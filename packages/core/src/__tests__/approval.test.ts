import { describe, it, expect } from "vitest";
import { ApprovalStore } from "../tx/approval.js";

describe("ApprovalStore", () => {
  it("allows a fresh, matching, unexpired approval exactly once", () => {
    const store = new ApprovalStore();
    const approval = store.create({ walletAddress: "0xW", chainId: 1, intentHash: "0xhash", ttlMs: 60_000 });
    const result = store.checkAndConsume(approval.approvalId, "0xhash");
    expect(result.ok).toBe(true);
  });

  it("blocks reuse of an already-consumed approval", () => {
    const store = new ApprovalStore();
    const approval = store.create({ walletAddress: "0xW", chainId: 1, intentHash: "0xhash", ttlMs: 60_000 });
    store.checkAndConsume(approval.approvalId, "0xhash");
    const second = store.checkAndConsume(approval.approvalId, "0xhash");
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("STALE_APPROVAL");
  });

  it("blocks an expired approval", () => {
    const store = new ApprovalStore();
    const approval = store.create({ walletAddress: "0xW", chainId: 1, intentHash: "0xhash", ttlMs: 1000 });
    const later = new Date(Date.now() + 5000);
    const result = store.checkAndConsume(approval.approvalId, "0xhash", later);
    expect(result.ok).toBe(false);
  });

  it("blocks when the intent hash does not match the bound approval", () => {
    const store = new ApprovalStore();
    const approval = store.create({ walletAddress: "0xW", chainId: 1, intentHash: "0xhash", ttlMs: 60_000 });
    const result = store.checkAndConsume(approval.approvalId, "0xdifferent-hash");
    expect(result.ok).toBe(false);
  });

  it("blocks a revoked approval", () => {
    const store = new ApprovalStore();
    const approval = store.create({ walletAddress: "0xW", chainId: 1, intentHash: "0xhash", ttlMs: 60_000 });
    store.revoke(approval.approvalId);
    const result = store.checkAndConsume(approval.approvalId, "0xhash");
    expect(result.ok).toBe(false);
  });

  it("blocks an unknown approval id", () => {
    const store = new ApprovalStore();
    const result = store.checkAndConsume("does-not-exist", "0xhash");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NOT_FOUND");
  });
});
