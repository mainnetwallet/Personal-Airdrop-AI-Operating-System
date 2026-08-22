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

// ---------------------------------------------------------------------
// Phase 4 — Requirement / Identity / Mission / Task / Eligibility
// ---------------------------------------------------------------------

export type RequirementType =
  | "SOCIAL" | "QUEST" | "ONCHAIN" | "TESTNET" | "RESEARCH" | "GOVERNANCE"
  | "NFT" | "STAKING" | "LIQUIDITY" | "BRIDGE" | "SWAP" | "CLAIM" | "FAUCET"
  | "FEEDBACK" | "HOLDING" | "VOLUME" | "DURATION" | "REFERRAL" | "OTHER";

export type RequirementStatus = "ACTIVE" | "SUPERSEDED" | "EXPIRED" | "RETRACTED";

// Every requirement row is one version. History is never overwritten:
// superseding a requirement closes the current version's validUntil
// and appends a new version with supersedesVersion pointing back to
// it. See @airdrop-os/core requirement.ts.
export interface Requirement {
  requirementId: string;
  projectId: string;
  campaignId: string | null;
  seasonId: string | null;
  epochId: string | null;
  type: RequirementType;
  description: string;
  source: string;
  evidence: string[];
  confidence: ClaimConfidence;
  status: RequirementStatus;
  deadline: string | null;
  minimum: number | null;
  maximum: number | null;
  wallet: string | null;
  account: string | null;
  chain: string | null;
  activity: string | null;
  duration: string | null;
  volume: number | null;
  snapshot: string | null;
  version: number;
  validFrom: string;
  validUntil: string | null;
  supersedesVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export type AccountType =
  | "WALLET" | "X_ACCOUNT" | "DISCORD_ACCOUNT" | "TELEGRAM_ACCOUNT"
  | "GITHUB_ACCOUNT" | "QUEST_ACCOUNT" | "EXCHANGE_ACCOUNT" | "EMAIL_ACCOUNT"
  | "GAME_ACCOUNT";

export type AssociationState = "USER_CONFIRMED" | "KNOWN" | "OBSERVED" | "UNCERTAIN";

// USER -> account edges. Never silently merged: associating an
// (accountType, accountRef) already linked to a different userId
// throws rather than reassigning ownership (see @airdrop-os/core
// identityGraph.ts).
export interface IdentityAssociation {
  associationId: string;
  userId: string;
  accountType: AccountType;
  accountRef: string;
  state: AssociationState;
  createdAt: string;
  updatedAt: string;
}

export type WalletLabel = "MAIN" | "TESTNET" | "EXPERIMENTAL" | "DEFI" | "NFT" | "RESEARCH";
export type WalletStatus = "ACTIVE" | "WATCHING" | "RETIRED" | "COMPROMISED";

export interface Wallet {
  walletId: string;
  address: string;
  label: WalletLabel;
  chains: string[];
  status: WalletStatus;
  createdAt: string;
}

export type TaskType =
  | "SOCIAL" | "QUEST" | "ONCHAIN" | "TESTNET" | "RESEARCH" | "GOVERNANCE"
  | "NFT" | "STAKING" | "LIQUIDITY" | "BRIDGE" | "SWAP" | "CLAIM" | "FAUCET"
  | "FEEDBACK" | "MANUAL_VERIFICATION" | "CAPTCHA_HANDOFF" | "LOGIN_HANDOFF"
  | "2FA_HANDOFF" | "KYC_HANDOFF" | "DISCORD" | "TELEGRAM" | "GITHUB"
  | "DEVELOPER" | "DEPIN" | "GAMING" | "REFERRAL" | "AMBASSADOR" | "SNAPSHOT"
  | "WAITLIST" | "BETA" | "EDUCATION" | "EXCHANGE" | "CONTENT";

export type TaskStatus =
  | "BLOCKED" | "READY" | "IN_PROGRESS" | "WAITING_HUMAN" | "DONE" | "SKIPPED" | "FAILED";

// Task DAG node. dependencies reference other taskIds and must already
// exist at creation time (see @airdrop-os/core task.ts) — this makes a
// dependency cycle structurally impossible rather than something that
// has to be detected after the fact.
export interface Task {
  taskId: string;
  missionId: string;
  type: TaskType;
  title: string;
  description: string;
  dependencies: string[];
  conditions: string[];
  outputs: string[];
  requiresHumanGate: boolean;
  requiresApprovalGate: boolean;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export type MissionStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "BLOCKED" | "COMPLETED" | "ABANDONED";

export type EligibilityState =
  | "UNKNOWN" | "POSSIBLE" | "LIKELY" | "QUALIFIED" | "VERIFIED"
  | "INELIGIBLE" | "CONFLICTED" | "EXPIRED";

export interface Mission {
  missionId: string;
  projectId: string;
  campaignId: string | null;
  objective: string;
  requirements: string[];
  tasks: string[];
  dependencies: string[];
  deadline: string | null;
  budget: number | null;
  timeBudget: string | null;
  risk: number | null;
  status: MissionStatus;
  progress: number;
  eligibility: EligibilityState;
  rewardSignal: number | null;
  workflow: string | null;
  checkpoint: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NextBestAction =
  | "DO" | "WAIT" | "WATCH" | "SKIP" | "RESEARCH" | "HUMAN_REVIEW" | "BLOCK" | "NO_ACTION";

export type UserPreferenceStance = "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE";

export interface NextBestActionInput {
  eligibility: EligibilityState;
  deadline: string | null;
  rewardSignal: number | null;
  cost: number | null;
  time: number | null;
  risk: number | null;
  budget: number | null;
  availability: boolean;
  confidence: ClaimConfidence;
  workflowMatch: boolean;
  userPreference: UserPreferenceStance | null;
}

export interface EligibilityActivity {
  activityId: string;
  wallet: string | null;
  account: string | null;
  type: string;
  timestamp: string;
  block: number | null;
  value: number | null;
  chain: string | null;
}

// The bundle of evidence behind a computed eligibility state — always
// traceable to the specific requirement *versions* used, per activity,
// not just "the requirement" in the abstract.
export interface EligibilityProofPackage {
  projectId: string;
  campaignId: string | null;
  seasonId: string | null;
  epochId: string | null;
  wallet: string | null;
  account: string | null;
  requirements: { requirementId: string; version: number }[];
  activities: EligibilityActivity[];
  snapshot: string | null;
  evidence: string[];
  calculation: string;
  confidence: ClaimConfidence;
  unknowns: string[];
  state: EligibilityState;
  generatedAt: string;
}

// ---------------------------------------------------------------------
// Phase 5: Blockchain / Activity / Snapshot / Points / Opportunity Radar
// ---------------------------------------------------------------------

export type EvmChain =
  | "ETHEREUM" | "BASE" | "ARBITRUM" | "OPTIMISM" | "POLYGON"
  | "BNB_CHAIN" | "AVALANCHE" | "ZKSYNC" | "LINEA" | "SCROLL" | "BLAST";

// Non-EVM chains are declared but every adapter for them is
// NOT_CONFIGURED in Phase 5 - the type exists so later phases can add
// real adapters without touching this union's call sites.
export type NonEvmChain = "SOLANA" | "SUI" | "APTOS";

export type ChainId = EvmChain | NonEvmChain;

export type RpcProviderRole = "PRIMARY" | "BACKUP" | "BACKUP2" | "BACKUP3";

export type RpcProviderHealth = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "CIRCUIT_OPEN" | "NOT_CONFIGURED";

export interface RpcProviderConfig {
  providerId: string;
  chain: ChainId;
  role: RpcProviderRole;
  url: string | null; // null => NOT_CONFIGURED, never fabricated
}

export interface RpcProviderState {
  providerId: string;
  health: RpcProviderHealth;
  consecutiveFailures: number;
  lastLatencyMs: number | null;
  lastError: string | null;
  lastCheckedAt: string | null;
  circuitOpenedAt: string | null;
  rateLimitedUntil: string | null;
}

export type ActivityType =
  | "SWAP" | "BRIDGE" | "LEND" | "BORROW" | "LP_PROVIDE" | "LP_WITHDRAW"
  | "STAKE" | "UNSTAKE" | "RESTAKE" | "DELEGATE" | "UNDELEGATE" | "GOVERNANCE_VOTE"
  | "NFT_MINT" | "NFT_TRADE" | "NFT_HOLD" | "CONTRACT_INTERACTION" | "PERPETUAL_TRADE"
  | "PREDICTION_MARKET" | "PAYMENT" | "CROSS_CHAIN_MESSAGE";

export type TransactionFinality =
  | "PENDING" | "INCLUDED" | "CONFIRMED" | "FINALIZED" | "REORGED" | "DROPPED" | "REPLACED";

export interface ActivityAttribution {
  transactionHash: string;
  traceId: string | null;
  functionSelector: string | null;
  contractAddress: string | null;
  tokenAddress: string | null;
  protocolId: string | null;
  browserContextId: string | null;
  taskId: string | null;
  missionId: string | null;
  campaignId: string | null;
  projectId: string | null;
  confidence: ClaimConfidence;
}

export interface OnChainActivity {
  activityId: string;
  chain: ChainId;
  wallet: string;
  type: ActivityType;
  transactionHash: string;
  blockNumber: number | null;
  timestamp: string | null; // block timestamp, null while PENDING
  finality: TransactionFinality;
  gasUsed: string | null;
  valueUsd: number | null;
  attribution: ActivityAttribution | null;
  supersededBy: string | null; // activityId of the replacement, set on REPLACED/REORGED
  createdAt: string;
  updatedAt: string;
}

export interface ReorgEvent {
  reorgId: string;
  chain: ChainId;
  detectedAt: string;
  oldBlockHash: string;
  newBlockHash: string;
  fromBlock: number;
  toBlock: number;
  affectedActivityIds: string[];
}

export type ReconciliationStatus = "MATCH" | "RECONCILIATION_REQUIRED";

export interface ReconciliationSource {
  sourceType: "PRIMARY_RPC" | "BACKUP_RPC" | "EXPLORER" | "INDEXER";
  value: string;
}

export interface ReconciliationResult {
  reconciliationId: string;
  chain: ChainId;
  subject: string; // e.g. `${txHash}:finality` or `${wallet}:balance:${block}`
  sources: ReconciliationSource[];
  status: ReconciliationStatus;
  checkedAt: string;
}

// Historical state must NEVER be derived from current state - every
// record here is pinned to a specific block/timestamp and, once
// written, is only ever superseded (reorg) not overwritten in place.
export interface HistoricalStateRecord {
  recordId: string;
  chain: ChainId;
  wallet: string;
  block: number;
  blockTimestamp: string;
  kind: "BALANCE" | "NFT_HOLDING" | "LP_POSITION" | "STAKING_POSITION" | "GOVERNANCE_POWER" | "ACTIVITY_SUMMARY";
  data: Record<string, unknown>;
  invalidatedByReorgId: string | null;
  recordedAt: string;
}

export interface SnapshotProof {
  snapshotProofId: string;
  projectId: string;
  campaignId: string | null;
  snapshotBlock: number;
  snapshotTimestamp: string;
  wallet: string;
  asset: string | null;
  balance: string | null;
  requirementId: string | null;
  requirementVersion: number | null;
  result: EligibilityState;
  evidence: string[]; // historicalStateRecord ids / reconciliationResult ids
  confidence: ClaimConfidence;
  generatedAt: string;
}

export type PointsUnit = "POINTS" | "XP";

export interface PointsLedgerEntry {
  entryId: string;
  agentId: string;
  projectId: string;
  seasonId: string | null;
  epochId: string | null;
  unit: PointsUnit;
  amount: number; // can be negative (decay/penalty)
  multiplier: number;
  reason: string;
  sourceActivityId: string | null;
  recordedAt: string;
}

export interface RankThreshold {
  rank: string;
  minTotal: number;
}

export interface OpportunitySignal {
  opportunityId: string;
  projectId: string | null;
  title: string;
  category:
    | "NEW_PROJECT" | "CAMPAIGN" | "TESTNET" | "POINTS_PROGRAM" | "QUEST"
    | "WAITLIST" | "BETA" | "EARLY_ACCESS" | "DEVELOPER" | "DEPIN"
    | "GAMING" | "AI_COMPUTE" | "COMMUNITY" | "POTENTIAL_RETROACTIVE";
  discoveredAt: string;
  claimWindowEnd: string | null;
  officialEvidenceCount: number;
  sourceConfidence: ClaimConfidence;
}

export interface OpportunityScoreInput {
  officialEvidenceStrength: number; // 0..1
  projectQuality: number; // 0..1
  cost: number; // 0..1, higher = more expensive
  time: number; // 0..1, higher = more time required
  risk: number; // 0..1, higher = riskier
  deadlinePressure: number; // 0..1, higher = more urgent
  competition: number; // 0..1, higher = more saturated
  userFit: number; // 0..1
  confidence: ClaimConfidence;
}

export interface OpportunityScoreResult {
  score: number; // 0..1, never a guarantee of reward
  breakdown: Record<string, number>;
  confidence: ClaimConfidence;
}

// ============================================================
// Phase 6: Browser / PC Agent / Extension / Workflow / Checkpoint
// ============================================================

export type BrowserMode = "CONTROLLED_BROWSER" | "USER_BROWSER_EXTENSION";

/** A device-scoped job the VPS explicitly authorized the PC agent to run.
 * Authorization always expires; a PC agent must never treat an expired
 * or revoked job as valid. */
export type JobAuthorizationStatus = "ACTIVE" | "EXPIRED" | "REVOKED" | "COMPLETED";

export interface DeviceJobAuthorization {
  jobId: string;
  deviceId: string;
  agentId: string;
  scope: string[]; // permission scope names, e.g. ["BROWSER", "READ"]
  issuedAt: string;
  expiresAt: string;
  status: JobAuthorizationStatus;
}

/** Sessions are isolated so state from one project/wallet/profile never
 * bleeds into another. Two sessions are the "same" session only if every
 * field of the isolation key matches. */
export interface BrowserIsolationKey {
  projectId: string | null;
  campaignId: string | null;
  missionId: string | null;
  wallet: string | null;
  account: string | null;
  browserProfile: string | null;
  chain: string | null;
  deviceId: string;
}

export type BrowserSessionStatus = "OPEN" | "PAUSED" | "CLOSED" | "CRASHED";

export interface BrowserSession {
  sessionId: string;
  mode: BrowserMode;
  isolation: BrowserIsolationKey;
  status: BrowserSessionStatus;
  openedAt: string;
  closedAt: string | null;
}

/** Browser events store ONLY safe metadata. Field VALUES that look like
 * secrets (password, seed phrase, private key, OTP, 2FA, recovery code,
 * payment credential, session token) must never appear here - only the
 * fact that a sensitive field was present and redacted. */
export type BrowserEventSensitivity = "SAFE" | "REDACTED";

export interface BrowserEvent {
  eventId: string;
  sessionId: string;
  timestamp: string;
  url: string;
  title: string | null;
  eventType: "NAVIGATION" | "CLICK" | "INPUT" | "SUBMIT" | "OBSERVATION";
  elementMetadata: Record<string, string | number | boolean | null> | null;
  action: string | null;
  projectId: string | null;
  campaignId: string | null;
  missionId: string | null;
  taskId: string | null;
  wallet: string | null;
  account: string | null;
  chain: string | null;
  sensitivity: BrowserEventSensitivity;
  confidence: ClaimConfidence;
  redactedFields: string[];
}

// --- Workflow engine ---

export interface WorkflowVariable {
  name: string;
  kind: "wallet" | "account" | "chain" | "token" | "amount" | "contract" | "quest" | "project" | "campaign" | "network" | "browserProfile" | "device";
}

export interface WorkflowCondition {
  variable: string;
  operator: "equals" | "notEquals" | "exists" | "notExists";
  value?: string;
}

export type WorkflowGateType = "NONE" | "HUMAN_GATE" | "APPROVAL_GATE";

export interface WorkflowStep {
  stepId: string;
  name: string;
  dependsOn: string[]; // stepIds that must succeed first
  conditions: WorkflowCondition[];
  expectedOutput: string | null;
  gate: WorkflowGateType;
  onFailure: "STOP" | "RETRY" | "SKIP" | "HUMAN_REVIEW";
}

export interface WorkflowDefinitionInput {
  name: string;
  goal: string;
  steps: WorkflowStep[];
  variables: WorkflowVariable[];
}

export interface WorkflowVersionRecord {
  workflowId: string;
  version: number; // 1, 2, 3... never overwritten
  label: string; // e.g. "V1"
  definition: WorkflowDefinitionInput;
  createdAt: string;
  supersedes: number | null;
  derivedFromRunStats?: { successCount: number; failureCount: number; avgTimeMs: number; avgCost: number };
}

export type WorkflowRunStatus =
  | "PENDING" | "RUNNING" | "WAITING_FOR_APPROVAL" | "WAITING_FOR_USER"
  | "PAUSED_REGRESSION" | "COMPLETED" | "FAILED" | "BLOCKED";

export interface WorkflowStepResult {
  stepId: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "SKIPPED";
  output: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface WorkflowRun {
  runId: string;
  workflowId: string;
  version: number;
  status: WorkflowRunStatus;
  stepResults: WorkflowStepResult[];
  startedAt: string;
  finishedAt: string | null;
  checkpointId: string | null;
}

// --- Teach agent ---

export type TeachDecision = "SAVE" | "EDIT" | "DISCARD";

export interface TaughtWorkflowDraft {
  draftId: string;
  observedSessionId: string;
  goal: string;
  steps: WorkflowStep[];
  successCriteria: string[];
  failureCriteria: string[];
  manualInterventionPoints: string[];
  estimatedTimeMs: number;
  estimatedCost: number;
  confidence: ClaimConfidence;
  decision: TeachDecision | null;
}

// --- Checkpoint ---

export type CheckpointCompatibility = "COMPATIBLE" | "INCOMPATIBLE";

export interface CheckpointVersions {
  schemaVersion: number;
  agentVersion: string;
  workflowVersion: number | null;
}

export interface CheckpointRecord {
  checkpointId: string;
  sessionId: string | null;
  runId: string | null;
  label: string; // e.g. "BEFORE_CLAIM", "AFTER_STAKE"
  versions: CheckpointVersions;
  safeState: Record<string, unknown>; // never secrets
  createdAt: string;
}

// --- CAPTCHA handoff ---

export type CaptchaType = "RECAPTCHA" | "HCAPTCHA" | "TURNSTILE" | "CLOUDFLARE_CHALLENGE" | "HUMAN_VERIFICATION";

export type CaptchaStatus =
  | "NONE" | "DETECTED" | "PAUSED" | "CHECKPOINTED"
  | "AWAITING_USER" | "USER_COMPLETED" | "VERIFIED" | "RESUMED" | "TIMED_OUT";

export interface CaptchaEvent {
  captchaId: string;
  sessionId: string;
  type: CaptchaType;
  status: CaptchaStatus;
  detectedAt: string;
  checkpointId: string | null;
  resolvedAt: string | null;
}

// --- Recovery ---

export type RecoveryTrigger =
  | "BROWSER_CRASH" | "PC_RESTART" | "NETWORK_FAILURE" | "RPC_FAILURE" | "SESSION_EXPIRY";

export type RecoveryOutcome = "RESUMED" | "BLOCKED_INCOMPATIBLE_CHECKPOINT" | "BLOCKED_NO_CHECKPOINT" | "BLOCKED_VERIFICATION_FAILED";

export interface RecoveryEvent {
  recoveryId: string;
  trigger: RecoveryTrigger;
  sessionId: string | null;
  runId: string | null;
  checkpointId: string | null;
  outcome: RecoveryOutcome;
  detectedAt: string;
  resolvedAt: string | null;
}

// =====================================================================
// Phase 7: Advanced Security / Transaction Firewall / Claim / EIP-7702
// =====================================================================

// --- Transaction firewall pipeline ---

export type TxFirewallStage =
  | "PREPARE" | "DECODE" | "VALIDATE" | "ESTIMATE" | "SIMULATE"
  | "STATE_ANALYSIS" | "RISK" | "POLICY" | "INTENT_DIFF"
  | "APPROVAL" | "SIGN" | "SUBMIT" | "VERIFY";

export const TX_FIREWALL_STAGE_ORDER: TxFirewallStage[] = [
  "PREPARE", "DECODE", "VALIDATE", "ESTIMATE", "SIMULATE",
  "STATE_ANALYSIS", "RISK", "POLICY", "INTENT_DIFF",
  "APPROVAL", "SIGN", "SUBMIT", "VERIFY",
];

export type TxFirewallVerdict = "ALLOW" | "BLOCK" | "NEEDS_USER_REVIEW";

export type TxBlockReason =
  | "PHISHING" | "FAKE_CLAIM" | "WRONG_CHAIN" | "WRONG_RECIPIENT"
  | "DANGEROUS_APPROVAL" | "MALICIOUS_SIGNATURE" | "UNKNOWN_CONTRACT"
  | "UNKNOWN_DELEGATION" | "UNSAFE_PERMISSION" | "STALE_APPROVAL"
  | "STALE_SIMULATION" | "SUSPICIOUS_DOMAIN" | "UNEXPECTED_STATE_CHANGE"
  | "MATERIAL_INTENT_CHANGE" | "EIP7702_UNKNOWN_TARGET" | "EIP7702_CHAIN_MISMATCH"
  | "EMERGENCY_STOP" | "NOT_CONFIGURED";

export interface TxIntent {
  intentHash: string;
  action: string; // e.g. "CLAIM", "APPROVE", "TRANSFER", "STAKE", "DELEGATE"
  walletAddress: string;
  chainId: number;
  contractAddress: string | null;
  recipient: string | null;
  token: string | null;
  amount: string | null; // decimal string, never a float
  spender: string | null;
  createdAt: string;
}

export interface TxIntentDiffField {
  field: "action" | "walletAddress" | "chainId" | "contractAddress" | "recipient" | "token" | "amount" | "spender";
  expected: string | null;
  actual: string | null;
  materialChange: boolean;
}

export interface TxIntentDiffResult {
  intentHash: string;
  fields: TxIntentDiffField[];
  hasMaterialChange: boolean;
  evaluatedAt: string;
}

// --- Approval binding ---

export interface TxApproval {
  approvalId: string;
  projectId: string | null;
  campaignId: string | null;
  missionId: string | null;
  taskId: string | null;
  walletAddress: string;
  accountId: string | null;
  chainId: number;
  contractAddress: string | null;
  intentHash: string;
  createdAt: string;
  expiresAt: string;
  status: "ACTIVE" | "EXPIRED" | "USED" | "REVOKED";
  usedAt: string | null;
}

export type ApprovalCheckResult =
  | { ok: true }
  | { ok: false; reason: "STALE_APPROVAL" | "NOT_FOUND"; detail: string };

// --- Simulation freshness ---

export interface SimulationFingerprint {
  simulationId: string;
  intentHash: string;
  blockNumber: string | null;
  timestamp: string;
  rpcProviderId: string | null;
  stateFingerprint: string | null; // hash of relevant on-chain state read during simulation
  succeeded: boolean;
  revertReason: string | null;
}

export interface SimulationFreshnessCheck {
  fresh: boolean;
  reason: "OK" | "TOO_OLD" | "BLOCK_ADVANCED" | "NO_SIMULATION" | "RPC_MISMATCH";
  maxAgeMs: number;
  ageMs: number | null;
}

// --- Risk scoring / policy ---

export type TxRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TxRiskFactor {
  code: TxBlockReason | "LOW_REPUTATION_CONTRACT" | "NEW_CONTRACT" | "UNVERIFIED_SOURCE" | "UPGRADEABLE_PROXY" | "UNLIMITED_APPROVAL";
  weight: number; // 0-100
  detail: string;
}

export interface TxRiskAssessment {
  intentHash: string;
  level: TxRiskLevel;
  score: number; // 0-100
  factors: TxRiskFactor[];
  assessedAt: string;
}

export interface TxPolicyDecision {
  intentHash: string;
  verdict: TxFirewallVerdict;
  blockReasons: TxBlockReason[];
  requiresUserApproval: boolean;
  decidedAt: string;
}

// --- Domain protection ---

export type DomainRiskSignal =
  | "TYPOSQUATTING" | "UNICODE_LOOKALIKE" | "FAKE_SUBDOMAIN"
  | "SUSPICIOUS_REDIRECT" | "URL_SHORTENER" | "UNEXPECTED_DOMAIN" | "KNOWN_PHISHING";

export interface DomainCheckResult {
  domain: string;
  officialDomains: string[];
  isOfficial: boolean;
  signals: DomainRiskSignal[];
  verdict: "SAFE" | "SUSPICIOUS" | "BLOCK";
  checkedAt: string;
}

// --- Contract intelligence ---

export type ContractCapability =
  | "MINT" | "PAUSE" | "BLACKLIST" | "UPGRADEABLE" | "PROXY"
  | "PERMIT" | "PERMIT2" | "MULTICALL" | "DELEGATECALL" | "SELFDESTRUCT";

export interface ContractIntelligenceReport {
  chainId: number;
  address: string;
  status: "CONNECTED" | "DEGRADED" | "NOT_CONFIGURED" | "EXPIRED" | "REVOKED" | "BLOCKED";
  verifiedSource: boolean | null;
  isProxy: boolean | null;
  implementationAddress: string | null;
  ownerAddress: string | null;
  isUpgradeable: boolean | null;
  capabilities: ContractCapability[];
  deploymentAgeDays: number | null;
  knownIncidents: string[];
  lastChangedAt: string | null;
  generatedAt: string;
}

// --- Claim security ---

export interface ClaimSecurityCheck {
  claimId: string;
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
  verdict: TxFirewallVerdict;
  blockReasons: TxBlockReason[];
  evaluatedAt: string;
}

// --- EIP-7702 delegation ---

export interface Eip7702Authorization {
  chainId: number;
  authorizationNonce: string;
  authorityAddress: string; // the EOA granting delegation
  targetAddress: string; // the code/contract being delegated to
  currentChainId: number; // chain the wallet is actually connected to
  intendedChainId: number; // chain the user believes/intends this to apply to
}

export interface Eip7702TargetIntelligence {
  targetAddress: string;
  implementationKnown: boolean;
  isProxy: boolean | null;
  isUpgradeable: boolean | null;
  initializationVerified: boolean;
  storageCompatible: boolean | null;
  auditEvidence: string[];
  sourceStatus: "CONNECTED" | "NOT_CONFIGURED" | "UNKNOWN";
}

export interface Eip7702DelegationDiff {
  currentTarget: string | null;
  proposedTarget: string;
  currentPermissions: string[];
  proposedPermissions: string[];
  affectedAssets: string[];
  upgradeabilityChanged: boolean;
}

export interface Eip7702RiskResult {
  authorization: Eip7702Authorization;
  chainLockOk: boolean;
  targetKnown: boolean;
  verdict: TxFirewallVerdict;
  blockReasons: TxBlockReason[];
  delegationDiff: Eip7702DelegationDiff | null;
  evaluatedAt: string;
}

// --- Anti-Sybil (awareness only, never bypass) ---

export interface AntiSybilSignal {
  signalId: string;
  walletAddress: string;
  code: string;
  detail: string;
  confidence: ClaimConfidence;
  detectedAt: string;
}

export interface AntiSybilAwarenessReport {
  walletAddress: string;
  signals: AntiSybilSignal[];
  note: "AWARENESS_ONLY_NEVER_BYPASSES_PLATFORM_PROTECTIONS";
  generatedAt: string;
}

// --- Emergency stop ---

export type EmergencyStopScope = "ALL_SENSITIVE_OPERATIONS" | "WALLET" | "PROJECT" | "SESSION";

export interface EmergencyStopState {
  active: boolean;
  scope: EmergencyStopScope | null;
  targetId: string | null; // walletAddress/projectId/sessionId depending on scope
  reason: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  readOnlyInvestigationAllowed: true;
}

// --- Prompt-injection defense ---

export type UntrustedContentSource =
  | "WEB" | "DISCORD" | "X" | "TELEGRAM" | "GITHUB" | "QUEST_PAGE" | "CONTRACT_METADATA";

export interface PromptInjectionFinding {
  source: UntrustedContentSource;
  signal: string;
  snippet: string; // truncated/redacted excerpt, never full untrusted payload
  detectedAt: string;
}

export interface PromptInjectionScanResult {
  source: UntrustedContentSource;
  contentTreatedAsData: true;
  findings: PromptInjectionFinding[];
  suspicious: boolean;
  scannedAt: string;
}
