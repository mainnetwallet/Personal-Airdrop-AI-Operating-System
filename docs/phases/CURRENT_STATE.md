# CURRENT STATE — Personal Airdrop AI Operating System V12

Last updated: end of Phase 4.

## Current architecture
pnpm monorepo. Fastify API + Drizzle/Postgres + Redis/BullMQ backend.
`packages/core` hosts, all as in-memory libraries not yet wired to
persistence or the API:
- Phase 2: Agent OS Kernel (state machine, event bus, memory, tool
  registry, permission enforcement, run limits)
- Phase 3: Project/Research/Evidence/Campaign/Airdrop intelligence
- Phase 4: Requirement versioning, identity graph, wallet metadata,
  mission/task DAG, eligibility engine, next-best-action

Next.js web app and PC/extension/Android agents are still scaffolded but
empty. See `docs/phases/PHASE-1.md` through `PHASE-4.md` for full detail.

## Completed / tested (this sandbox)
- Monorepo scaffold, fail-closed config loading
- Drizzle schema for 15 tables (13 Phase 1 + `memory_entries` +
  `tool_registry`) + 3 generated SQL migrations
- Device trust-state machine (unit tested)
- Secret redaction (unit tested)
- Device-bound access/refresh token issuance + verification (unit tested)
- Fastify health/readiness endpoints (unit tested with mocked db/redis)
- Agent OS Kernel: 17-state machine, event bus, memory store, tool
  registry, permission-scoped tool execution, run limits — 48 tests
- `TRANSACTION_APPROVAL` confirmed never implicitly granted (test-covered)
- Project lifecycle store (12-state machine) — unit tested
- Evidence graph: sources, content-hashed snapshots, diff/change
  detection, claims, full-lineage evidence, contradiction resolution
  favoring PRIMARY_OFFICIAL over community/rumor regardless of source
  count or reputation — unit tested
- Source reputation tracker (accuracy/availability/freshness,
  weighting signal only) — unit tested
- Research engine: discover/retrieve/normalize/deduplicate/ingest/
  verify/isStale pipeline — unit tested
- Airdrop-type classification (~80 types, falls back to
  UNKNOWN_AIRDROP_TYPE, never throws) — unit tested
- Airdrop adapter contract + registry with NOT_CONFIGURED stub — unit tested
- First real (declarative) tool registered: `source.http_fetch`
- Requirement store: append-only versioning, never overwrites history,
  `versionAt()` historical-backtesting lookup — unit tested
- Identity graph: USER -> 9 account types, never silently merges a
  cross-user conflict, explicit `reassociate()` for intentional
  reassignment — unit tested
- Wallet metadata store (no keys/signing) — unit tested
- Task DAG: structurally cycle-free construction, dependency-gated
  unblocking (READY vs WAITING_HUMAN) — unit tested
- Mission store: validated status transitions, task-derived progress,
  auto-completion — unit tested
- Eligibility engine: per-requirement-version backtested evaluation,
  proof-package generation citing exact requirement versions used —
  unit tested
- `decideNextBestAction()`: pure decision function, all 8 outputs
  covered — unit tested
- Typecheck clean across all 9 packages/apps; 142/142
  @airdrop-os/core tests passing (48 Phase 1–2 + 46 Phase 3 + 48 Phase
  4); 157 tests passing repo-wide excluding the live-DB-only auth suite

## Partial / mocked / not-configured
- `/auth/*` routes exercised against a real local Postgres/Redis (see
  Known bugs) — `/devices/*` has **not** yet been run against a live DB.
- `apps/web`, `apps/local-agent`, `apps/extension`, `apps/android`:
  NOT_CONFIGURED, workspace placeholders only
