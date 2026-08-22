import { describe, it, expect } from "vitest";
import { detectReorg, applyReorgToActivity } from "../chain/reorg.js";
import type { OnChainActivity } from "@airdrop-os/types";

function makeActivity(overrides: Partial<OnChainActivity> = {}): OnChainActivity {
  return {
    activityId: "a1",
    chain: "ETHEREUM",
    wallet: "0xabc",
    type: "SWAP",
    transactionHash: "0xhash1",
    blockNumber: 100,
    timestamp: "2026-01-01T00:00:00.000Z",
    finality: "CONFIRMED",
    gasUsed: "21000",
    valueUsd: 100,
    attribution: null,
    supersededBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("reorg detection", () => {
  it("identifies exactly the activities within the reorged block range", () => {
    const activities = [
      makeActivity({ activityId: "in-range", blockNumber: 105 }),
      makeActivity({ activityId: "out-of-range", blockNumber: 200 }),
      makeActivity({ activityId: "other-chain", chain: "BASE", blockNumber: 105 }),
    ];
    const event = detectReorg({
      chain: "ETHEREUM",
      oldBlockHash: "0xold",
      newBlockHash: "0xnew",
      fromBlock: 100,
      toBlock: 110,
      activities,
    });
    expect(event.affectedActivityIds).toEqual(["in-range"]);
  });

  it("marks an activity REORGED without inventing new block/timestamp data", () => {
    const activity = makeActivity();
    const reorged = applyReorgToActivity(activity, "2026-01-02T00:00:00.000Z");
    expect(reorged.finality).toBe("REORGED");
    expect(reorged.blockNumber).toBe(activity.blockNumber); // untouched, not fabricated
    expect(reorged.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });
});
