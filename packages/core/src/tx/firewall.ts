import type {
  ApprovalCheckResult,
  ContractIntelligenceReport,
  DomainCheckResult,
  SimulationFreshnessCheck,
  TxFirewallStage,
  TxFirewallVerdict,
  TxIntent,
  TxIntentDiffResult,
  TxPolicyDecision,
  TxRiskAssessment,
} from "@airdrop-os/types";
import { TX_FIREWALL_STAGE_ORDER } from "@airdrop-os/types";
import { diffIntent } from "./intentDiff.js";
import { assessRisk, decidePolicy } from "./riskPolicy.js";
import type { EmergencyStopController } from "./emergencyStop.js";

/**
 * Phase 7: Transaction firewall.
 *
 * Orchestrates prepare -> decode -> validate -> estimate -> simulate ->
 * state analysis -> risk -> policy -> intent diff -> approval -> sign ->
 * submit -> verify. This module never performs the sign/submit/RPC I/O
 * itself (no live chain access in this sandbox) - callers supply the
 * outcome of each I/O-bound stage, and the firewall's job is to refuse
 * to advance to the next stage when an earlier stage failed or the
 * Security Agent (risk/policy) vetoed. The Security Agent's BLOCK is
 * final: nothing downstream can turn a BLOCK back into an ALLOW.
 */

export interface FirewallStageRecord {
  stage: TxFirewallStage;
  status: "PASSED" | "BLOCKED" | "SKIPPED" | "NEEDS_USER_REVIEW";
  detail: string;
}

export interface FirewallRunResult {
  intentHash: string;
  verdict: TxFirewallVerdict;
  stages: FirewallStageRecord[];
  intentDiff: TxIntentDiffResult | null;
  riskAssessment: TxRiskAssessment | null;
  policyDecision: TxPolicyDecision | null;
  finishedStage: TxFirewallStage;
}

export interface FirewallRunInput {
  expectedIntent: TxIntent;
  decodedIntent: TxIntent | null;
  validationOk: boolean;
  validationDetail: string;
  estimationOk: boolean;
  estimationDetail: string;
  simulationSucceeded: boolean | null;
  simulationFreshness: SimulationFreshnessCheck | null;
  stateAnalysisOk: boolean;
  stateAnalysisDetail: string;
  domainCheck: DomainCheckResult | null;
  contractReport: ContractIntelligenceReport | null;
  approvalCheck: ApprovalCheckResult | null;
  unlimitedApproval: boolean;
  emergencyStop?: EmergencyStopController;
}

function stopEarly(
  stages: FirewallStageRecord[],
  stage: TxFirewallStage,
  intentHash: string,
): FirewallRunResult {
  return {
    intentHash,
    verdict: "BLOCK",
    stages,
    intentDiff: null,
    riskAssessment: null,
    policyDecision: null,
    finishedStage: stage,
  };
}

