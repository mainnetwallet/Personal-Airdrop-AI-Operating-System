import type { BrowserSession, BrowserIsolationKey, BrowserMode, BrowserSessionStatus } from "@airdrop-os/types";

function isolationSignature(key: BrowserIsolationKey): string {
  return [key.projectId, key.campaignId, key.missionId, key.wallet, key.account, key.browserProfile, key.chain, key.deviceId]
    .map((v) => v ?? "\0null")
    .join("|");
}

/**
 * Owns browser session lifecycle for both CONTROLLED_BROWSER (PC agent
 * driving Playwright) and USER_BROWSER_EXTENSION (Chrome extension riding
 * along with the user's own browser) modes. Sessions are isolated: two
 * sessions are only ever considered the same context if EVERY field of
 * the isolation key matches, so a task running for wallet A / project X
 * can never observe or reuse state from wallet B / project Y.
 */
export class BrowserSessionManager {
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly bySignature = new Map<string, string>(); // signature -> open sessionId

  open(params: { sessionId: string; mode: BrowserMode; isolation: BrowserIsolationKey; now?: number }): BrowserSession {
    const signature = isolationSignature(params.isolation);
    const existingId = this.bySignature.get(signature);
    if (existingId) {
      const existing = this.sessions.get(existingId);
      if (existing && existing.status === "OPEN") {
        throw new Error(`An OPEN session already exists for this isolation context: ${existingId}`);
      }
    }
    const now = params.now ?? Date.now();
    const session: BrowserSession = {
      sessionId: params.sessionId,
      mode: params.mode,
      isolation: params.isolation,
      status: "OPEN",
      openedAt: new Date(now).toISOString(),
      closedAt: null,
    };
    this.sessions.set(session.sessionId, session);
    this.bySignature.set(signature, session.sessionId);
    return session;
  }

  get(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  setStatus(sessionId: string, status: BrowserSessionStatus, now: number = Date.now()): BrowserSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Unknown session: ${sessionId}`);
    session.status = status;
    if (status === "CLOSED" || status === "CRASHED") session.closedAt = new Date(now).toISOString();
    return session;
  }

  /** True only if both sessions share an identical isolation key - used to
   * decide whether a workflow step may reuse another session's state. */
  shareIsolation(sessionIdA: string, sessionIdB: string): boolean {
    const a = this.sessions.get(sessionIdA);
    const b = this.sessions.get(sessionIdB);
    if (!a || !b) return false;
    return isolationSignature(a.isolation) === isolationSignature(b.isolation);
  }
}
