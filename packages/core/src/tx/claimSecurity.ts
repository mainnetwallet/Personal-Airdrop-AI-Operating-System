import { randomUUID } from "node:crypto";
import type {
  ApprovalCheckResult,
  ClaimSecurityCheck,
  ContractIntelligenceReport,
  DomainCheckResult,
  SimulationFreshnessCheck,
  TxBlockReason,
  TxRiskAssessment,
} from "@airdrop-os/types";

/**
 * Phase 7: Claim security.
 *
 * A "claim" (e.g. an airdrop claim transaction) is only verified when
 * every one of these checks explicitly passed - any missing or negative
 * check produces a BLOCK, never a default ALLOW.
 */

export interface ClaimSecurityInput {
  officialSourceVerified: boolean;
  domainCheck: DomainCheckResult | null;
  contractCheck: ContractIntelligenceReport | null;
  chainVerified: boolean;
  functionVerified: boolean;
  recipientVerified: boolean;
  tokenVerified: boolean;
  approvalCheck: ApprovalCheckResult | null;
  simulationCheck: SimulationFreshnessCheck | null;
  riskAssessment: TxRiskAssessment | null;
}

export function verifyClaimSecurity(input: ClaimSecurityInput): ClaimSecurityCheck {
  const blockReasons: TxBlockReason[] = [];

  if (!input.officialSourceVerified) blockReasons.push("FAKE_CLAIM");
  if (input.domainCheck && input.domainCheck.verdict !== "SAFE") {
    blockReasons.push(input.domainCheck.verdict === "BLOCK" ? "SUSPICIOUS_DOMAIN" : "SUSPICIOUS_DOMAIN");
  }
  if (!input.domainCheck) blockReasons.push("SUSPICIOUS_DOMAIN");
  if (!input.contractCheck || input.contractCheck.status !== "CONNECTED") blockReasons.push("UNKNOWN_CONTRACT");
  if (!input.chainVerified) blockReasons.push("WRONG_CHAIN");
  if (!input.recipientVerified) blockReasons.push("WRONG_RECIPIENT");
  if (!input.functionVerified || !input.tokenVerified) blockReasons.push("UNSAFE_PERMISSION");
  if (!input.approvalCheck || input.approvalCheck.ok !== true) blockReasons.push("STALE_APPROVAL");
  if (!input.simulationCheck || !input.simulationCheck.fresh) blockReasons.push("STALE_SIMULATION");
  if (!input.riskAssessment || input.riskAssessment.level === "HIGH" || input.riskAssessment.level === "CRITICAL") {
    blockReasons.push("DANGEROUS_APPROVAL");
  }

  const uniqueReasons = Array.from(new Set(blockReasons));
  const verdict: ClaimSecurityCheck["verdict"] =
    uniqueReasons.length === 0
      ? "ALLOW"
      : uniqueReasons.some((r) => ["FAKE_CLAIM", "WRONG_CHAIN", "WRONG_RECIPIENT", "UNKNOWN_CONTRACT"].includes(r))
        ? "BLOCK"
        : "NEEDS_USER_REVIEW";

  return {
    claimId: randomUUID(),
    officialSourceVerified: input.officialSourceVerified,
    domainCheck: input.domainCheck,
    contractCheck: input.contractCheck,
    chainVerified: input.chainVerified,
    functionVerified: input.functionVerified,
    recipientVerified: input.recipientVerified,
    tokenVerified: input.tokenVerified,
    approvalCheck: input.approvalCheck,
    simulationCheck: input.simulationCheck,
    riskAssessment: input.riskAssessment,
    verdict,
    blockReasons: uniqueReasons,
    evaluatedAt: new Date().toISOString(),
  };
}
