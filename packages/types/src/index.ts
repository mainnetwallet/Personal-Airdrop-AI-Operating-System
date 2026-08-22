// Shared domain types for Personal Airdrop AI Operating System (Phase 1 subset)

export type DeviceType = "VPS" | "PC" | "ANDROID" | "WEB" | "CHROME_EXTENSION";

export type DeviceTrustState =
  | "NEW"
  | "PENDING"
  | "TRUSTED"
  | "LIMITED"
  | "SUSPENDED"
  | "REVOKED";

export interface DeviceCapability {
  name: string;
  enabled: boolean;
}

export interface Device {
  deviceId: string;
  agentId: string;
  type: DeviceType;
  name: string;
  platform: string;
  version: string;
  status: DeviceTrustState;
  capabilities: string[];
  permissions: string[];
  publicKey: string | null;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}

export type IntegrationHealthState =
  | "CONNECTED"
  | "DEGRADED"
  | "NOT_CONFIGURED"
  | "EXPIRED"
  | "REVOKED"
  | "BLOCKED";

export interface AgentIdentity {
  agentId: string;
  label: string;
  createdAt: string;
}

export interface AuditLogEntry {
  auditId: string;
  actorType: "USER" | "AGENT" | "SYSTEM";
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Permission scopes (foundation level - full set expands in Phase 2)
export type PermissionScope =
  | "READ"
  | "RESEARCH"
  | "BROWSER"
  | "ACCOUNT"
  | "WALLET_READ"
  | "TRANSACTION_PREPARE"
  | "TRANSACTION_APPROVAL"
  | "ADMIN";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
}

// ---------------------------------------------------------------------
// Phase 2 — Agent OS Kernel / Event Bus / Memory / Permission
// ---------------------------------------------------------------------

export type AgentState =
  | "IDLE"
  | "THINKING"
  | "RESEARCHING"
  | "PLANNING"
  | "WAITING_FOR_USER"
  | "WAITING_FOR_APPROVAL"
  | "PREPARING"
  | "EXECUTING"
  | "VERIFYING"
  | "CHECKPOINTING"
  | "RESUMING"
  | "LEARNING"
  | "FAILED"
  | "PAUSED"
  | "STOPPED"
  | "BLOCKED"
  | "COMPLETED";

export interface StateTransitionRecord {
  runId: string;
  from: AgentState;
  to: AgentState;
  reason: string | null;
  at: string;
}

export interface RunLimits {
  maxSteps: number;
  maxRuntimeMs: number;
  maxToolCalls: number;
  maxRetries: number;
  maxCost: number;
}

export interface RunCost {
  toolCalls: number;
  amount: number;
}

export interface AgentRun {
  runId: string;
  parentRunId: string | null;
  agentId: string;
  deviceId: string | null;
  goal: string;
  context: Record<string, unknown>;
  toolsUsed: string[];
  permissions: PermissionScope[];
  status: AgentState;
  startTime: string;
  endTime: string | null;
  steps: number;
  toolCalls: number;
  retries: number;
  cost: RunCost;
  result: unknown;
  errors: string[];
  checkpointId: string | null;
}

export interface KernelEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: string;
  agentId: string | null;
  deviceId: string | null;
  correlationId: string;
  causationId: string | null;
  schemaVersion: string;
  sequence: number;
  payload: Record<string, unknown>;
}

export type MemoryType =
  | "USER_PREFERENCE"
  | "PROJECT_FACT"
  | "PROJECT_EVENT"
  | "TASK_HISTORY"
  | "WORKFLOW"
  | "WORKFLOW_VERSION"
  | "FAILURE_RESOLUTION"
  | "DECISION"
  | "CHECKPOINT_HISTORY"
  | "PROJECT_CHANGE"
  | "PERSONAL_STRATEGY"
  | "ACTIVITY_PATTERN"
  | "SUCCESS_PATTERN"
  | "FAILURE_PATTERN"
  | "RESEARCH_FACT"
  | "DECISION_HISTORY";

export type MemoryLifecycle =
  | "NEW"
  | "CONFIRMED"
  | "VERIFIED"
  | "STALE"
  | "CORRECTED"
  | "ARCHIVED";

export interface MemoryCorrection {
  previousContent: unknown;
  correctedAt: string;
  reason: string | null;
}

