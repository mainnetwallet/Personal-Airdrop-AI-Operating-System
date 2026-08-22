import type {
  Eip7702Authorization,
  Eip7702DelegationDiff,
  Eip7702RiskResult,
  Eip7702TargetIntelligence,
  TxBlockReason,
} from "@airdrop-os/types";

/**
 * Phase 7: EIP-7702 delegation risk.
 *
 * EIP-7702 lets an EOA delegate its code to a contract. This is treated
 * as HIGH-RISK by construction: an unknown target is BLOCKed by default,
 * a chain mismatch between the authorization/current/intended chain is
 * always BLOCKed, and the delegation diff is always surfaced so the
 * caller can show current-vs-proposed before any signature is requested.
 * Nothing here ever signs, submits, or silently approves a delegation.
 */

export function checkChainLock(authorization: Eip7702Authorization): boolean {
  return (
    authorization.chainId === authorization.currentChainId &&
    authorization.chainId === authorization.intendedChainId
  );
}

export function buildDelegationDiff(
  authorization: Eip7702Authorization,
  currentTarget: string | null,
  currentPermissions: string[],
  proposedPermissions: string[],
  affectedAssets: string[],
  upgradeabilityChanged: boolean,
): Eip7702DelegationDiff {
  return {
    currentTarget,
    proposedTarget: authorization.targetAddress,
    currentPermissions,
    proposedPermissions,
    affectedAssets,
    upgradeabilityChanged,
  };
}

export interface Eip7702EvaluationInput {
  authorization: Eip7702Authorization;
  targetIntelligence: Eip7702TargetIntelligence | null;
  delegationDiff: Eip7702DelegationDiff | null;
  /** Explicit user intent to delegate to this exact target - never inferred. */
  userIntentConfirmed: boolean;
}

export function evaluateEip7702(input: Eip7702EvaluationInput): Eip7702RiskResult {
  const { authorization } = input;
  const blockReasons: TxBlockReason[] = [];

  const chainLockOk = checkChainLock(authorization);
  if (!chainLockOk) {
    blockReasons.push("EIP7702_CHAIN_MISMATCH");
  }

  const targetKnown =
    input.targetIntelligence !== null &&
    input.targetIntelligence.implementationKnown &&
    input.targetIntelligence.sourceStatus === "CONNECTED" &&
    input.targetIntelligence.initializationVerified;

  if (!targetKnown) {
    // Unknown target => BLOCK BY DEFAULT, no exceptions.
    blockReasons.push("EIP7702_UNKNOWN_TARGET");
  }

  if (!input.userIntentConfirmed) {
    blockReasons.push("EIP7702_UNKNOWN_TARGET");
  }

  const verdict: Eip7702RiskResult["verdict"] = blockReasons.length > 0 ? "BLOCK" : "NEEDS_USER_REVIEW";

  return {
    authorization,
    chainLockOk,
    targetKnown,
    verdict,
    blockReasons: Array.from(new Set(blockReasons)),
    delegationDiff: input.delegationDiff,
    evaluatedAt: new Date().toISOString(),
  };
}
