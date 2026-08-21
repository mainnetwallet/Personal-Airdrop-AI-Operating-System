# PHASE 2 — Agent OS Kernel / Event Bus / Memory / Permission

Status: **IMPLEMENTED, UNIT-TESTED** (no live Postgres/Redis in this sandbox — see caveat below, same as Phase 1).

## What was verified before starting

- Inspected `git log`: Phase 1 (`952ac89`) was committed and intact.
  Phase 2 had previously been built (`f7db4b2`) and then **reverted**
  (`df172d1`) with no explanation recorded in the revert commit message.
  Per user instruction, Phase 2 was rebuilt fresh rather than restoring
  the reverted commit.
- `packages/core/src/index.ts` was confirmed `NOT_CONFIGURED` (Phase 1
  placeholder) before any changes — the kernel package was genuinely
  untouched.
- `pnpm -r typecheck` and `pnpm -r test` were run **before** changes to
  confirm Phase 1's baseline (67 tests across config/identity/security/api)
  was green.

## What was implemented

All in `packages/core/src/`:

- **`kernelState.ts`** — the 17-state agent state machine (IDLE,
  THINKING, RESEARCHING, PLANNING, WAITING_FOR_USER,
  WAITING_FOR_APPROVAL, PREPARING, EXECUTING, VERIFYING, CHECKPOINTING,
  RESUMING, LEARNING, FAILED, PAUSED, STOPPED, BLOCKED, COMPLETED) as an
  explicit adjacency list. Invalid/self/out-of-terminal transitions throw
  `InvalidStateTransitionError` rather than silently succeeding.
- **`runLimits.ts`** — enforces `maxSteps`, `maxRuntimeMs`,
  `maxToolCalls`, `maxRetries`, `maxCost` before each step/tool call;
  throws `RunLimitExceededError` with the specific violated limit. No
  infinite loops: a run that hits any ceiling cannot advance except into
  BLOCKED/STOPPED/FAILED/PAUSED.
- **`eventBus.ts`** — `KernelEventBus` with `eventId`, `eventType`,
  `timestamp`, `source`, `agentId`, `deviceId`, `correlationId`,
  `causationId`, `schemaVersion`, and a monotonically increasing
  `sequence` for ordering/gap detection. Type-specific and wildcard
  subscriptions; full log preserved for audit reconstruction.
- **`memory.ts`** — `MemoryStore` covering all 16 memory types and the
  6-state lifecycle (NEW/CONFIRMED/VERIFIED/STALE/CORRECTED/ARCHIVED).
  `correct()` appends to `correctionHistory` rather than overwriting.
  Every write/correction is passed through `redactSecrets()`
  (`@airdrop-os/security`) before being stored — verified by test.
- **`toolRegistry.ts`** — `ToolRegistry` for `name`, `description`,
  `inputSchema`/`outputSchema`, `permission`, `risk`, `supportedDevices`,
  `timeoutMs`, `retryPolicy`, `auditEvent`, `requiresApproval`.
- **`kernel.ts`** — `AgentOSKernel`, the orchestrator:
  - `createRun` / `getRun` / `transitionRun` (validates via
    `kernelState`, checks `runLimits`, emits `run.created` /
    `run.transitioned` events)
  - `callTool` enforces, in order: tool exists → run holds the tool's
    declared `PermissionScope` → target device is supported → run limits
    not exceeded. Every allowed *and* denied call emits an audited
    kernel event (`tool.called` / `tool.denied`).
  - **`TRANSACTION_APPROVAL` is never granted implicitly** — a run must
    already carry that scope in its explicit permission set for a tool
    requiring it to execute; the kernel has no code path that elevates a
    run's permissions on its own. Covered by test
    (`kernel.test.ts` — "never implicitly grants TRANSACTION_APPROVAL").

Types added to `@airdrop-os/types`: `AgentState`,
`StateTransitionRecord`, `RunLimits`, `RunCost`, `AgentRun`,
`KernelEvent`, `MemoryType`, `MemoryLifecycle`, `MemoryCorrection`,
`MemoryEntry`, `ToolRiskLevel`, `RetryPolicy`, `ToolDefinition`.

Schema (`@airdrop-os/database`): `agent_runs` extended with
`context`/`toolsUsed`/`permissions`/`steps`/`toolCalls`/`retries`/
`errors`/`checkpointId`; `events` extended with
`correlationId`/`causationId`/`schemaVersion`; new tables
`memory_entries` and `tool_registry` added. Migration generated:
`packages/database/drizzle/0001_mixed_sister_grimm.sql` (15 tables
total in the schema now).

## Tests

`packages/core` — **48 unit tests, all passing** (`vitest run`):

| File | Tests |
|---|---|
| `kernelState.test.ts` | 7 — valid/invalid/terminal/self transitions |
| `runLimits.test.ts` | 7 — each of the 5 limit types + custom overrides |
| `eventBus.test.ts` | 6 — sequencing, correlation/causation, listeners, log |
| `memory.test.ts` | 8 — lifecycle, correction history, redaction, query |
| `toolRegistry.test.ts` | 6 — registration, lookup, device support |
| `kernel.test.ts` | 14 — run lifecycle, permission enforcement, limit enforcement, audit events |

`pnpm -r typecheck` — clean across all 9 packages/apps.
`pnpm -r test` — **67 tests passing** repo-wide (Phase 1's 19 + Phase 2's
48), nothing broken by these changes.

## Explicitly NOT done in this phase (do not assume otherwise)

- **DB migration was generated but not applied.** No Postgres/Redis
  engine is available in this sandbox (same limitation as Phase 1). The
  `memory_entries`/`tool_registry` tables and the `agent_runs`/`events`
  column additions exist only as schema + generated SQL — **NOT_CONFIGURED
  against a live database.**
- The kernel's `MemoryStore`/event log are **in-memory only** — there is
  no repository layer yet wiring `AgentOSKernel` to
  `packages/database`. That wiring is future-phase work; Phase 2's
  contract was the kernel itself, not persistence integration.
- No concrete tools are registered anywhere yet (`ToolRegistry` is
  empty at boot) — Phase 3+ adapters will register real tools
  (`http.get`, browser actions, etc.). The tools used in tests are
  test fixtures only.
- No API routes expose the kernel yet — that's for whichever phase wires
  `apps/api` to `packages/core` (not specified as in-scope for Phase 2's
  prompt).

## Recommended next action

1. On a machine with Docker: bring up Postgres/Redis, run
   `pnpm --filter @airdrop-os/database db:migrate`, and confirm the new
   tables exist.
2. Then hand `PHASE-3.md` to Claude in a fresh chat pointed at this
   repository, per the README's sequential-build instructions.