export interface MemoryEntry {
  memoryId: string;
  agentId: string;
  type: MemoryType;
  content: unknown;
  source: string;
  confidence: number; // 0..1
  lifecycle: MemoryLifecycle;
  correctionHistory: MemoryCorrection[];
  createdAt: string;
  updatedAt: string;
}

export type ToolRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permission: PermissionScope;
  risk: ToolRiskLevel;
  supportedDevices: DeviceType[];
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  auditEvent: boolean;
  requiresApproval: boolean;
}

// ---------------------------------------------------------------------
// Phase 3 — Project / Research / Evidence / Campaign / Airdrop Intelligence
// ---------------------------------------------------------------------

export type ProjectState =
  | "DISCOVERED"
  | "RESEARCHING"
  | "VERIFIED"
  | "WATCHING"
  | "ACTIVE"
  | "PAUSED"
  | "CLAIMABLE"
  | "CLAIMED"
  | "COMPLETED"
  | "EXPIRED"
  | "REJECTED"
  | "RISKY";

export type SourceType =
  | "PRIMARY_OFFICIAL"
  | "OFFICIAL_DOC"
  | "OFFICIAL_CONTRACT"
  | "OFFICIAL_ANNOUNCEMENT"
  | "OFFICIAL_SOCIAL"
  | "OFFICIAL_GITHUB"
  | "OFFICIAL_DISCORD"
  | "ONCHAIN_EVIDENCE"
  | "TRUSTED_RESEARCH"
  | "COMMUNITY"
  | "UNKNOWN"
  | "RUMOR";

export type ClaimConfidence =
  | "VERIFIED"
  | "LIKELY"
  | "UNCERTAIN"
  | "SPECULATIVE"
  | "CONFLICTED"
  | "STALE";

export interface Project {
  projectId: string;
  name: string;
  slug: string;
  logo: string | null;
  website: string | null;
  officialSources: string[];
  socialLinks: Record<string, string>;
  docs: string | null;
  github: string | null;
  discord: string | null;
  telegram: string | null;
  xAccount: string | null;
  chains: string[];
  contracts: string[];
  category: string | null;
  funding: string | null;
  backers: string[];
  status: ProjectState;
  airdropStatus: string | null;
  confidence: ClaimConfidence;
  opportunityScore: number;
  riskScore: number;
  estimatedCost: number | null;
  estimatedTime: string | null;
  priority: number;
  lastVerified: string | null;
  nextCheck: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  sourceId: string;
  url: string;
  sourceType: SourceType;
  discoveredAt: string;
}

export interface Snapshot {
  snapshotId: string;
  sourceId: string;
  contentHash: string;
  retrievedAt: string;
  knowledgeVersion: number;
  content: unknown;
}

export interface Claim {
  claimId: string;
  projectId: string | null;
  field: string;
  value: unknown;
  confidence: ClaimConfidence;
  createdAt: string;
  updatedAt: string;
}

// Evidence preserves full lineage for a claim: which source, at what
// URL, of what type, retrieved when, said what, content-hashed, and at
// which knowledge version — so any claim can be traced back to exactly
// what was known and from where.
export interface Evidence {
  evidenceId: string;
  claimId: string;
  sourceId: string;
  url: string;
  sourceType: SourceType;
  retrievedAt: string;
  content: unknown;
  contentHash: string;
  knowledgeVersion: number;
  createdAt: string;
}

// Source reputation tracks historical accuracy/freshness/availability.
// It is a confidence-weighting signal only — it can never override
// PRIMARY_OFFICIAL-tier evidence (see @airdrop-os/core evidence.ts).
export interface SourceReputationRecord {
  sourceId: string;
  correctCount: number;
  incorrectCount: number;
  lastSeenAt: string | null;
  availability: number; // 0..1, EMA of retrieval success
  freshnessScore: number; // 0..1
  reputationScore: number; // 0..1 derived
}

export type CampaignPhase =
  | "DISCOVERY"
  | "ANNOUNCEMENT"
  | "WAITLIST"
  | "BETA"
  | "ALPHA"
  | "TESTNET"
  | "MAINNET"
  | "CAMPAIGN"
  | "SEASON"
  | "EPOCH"
  | "SNAPSHOT"
  | "ELIGIBILITY"
  | "CLAIM"
  | "DISTRIBUTION";

export interface CampaignTimelineEvent {
  eventId: string;
  campaignId: string;
  phase: CampaignPhase;
  occurredAt: string | null;
  note: string | null;
}

