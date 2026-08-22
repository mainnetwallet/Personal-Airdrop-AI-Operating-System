import { describe, it, expect } from "vitest";
import { BrowserSessionManager } from "../agent/browserSession.js";
import type { BrowserIsolationKey } from "@airdrop-os/types";

function key(overrides: Partial<BrowserIsolationKey> = {}): BrowserIsolationKey {
  return {
    projectId: "proj-1",
    campaignId: null,
    missionId: null,
    wallet: "0xabc",
    account: null,
    browserProfile: "profile-1",
    chain: "ethereum",
    deviceId: "dev-1",
    ...overrides,
  };
}

describe("BrowserSessionManager", () => {
  it("opens a session with the given isolation key", () => {
    const mgr = new BrowserSessionManager();
    const session = mgr.open({ sessionId: "s1", mode: "CONTROLLED_BROWSER", isolation: key(), now: 0 });
    expect(session.status).toBe("OPEN");
  });

  it("refuses to open a second OPEN session for the identical isolation key", () => {
    const mgr = new BrowserSessionManager();
    mgr.open({ sessionId: "s1", mode: "CONTROLLED_BROWSER", isolation: key() });
    expect(() => mgr.open({ sessionId: "s2", mode: "CONTROLLED_BROWSER", isolation: key() })).toThrow();
  });

  it("allows opening a new session once the old one for that isolation key is closed", () => {
    const mgr = new BrowserSessionManager();
    mgr.open({ sessionId: "s1", mode: "CONTROLLED_BROWSER", isolation: key() });
    mgr.setStatus("s1", "CLOSED");
    expect(() => mgr.open({ sessionId: "s2", mode: "CONTROLLED_BROWSER", isolation: key() })).not.toThrow();
  });

  it("does not consider sessions with different wallets to share isolation", () => {
    const mgr = new BrowserSessionManager();
    mgr.open({ sessionId: "s1", mode: "CONTROLLED_BROWSER", isolation: key({ wallet: "0xaaa" }) });
    mgr.open({ sessionId: "s2", mode: "CONTROLLED_BROWSER", isolation: key({ wallet: "0xbbb" }) });
    expect(mgr.shareIsolation("s1", "s2")).toBe(false);
  });

  it("marks CRASHED sessions closed with a timestamp", () => {
    const mgr = new BrowserSessionManager();
    mgr.open({ sessionId: "s1", mode: "USER_BROWSER_EXTENSION", isolation: key() });
    const updated = mgr.setStatus("s1", "CRASHED", 5000);
    expect(updated.closedAt).toBe(new Date(5000).toISOString());
  });
});
