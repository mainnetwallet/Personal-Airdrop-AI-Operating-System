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
