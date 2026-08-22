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
 *
 * NOT_CONFIGURED in this environment:
 *   - Playwright is not installed/wired. This sandbox has no display and
 *     no permitted network path to download Playwright's browser
 *     binaries, so `launchBrowser()` below is a stub that throws
 *     NOT_CONFIGURED rather than pretending to drive a real browser.
 *   - There is no real VPS to connect to from this sandbox, so
 *     `connectToVps()` is a stub. Real wiring is: open a WebSocket/HTTP
 *     connection to VPS_API_URL, authenticate with DEVICE_ID +
 *     DEVICE_REFRESH_TOKEN against the Phase 1 `/auth/refresh` and
 *     `/devices` endpoints, then poll/subscribe for job authorizations.
 *
 * Everything below is real, runnable logic for the parts that do not
 * require a live browser or a live VPS - it is what a real connection
 * would drive.
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

export class LocalAgent {
  readonly authorizer = new PcAgentAuthorizer();
  readonly sessions = new BrowserSessionManager();
  readonly checkpoints: CheckpointManager;
  private browser: Browser | null = null;

  constructor(
    private readonly deviceId: string,
    private readonly agentVersion: string,
    private readonly chromiumPath: string | undefined = undefined,
    schemaVersion = 1,
  ) {
    this.checkpoints = new CheckpointManager({ schemaVersion, agentVersion, workflowVersion: null });
  }

  /** Real wiring point for connecting to the VPS. Still NOT_CONFIGURED:
   * this requires a running VPS-side agent process (WebSocket/HTTP auth
   * against /auth/refresh + /devices) that does not exist yet in this
   * repo. Wiring the browser locally (below) does not require this. */
  async connectToVps(): Promise<never> {
    throw new NotConfiguredError("VPS connection");
  }

  /** Launches a locally installed Chromium (e.g. Termux's `pkg install
   * chromium` on Android) via puppeteer-core. Requires CHROMIUM_PATH to
   * be set explicitly - fails closed rather than guessing a binary
   * path. `--no-sandbox` is required because Termux has no setuid
   * sandbox helper; this narrows isolation guarantees versus desktop
   * Chromium, which is a real tradeoff to be aware of, not a formality. */
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
      vpsConnection: "NOT_CONFIGURED",
      browserAutomation: this.chromiumPath ? "READY" : "NOT_CONFIGURED",
      activeSessions: this.browser ? 1 : 0,
      reportedAt: new Date(now).toISOString(),
    };
  }
}

if (process.env.NODE_ENV !== "test") {
  const config = loadLocalAgentConfig();
  const agent = new LocalAgent(config.DEVICE_ID, config.AGENT_VERSION, config.CHROMIUM_PATH);
  console.log(`[local-agent] started for device ${config.DEVICE_ID}. Health:`, agent.reportHealth());
  if (!config.CHROMIUM_PATH) {
    console.log("[local-agent] CHROMIUM_PATH not set - browser automation NOT_CONFIGURED. VPS connection is always NOT_CONFIGURED (unimplemented).");
  }
}

export const newAgentJobId = () => randomUUID();
