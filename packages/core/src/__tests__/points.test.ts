import { describe, it, expect } from "vitest";
import { PointsLedger, resolveRank, applyDecay } from "../chain/points.js";

describe("PointsLedger", () => {
  it("sums entries with multipliers applied", () => {
    const ledger = new PointsLedger();
    ledger.record({ agentId: "a1", projectId: "p1", seasonId: null, epochId: null, unit: "POINTS", amount: 100, multiplier: 1, reason: "quest", sourceActivityId: null });
    ledger.record({ agentId: "a1", projectId: "p1", seasonId: null, epochId: null, unit: "POINTS", amount: 50, multiplier: 2, reason: "boosted quest", sourceActivityId: null });
    expect(ledger.total({ agentId: "a1", projectId: "p1", unit: "POINTS" })).toBe(200); // 100*1 + 50*2
  });

  it("keeps POINTS and XP as separate totals - points != token, and units don't mix", () => {
    const ledger = new PointsLedger();
    ledger.record({ agentId: "a1", projectId: "p1", seasonId: null, epochId: null, unit: "POINTS", amount: 100, multiplier: 1, reason: "x", sourceActivityId: null });
    ledger.record({ agentId: "a1", projectId: "p1", seasonId: null, epochId: null, unit: "XP", amount: 30, multiplier: 1, reason: "x", sourceActivityId: null });
    expect(ledger.total({ agentId: "a1", projectId: "p1", unit: "POINTS" })).toBe(100);
    expect(ledger.total({ agentId: "a1", projectId: "p1", unit: "XP" })).toBe(30);
  });

  it("retains full history rather than a mutable running total", () => {
    const ledger = new PointsLedger();
    ledger.record({ agentId: "a1", projectId: "p1", seasonId: null, epochId: null, unit: "POINTS", amount: 10, multiplier: 1, reason: "x", sourceActivityId: null });
    ledger.record({ agentId: "a1", projectId: "p1", seasonId: null, epochId: null, unit: "POINTS", amount: 10, multiplier: 1, reason: "y", sourceActivityId: null });
    expect(ledger.history("a1", "p1")).toHaveLength(2);
  });

  it("builds a leaderboard sorted descending by total", () => {
    const ledger = new PointsLedger();
    ledger.record({ agentId: "a1", projectId: "p1", seasonId: "s1", epochId: null, unit: "POINTS", amount: 50, multiplier: 1, reason: "x", sourceActivityId: null });
    ledger.record({ agentId: "a2", projectId: "p1", seasonId: "s1", epochId: null, unit: "POINTS", amount: 200, multiplier: 1, reason: "x", sourceActivityId: null });
    const board = ledger.leaderboard({ projectId: "p1", unit: "POINTS", seasonId: "s1" });
    expect(board[0].agentId).toBe("a2");
    expect(board[1].agentId).toBe("a1");
  });
});

describe("resolveRank", () => {
  const thresholds = [
    { rank: "BRONZE", minTotal: 0 },
    { rank: "SILVER", minTotal: 100 },
    { rank: "GOLD", minTotal: 500 },
  ];

  it("resolves the highest rank the total qualifies for", () => {
    expect(resolveRank(50, thresholds)).toBe("BRONZE");
    expect(resolveRank(150, thresholds)).toBe("SILVER");
    expect(resolveRank(1000, thresholds)).toBe("GOLD");
  });

  it("returns null when below every threshold", () => {
    expect(resolveRank(-5, [{ rank: "BRONZE", minTotal: 0 }])).toBe(null);
  });
});

describe("applyDecay", () => {
  it("produces a negative entry proportional to decay rate, not a mutation", () => {
    const decay = applyDecay({
      agentId: "a1", projectId: "p1", unit: "POINTS", seasonId: null, epochId: null,
      currentTotal: 200, decayRate: 0.1,
    });
    expect(decay.amount).toBe(-20);
  });

  it("rejects a decay rate outside 0..1", () => {
    expect(() =>
      applyDecay({ agentId: "a1", projectId: "p1", unit: "POINTS", seasonId: null, epochId: null, currentTotal: 100, decayRate: 1.5 })
    ).toThrow();
  });
});
