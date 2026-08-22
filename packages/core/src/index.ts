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

/**
 * Phase 6: Browser / PC Agent / Extension / Workflow / Checkpoint.
 * Like Phases 2-5, this is pure state-management logic, fully unit
 * tested, and not yet wired to a live Playwright browser, a real Chrome
 * extension runtime, or persistence - `apps/local-agent` and
 * `apps/extension` remain NOT_CONFIGURED for live execution in this
 * sandbox (no display, no real device/VPS connection available here).
 */
export const AGENT_STATUS = "IMPLEMENTED" as const;

export * from "./agent/pcAgentAuth.js";
export * from "./agent/browserSession.js";
export * from "./agent/browserEvent.js";
export * from "./agent/checkpoint.js";
export * from "./agent/workflow.js";
export * from "./agent/teachAgent.js";
export * from "./agent/captcha.js";
export * from "./agent/recovery.js";

/**
 * Phase 7: Advanced Security / Transaction Firewall / Claim Security /
 * EIP-7702. Every I/O-bound step (RPC calls, block explorer/bytecode
 * lookups, live DNS/WHOIS, real simulation) is NOT_CONFIGURED in this
 * sandbox - these modules are pure decision logic driven by data the
 * caller supplies from a future real adapter, never fabricated results.
 * The Security Agent's BLOCK verdict is final and nothing downstream
 * overrides it back to ALLOW. Sensitive signing always remains
 * user-controlled - the firewall never signs or submits itself.
 */
export const TX_FIREWALL_STATUS = "IMPLEMENTED" as const;

export * from "./tx/domainProtection.js";
export * from "./tx/contractIntelligence.js";
export * from "./tx/intentDiff.js";
export * from "./tx/approval.js";
export * from "./tx/simulation.js";
export * from "./tx/riskPolicy.js";
export * from "./tx/claimSecurity.js";
export * from "./tx/eip7702.js";
export * from "./tx/antiSybil.js";
export * from "./tx/emergencyStop.js";
export * from "./tx/promptInjection.js";
export * from "./tx/firewall.js";

/**
 * Phase 8: Airdrop coverage / off-chain intelligence / plugins.
 * All adapters registered here are MOCK — no live Discord/X/Telegram/
 * GitHub/quest/DePIN/AI-compute/GameFi/prediction/referral/ambassador/
 * exchange/waitlist/learn-to-earn credentials exist in this sandbox,
 * so every IntegrationProvider starts and stays NOT_CONFIGURED until a
 * real integration explicitly reports otherwise. Plugin SDK: unknown
 * plugins are always DISABLED; activation never grants a permission
 * beyond what the plugin's own manifest requested.
 */
export const PHASE8_STATUS = "IMPLEMENTED" as const;

export * from "./integrations/integrationRegistry.js";
export * from "./adapters/mockOffChainAdapter.js";
export * from "./adapters/phase8Adapters.js";
export * from "./plugins/pluginSdk.js";
