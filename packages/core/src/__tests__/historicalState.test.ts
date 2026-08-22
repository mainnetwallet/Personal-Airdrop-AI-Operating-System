import { describe, it, expect } from "vitest";
import { HistoricalStateStore, HistoricalStateNotFoundError } from "../chain/historicalState.js";

describe("HistoricalStateStore", () => {
  it("returns exactly the recorded state for a wallet+block+kind", () => {
    const store = new HistoricalStateStore();
    store.record({ chain: "ETHEREUM", wallet: "0xabc", block: 100, blockTimestamp: "2026-01-01T00:00:00.000Z", kind: "BALANCE", data: { usd: 500 } });
    const record = store.getAt("0xabc", 100, "BALANCE");
    expect(record.data).toEqual({ usd: 500 });
  });

  it("throws rather than substituting current or nearby state for a missing block", () => {
    const store = new HistoricalStateStore();
    store.record({ chain: "ETHEREUM", wallet: "0xabc", block: 100, blockTimestamp: "x", kind: "BALANCE", data: {} });
    expect(() => store.getAt("0xabc", 999, "BALANCE")).toThrow(HistoricalStateNotFoundError);
  });

  it("invalidates records within a reorged range instead of deleting them", () => {
    const store = new HistoricalStateStore();
    const r1 = store.record({ chain: "ETHEREUM", wallet: "0xabc", block: 105, blockTimestamp: "x", kind: "BALANCE", data: {} });
    const invalidated = store.invalidateForReorg("reorg-1", "ETHEREUM", 100, 110);
    expect(invalidated).toHaveLength(1);
    expect(invalidated[0].recordId).toBe(r1.recordId);
    expect(invalidated[0].invalidatedByReorgId).toBe("reorg-1");
    // getAt no longer returns an invalidated record
    expect(() => store.getAt("0xabc", 105, "BALANCE")).toThrow();
    // but the record is still retained in `all()`, not deleted
    expect(store.all()).toHaveLength(1);
  });
});
