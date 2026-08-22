# CURRENT STATE — Personal Airdrop AI Operating System V12

Last updated: end of Phase 3.

## Current architecture
pnpm monorepo. Fastify API + Drizzle/Postgres + Redis/BullMQ backend.
`packages/core` hosts the Agent OS Kernel (Phase 2: state machine, event
bus, memory, tool registry, permission enforcement, run limits) and now
also Project/Research/Evidence/Campaign/Airdrop intelligence (Phase 3),
all as in-memory libraries, not yet wired to persistence or the API.
Next.js web app and PC/extension/Android agents are still scaffolded but
empty. See `docs/phases/PHASE-1.md`, `PHASE-2.md`, `PHASE-3.md` for full
detail.

## Completed / tested (this sandbox)
- Monorepo scaffold, fail-closed config loading
- Drizzle schema for 15 tables (13 Phase 1 + `memory_entries` +
  `tool_registry`) + 3 generated SQL migrations
- Device trust-state machine (unit tested)
- Secret redaction (unit tested)
- Device-bound access/refresh token issuance + verification (unit tested)
- Fastify health/readiness endpoints (unit tested with mocked db/redis)
- Agent OS Kernel: 17-state machine, event bus (ordered, correlated),
  memory store (16 types, 6-stage lifecycle, non-destructive
  corrections), tool registry, permission-scoped tool execution, run
  limits (steps/runtime/tool calls/retries/cost) — 48 unit tests
- `TRANSACTION_APPROVAL` confirmed never implicitly granted (test-covered)
- Project lifecycle store (12-state machine: DISCOVERED → RESEARCHING →
  VERIFIED → WATCHING/ACTIVE → CLAIMABLE → CLAIMED → COMPLETED, with
  RISKY/REJECTED/EXPIRED escape hatches) — unit tested
- Evidence graph: sources, content-hashed snapshots with diff/change
  detection, claims, evidence with full lineage (source/URL/type/
  retrievedAt/contentHash/knowledgeVersion), contradiction resolution
  that always favors PRIMARY_OFFICIAL-tier evidence over community/
  rumor tiers regardless of source count or reputation — unit tested
- Source reputation tracker (accuracy/availability/freshness, weighting
  signal only, cannot override primary evidence) — unit tested
- Research engine: discover/retrieve/normalize/deduplicate/ingest/
  verify/isStale pipeline over the evidence graph — unit tested
- Airdrop-type classification (~80-type taxonomy, always falls back to
  UNKNOWN_AIRDROP_TYPE, never throws/guesses) — unit tested
- Airdrop adapter contract + registry, with a NOT_CONFIGURED stub
  adapter whose claim() never implies automatic execution — unit tested
- First real tool registered into the Phase 2 ToolRegistry:
  `source.http_fetch` (declarative metadata only, no executor yet)
- Typecheck clean across all 9 packages/apps; 94/94 @airdrop-os/core
  tests passing (48 Phase 1–2 + 46 Phase 3), 109 tests passing repo-wide
  excluding the live-DB-only auth suite

## Partial / mocked / not-configured
- `/auth/*` routes have now been exercised against a real local
  Postgres/Redis (see Known bugs / security issues) — `/devices/*` has
  **not** yet been run against a live DB and should be verified the
  same way before trusting it in production.
- `apps/web`, `apps/local-agent`, `apps/extension`, `apps/android`:
  NOT_CONFIGURED, workspace placeholders only
- `packages/core` (Agent OS Kernel + Phase 3 research/evidence/project/
  campaign stores): **in-memory only** — no repository layer connects
  any of it to `packages/database` yet; nothing from either phase is
  persisted durably in this sandbox
- `ToolRegistry` now has one real (declarative) tool entry
  (`source.http_fetch`) but still no executor anywhere in the repo —
  it cannot actually be invoked yet
- **No real `AirdropAdapter` implementations** — every AirdropType
  resolves to the NOT_CONFIGURED stub; building real per-type adapters
  is Phase 4+ work
- No API route exposes the kernel or Phase 3 research/project stores yet
- `apps/worker`: only a placeholder heartbeat queue; real job types
  (including anything that would back `source.http_fetch`)
  NOT_CONFIGURED
- Rate limiting: single global limiter only, no per-route/per-auth-endpoint
  tuning yet

## Known bugs / security issues
### Phase 1 (fixed via live-DB verification against real Postgres)
1. **`/auth/register` had no transaction.** Sequential unwrapped
   inserts (`users` → `agent_identities` → `devices` →
   `device_permissions`) could leave an orphaned, permanently
   unrecoverable `users` row on a mid-sequence failure. **Fixed** by
   wrapping the handler in `db.transaction(...)`.
