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
- `/auth/*` routes have now been exercised against a real local
  Postgres/Redis (see Known bugs / security issues) — `/devices/*` has
  **not** yet been run against a live DB and should be verified the
  same way before trusting it in production.
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
Two bugs were found and fixed via **live-DB verification** of
`/auth/register` and `/auth/login` against a real Postgres instance —
neither was caught by the original Phase 1 unit-test-only verification,
because both are about actual transactional/constraint behavior that a
mocked db object cannot exercise.

1. **`/auth/register` had no transaction.** The handler did sequential,
   unwrapped inserts: `users` → `agent_identities` → `devices` →
   `device_permissions`. A failure at any step after the first left an
   orphaned `users` row with no agent identity — the account was then
   permanently unrecoverable: login failed (`500 agent identity missing
   for user`) and re-registration failed (`409 account already exists`),
   with no path out. Reproduced live: registering a second real user
   failed (see bug 2) and left exactly that orphaned row, confirmed via
   `psql`. **Fixed** by wrapping the full handler body in
   `db.transaction(async (tx) => { ... })` so any failure rolls back
   everything atomically.
2. **`formatAgentLabel(1)` was hardcoded.** Every registration passed
   the literal `1` instead of a real per-agent sequence number.
   `agent_identities_label_idx` is a unique index on `label`, so the
   *second* real user to register always hit `500 duplicate key value
   violates unique constraint "agent_identities_label_idx"`. Reproduced
   live: user A registered fine (`AIRDROP-USER-001`), user B's
   registration 500'd. **Fixed** by adding a Postgres sequence
   (`agent_label_seq`, migration `0002_majestic_red_ghost.sql`) and
   deriving the label from `nextval('agent_label_seq')` inside the same
   transaction as fix 1 — atomic and race-safe under concurrent
   registrations, without changing the `AIRDROP-USER-NNN` format (kept
   because `packages/identity/src/__tests__/agentIdentity.test.ts`
   asserts that exact format).

Also fixed as part of the same live-DB pass: a malformed/missing
`device` object on `/auth/register` or `/auth/login` (e.g. missing
`name`/`platform`/`version`, or an invalid `type`) previously fell
through to the DB layer and surfaced as a raw `500` with a Postgres
constraint name leaked in the response body. Added `validateDevice()`
input validation so this now fails fast with a clean `400`.

Regression tests: `apps/api/src/__tests__/auth.register.test.ts` (runs
against a real Postgres test database, not mocked) covers distinct
agent labels across two sequential registrations, that a forced
mid-transaction failure leaves no orphaned `users` row, and that a
malformed `device` object returns `400`.

Caveats still open:
- Concurrent-refresh races and kernel-to-DB persistence races remain
  unverified.
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
- `packages/database/drizzle/0002_majestic_red_ghost.sql` — adds
  `agent_label_seq`, a Postgres sequence backing the numeric suffix of
  `agent_identities.label` (see Known bugs / security issues, bug 2)

All three migrations have been applied and exercised against a real
local Postgres instance as part of the live-DB bug-fix pass described
above.

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
