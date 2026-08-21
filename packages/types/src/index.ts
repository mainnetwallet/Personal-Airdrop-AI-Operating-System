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
