# CURRENT STATE — Personal Airdrop AI Operating System V12

Last updated: end of Phase 6.

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
- Phase 6: PC agent job authorization, browser session isolation, safe
  browser event capture (name-based redaction), checkpointing,
  workflow engine (versioned, gated, regression-pause), teach-agent
  (observe -> draft, human decides SAVE/EDIT/DISCARD), CAPTCHA handoff
  state machine (never solves/bypasses), crash/network recovery
  (RESTORE -> VERIFY -> RESUME)

`apps/local-agent` and `apps/extension` are now real, tested wiring
around Phase 6's core logic (job auth, session isolation, checkpoints,
safe event redaction, teach sessions) but NOT_CONFIGURED for live
execution — no Playwright browser, no reachable VPS, no Chrome runtime
in this sandbox. `apps/web` and `apps/android` are still empty
scaffolds. See `docs/phases/PHASE-1.md` through `PHASE-6.md` for full
detail.

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
- RPC manager (failover/circuit breaker/rate-limit), finality state
  machine, reorg detection, RPC reconciliation (all-sources-agree),
  attribution chain, historical state store, snapshot proof builder,
  points/XP ledger, opportunity radar scoring (see Phase 5 doc for
  detail — unchanged this phase)
- **Phase 6 (new this session):**
  - `PcAgentAuthorizer`: time-boxed, scope-bound job authorizations;
    checks validity/device-binding/scope on every call, never trusts a
    previously-valid result
  - `BrowserSessionManager`: isolation-key-based session separation
    (project/campaign/mission/wallet/account/profile/chain/device all
    must match) for both CONTROLLED_BROWSER and USER_BROWSER_EXTENSION
    modes; refuses a duplicate OPEN session for the same isolation
    context
  - `toSafeBrowserEvent()`/`BrowserEventStore`: strips any
    element-metadata field whose NAME looks sensitive
    (password/seed/private-key/OTP/2FA/recovery-code/card/CVV/token),
    decided on field name only, never value
  - `CheckpointManager`: stores only safe state, refuses to checkpoint
    a field that looks sensitive; `checkCompatibility()` requires exact
    schema/agent/workflow version match before any resume
  - `WorkflowStore`/`WorkflowRunner`: append-only version history
    (V1/V2/... never overwritten), dependency-validated steps
    (structurally cycle-free), HUMAN_GATE/APPROVAL_GATE steps pause
    rather than run through, `handlePossibleRegression()` pauses a run
    that fails after a prior success at the same version instead of
    silently retrying
  - `TeachAgentSession`: observe-only during teaching, confidence
    capped by redaction/thinness of the observation, user always makes
    the final SAVE/EDIT/DISCARD call
  - `CaptchaHandoff`: strict DETECTED->PAUSED->CHECKPOINTED->
    AWAITING_USER->USER_COMPLETED->VERIFIED->RESUMED state machine —
    no transition solves or bypasses anything; `verify()` only accepts
    a caller-supplied real-page confirmation
  - `RecoveryManager`: RESTORE->VERIFY->RESUME with explicit
    BLOCKED_NO_CHECKPOINT / BLOCKED_INCOMPATIBLE_CHECKPOINT /
    BLOCKED_VERIFICATION_FAILED outcomes — never silently resumes
  - `apps/local-agent`: fail-closed env config
    (VPS_API_URL/DEVICE_ID/DEVICE_REFRESH_TOKEN), `LocalAgent` class
    wiring the above together, health reporting;
    `connectToVps()`/`launchBrowser()` are explicit NOT_CONFIGURED stubs
  - `apps/extension`: real MV3 `manifest.json`, fail-closed zod message
    schema (`messages.ts`), `ExtensionBackground.handleMessage` routing
    into the *same* redaction/teach-session logic as the PC agent path,
    `buildObservationMessage()` for content-script message construction;
    `registerMessageListener()`/`authenticateDevice()`/`attachObservers()`
    are explicit NOT_CONFIGURED stubs