2. **`formatAgentLabel(1)` was hardcoded.** Every registration got the
   literal label suffix `1`, so the second real user always hit a
   unique-constraint `500`. **Fixed** via a Postgres sequence
   (`agent_label_seq`, migration `0002_majestic_red_ghost.sql`).

Also fixed in the same pass: a malformed/missing `device` object on
`/auth/register` or `/auth/login` previously leaked a raw Postgres
constraint name in a `500`; `validateDevice()` now fails fast with a
clean `400`.

Regression tests: `apps/api/src/__tests__/auth.register.test.ts` (runs
against a real Postgres test database, not mocked).

### Phase 3 (found and fixed via unit testing, no live DB involved)
3. **`ResearchEngine.deduplicate()` matched on `(projectId, field,
   valueHash)` instead of `(projectId, field)`.** Two observations of
   the same field with *different* values (e.g. conflicting TGE dates
   from two sources) were never recognized as competing facts about
   the same claim — each became its own claim with one piece of
   agreeing evidence, so `detectContradiction()` never saw them
   together and a real contradiction silently went undetected instead
   of surfacing as `CONFLICTED`. Caught by
   `researchEngine.test.ts` (`verify() returns CONFLICTED once
   contradicting evidence is attached, even after being VERIFIED`),
   which failed before the fix. **Fixed** by matching dedup on
   `(projectId, field)` only, so differing values now correctly land as
   competing evidence on the same claim. See `PHASE-3.md` for detail.

Caveats still open:
- Concurrent-refresh races and kernel-to-DB persistence races remain
  unverified (Phase 1/2).
- Phase 2 was previously built once already (commit `f7db4b2`) and
  reverted (`df172d1`) with no reason recorded in that revert's commit
  message. Phase 2 was rebuilt from scratch rather than restoring that
  commit.
- Phase 3's evidence graph, reputation tracker, and stores are entirely
  in-memory and untested against realistic data volumes or concurrent
  writers.

## Migrations
- `packages/database/drizzle/0000_tearful_rafael_vega.sql` — 13 Phase 1
  tables
- `packages/database/drizzle/0001_mixed_sister_grimm.sql` — Phase 2:
  `memory_entries`, `tool_registry` tables + `agent_runs`/`events`
  column additions
- `packages/database/drizzle/0002_majestic_red_ghost.sql` — adds
  `agent_label_seq` (see Known bugs, bug 2)

No new migration this phase — Phase 3's stores have no persistence
layer yet (see Partial / not-configured and `PHASE-3.md`).

All three existing migrations have been applied and exercised against a
real local Postgres instance as part of the Phase 1 live-DB bug-fix pass.

## API routes
`GET /health`, `GET /readiness`, `POST /auth/register`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/revoke`,
`GET /devices`, `POST /devices/transition`

No kernel-backed or Phase-3-backed routes exist yet.

## Environment variables
`NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_SECONDS`, `API_HOST`, `API_PORT`, `RATE_LIMIT_MAX`,
`RATE_LIMIT_WINDOW_MS`, `POSTGRES_PASSWORD` (all documented in
`.env.example`, no real secrets committed). No new env vars were needed
for Phase 2 or Phase 3.

## Required external integrations
None required through Phase 3 (research retrieval is caller-supplied in
this phase, not a live integration). Phase 6+ will need browser
automation for actual source retrieval; Phase 8+ will need
Discord/X/Telegram/GitHub API credentials — all currently
NOT_CONFIGURED, to be added explicitly (never fabricated) when those
phases are built.

## Next-phase dependencies
A Phase 4 (per the original 10-phase plan; `PHASE-4.md` was not present
in this repository/session) would consume: `ProjectStore` (read/update
projects), `ResearchEngine` + `EvidenceGraph` (ingest/verify claims),
`AirdropAdapterRegistry` (register real per-type adapters replacing the
NOT_CONFIGURED stub), `CampaignStore` (track live campaign timelines),
and the `source.http_fetch` tool declaration (once an executor exists).

## Exact recommended next action
1. On a machine with Docker: `docker compose up -d`, then
   `pnpm --filter @airdrop-os/database db:migrate` (applies all three
   migrations), then start the API and confirm `/readiness` reports
   `CONNECTED` for both Postgres and Redis.
2. Manually exercise `/auth/register` → `/auth/login` →
   `/devices/transition` (promote a device to TRUSTED) → `/auth/refresh`
   once against the real database to confirm the Phase 1 flow
   end-to-end.
3. `PHASE-4.md` does not exist in this repository — it will need to be
   written (following the same format as PHASE-1/2/3.md) before the
   next phase can be handed to a fresh Claude session per the README's
   sequential-build instructions.
