import type { ActivityAttribution, ClaimConfidence } from "@airdrop-os/types";

export interface BuildAttributionInput {
  transactionHash: string;
  traceId?: string | null;
  functionSelector?: string | null;
  contractAddress?: string | null;
  tokenAddress?: string | null;
  protocolId?: string | null;
  browserContextId?: string | null;
  taskId?: string | null;
  missionId?: string | null;
  campaignId?: string | null;
  projectId?: string | null;
}

/**
 * Builds an attribution chain: transaction -> trace -> function ->
 * contract -> token -> protocol -> browser context -> task -> mission
 * -> campaign -> project. Confidence is derived from how much of the
 * chain is actually populated, not asserted - a transaction attributed
 * only to a raw contract address (no protocol/task/mission link) is
 * necessarily lower confidence than one traced all the way to a task
 * the agent itself initiated via a tracked browser context.
 */
export function buildAttribution(input: BuildAttributionInput): ActivityAttribution {
  const chainLinks = [
    input.traceId,
    input.functionSelector,
    input.contractAddress,
    input.tokenAddress,
    input.protocolId,
    input.browserContextId,
    input.taskId,
    input.missionId,
    input.campaignId,
    input.projectId,
  ];
  const populated = chainLinks.filter((v) => v !== null && v !== undefined).length;

  let confidence: ClaimConfidence;
  if (input.browserContextId && input.taskId) {
    confidence = "VERIFIED"; // agent-initiated action we directly observed
  } else if (populated >= 5) {
    confidence = "LIKELY";
  } else if (populated >= 1) {
    confidence = "UNCERTAIN";
  } else {
    confidence = "SPECULATIVE";
  }

  return {
    transactionHash: input.transactionHash,
    traceId: input.traceId ?? null,
    functionSelector: input.functionSelector ?? null,
    contractAddress: input.contractAddress ?? null,
    tokenAddress: input.tokenAddress ?? null,
    protocolId: input.protocolId ?? null,
    browserContextId: input.browserContextId ?? null,
    taskId: input.taskId ?? null,
    missionId: input.missionId ?? null,
    campaignId: input.campaignId ?? null,
    projectId: input.projectId ?? null,
    confidence,
  };
}
