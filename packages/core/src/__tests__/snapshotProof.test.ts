import { describe, it, expect } from "vitest";
import { buildSnapshotProof } from "../chain/snapshotProof.js";

describe("buildSnapshotProof", () => {
  it("builds a proof citing block, timestamp, wallet, and evidence", () => {
    const proof = buildSnapshotProof({
      projectId: "proj-1",
      snapshotBlock: 12345,
      snapshotTimestamp: "2026-01-01T00:00:00.000Z",
      wallet: "0xabc",
      asset: "USDC",
      balance: "500",
      result: "QUALIFIED",
      evidence: ["hist-record-1"],
      confidence: "VERIFIED",
    });
    expect(proof.snapshotBlock).toBe(12345);
    expect(proof.evidence).toEqual(["hist-record-1"]);
  });

  it("refuses to build a proof with no evidence at all", () => {
    expect(() =>
      buildSnapshotProof({
        projectId: "proj-1",
        snapshotBlock: 1,
        snapshotTimestamp: "x",
        wallet: "0xabc",
        result: "QUALIFIED",
        evidence: [],
        confidence: "VERIFIED",
      })
    ).toThrow();
  });
});
