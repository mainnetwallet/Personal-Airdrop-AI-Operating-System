# CURRENT STATE — Personal Airdrop AI Operating System V12

Last updated: end of Phase 2.

## Current architecture
pnpm monorepo. Fastify API + Drizzle/Postgres + Redis/BullMQ backend.
Agent OS Kernel (`packages/core`) is now implemented as an in-process
library: agent run state machine, event bus, memory store, tool
registry/permission gate, and run resource limits. Next.js web app and
PC/extension/Android agents are scaffolded but still empty. See
`docs/phases/PHASE-1.md` and `docs/phases/PHASE-2.md` for full detail.

## Completed / tested (this sandbox)
- Everything from Phase 1 (monorepo scaffold, 13 foundational tables,
  device trust state machine, secret redaction, device-bound token
  issuance, health/readiness endpoints) — re-verified green, not just
  assumed.
- Phase 2 `@airdrop-os/core`:
  - 17-state agent run state machine with logged transitions
  - Event bus with correlationId/causationId/schemaVersion and
    idempotent publish-by-eventId
  - Run resource limiter (steps/runtime/tool calls/retries/cost)
  - Memory store: 16 memory types, 6-state lifecycle, secret redaction
    on every write, correction history preserved
  - Tool registry + permission gate: denies missing permission,
    unsupported device, or missing explicit approval for
    TRANSACTION_APPROVAL / requiresApproval tools
  - `AgentOsKernel` integrating all of the above
  - 39 unit tests, all passing; `pnpm -r typecheck` and `pnpm -r test`
    clean across all 12 packages/apps

## Partial / mocked / not-configured
- Kernel is in-memory only; a DB-backed persistence adapter for
  `agent_runs`/`events`/`memory_entries` is NOT_CONFIGURED (near-term
  follow-up, not required by Phase 2's contract)
- Migration `0001_flaky_king_bedlam.sql` (agent_runs/events extensions +
  memory_entries + tool_registry) generated but **not applied** to a
  live database — no Postgres engine in this sandbox
- `ToolRegistry` starts empty; no real tools registered until Phase 3+
- `apps/web`, `apps/local-agent`, `apps/extension`, `apps/android`:
  still NOT_CONFIGURED, workspace placeholders only
- `apps/worker`: still only the Phase 1 placeholder heartbeat queue;
  real job types NOT_CONFIGURED

## Known bugs / security issues
None found. Secret redaction verified in memory writes.
TRANSACTION_APPROVAL / requiresApproval auto-grant is explicitly blocked
and unit-tested.

## Migrations
- `0000_tearful_rafael_vega.sql` (Phase 1) — 13 foundational tables
- `0001_flaky_king_bedlam.sql` (Phase 2) — agent_runs/events extensions,
  memory_entries, tool_registry
Neither has been applied to a live database in this sandbox.

## API routes
Unchanged from Phase 1: `GET /health`, `GET /readiness`,
`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
`POST /auth/revoke`, `GET /devices`, `POST /devices/transition`. Phase 2
added no new routes (kernel is a library, not yet wired into the API).

## Environment variables
Unchanged from Phase 1 — see `.env.example`.

## Required external integrations
None required through Phase 2. Phase 3+ will need chain RPC providers,
Phase 6+ browser automation, Phase 8+ Discord/X/Telegram/GitHub API
credentials — all NOT_CONFIGURED, to be added explicitly (never
fabricated) when those phases are built.

## Next-phase dependencies
Phase 3 (Project/Research/Evidence/Campaign) consumes: `AgentOsKernel`
(to drive RESEARCHING/PLANNING state and register research tools),
`MemoryStore` (RESEARCH_FACT/PROJECT_FACT entries), `ToolRegistry`
(registering its adapters), and the `agent_runs`/`events`/
`memory_entries` schema.

## Exact recommended next action
1. On a machine with Docker: `docker compose up -d`, then
   `pnpm --filter @airdrop-os/database db:migrate` to apply both
   migrations, then confirm `/readiness` reports CONNECTED.
2. Then hand Phase 3's prompt to Claude, in a fresh chat pointed at this
   repository, per the README's sequential-build instructions.
