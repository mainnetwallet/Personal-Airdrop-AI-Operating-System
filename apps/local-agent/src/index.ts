import { randomUUID } from "node:crypto";
import puppeteer, { type Browser } from "puppeteer-core";
import {
  PcAgentAuthorizer,
  BrowserSessionManager,
  CheckpointManager,
} from "@airdrop-os/core";
import type { BrowserIsolationKey, BrowserMode } from "@airdrop-os/types";
import { loadLocalAgentConfig } from "./config.js";

/**
 * PHASE 6 STATUS - apps/local-agent
 *
 * IMPLEMENTED (and unit-tested via @airdrop-os/core):
 *   - job authorization/expiration checking (PcAgentAuthorizer)
 *   - browser session isolation bookkeeping (BrowserSessionManager)
 *   - checkpoint create/compatibility-check plumbing (CheckpointManager)
 *   - fail-closed local env config loading
 *   - connectToVps(): real HTTP auth handshake against the Phase 1
 *     `/auth/refresh` + `/devices` endpoints (rotates the refresh
 *     token, fetches this agent's device list). Fails closed on any
 *     network/auth error rather than pretending to be connected.
 *   - launchBrowser(): real puppeteer-core launch of a locally
 *     installed Chromium (e.g. Termux's `pkg install chromium`), gated
 *     on CHROMIUM_PATH.
 *
 * STILL NOT IMPLEMENTED (out of scope here, real limitations - not
 * things a config change can fix):
 *   - There is no "poll/subscribe for job authorizations" endpoint in
 *     the API yet. connectToVps() authenticates and lists devices; it
 *     does not receive or execute remote job commands.
 *   - launchBrowser()'s Chromium has no browser-extension support, so
 *     wallet extensions (MetaMask, etc.) will not load in it.
 *   - No CAPTCHA/anti-bot bypass is implemented, and none should be
 *     added - see README security posture.
 */

export class NotConfiguredError extends Error {
  constructor(feature: string) {
    super(`${feature} is NOT_CONFIGURED in this environment`);
    this.name = "NotConfiguredError";
  }
}

export interface LocalAgentHealth {
  agentVersion: string;
  deviceId: string;
  vpsConnection: "NOT_CONFIGURED" | "CONNECTED" | "DEGRADED";
  browserAutomation: "NOT_CONFIGURED" | "READY";
  activeSessions: number;
  reportedAt: string;
}

export interface DeviceInfo {
  id: string;
  type: string;
  status: string;
  [key: string]: unknown;
}

export interface VpsConnection {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  scope: string[];
  devices: DeviceInfo[];
}

export class LocalAgent {
  readonly authorizer = new PcAgentAuthorizer();
  readonly sessions = new BrowserSessionManager();
  readonly checkpoints: CheckpointManager;
  private browser: Browser | null = null;
  private vps: VpsConnection | null = null;

  constructor(
    private readonly deviceId: string,
    private readonly agentVersion: string,
    private readonly vpsApiUrl: string | undefined = undefined,
    private readonly deviceRefreshToken: string | undefined = undefined,
    private readonly chromiumPath: string | undefined = undefined,
    schemaVersion = 1,
  ) {
    this.checkpoints = new CheckpointManager({ schemaVersion, agentVersion, workflowVersion: null });
  }

  /** Authenticates against the VPS API's /auth/refresh, then fetches
   * this agent's device list from /devices. Requires VPS_API_URL and
   * DEVICE_REFRESH_TOKEN - fails closed (throws) rather than reporting
   * a fake CONNECTED state if either is missing or the request fails.
   * Does NOT poll/receive job authorizations - no such endpoint exists
   * in the API yet; that remains future work. */
  async connectToVps(): Promise<VpsConnection> {
    if (!this.vpsApiUrl || !this.deviceRefreshToken) {
      throw new NotConfiguredError("VPS connection (VPS_API_URL / DEVICE_REFRESH_TOKEN not set)");
    }

    const refreshRes = await fetch(new URL("/auth/refresh", this.vpsApiUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: this.deviceRefreshToken }),
    });
    if (!refreshRes.ok) {
      throw new Error(`VPS auth/refresh failed: ${refreshRes.status} ${await refreshRes.text()}`);
    }
    const refreshBody = (await refreshRes.json()) as {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: number;
      scope: string[];
    };

    const devicesRes = await fetch(new URL("/devices", this.vpsApiUrl), {
      headers: { authorization: `Bearer ${refreshBody.accessToken}` },
    });
    if (!devicesRes.ok) {
      throw new Error(`VPS /devices fetch failed: ${devicesRes.status} ${await devicesRes.text()}`);
    }
    const devicesBody = (await devicesRes.json()) as { devices: DeviceInfo[] };

    this.vps = {
      accessToken: refreshBody.accessToken,
      refreshToken: refreshBody.refreshToken,
      accessTokenExpiresAt: refreshBody.accessTokenExpiresAt,
      scope: refreshBody.scope,
      devices: devicesBody.devices,
    };
    return this.vps;
  }

  /** Launches a locally installed Chromium (e.g. Termux's `pkg install
   * chromium` on Android) via puppeteer-core. Requires CHROMIUM_PATH to
   * be set explicitly - fails closed rather than guessing a binary
   * path. `--no-sandbox` is required because Termux has no setuid
   * sandbox helper; this narrows isolation guarantees versus desktop
   * Chromium, which is a real tradeoff to be aware of, not a formality.
   * Note: this Chromium has no extension support, so wallet extensions
   * will not load here. */
  async launchBrowser(_isolation: BrowserIsolationKey, _mode: BrowserMode): Promise<Browser> {
    if (!this.chromiumPath) {
      throw new NotConfiguredError("Browser automation (CHROMIUM_PATH not set)");
    }
    if (this.browser) return this.browser;
    this.browser = await puppeteer.launch({
      executablePath: this.chromiumPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    return this.browser;
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  reportHealth(now: number = Date.now()): LocalAgentHealth {
    return {
      agentVersion: this.agentVersion,
      deviceId: this.deviceId,
      vpsConnection: this.vps ? "CONNECTED" : "NOT_CONFIGURED",
      browserAutomation: this.chromiumPath ? "READY" : "NOT_CONFIGURED",
      activeSessions: this.browser ? 1 : 0,
      reportedAt: new Date(now).toISOString(),
    };
  }
}

if (process.env.NODE_ENV !== "test") {
  const config = loadLocalAgentConfig();
  const agent = new LocalAgent(
    config.DEVICE_ID,
    config.AGENT_VERSION,
    config.VPS_API_URL,
    config.DEVICE_REFRESH_TOKEN,
    config.CHROMIUM_PATH,
  );
  console.log(`[local-agent] started for device ${config.DEVICE_ID}. Health:`, agent.reportHealth());
  if (!config.CHROMIUM_PATH) {
    console.log("[local-agent] CHROMIUM_PATH not set - browser automation NOT_CONFIGURED.");
  }
  agent.connectToVps().catch((err) => {
    console.log(`[local-agent] VPS connect failed (non-fatal at startup): ${(err as Error).message}`);
  });
}

export const newAgentJobId = () => randomUUID();