export function runFirewall(input: FirewallRunInput): FirewallRunResult {
  const intentHash = input.expectedIntent.intentHash;
  const stages: FirewallStageRecord[] = [];

  // PREPARE
  stages.push({ stage: "PREPARE", status: "PASSED", detail: "Expected intent captured" });

  // DECODE
  if (!input.decodedIntent) {
    stages.push({ stage: "DECODE", status: "BLOCKED", detail: "No decoded intent available" });
    return stopEarly(stages, "DECODE", intentHash);
  }
  stages.push({ stage: "DECODE", status: "PASSED", detail: "Transaction decoded" });

  // VALIDATE
  if (!input.validationOk) {
    stages.push({ stage: "VALIDATE", status: "BLOCKED", detail: input.validationDetail });
    return stopEarly(stages, "VALIDATE", intentHash);
  }
  stages.push({ stage: "VALIDATE", status: "PASSED", detail: input.validationDetail });

  // ESTIMATE
  if (!input.estimationOk) {
    stages.push({ stage: "ESTIMATE", status: "BLOCKED", detail: input.estimationDetail });
    return stopEarly(stages, "ESTIMATE", intentHash);
  }
  stages.push({ stage: "ESTIMATE", status: "PASSED", detail: input.estimationDetail });

  // SIMULATE
  if (input.simulationSucceeded === false) {
    stages.push({ stage: "SIMULATE", status: "BLOCKED", detail: "Simulation reverted or failed" });
    return stopEarly(stages, "SIMULATE", intentHash);
  }
  if (!input.simulationFreshness || !input.simulationFreshness.fresh) {
    stages.push({
      stage: "SIMULATE",
      status: "BLOCKED",
      detail: `Simulation missing or stale: ${input.simulationFreshness?.reason ?? "NO_SIMULATION"}`,
    });
    return stopEarly(stages, "SIMULATE", intentHash);
  }
  stages.push({ stage: "SIMULATE", status: "PASSED", detail: "Simulation succeeded and is fresh" });

  // STATE_ANALYSIS
  if (!input.stateAnalysisOk) {
    stages.push({ stage: "STATE_ANALYSIS", status: "BLOCKED", detail: input.stateAnalysisDetail });
    return stopEarly(stages, "STATE_ANALYSIS", intentHash);
  }
  stages.push({ stage: "STATE_ANALYSIS", status: "PASSED", detail: input.stateAnalysisDetail });

  // INTENT_DIFF (computed before RISK so risk assessment can use it)
  const intentDiff = diffIntent(input.expectedIntent, input.decodedIntent);

  // RISK
  const riskAssessment = assessRisk({
    intentHash,
    domainCheck: input.domainCheck,
    contractReport: input.contractReport,
    intentDiff,
    approvalOk: input.approvalCheck ? input.approvalCheck.ok : null,
    simulationFreshness: input.simulationFreshness,
    simulationSucceeded: input.simulationSucceeded,
    unlimitedApproval: input.unlimitedApproval,
  });
  stages.push({
    stage: "RISK",
    status: riskAssessment.level === "CRITICAL" ? "BLOCKED" : "PASSED",
    detail: `Risk level ${riskAssessment.level} (score ${riskAssessment.score})`,
  });

  // POLICY (Security Agent veto - final)
  const policyDecision = decidePolicy(riskAssessment);
  if (policyDecision.verdict === "BLOCK") {
    stages.push({ stage: "POLICY", status: "BLOCKED", detail: `Blocked: ${policyDecision.blockReasons.join(", ")}` });
    return {
      intentHash,
      verdict: "BLOCK",
      stages,
      intentDiff,
      riskAssessment,
      policyDecision,
      finishedStage: "POLICY",
    };
  }
  stages.push({
    stage: "POLICY",
    status: policyDecision.verdict === "NEEDS_USER_REVIEW" ? "NEEDS_USER_REVIEW" : "PASSED",
    detail: `Verdict ${policyDecision.verdict}`,
  });

  // INTENT_DIFF stage record (after risk/policy consumed it)
  if (intentDiff.hasMaterialChange) {
    stages.push({ stage: "INTENT_DIFF", status: "BLOCKED", detail: "Material intent change detected" });
    return {
      intentHash,
      verdict: "BLOCK",
      stages,
      intentDiff,
      riskAssessment,
      policyDecision,
      finishedStage: "INTENT_DIFF",
    };
  }
  stages.push({ stage: "INTENT_DIFF", status: "PASSED", detail: "No material intent change" });

  // APPROVAL
  if (!input.approvalCheck || input.approvalCheck.ok !== true) {
    stages.push({
      stage: "APPROVAL",
      status: "BLOCKED",
      detail: input.approvalCheck && input.approvalCheck.ok === false ? input.approvalCheck.detail : "No approval",
    });
    return stopEarly(stages, "APPROVAL", intentHash);
  }
  stages.push({ stage: "APPROVAL", status: "PASSED", detail: "Approval valid and bound to this intent" });

  // EMERGENCY STOP (checked immediately before the sensitive SIGN stage)
  if (input.emergencyStop && input.emergencyStop.blocksSensitiveOp("WALLET", input.expectedIntent.walletAddress)) {
    stages.push({ stage: "SIGN", status: "BLOCKED", detail: "Emergency stop active for this wallet" });
    return {
      intentHash,
      verdict: "BLOCK",
      stages,
      intentDiff,
      riskAssessment,
      policyDecision,
      finishedStage: "SIGN",
    };
  }

  // SIGN / SUBMIT / VERIFY: the firewall never performs these itself.
  // Sensitive signing remains user-controlled unless an explicitly
  // authorized secure mechanism exists (out of scope for this sandbox -
  // no such mechanism is configured). Even a fully-ALLOW policy decision
  // still stops here and hands back NEEDS_USER_REVIEW for the signature
  // itself, rather than fabricating a signature/submission outcome.
  stages.push({ stage: "SIGN", status: "NEEDS_USER_REVIEW", detail: "Signing requires explicit user action - never automated" });
  stages.push({ stage: "SUBMIT", status: "SKIPPED", detail: "Not submitted - awaiting user signature" });
  stages.push({ stage: "VERIFY", status: "SKIPPED", detail: "Not verified - transaction not yet submitted" });

  return {
    intentHash,
    verdict: "NEEDS_USER_REVIEW",
    stages,
    intentDiff,
    riskAssessment,
    policyDecision,
    finishedStage: "SIGN",
  };
}

export function stageOrderIsValid(records: FirewallStageRecord[]): boolean {
  const seen = records.map((r) => r.stage);
  let cursor = -1;
  for (const stage of seen) {
    const idx = TX_FIREWALL_STAGE_ORDER.indexOf(stage);
    if (idx < cursor) return false;
    cursor = idx;
  }
  return true;
}
