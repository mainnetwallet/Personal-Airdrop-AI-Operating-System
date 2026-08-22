import { describe, it, expect } from "vitest";
import { RpcManager } from "../chain/rpcManager.js";

function setup() {
  const mgr = new RpcManager();
  mgr.registerProvider({ providerId: "eth-primary", chain: "ETHEREUM", role: "PRIMARY", url: "https://primary.example" });
  mgr.registerProvider({ providerId: "eth-backup", chain: "ETHEREUM", role: "BACKUP", url: "https://backup.example" });
  mgr.registerProvider({ providerId: "eth-backup2", chain: "ETHEREUM", role: "BACKUP2", url: null }); // NOT_CONFIGURED
  return mgr;
}

describe("RpcManager", () => {
  it("selects the primary provider when healthy", () => {
    const mgr = setup();
    expect(mgr.selectProvider("ETHEREUM")).toBe("eth-primary");
  });

  it("reports a provider with no url as NOT_CONFIGURED, never fabricated healthy", () => {
    const mgr = setup();
    expect(mgr.getState("eth-backup2").health).toBe("NOT_CONFIGURED");
  });

  it("falls over to backup once primary's circuit opens", () => {
    const mgr = setup();
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      mgr.recordFailure({ providerId: "eth-primary", error: "timeout" }, now);
    }
    expect(mgr.getState("eth-primary").health).toBe("CIRCUIT_OPEN");
    expect(mgr.selectProvider("ETHEREUM", now)).toBe("eth-backup");
  });

  it("half-opens the circuit after the reset window and allows a trial call", () => {
    const mgr = setup();
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) mgr.recordFailure({ providerId: "eth-primary", error: "timeout" }, t0);
    expect(mgr.selectProvider("ETHEREUM", t0)).toBe("eth-backup");
    const later = t0 + 61_000;
    expect(mgr.selectProvider("ETHEREUM", later)).toBe("eth-primary");
  });

  it("returns null when every provider for a chain is unusable", () => {
    const mgr = new RpcManager();
    mgr.registerProvider({ providerId: "x", chain: "BASE", role: "PRIMARY", url: null });
    expect(mgr.selectProvider("BASE")).toBeNull();
  });

  it("marks a provider rate-limited and skips it until the window expires", () => {
    const mgr = setup();
    const now = Date.now();
    mgr.recordFailure({ providerId: "eth-primary", error: "429", rateLimited: true }, now);
    expect(mgr.selectProvider("ETHEREUM", now)).toBe("eth-backup");
    expect(mgr.selectProvider("ETHEREUM", now + 11_000)).toBe("eth-primary");
  });

  it("tracks latency and marks DEGRADED on slow but successful calls", () => {
    const mgr = setup();
    mgr.recordSuccess({ providerId: "eth-primary", latencyMs: 4000 });
    expect(mgr.getState("eth-primary").health).toBe("DEGRADED");
    mgr.recordSuccess({ providerId: "eth-primary", latencyMs: 100 });
    expect(mgr.getState("eth-primary").health).toBe("HEALTHY");
  });
});
