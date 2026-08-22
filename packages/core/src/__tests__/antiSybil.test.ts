import { describe, it, expect } from "vitest";
import { AntiSybilAwarenessStore } from "../tx/antiSybil.js";

describe("AntiSybilAwarenessStore", () => {
  it("records signals scoped to a wallet and reports them back", () => {
    const store = new AntiSybilAwarenessStore();
    store.record("0xWalletA", "SHARED_FUNDING_SOURCE", "Funded from same faucet tx as 3 other wallets", "LIKELY");
    store.record("0xWalletB", "SHARED_FUNDING_SOURCE", "Unrelated wallet", "UNCERTAIN");

    const report = store.report("0xWalletA");
    expect(report.signals).toHaveLength(1);
    expect(report.signals[0].walletAddress).toBe("0xWalletA");
  });

  it("always carries the fixed awareness-only note", () => {
    const store = new AntiSybilAwarenessStore();
    const report = store.report("0xWalletA");
    expect(report.note).toBe("AWARENESS_ONLY_NEVER_BYPASSES_PLATFORM_PROTECTIONS");
  });
});
