import { randomUUID } from "node:crypto";
import {
  PcAgentAuthorizer,
  BrowserSessionManager,
  CheckpointManager,
  type BrowserIsolationKey,
  type BrowserMode,
} from "@airdrop-os/core";
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

  constructor(private readonly deviceId: string, private readonly agentVersion: string, schemaVersion = 1) {
    this.checkpoints = new CheckpointManager({ schemaVersion, agentVersion, workflowVersion: null });
  }

  /** Real wiring point for connecting to the VPS. NOT_CONFIGURED here
   * because no VPS is reachable from this sandbox - see the module
   * docstring for what a real implementation does. */
  async connectToVps(): Promise<never> {
    throw new NotConfiguredError("VPS connection");
  }

  /** Real wiring point for launching a Playwright-controlled browser.
   * NOT_CONFIGURED here because Playwright's browser binaries cannot be
   * downloaded in this sandbox's network configuration. */
  async launchBrowser(_isolation: BrowserIsolationKey, _mode: BrowserMode): Promise<never> {
    throw new NotConfiguredError("Playwright browser automation");
  }

  reportHealth(now: number = Date.now()): LocalAgentHealth {
    return {
      agentVersion: this.agentVersion,
      deviceId: this.deviceId,
      vpsConnection: "NOT_CONFIGURED",
      browserAutomation: "NOT_CONFIGURED",
      activeSessions: 0,
      reportedAt: new Date(now).toISOString(),
    };
  }
}

if (process.env.NODE_ENV !== "test") {
  const config = loadLocalAgentConfig();
  const agent = new LocalAgent(config.DEVICE_ID, config.AGENT_VERSION);
  console.log(`[local-agent] started for device ${config.DEVICE_ID}. Health:`, agent.reportHealth());
  console.log("[local-agent] VPS connection and browser automation are NOT_CONFIGURED - see src/index.ts.");
}

export const newAgentJobId = () => randomUUID();
