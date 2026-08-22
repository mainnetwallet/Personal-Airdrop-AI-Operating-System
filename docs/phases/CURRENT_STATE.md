# CURRENT STATE — Personal Airdrop AI Operating System V12

Last updated: end of Phase 5.

## Current architecture
pnpm monorepo. Fastify API + Drizzle/Postgres + Redis/BullMQ backend.
`packages/core` hosts, all as in-memory libraries not yet wired to
persistence or the API:
- Phase 2: Agent OS Kernel (state machine, event bus, memory, tool
  registry, permission enforcement, run limits)
- Phase 3: Project/Research/Evidence/Campaign/Airdrop intelligence
- Phase 4: Requirement versioning, identity graph, wallet metadata,
  mission/task DAG, eligibility engine, next-best-action
- Phase 5: RPC manager (failover/circuit breaker), on-chain activity
  types + finality state machine, reorg detection/protection, RPC
  reconciliation, attribution chain, historical state store, snapshot
  proof builder, points/XP ledger, opportunity radar scoring

Next.js web app and PC/extension/Android agents are still scaffolded but
empty. See `docs/phases/PHASE-1.md` through `PHASE-5.md` for full detail.

## Completed / tested (this sandbox)
- Monorepo scaffold, fail-closed config loading
- Drizzle schema for 15 tables (13 Phase 1 + `memory_entries` +
  `tool_registry`) + 3 generated SQL migrations
- Device trust-state machine, secret redaction, device-bound
  access/refresh tokens, health/readiness endpoints — all unit tested
- Agent OS Kernel: 17-state machine, event bus, memory store, tool
  registry, permission-scoped tool execution, run limits
- Project lifecycle, evidence graph (content-hashed snapshots,
  contradiction resolution favoring PRIMARY_OFFICIAL), source
  reputation, research pipeline, airdrop-type classification (~80
  types), adapter registry
- Requirement versioning (append-only, `versionAt()` backtesting),
  identity graph, wallet metadata, task DAG (cycle-free), mission
  store, eligibility engine (per-version backtested), next-best-action
- **Phase 5 (new this session):**
  - `RpcManager`: per-chain primary/backup/backup2/backup3 ordering,
    circuit breaker (opens after 5 consecutive failures, half-opens
    after 60s), rate-limit cooldown, NOT_CONFIGURED for providers with
    no URL — never fabricated healthy
  - `TransactionFinality` state machine: PENDING->INCLUDED->CONFIRMED->
    FINALIZED, REORGED reachable even from FINALIZED, DROPPED/REPLACED
    terminal
  - `detectReorg()`/`applyReorgToActivity()`: identifies exactly the
    activities in a reorged block range, marks REORGED without
    fabricating replacement data
  - `reconcile()`: requires ALL sources (primary/backup RPC, explorer,
    indexer) to agree - one dissenter forces RECONCILIATION_REQUIRED
  - `buildAttribution()`: derives confidence from how much of the
    tx->trace->...->project chain is actually populated
  - `HistoricalStateStore`: append-only, fails closed on missing
    historical data (never substitutes current state), reorg
    invalidation retains records rather than deleting them
  - `buildSnapshotProof()`: refuses to build without at least one
    evidence citation
  - `PointsLedger`: append-only, POINTS/XP kept structurally separate
    (type-enforced, never a token balance), leaderboard/rank/decay
  - `scoreOpportunity()`: confidence-capped scoring across 8 factors,
    explainable breakdown, never implies a guaranteed reward
- Typecheck clean across all 9 packages/apps; **180/180**
  `@airdrop-os/core` tests passing (142 Phase 1-4 + 38 new Phase 5);
  195 tests passing repo-wide excluding the live-DB-only auth suite

## Partial / mocked / not-configured
- `/auth/*` routes exercised against a real local Postgres/Redis in a
  prior session (see Known bugs) - `/devices/*` still not run against
  a live DB
- `apps/web`, `apps/local-agent`, `apps/extension`, `apps/android`:
  NOT_CONFIGURED, workspace placeholders only
