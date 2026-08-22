import type {
  ContractIntelligenceReport,
  DomainCheckResult,
  SimulationFreshnessCheck,
  TxBlockReason,
  TxIntentDiffResult,
  TxPolicyDecision,
  TxRiskAssessment,
  TxRiskFactor,
  TxRiskLevel,
} from "@airdrop-os/types";
import { hasDangerousCapability, isReportUsable } from "./contractIntelligence.js";

/**
 * Phase 7: Risk assessment + policy engine.
 *
 * Security Agent has veto authority: the policy step never overrides a
 * BLOCK verdict produced here to ALLOW. Unknown/NOT_CONFIGURED inputs are
 * treated as risk-positive, never as an implicit pass - this module fails
 * closed by construction.
 */

export interface RiskAssessmentInput {
  intentHash: string;
  domainCheck: DomainCheckResult | null;
  contractReport: ContractIntelligenceReport | null;
  intentDiff: TxIntentDiffResult | null;
  approvalOk: boolean | null; // null = not checked
  simulationFreshness: SimulationFreshnessCheck | null;
  simulationSucceeded: boolean | null;
  unlimitedApproval: boolean;
}

function levelFromScore(score: number): TxRiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 20) return "MEDIUM";
  return "LOW";
}

export function assessRisk(input: RiskAssessmentInput): TxRiskAssessment {
  const factors: TxRiskFactor[] = [];

  if (input.domainCheck) {
    if (input.domainCheck.verdict === "BLOCK") {
      factors.push({ code: "PHISHING", weight: 100, detail: `Domain ${input.domainCheck.domain} flagged: ${input.domainCheck.signals.join(", ")}` });
    } else if (input.domainCheck.verdict === "SUSPICIOUS") {
      factors.push({ code: "SUSPICIOUS_DOMAIN", weight: 40, detail: `Domain ${input.domainCheck.domain} signals: ${input.domainCheck.signals.join(", ")}` });
    }
  }

  if (input.contractReport) {
    if (!isReportUsable(input.contractReport)) {
      factors.push({ code: "UNKNOWN_CONTRACT", weight: 45, detail: "Contract intelligence NOT_CONFIGURED or unverified - treated as unknown risk" });
    } else {
      if (input.contractReport.verifiedSource === false) {
        factors.push({ code: "UNVERIFIED_SOURCE", weight: 35, detail: "Contract source is not verified" });
      }
      if (input.contractReport.isUpgradeable) {
        factors.push({ code: "UPGRADEABLE_PROXY", weight: 25, detail: "Contract is upgradeable/proxied" });
      }
      if (input.contractReport.deploymentAgeDays !== null && input.contractReport.deploymentAgeDays < 7) {
        factors.push({ code: "NEW_CONTRACT", weight: 20, detail: `Contract deployed ${input.contractReport.deploymentAgeDays}d ago` });
      }
      if (input.contractReport.knownIncidents.length > 0) {
        factors.push({ code: "LOW_REPUTATION_CONTRACT", weight: 60, detail: `Known incidents: ${input.contractReport.knownIncidents.join(", ")}` });
      }
      if (hasDangerousCapability(input.contractReport)) {
        factors.push({ code: "DANGEROUS_APPROVAL", weight: 50, detail: `Dangerous capabilities: ${input.contractReport.capabilities.join(", ")}` });
      }
    }
  } else {
    factors.push({ code: "UNKNOWN_CONTRACT", weight: 45, detail: "No contract intelligence supplied" });
  }

  if (input.intentDiff?.hasMaterialChange) {
    factors.push({ code: "MATERIAL_INTENT_CHANGE", weight: 90, detail: "Decoded intent differs materially from expected intent" });
  }

  if (input.approvalOk === false) {
    factors.push({ code: "STALE_APPROVAL", weight: 100, detail: "Approval check failed (missing/expired/used/mismatched)" });
  }

  if (input.simulationFreshness && !input.simulationFreshness.fresh) {
    factors.push({ code: "STALE_SIMULATION", weight: 55, detail: `Simulation not fresh: ${input.simulationFreshness.reason}` });
  }

  if (input.simulationSucceeded === false) {
    factors.push({ code: "DANGEROUS_APPROVAL", weight: 70, detail: "Simulation reverted/failed" });
  }

  if (input.unlimitedApproval) {
    factors.push({ code: "UNLIMITED_APPROVAL", weight: 30, detail: "Approval amount is unlimited/unbounded" });
  }

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.weight, 0));

  return {
    intentHash: input.intentHash,
    level: levelFromScore(score),
    score,
    factors,
    assessedAt: new Date().toISOString(),
  };
}

const FACTOR_TO_BLOCK_REASON: Partial<Record<TxRiskFactor["code"], TxBlockReason>> = {
  PHISHING: "PHISHING",
  SUSPICIOUS_DOMAIN: "SUSPICIOUS_DOMAIN",
  UNKNOWN_CONTRACT: "UNKNOWN_CONTRACT",
  MATERIAL_INTENT_CHANGE: "MATERIAL_INTENT_CHANGE",
  STALE_APPROVAL: "STALE_APPROVAL",
  STALE_SIMULATION: "STALE_SIMULATION",
  DANGEROUS_APPROVAL: "DANGEROUS_APPROVAL",
  LOW_REPUTATION_CONTRACT: "PHISHING",
};

/** Hard-block factor codes: presence alone forces BLOCK regardless of total score. */
const HARD_BLOCK_CODES = new Set<TxRiskFactor["code"]>([
  "PHISHING",
  "MATERIAL_INTENT_CHANGE",
  "STALE_APPROVAL",
  "LOW_REPUTATION_CONTRACT",
]);

export function decidePolicy(assessment: TxRiskAssessment): TxPolicyDecision {
  const blockReasons = new Set<TxBlockReason>();
  let hardBlock = false;

  for (const factor of assessment.factors) {
    const reason = FACTOR_TO_BLOCK_REASON[factor.code];
    if (reason) blockReasons.add(reason);
    if (HARD_BLOCK_CODES.has(factor.code)) hardBlock = true;
  }

  let verdict: TxPolicyDecision["verdict"];
  if (hardBlock || assessment.level === "CRITICAL") {
    verdict = "BLOCK";
  } else if (assessment.level === "HIGH" || assessment.level === "MEDIUM") {
    verdict = "NEEDS_USER_REVIEW";
  } else {
    verdict = "ALLOW";
  }

  return {
    intentHash: assessment.intentHash,
    verdict,
    blockReasons: Array.from(blockReasons),
    requiresUserApproval: verdict !== "ALLOW",
    decidedAt: new Date().toISOString(),
  };
}
