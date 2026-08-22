import { randomUUID } from "node:crypto";
import type { ReorgEvent, OnChainActivity, ChainId } from "@airdrop-os/types";

/**
 * Builds a reorg event and computes exactly which activities are
 * affected (those in the reorged block range on the given chain).
 * Does not mutate the activities itself - callers must explicitly
 * recalculate finality/eligibility/snapshots for every affected
 * activity, because silently leaving them as CONFIRMED after a reorg
 * would be a correctness and security bug (stale eligibility proofs).
 */
export function detectReorg(params: {
  chain: ChainId;
  oldBlockHash: string;
  newBlockHash: string;
  fromBlock: number;
  toBlock: number;
  activities: OnChainActivity[];
  now?: string;
}): ReorgEvent {
  const affected = params.activities.filter(
    (a) =>
      a.chain === params.chain &&
      a.blockNumber !== null &&
      a.blockNumber >= params.fromBlock &&
      a.blockNumber <= params.toBlock
  );

  return {
    reorgId: randomUUID(),
    chain: params.chain,
    detectedAt: params.now ?? new Date().toISOString(),
    oldBlockHash: params.oldBlockHash,
    newBlockHash: params.newBlockHash,
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
    affectedActivityIds: affected.map((a) => a.activityId),
  };
}

/**
 * Applies a reorg to a single activity: marks it REORGED and clears the
 * fields that are no longer trustworthy (block number, timestamp,
 * finality-dependent confidence). The caller is responsible for
 * re-ingesting the activity from the new canonical chain state and
 * re-running eligibility/snapshot calculations that depended on it -
 * this function only ever marks-as-reorged, it never re-derives a new
 * "current" value out of thin air.
 */
export function applyReorgToActivity(activity: OnChainActivity, now: string = new Date().toISOString()): OnChainActivity {
  return {
    ...activity,
    finality: "REORGED",
    updatedAt: now,
  };
}
