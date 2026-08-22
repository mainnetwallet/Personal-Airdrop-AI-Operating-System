/**
 * Phase 2: Agent OS Kernel — state machine, event bus, memory,
 * tool registry, permission enforcement, run limits.
 */
export const KERNEL_STATUS = "IMPLEMENTED" as const;

export * from "./kernelState.js";
export * from "./runLimits.js";
export * from "./eventBus.js";
export * from "./memory.js";
export * from "./toolRegistry.js";
export * from "./kernel.js";

/**
 * Phase 3: Project / Research / Evidence / Campaign / Airdrop
 * Intelligence.
 */
export const RESEARCH_STATUS = "IMPLEMENTED" as const;

export * from "./project.js";
export * from "./airdropTypes.js";
export * from "./evidence.js";
export * from "./sourceReputation.js";
export * from "./researchEngine.js";
export * from "./campaign.js";
export * from "./adapters/registry.js";
export * from "./adapters/notConfiguredAdapter.js";
export * from "./tools/researchTools.js";

/**
 * Phase 4: Requirement / Identity / Mission / Task / Eligibility.
 */
export const ELIGIBILITY_STATUS = "IMPLEMENTED" as const;

export * from "./requirement.js";
export * from "./identityGraph.js";
export * from "./wallet.js";
export * from "./task.js";
export * from "./mission.js";
export * from "./eligibility.js";
export * from "./nextBestAction.js";

/**
 * Phase 5: Blockchain / Activity / Snapshot / Points / Opportunity
 * Radar. No live RPC providers are configured in this repository - the
 * RpcManager is pure state management, driven by real call outcomes
 * the API/worker layer reports to it. Every provider without a
 * `url` is NOT_CONFIGURED, never fabricated as healthy.
 */
export const CHAIN_STATUS = "IMPLEMENTED" as const;

export * from "./chain/rpcManager.js";
export * from "./chain/finality.js";
export * from "./chain/reorg.js";
export * from "./chain/reconciliation.js";
export * from "./chain/attribution.js";
export * from "./chain/historicalState.js";
export * from "./chain/snapshotProof.js";
export * from "./chain/points.js";
export * from "./chain/opportunityRadar.js";
