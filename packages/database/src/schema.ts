/**
 * Phase 1 foundational schema.
 *
 * Tables: users, agent_identities, devices, device_capabilities,
 * device_permissions, sessions, refresh_tokens, policies, agent_runs,
 * events, audit_logs, feature_flags, integration_health.
 *
 * Notes:
 * - No table in this file stores raw secrets (seed phrases, private keys,
 *   passwords in plaintext, OTP/2FA secrets, session token *values* are
 *   only ever stored hashed).
 * - `agent_runs` and `events` are foundation stubs; Phase 2 (Agent OS
 *   Kernel) owns their full state machine.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

export const deviceTypeEnum = pgEnum("device_type", [
  "VPS",
  "PC",
  "ANDROID",
  "WEB",
  "CHROME_EXTENSION",
]);

export const deviceTrustStateEnum = pgEnum("device_trust_state", [
  "NEW",
  "PENDING",
  "TRUSTED",
  "LIMITED",
  "SUSPENDED",
  "REVOKED",
]);

export const integrationHealthEnum = pgEnum("integration_health_state", [
  "CONNECTED",
  "DEGRADED",
  "NOT_CONFIGURED",
  "EXPIRED",
  "REVOKED",
  "BLOCKED",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

// One persistent agent identity per user account (e.g. AIRDROP-USER-001),
// independent of any VPS/IP/hostname/browser/device.
export const agentIdentities = pgTable("agent_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // e.g. AIRDROP-USER-001
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: uniqueIndex("agent_identities_user_idx").on(t.userId),
  labelIdx: uniqueIndex("agent_identities_label_idx").on(t.label),
}));

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agentIdentities.id, { onDelete: "cascade" }),
  type: deviceTypeEnum("type").notNull(),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  version: text("version").notNull(),
  status: deviceTrustStateEnum("status").notNull().default("NEW"),
  publicKey: text("public_key"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  agentIdx: index("devices_agent_idx").on(t.agentId),
}));

export const deviceCapabilities = pgTable("device_capabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
}, (t) => ({
  deviceCapIdx: uniqueIndex("device_capabilities_device_name_idx").on(t.deviceId, t.name),
}));

// New devices default to READ_ONLY permission until explicitly trusted.
export const devicePermissions = pgTable("device_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(), // e.g. READ, RESEARCH, BROWSER, ACCOUNT, WALLET_READ, ...
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => ({
  devicePermIdx: uniqueIndex("device_permissions_device_scope_idx").on(t.deviceId, t.scope),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  accessTokenJti: text("access_token_jti").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => ({
  jtiIdx: uniqueIndex("sessions_access_jti_idx").on(t.accessTokenJti),
  deviceIdx: index("sessions_device_idx").on(t.deviceId),
}));

// Refresh tokens are stored hashed, never in plaintext. `family` supports
// rotation + reuse detection: reusing a rotated-out token revokes the family.
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  family: uuid("family").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => ({
  familyIdx: index("refresh_tokens_family_idx").on(t.family),
  deviceIdx: index("refresh_tokens_device_idx").on(t.deviceId),
}));

export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  keyIdx: uniqueIndex("policies_key_idx").on(t.key),
}));

// Phase 2 (Agent OS Kernel): full agent run record. Every field here is
// mirrored by the in-memory AgentRun type/state machine in
// @airdrop-os/core; this table is the durable record of the same data.
export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentRunId: uuid("parent_run_id"),
  agentId: uuid("agent_id").notNull().references(() => agentIdentities.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id),
  goal: text("goal").notNull(),
  context: jsonb("context").notNull().default({}),
  toolsUsed: jsonb("tools_used").notNull().default([]),
  permissions: jsonb("permissions").notNull().default([]),
  status: text("status").notNull().default("IDLE"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull().defaultNow(),
  endTime: timestamp("end_time", { withTimezone: true }),
  result: jsonb("result"),
  errors: jsonb("errors").notNull().default([]),
  cost: jsonb("cost").notNull().default({ toolCalls: 0 }),
  checkpointId: uuid("checkpoint_id"),
}, (t) => ({
  agentIdx: index("agent_runs_agent_idx").on(t.agentId),
  parentIdx: index("agent_runs_parent_idx").on(t.parentRunId),
}));

// Phase 2: full kernel event bus contract, including the
// correlationId/causationId/schemaVersion fields the in-memory
// KernelEventBus (@airdrop-os/core) uses to reconstruct causal chains.
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(),
  source: text("source").notNull(),
  agentId: uuid("agent_id").references(() => agentIdentities.id),
  deviceId: uuid("device_id").references(() => devices.id),
  correlationId: uuid("correlation_id").notNull(),
  causationId: uuid("causation_id"),
  schemaVersion: text("schema_version").notNull().default("1"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  typeIdx: index("events_type_idx").on(t.eventType),
  correlationIdx: index("events_correlation_idx").on(t.correlationId),
}));

export const memoryTypeEnum = pgEnum("memory_type", [
  "USER_PREFERENCE",
  "PROJECT_FACT",
  "PROJECT_EVENT",
  "TASK_HISTORY",
  "WORKFLOW",
  "WORKFLOW_VERSION",
  "FAILURE_RESOLUTION",
  "DECISION",
  "CHECKPOINT_HISTORY",
  "PROJECT_CHANGE",
  "PERSONAL_STRATEGY",
  "ACTIVITY_PATTERN",
  "SUCCESS_PATTERN",
  "FAILURE_PATTERN",
  "RESEARCH_FACT",
  "DECISION_HISTORY",
]);

export const memoryLifecycleEnum = pgEnum("memory_lifecycle", [
  "NEW",
  "CONFIRMED",
  "VERIFIED",
  "STALE",
  "CORRECTED",
  "ARCHIVED",
]);

// Phase 2: durable memory record. `content` never stores secrets - the
// application layer always passes writes through redactSecrets() first
// (see @airdrop-os/core MemoryStore), this table has no column that is
// exempt from that rule. `correctionHistory` preserves every prior
// version of `content` rather than overwriting it.
export const memoryEntries = pgTable("memory_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agentIdentities.id, { onDelete: "cascade" }),
  type: memoryTypeEnum("type").notNull(),
  content: jsonb("content").notNull(),
  source: text("source").notNull(),
  confidence: text("confidence").notNull(), // decimal 0..1, stored as text to avoid float rounding
  lifecycle: memoryLifecycleEnum("lifecycle").notNull().default("NEW"),
  correctionHistory: jsonb("correction_history").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  agentIdx: index("memory_entries_agent_idx").on(t.agentId),
  typeIdx: index("memory_entries_type_idx").on(t.type),
}));

// Phase 2: catalog of tools available to the kernel and the permission/
// risk/device metadata every tool call is checked against (see
// @airdrop-os/core ToolRegistry). This table is descriptive - the
// authoritative enforcement logic lives in code, not in a DB constraint.
export const toolRegistry = pgTable("tool_registry", {
  name: text("name").primaryKey(),
  description: text("description").notNull(),
  inputSchema: jsonb("input_schema").notNull().default({}),
  outputSchema: jsonb("output_schema").notNull().default({}),
  permission: text("permission").notNull(),
  risk: text("risk").notNull(),
  supportedDevices: jsonb("supported_devices").notNull().default([]),
  timeoutMs: text("timeout_ms").notNull(),
  retryPolicy: jsonb("retry_policy").notNull().default({ maxRetries: 0, backoffMs: 0 }),
  auditEvent: boolean("audit_event").notNull().default(true),
  requiresApproval: boolean("requires_approval").notNull().default(false),
});

// Audit logs are append-only from the application's perspective: no
// update/delete path is exposed anywhere in the API.
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: text("actor_type").notNull(), // USER | AGENT | SYSTEM
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  actionIdx: index("audit_logs_action_idx").on(t.action),
  createdIdx: index("audit_logs_created_idx").on(t.createdAt),
}));

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
});

export const integrationHealth = pgTable("integration_health", {
  id: uuid("id").primaryKey().defaultRandom(),
  integrationKey: text("integration_key").notNull(),
  state: integrationHealthEnum("state").notNull().default("NOT_CONFIGURED"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  detail: text("detail"),
}, (t) => ({
  keyIdx: uniqueIndex("integration_health_key_idx").on(t.integrationKey),
}));