- `packages/core` (all of Phases 2-5's stores): **in-memory only** - no
  repository layer connects any of it to `packages/database` yet. This
  is now the **fourth consecutive phase** to defer persistence,
  flagged again as worth addressing together rather than a fifth time
- `RpcManager` has zero real RPC provider URLs configured - no
  Alchemy/Infura/etc. API keys exist in this environment. No real
  network calls are made anywhere in Phase 5; the state-management
  logic is complete but unconnected to any live chain
- No indexer/explorer API integration for `reconcile()` - the shape
  supports it, no adapter calls a real one
- Solana/Sui/Aptos: type placeholders only, no adapter logic
- `ToolRegistry` has one real (declarative) tool entry
  (`source.http_fetch`) but no executor anywhere in the repo yet
- No real `AirdropAdapter` implementations - every AirdropType
  resolves to the NOT_CONFIGURED stub
- `EligibilityEngine`'s satisfaction check is minimum/maximum/chain-
  threshold only - duration-based requirements not yet computed
- No API route exposes the kernel or any Phase 3/4/5 store yet
- `apps/worker`: only a placeholder heartbeat queue
- Rate limiting: single global limiter only
- Gas/volume/frequency/active-days/unique-contracts aggregation
  functions not built this phase - the `OnChainActivity` type captures
  the raw data; rollups are a natural follow-up

## Known bugs / security issues
### Phase 1 (fixed via live-DB verification against real Postgres)
1. `/auth/register` had no transaction - fixed via `db.transaction(...)`.
2. `formatAgentLabel(1)` was hardcoded - fixed via a Postgres sequence.
Also fixed: malformed `device` object leaking a raw Postgres constraint
name - `validateDevice()` now returns a clean `400`.

### Phase 3 (found and fixed via unit testing)
3. `ResearchEngine.deduplicate()` matched on
   `(projectId, field, valueHash)` instead of `(projectId, field)`,
   silently hiding conflicting claims as non-conflicting. Fixed.

### Phase 4 (test-quality issue, no production code change)
4. Two tests initially failed due to real wall-clock timestamps landing
   in the same millisecond; fixed with `vi.useFakeTimers()`.

### Phase 5
No bugs found in what was built this phase - but see Caveats: the
entire phase is untested against a live chain, so integration-level
bugs (real reorg depth, real RPC error shapes, real rate-limit headers)
remain unverified by construction, not because they were checked and
found absent.

Caveats still open:
- Concurrent-refresh races and kernel-to-DB persistence races remain
  unverified (Phase 1/2)
- Phase 2 was previously built once already (commit `f7db4b2`) and
  reverted (`df172d1`) with no reason recorded in that revert's commit
  message
- Phase 3/4/5's in-memory stores are untested against realistic data
  volumes or concurrent writers

## Migrations
- `0000_tearful_rafael_vega.sql` - 13 Phase 1 tables
- `0001_mixed_sister_grimm.sql` - Phase 2 tables
- `0002_majestic_red_ghost.sql` - `agent_label_seq`
No new migration in Phase 3, 4, or 5 (all defer persistence - see
Partial/not-configured).

## API routes
`GET /health`, `GET /readiness`, `POST /auth/register`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/revoke`,
`GET /devices`, `POST /devices/transition`. No kernel- or Phase
3/4/5-backed routes exist yet.

## Environment variables
`NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_SECONDS`, `API_HOST`, `API_PORT`, `RATE_LIMIT_MAX`,
`RATE_LIMIT_WINDOW_MS`, `POSTGRES_PASSWORD`. No new env vars this
phase - real RPC URLs will be needed once network calls are wired up,
not added speculatively without real values.

## Required external integrations
RPC providers per chain (Alchemy/Infura/self-hosted): **NOT_CONFIGURED**.
Block explorers/indexers: **NOT_CONFIGURED**. Phase 8+ will need
Discord/X/Telegram/GitHub API credentials: **NOT_CONFIGURED**.

## Next-phase dependencies
Phase 6 (per `PERSONAL_AIRDROP_AI_OS_V12_10_PHASES/PHASE-6.md`, present
in the repo but not yet read in this session) is Browser / PC Agent /
Extension / Workflow / Checkpoint - expected to consume the kernel's
tool registry and event bus, plus `RequirementStore`/`MissionStore`/
`TaskGraph` from Phase 4, and will likely be the first phase to
actually exercise `RpcManager` if it needs to read on-chain state
during a workflow.

## Exact recommended next action
1. On a machine with Docker: `docker compose up -d`, then
   `pnpm --filter @airdrop-os/database db:migrate`, confirm
   `/readiness` reports CONNECTED for both Postgres and Redis.
2. If/when real RPC provider credentials become available, wire a real
   `ethers`/`viem` client behind `RpcManager.selectProvider()`'s output
   and exercise `reconcile()` against real primary/backup/explorer
   responses before trusting Phase 5 in production.
3. Hand `PHASE-6.md` (confirmed present in
   `PERSONAL_AIRDROP_AI_OS_V12_10_PHASES/`) to Claude in a fresh chat
   pointed at this repository, per the README's sequential-build
   instructions.