- Typecheck clean across all 11 packages/apps that have a `typecheck`
  script (`apps/web`, `apps/android` don't); **233/233**
  `@airdrop-os/core` tests passing (180 Phase 1-5 + 53 new Phase 6),
  plus **14/14** new `apps/extension` tests; 253 tests passing
  repo-wide excluding the live-DB-only auth suite

## Partial / mocked / not-configured
- `/auth/*` routes exercised against a real local Postgres/Redis in a
  prior session (see Known bugs) - `/devices/*` still not run against
  a live DB. This sandbox has no Docker, so the 3 live-DB `auth`
  integration tests fail here with ECONNREFUSED — expected, not a
  regression
- `apps/web`, `apps/android`: NOT_CONFIGURED, empty workspace
  placeholders
- `apps/local-agent`: real job-auth/session/checkpoint wiring, but
  `connectToVps()` and `launchBrowser()` are NOT_CONFIGURED — no
  reachable VPS and no permitted network path to Playwright's browser
  binaries from this sandbox
- `apps/extension`: real message-validation/routing logic, but
  `registerMessageListener()`, `authenticateDevice()`, and
  `attachObservers()` are NOT_CONFIGURED — no Chrome extension runtime
  or DOM available here, and no reachable VPS for the device-auth
  handshake
- `packages/core` (all of Phases 2-6's stores): **in-memory only** - no
  repository layer connects any of it to `packages/database` yet. This
  is now the **fifth consecutive phase** to defer persistence, flagged
  again as worth addressing together rather than a sixth time
- `RpcManager` has zero real RPC provider URLs configured - no
  Alchemy/Infura/etc. API keys exist in this environment
- No indexer/explorer API integration for `reconcile()` - the shape
  supports it, no adapter calls a real one
- Solana/Sui/Aptos: type placeholders only, no adapter logic
- `ToolRegistry` has one real (declarative) tool entry
  (`source.http_fetch`) but no executor anywhere in the repo yet
- No real `AirdropAdapter` implementations - every AirdropType
  resolves to the NOT_CONFIGURED stub
- `EligibilityEngine`'s satisfaction check is minimum/maximum/chain-
  threshold only - duration-based requirements not yet computed
- No API route exposes the kernel or any Phase 3/4/5/6 store yet
- `apps/worker`: only a placeholder heartbeat queue
- Rate limiting: single global limiter only
- Gas/volume/frequency/active-days/unique-contracts aggregation
  functions not built - the `OnChainActivity` type captures the raw
  data; rollups are a natural follow-up
- `WorkflowRunner` has no retry/backoff policy beyond the
  regression-pause signal
- `detectCaptchaType()` is a name-only heuristic against
  caller-supplied page signals, not a real DOM/page inspector

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
No bugs found in what was built that phase - the entire phase remains
untested against a live chain, so integration-level bugs (real reorg
depth, real RPC error shapes, real rate-limit headers) remain
unverified by construction, not because they were checked and found
absent.

### Phase 6
5. `apps/local-agent/src/index.ts` imported `BrowserIsolationKey` and
   `BrowserMode` from `@airdrop-os/core`, but those types are only
   defined in and exported by `@airdrop-os/types` - `core` never
   re-exports them. This broke the whole-repo typecheck baseline before
   any new Phase 6 app code was added on top. Fixed by importing them
   from `@airdrop-os/types` directly (already a declared dependency).
   Found by running the full-repo typecheck baseline before writing
   anything new, per the "verify prior claims" contract.

Caveats still open:
- Concurrent-refresh races and kernel-to-DB persistence races remain
  unverified (Phase 1/2)
- Phase 2 was previously built once already (commit `f7db4b2`) and
  reverted (`df172d1`) with no reason recorded in that revert's commit
  message
- Phase 3/4/5/6's in-memory stores are untested against realistic data
  volumes or concurrent writers
- Phase 6's `apps/local-agent`/`apps/extension` wiring has never run
  against a real browser, VPS, or Chrome runtime — only the pure logic
  underneath has been exercised

## Migrations
- `0000_tearful_rafael_vega.sql` - 13 Phase 1 tables
- `0001_mixed_sister_grimm.sql` - Phase 2 tables
- `0002_majestic_red_ghost.sql` - `agent_label_seq`
No new migration in Phase 3, 4, 5, or 6 (all defer persistence - see
Partial/not-configured).

## API routes
`GET /health`, `GET /readiness`, `POST /auth/register`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/revoke`,
`GET /devices`, `POST /devices/transition`. No kernel- or Phase
3/4/5/6-backed routes exist yet.

## Environment variables
API: `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_SECONDS`, `API_HOST`, `API_PORT`, `RATE_LIMIT_MAX`,
`RATE_LIMIT_WINDOW_MS`, `POSTGRES_PASSWORD`.
`apps/local-agent` (new this phase): `VPS_API_URL`, `DEVICE_ID`,
`DEVICE_REFRESH_TOKEN`, `AGENT_VERSION` - fail-closed via zod, no
insecure defaults. Real RPC provider URLs will still be needed once
Phase 5's network calls are wired up.

## Required external integrations
RPC providers per chain (Alchemy/Infura/self-hosted): **NOT_CONFIGURED**.
Block explorers/indexers: **NOT_CONFIGURED**. Playwright browser
binaries: **NOT_CONFIGURED**. Live VPS endpoint: **NOT_CONFIGURED**.
Chrome extension runtime (to load/test `manifest.json`):
**NOT_CONFIGURED**. Phase 8+ will need Discord/X/Telegram/GitHub API
credentials: **NOT_CONFIGURED**.

## Next-phase dependencies
Phase 6's `WorkflowStore`/`WorkflowRunner`, `CheckpointManager`, and
`BrowserSessionManager` are the natural foundation for whichever phase
first wires a real Playwright browser or Chrome runtime end-to-end, and
for the still-deferred persistence phase (now five phases running
in-memory-only).

## Exact recommended next action
1. On a machine with Docker: `docker compose up -d`, then
   `pnpm --filter @airdrop-os/database db:migrate`, confirm
   `/readiness` reports CONNECTED for both Postgres and Redis, and that
   the 3 currently-ECONNREFUSED `apps/api` auth tests pass against a
   real database.
2. On a machine with a display and permitted network access to
   Playwright's browser-binary CDN: install Playwright in
   `apps/local-agent`, wire `launchBrowser()` for real, and exercise a
   full teach -> workflow -> checkpoint -> resume cycle against an
   actual page before trusting Phase 6 in production.
3. Load `apps/extension/manifest.json` in a real Chrome instance, wire
   `attachObservers()`/`registerMessageListener()` for real, and
   complete the `CHROME_EXTENSION` device-auth handshake
   (`authenticateDevice()`) against a live VPS API.
4. If/when real RPC provider credentials become available, wire a real
   `ethers`/`viem` client behind `RpcManager.selectProvider()`'s output.
5. Consider a dedicated persistence phase to connect
   `packages/core`'s five phases of in-memory stores to
   `packages/database`, rather than deferring a sixth time.
