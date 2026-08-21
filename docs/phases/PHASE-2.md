# PHASE 2 — Agent OS Kernel / Event Bus / Memory / Permission

## Verified before starting
Read `docs/phases/CURRENT_STATE.md` and `docs/phases/PHASE-1.md`. Confirmed
Phase 1's actual repo state (not just its report) by inspecting
`packages/database/src/schema.ts`, `packages/identity`, `packages/security`,
`apps/api`, `apps/worker`, and running `pnpm -r typecheck` / `pnpm -r test`
before making any change. Phase 1's 13 foundational tables, device trust
state machine, token issuance, and health endpoints were all present and
green, matching the Phase 1 report. `packages/core` was an untouched
`NOT_CONFIGURED` placeholder as Phase 1 left it.

## Implemented / tested (this sandbox)
- **`packages/core`** (`@airdrop-os/core`, `KERNEL_STATUS = "IMPLEMENTED"`):
  - `kernelState.ts` — the 17-state agent state machine (IDLE ... COMPLETED)
    with an explicit transition table, `AgentRunStateMachine` that logs
    every transition, and `InvalidAgentStateTransitionError` for anything
    not in the table (no route to jump straight to a terminal state).
  - `eventBus.ts` — `KernelEventBus`: correlationId/causationId/
    schemaVersion on every event, idempotent `publish()` by `eventId`
    (a duplicate publish is not re-delivered), wildcard + typed
    subscriptions, and a subscriber throwing never blocks delivery to
    other subscribers.
  - `runLimits.ts` — `RunLimitTracker` enforcing maxSteps/maxRuntimeMs/
    maxToolCalls/maxRetries/maxCostUsd; throws `RunLimitExceededError`
    immediately on the step that would exceed a limit (no unbounded
    loop is possible through this class).
  - `memory.ts` — `MemoryStore` covering all 16 memory types and the
    NEW → CONFIRMED/VERIFIED/STALE/CORRECTED → ARCHIVED lifecycle
    (ARCHIVED is terminal); every write passes through
    `@airdrop-os/security`'s `redactSecrets()`; `correct()` preserves
    prior content in `correctionHistory` rather than discarding it.
  - `toolRegistry.ts` — `ToolRegistry` with per-tool permission/risk/
    device/timeout/retry/approval metadata; `assertCallAllowed()` denies
    a call missing the required permission, an unsupported device, or a
    missing explicit `approved: true` for `TRANSACTION_APPROVAL` or any
    tool with `requiresApproval: true`. There is no code path that grants
    signing authority automatically.
  - `kernel.ts` — `AgentOsKernel` ties the above together: `createRun`,
    `transitionRun`, `callTool`, `recordError`, each emitting the
    corresponding event and enforcing run limits before applying any
    change.
  - 39 unit tests across 6 files, all passing (`pnpm --filter
    @airdrop-os/core test`). Full monorepo `pnpm -r typecheck` and
    `pnpm -r test` are green (Phase 1's tests are untouched and still
    pass).
- **`packages/database/src/schema.ts`**: extended `agent_runs` (context,
  toolsUsed, permissions, errors, checkpointId) and `events`
  (correlationId, causationId, schemaVersion) to the full Phase 2
  contract; added `memory_entries` and `tool_registry` tables. Generated
  via `drizzle-kit generate` → `drizzle/0001_flaky_king_bedlam.sql`
  (additive only — no existing column dropped or renamed, Phase 1 data
  is preserved).
- **`packages/types/src/index.ts`**: added `AgentState`, `AgentRun`,
  `KernelEvent`, `MemoryType`/`MemoryLifecycle`/`MemoryEntry`,
  `ToolDefinition`, `RunLimitConfig`.

## Partial / mocked / not-configured
- The kernel above is a pure in-process implementation (no DB
  persistence layer wired in yet) — `AgentOsKernel` holds runs/events in
  memory only. A repository-backed adapter (writing `agent_runs`,
  `events`, `memory_entries` on every kernel mutation) is
  **NOT_CONFIGURED** and is next-phase/near-term work, not part of this
  phase's contract.
- Migration `0001_flaky_king_bedlam.sql` has **not been applied to a
  live database** — no Postgres engine is available in this sandbox,
  same constraint as Phase 1. Needs `pnpm db:migrate` on a machine with
  Docker before trusting the new tables in production.
- No tools are registered by default; `ToolRegistry` is an empty
  registry until Phase 3+ adapters register real tools.
- No API routes were added for runs/events/memory in this phase — the
  kernel is a library consumed by `apps/api`/`apps/worker` in later
  phases, per "implement only the current phase."

## Known bugs / security issues
None found. `redactSecrets()` reuse in `MemoryStore` was
unit-tested (secret-shaped keys are stripped before persistence).
`TRANSACTION_APPROVAL` auto-grant was explicitly tested and confirmed
blocked without `approved: true`.

## Migrations
`packages/database/drizzle/0001_flaky_king_bedlam.sql` — adds columns
to `agent_runs`/`events`, adds `memory_entries` + `tool_registry`
tables and their enums. Not yet applied to a live database.

## API routes / environment variables
No new routes or environment variables in this phase.

## Required external integrations
None required for Phase 2 itself.

## Next-phase dependencies
Phase 3 (Project/Research/Evidence/Campaign) will register its research
tools in `ToolRegistry`, write `MemoryEntry` records of type
`RESEARCH_FACT`/`PROJECT_FACT`, and drive `AgentRunStateMachine`
through RESEARCHING/PLANNING for discovery work.

## Exact recommended next action
1. On a machine with Docker: apply `0001_flaky_king_bedlam.sql` via
   `pnpm db:migrate` and confirm it applies cleanly on top of Phase 1's
   schema.
2. Then hand Phase 3's prompt to Claude, in a fresh chat pointed at this
   repository, per the README's sequential-build instructions.

STOP after Phase 2.