export interface Campaign {
  campaignId: string;
  projectId: string;
  name: string;
  currentPhase: CampaignPhase;
  timeline: CampaignTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

// Full airdrop-type taxonomy. Any raw/unrecognized type classifies to
// UNKNOWN_AIRDROP_TYPE rather than a guess (see @airdrop-os/core
// airdropTypes.ts classifyAirdropType()).
export type AirdropType =
  | "RETROACTIVE" | "POINTS" | "TESTNET" | "MAINNET_USAGE" | "HOLDER"
  | "SNAPSHOT" | "QUEST" | "BOUNTY" | "SOCIAL" | "COMMUNITY" | "DISCORD"
  | "TELEGRAM" | "GOVERNANCE" | "NFT" | "NFT_HOLDER" | "DEFI" | "LENDING"
  | "BORROWING" | "LIQUIDITY" | "BRIDGE" | "SWAP" | "STAKING" | "RESTAKING"
  | "PERPETUALS" | "TRADING" | "PREDICTION_MARKET" | "PAYMENTS" | "WALLET"
  | "L2" | "L3" | "APPCHAIN" | "MODULAR" | "DATA_AVAILABILITY"
  | "INTEROPERABILITY" | "CROSS_CHAIN" | "ORACLE" | "DEPIN" | "AI" | "GPU"
  | "COMPUTE" | "STORAGE" | "BANDWIDTH" | "MOBILE_NETWORK" | "GAMING"
  | "GAMEFI" | "METAVERSE" | "CREATOR" | "CONTENT" | "REFERRAL"
  | "DEVELOPER" | "GITHUB" | "CODE_CONTRIBUTION" | "BUG_REPORT"
  | "FEEDBACK" | "AMBASSADOR" | "COMMUNITY_CONTRIBUTOR" | "TRANSLATION"
  | "EDUCATION" | "PARTNERSHIP" | "ECOSYSTEM" | "INFRASTRUCTURE"
  | "EARLY_ADOPTER" | "USER_GROWTH" | "TIERED" | "RAFFLE" | "LOYALTY"
  | "SEASONAL" | "EPOCH" | "CAMPAIGN" | "SNAPSHOT_BASED" | "CLAIM_ONLY"
  | "SPECULATIVE_PRE_TGE" | "WAITLIST" | "BETA" | "EARLY_ACCESS"
  | "LEARN_TO_EARN" | "EXCHANGE_CAMPAIGN" | "COMMUNITY_ACCOUNT"
  | "EMAIL_CAMPAIGN" | "UNKNOWN_AIRDROP_TYPE";

export interface AdapterTaskDraft {
  title: string;
  description: string;
}

export interface AdapterMissionDraft {
  title: string;
  steps: string[];
}

export interface AdapterMonitorResult {
  checkedAt: string;
  changed: boolean;
  notes: string | null;
}

// claim() never auto-executes a transaction/signature — every status
// this contract can return requires a human in the loop or reports
// that no adapter exists yet.
export interface AdapterClaimResult {
  status: "NOT_CONFIGURED" | "REQUIRES_MANUAL_APPROVAL";
  reason: string;
}

export interface AdapterEligibility {
  eligible: boolean | "UNKNOWN";
  reason: string;
}

export interface AdapterReport {
  summary: string;
  generatedAt: string;
}

// Adapter contract every airdrop-type handler must implement. An
// AirdropType with no registered adapter resolves (via
// @airdrop-os/core AirdropAdapterRegistry) to a NOT_CONFIGURED stub
// that implements this same contract rather than being absent.
export interface AirdropAdapter {
  readonly type: AirdropType;
  readonly status: "IMPLEMENTED" | "NOT_CONFIGURED";
  detect(input: { name: string; category: string | null; keywords: string[] }): boolean;
  research(project: Project): unknown;
  verify(project: Project): unknown;
  extractRequirements(project: Project): string[];
  calculateEligibility(project: Project, context: Record<string, unknown>): AdapterEligibility;
  estimateCost(project: Project): number | null;
  estimateTime(project: Project): string | null;
  estimateRisk(project: Project): number | null;
  buildTasks(project: Project): AdapterTaskDraft[];
  buildMission(project: Project): AdapterMissionDraft;
  monitor(project: Project): AdapterMonitorResult;
  claim(project: Project): AdapterClaimResult;
  report(project: Project): AdapterReport;
}