- `packages/core` (all of Phases 2–4's stores): **in-memory only** — no
  repository layer connects any of it to `packages/database` yet.
  Phases 3 and 4 have now both deferred a persistence layer; flagged in
  PHASE-4.md as a natural point to address together in a future phase
  rather than deferring a third time.
- `ToolRegistry` has one real (declarative) tool entry
  (`source.http_fetch`) but no executor anywhere in the repo yet
- **No real `AirdropAdapter` implementations** — every AirdropType
  resolves to the NOT_CONFIGURED stub
- **`EligibilityEngine`'s satisfaction check is minimum/maximum/chain-
  threshold only** — duration-based requirements (e.g. "held for 30+
  days") are not yet computed from activity timestamps. The historical-
  backtesting mechanism itself (evaluating against the requirement
  version valid at each activity's timestamp) is fully implemented and
  tested; requirement-dimension coverage is partial.
- `decideNextBestAction()`'s risk threshold and
  `EligibilityEngine.deriveState()`'s exact state-derivation boundaries
  are reasonable defaults, not spec-mandated constants — isolated
  single-purpose functions, easy to tune later without touching
  anything else
- No API route exposes the kernel or any Phase 3/4 store yet
- `apps/worker`: only a placeholder heartbeat queue
- Rate limiting: single global limiter only

## Known bugs / security issues
### Phase 1 (fixed via live-DB verification against real Postgres)
1. **`/auth/register` had no transaction** — fixed via
   `db.transaction(...)`.
2. **`formatAgentLabel(1)` was hardcoded** — fixed via a Postgres
   sequence (`agent_label_seq`, migration `0002_majestic_red_ghost.sql`).

Also fixed: malformed `device` object leaking a raw Postgres
constraint name — `validateDevice()` now returns a clean `400`.

Regression tests: `apps/api/src/__tests__/auth.register.test.ts` (runs
against a real Postgres test database).

### Phase 3 (found and fixed via unit testing)
3. **`ResearchEngine.deduplicate()` matched on
   `(projectId, field, valueHash)` instead of `(projectId, field)`.**
   Conflicting values for the same field silently became two
   non-conflicting claims instead of being flagged `CONFLICTED`.
   **Fixed** by matching on field only. See `PHASE-3.md`.

### Phase 4 (test-quality issue found and fixed, no production code change)
4. **Two new tests initially failed** due to calling `create()` then
   `supersede()` back-to-back with real wall-clock timestamps, which
   can land in the same millisecond and make `versionAt()`'s half-open
   interval genuinely ambiguous for that instant (correct interval
   semantics, not a store bug). **Fixed** by using `vi.useFakeTimers()`
   to give the two versions genuine time separation in the test. See
   `PHASE-4.md`.

Caveats still open:
- Concurrent-refresh races and kernel-to-DB persistence races remain
  unverified (Phase 1/2).
- Phase 2 was previously built once already (commit `f7db4b2`) and
  reverted (`df172d1`) with no reason recorded in that revert's commit
  message.
- Phase 3/4's in-memory stores are untested against realistic data
  volumes or concurrent writers.

## Migrations
- `packages/database/drizzle/0000_tearful_rafael_vega.sql` — 13 Phase 1
  tables
- `packages/database/drizzle/0001_mixed_sister_grimm.sql` — Phase 2 tables
- `packages/database/drizzle/0002_majestic_red_ghost.sql` — `agent_label_seq`

No new migration in Phase 3 or Phase 4 (see Partial / not-configured).
All three existing migrations have been applied and exercised against
a real local Postgres instance during the Phase 1 live-DB bug-fix pass.

## API routes
`GET /health`, `GET /readiness`, `POST /auth/register`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/revoke`,
`GET /devices`, `POST /devices/transition`

No kernel-backed or Phase 3/4-backed routes exist yet.

## Environment variables
`NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_SECONDS`, `API_HOST`, `API_PORT`, `RATE_LIMIT_MAX`,
`RATE_LIMIT_WINDOW_MS`, `POSTGRES_PASSWORD`. No new env vars needed for
Phase 2, 3, or 4.

## Required external integrations
None required through Phase 4. Phase 6+ will need browser automation,
Phase 8+ will need Discord/X/Telegram/GitHub API credentials — all
currently NOT_CONFIGURED.

## Next-phase dependencies
Phase 5 (per `PERSONAL_AIRDROP_AI_OS_V12_10_PHASES/PHASE-5.md`, present
in the repo but not yet read in this session) would consume:
`RequirementStore`, `EligibilityEngine`, `MissionStore` + `TaskGraph`,
`IdentityGraph` + `WalletStore`, and `decideNextBestAction()`.

## Exact recommended next action
1. On a machine with Docker: `docker compose up -d`, then
   `pnpm --filter @airdrop-os/database db:migrate`, then confirm
   `/readiness` reports `CONNECTED` for both Postgres and Redis.
2. Manually exercise `/auth/register` → `/auth/login` →
   `/devices/transition` → `/auth/refresh` against the real database.
3. Hand `PHASE-5.md` (confirmed present in
   `PERSONAL_AIRDROP_AI_OS_V12_10_PHASES/`) to Claude in a fresh chat
   pointed at this repository, per the README's sequential-build
   instructions.
