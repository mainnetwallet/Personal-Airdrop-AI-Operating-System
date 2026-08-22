import type { TransactionFinality } from "@airdrop-os/types";

/**
 * Finality transitions. A transaction can be REORGED or DROPPED from
 * almost any non-terminal state (chains don't guarantee anything until
 * FINALIZED), and REPLACED only applies to PENDING (a replacement/
 * speed-up tx supersedes an unconfirmed one). FINALIZED is intentionally
 * NOT fully terminal - a sufficiently deep reorg (rare but real on some
 * chains) can still move it to REORGED; everything else is terminal
 * from FINALIZED.
 */
const TRANSITIONS: Record<TransactionFinality, TransactionFinality[]> = {
  PENDING: ["INCLUDED", "DROPPED", "REPLACED"],
  INCLUDED: ["CONFIRMED", "REORGED", "DROPPED"],
  CONFIRMED: ["FINALIZED", "REORGED"],
  FINALIZED: ["REORGED"],
  REORGED: ["PENDING", "INCLUDED"], // re-enters the mempool/chain after a reorg
  DROPPED: [],
  REPLACED: [],
};

export class InvalidFinalityTransitionError extends Error {
  constructor(from: TransactionFinality, to: TransactionFinality) {
    super(`Invalid finality transition: ${from} -> ${to}`);
    this.name = "InvalidFinalityTransitionError";
  }
}

export function canTransitionFinality(from: TransactionFinality, to: TransactionFinality): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidFinalityTransition(from: TransactionFinality, to: TransactionFinality): void {
  if (!canTransitionFinality(from, to)) {
    throw new InvalidFinalityTransitionError(from, to);
  }
}

/** Finality states from which any dependent eligibility/points/snapshot calc may safely treat the activity as real. */
export function isFinalitySafeForEligibility(state: TransactionFinality): boolean {
  return state === "CONFIRMED" || state === "FINALIZED";
}
