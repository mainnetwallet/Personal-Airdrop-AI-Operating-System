# CURRENT STATE — Personal Airdrop AI Operating System V12

Last updated: end of Phase 2.

## Current architecture
pnpm monorepo. Fastify API + Drizzle/Postgres + Redis/BullMQ backend.
`packages/core` now hosts the Agent OS Kernel (state machine, event bus,
memory, tool registry, permission enforcement, run limits) as an
in-memory library, not yet wired to persistence or the API.
Next.js web app and PC/extension/Android agents are still scaffolded but
empty. See `docs/phases/PHASE-1.md` and `docs/phases/PHASE-2.md` for
full detail.

## Completed / tested (this sandbox)
- Monorepo scaffold, fail-closed config loading
- Drizzle schema for 15 tables (13 Phase 1 + `memory_entries` +
  `tool_registry`) + 2 generated SQL migrations
- Device trust-state machine (unit tested)
- Secret redaction (unit tested)
- Device-bound access/refresh token issuance + verification (unit tested)
- Fastify health/readiness endpoints (unit tested with mocked db/redis)
- Agent OS Kernel: 17-state machine, event bus (ordered, correlated),
  memory store (16 types, 6-stage lifecycle, non-destructive
  corrections), tool registry, permission-scoped tool execution, run
  limits (steps/runtime/tool calls/retries/cost) — 48 unit tests
- `TRANSACTION_APPROVAL` confirmed never implicitly granted (test-covered)
- Typecheck clean across all 9 packages/apps; 67 tests passing repo-wide

## Partial / mocked / not-configured
- `/auth/*` and `/devices/*` routes are implemented but **not yet run
  against a live Postgres/Redis** — no DB engine available in this
  sandbox. Needs verification on a machine with Docker before trusting
  in production.
- `apps/web`, `apps/local-agent`, `apps/extension`, `apps/android`:
  NOT_CONFIGURED, workspace placeholders only
- `packages/core` (Agent OS Kernel): **in-memory only** — no repository
  layer connects it to `packages/database` yet; `AgentRun`/`KernelEvent`/
  `MemoryEntry` are not persisted anywhere durable in this sandbox
- `ToolRegistry` ships empty — no real tools (HTTP, browser, chain RPC,
  etc.) are registered; that's Phase 3+ adapter work
- No API route exposes the kernel yet
- `apps/worker`: only a placeholder heartbeat queue; real job types
  NOT_CONFIGURED
- Rate limiting: single global limiter only, no per-route/per-auth-endpoint
  tuning yet

## Known bugs / security issues
None found in what was built. Caveats:
- Integration-level behavior (real DB constraints, concurrent refresh
  races, kernel-to-DB persistence races) is unverified in this sandbox.
- Phase 2 was previously built once already (commit `f7db4b2`) and
  reverted (`df172d1`) with no reason recorded in that revert's commit
  message. This phase was rebuilt from scratch rather than restoring
  that commit; if the original revert was for a substantive reason,
  it wasn't visible in the repository history available here.

## Migrations
- `packages/database/drizzle/0000_tearful_rafael_vega.sql` — 13 Phase 1
  tables
- `packages/database/drizzle/0001_mixed_sister_grimm.sql` — Phase 2:
  `memory_entries`, `tool_registry` tables + `agent_runs`/`events`
  column additions

Neither migration has been applied to a live database in this sandbox.

## API routes
`GET /health`, `GET /readiness`, `POST /auth/register`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/revoke`,
`GET /devices`, `POST /devices/transition`

No kernel-backed routes exist yet.

## Environment variables
`NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_SECONDS`, `API_HOST`, `API_PORT`, `RATE_LIMIT_MAX`,
`RATE_LIMIT_WINDOW_MS`, `POSTGRES_PASSWORD` (all documented in
`.env.example`, no real secrets committed). No new env vars were needed
for Phase 2.

## Required external integrations
None required through Phase 2. Phase 3+ will need chain RPC providers,
Phase 6+ will need browser automation, Phase 8+ will need
Discord/X/Telegram/GitHub API credentials — all currently
NOT_CONFIGURED, to be added explicitly (never fabricated) when those
phases are built.

## Next-phase dependencies
Phase 3 (Project/Research/Evidence/Campaign) consumes: `AgentOSKernel`
(to run research agents under permission/run-limit enforcement),
`MemoryStore` (RESEARCH_FACT / PROJECT_FACT / PROJECT_EVENT types),
`KernelEventBus` (for research pipeline events), and `ToolRegistry`
(to register the first real tools — HTTP fetch / source retrieval).

## Exact recommended next action
1. On a machine with Docker: `docker compose up -d`, then
   `pnpm --filter @airdrop-os/database db:migrate` (applies both
   migrations), then start the API and confirm `/readiness` reports
   `CONNECTED` for both Postgres and Redis.
2. Manually exercise `/auth/register` → `/auth/login` →
   `/devices/transition` (promote a device to TRUSTED) → `/auth/refresh`
   once against the real database to confirm the Phase 1 flow
   end-to-end.
3. Then hand `PHASE-3.md` to Claude, in a fresh chat pointed at this
   repository, per the README's sequential-build instructions.
