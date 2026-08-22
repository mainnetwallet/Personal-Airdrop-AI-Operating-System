import { randomUUID } from "node:crypto";
import type { SnapshotProof, EligibilityState, ClaimConfidence } from "@airdrop-os/types";

export interface BuildSnapshotProofInput {
  projectId: string;
  campaignId?: string | null;
  snapshotBlock: number;
  snapshotTimestamp: string;
  wallet: string;
  asset?: string | null;
  balance?: string | null;
  requirementId?: string | null;
  requirementVersion?: number | null;
  result: EligibilityState;
  evidence: string[];
  confidence: ClaimConfidence;
}

/**
 * Builds an immutable snapshot proof record. Every field that could be
 * asserted vaguely instead ties back to a concrete block + timestamp +
 * requirement version + evidence ids, so a proof can be independently
 * re-verified later rather than trusted on the agent's word alone.
 */
export function buildSnapshotProof(input: BuildSnapshotProofInput, now: string = new Date().toISOString()): SnapshotProof {
  if (input.evidence.length === 0) {
    throw new Error("A snapshot proof must cite at least one piece of evidence");
  }
  return {
    snapshotProofId: randomUUID(),
    projectId: input.projectId,
    campaignId: input.campaignId ?? null,
    snapshotBlock: input.snapshotBlock,
    snapshotTimestamp: input.snapshotTimestamp,
    wallet: input.wallet,
    asset: input.asset ?? null,
    balance: input.balance ?? null,
    requirementId: input.requirementId ?? null,
    requirementVersion: input.requirementVersion ?? null,
    result: input.result,
    evidence: input.evidence,
    confidence: input.confidence,
    generatedAt: now,
  };
}
