# CURRENT STATE — Personal Airdrop AI Operating System V12

Last updated: end of Phase 9.

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
- Phase 7: Transaction firewall (prepare->decode->validate->estimate->
  simulate->state analysis->risk->policy->intent diff->approval->sign->
  submit->verify), domain protection, contract intelligence, approval
  binding, simulation freshness, risk/policy engine, claim security,
  EIP-7702 delegation risk (unknown target BLOCKs by default, chain
  lock), anti-Sybil awareness (never bypasses), emergency stop
  (read-only investigation always allowed), prompt-injection scanner
  for untrusted web/Discord/X/Telegram/GitHub/quest/contract content
- Phase 8: `IntegrationRegistry` (per-provider CONNECTED/DEGRADED/
  NOT_CONFIGURED/EXPIRED/REVOKED/BLOCKED status for 14 external
  services), generic mock off-chain `AirdropAdapter` factory + 13
  category-group registration (Discord, social, quest, developer,
  DePIN, AI/compute, gaming/GameFi, prediction/trading — no autonomous
  trading, referral, ambassador/creator, exchange — no auto-execute,
  waitlist/beta, learn-to-earn), Plugin SDK (`PluginRegistry`: unknown
  plugin DISABLED by default, activation never grants a permission
  beyond the plugin's own manifest, integrity-hash mismatch BLOCKs)
- Phase 9: Android control-client scaffold, multi-device shared Agent
  Identity (`DeviceRegistry`, split-brain protection), cross-device
  checkpoint compatibility (`MultiDeviceCheckpointStore`), generalized
  CHECKPOINT->RESTORE->VERIFY->RESUME recovery across 8 failure
  domains (`MultiDeviceRecoveryCoordinator`), encrypted backup manifest
  builder + store (`buildBackupManifest`/`BackupStore`), restore
  verification (`verifyRestore`), migration dry run + rollback-safe
  executor (`planMigrationDryRun`/`executeMigration`), disaster
  recovery test orchestration (`runDisasterRecoveryTest`)

`apps/local-agent` and `apps/extension` are real, tested wiring around
Phase 6's core logic (job auth, session isolation, checkpoints, safe
event redaction, teach sessions) but NOT_CONFIGURED for live execution —
no Playwright browser, no reachable VPS, no Chrome runtime in this
sandbox. `apps/web` (added post-Phase-9, see "apps/web" below) is a
real Next.js console wired to whatever `apps/api` actually exposes
(auth + devices) with honest "not wired" placeholders for Phase 2-9's
domain logic. `apps/android` is still an empty scaffold (it documents
its 18 required screens per Phase 9, but has no Android SDK/emulator/
Gradle toolchain in this sandbox). Phase 7's transaction firewall,
Phase 8's off-chain adapters, and Phase 9's multi-device/backup/
migration modules are not yet wired into any app or into `apps/api` —
see Next-phase dependencies. See
`docs/phases/PHASE-1.md` through `PHASE-9.md` for full detail.

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
  detail — unchanged since)
- Phase 6: PC agent job authorization, browser session isolation
  (isolation-key based), safe browser event capture (name-based
  redaction), checkpointing (schema/agent/workflow version compatible
  only), workflow engine (versioned, gated, regression-pause),
  teach-agent (observe-only, human SAVE/EDIT/DISCARD), CAPTCHA handoff
  (never solves/bypasses), crash/network recovery
  (RESTORE->VERIFY->RESUME); `apps/local-agent`/`apps/extension` real
  wiring around it (see Phase 6 doc for detail — unchanged this phase)
- Phase 7, all in `packages/core/src/tx/`: transaction firewall
  (13-stage pipeline), domain protection, contract intelligence,
  intent diff, approval binding, simulation freshness, risk/policy
  engine, claim security, EIP-7702 delegation risk, anti-Sybil
  awareness, emergency stop, prompt-injection scanner (see Phase 7 doc
  for detail — unchanged since)
- Phase 8: `IntegrationRegistry`, mock off-chain adapter factory + 13
  category-group registration, Plugin SDK (see Phase 8 doc for detail
  — unchanged since)
- **Phase 9 (new this session), all in `packages/core/src/multidevice/`:**
  - `DeviceRegistry`: one Agent Identity shared across
    VPS/PC/Android/Web/Chrome Extension; new devices always start
    `STANDBY`; `receivesSecrets` fixed `false` for
    `ANDROID`/`WEB`/`CHROME_EXTENSION`; `promoteToActive()` is the only
    path to `ACTIVE` and always demotes any prior `ACTIVE` holder under
    the same `agentId` first — `isSplitBrainFree()` provably holds
  - `MultiDeviceCheckpointStore`: extends Phase 6's `CheckpointVersions`
    with project/campaign/requirement version + browser-state/
    wallet-account-context/security-state hashes; a mismatch on any
    single dimension is `INCOMPATIBLE`, never a partial match
  - `MultiDeviceRecoveryCoordinator`: generalizes Phase 6's
    CHECKPOINT->RESTORE->VERIFY->RESUME to VPS/worker/PC/browser/
    network/RPC/Android/session failure domains; missing or
    incompatible checkpoints route to `DO_NOT_RESUME`, never a
    best-effort resume
  - `buildBackupManifest()`/`BackupStore`: builds a manifest over the
    exact Phase-9-named entity set, refuses any record containing a
    secret-looking field, only marks `encrypted: true` when the caller
    reports encryption actually ran, and a fresh manifest's
    `integrityStatus` starts `UNVERIFIED` (never fabricated `VERIFIED`)
  - `verifyRestore()`: checks counts, content hashes, a
    caller-supplied relationship checker, and checkpoint/workflow
    presence; omitting a relationship checker fails verification rather
    than passing by default
  - `planMigrationDryRun()`/`executeMigration()`: dry run surfaces ID
    conflicts, missing dependencies, invalid checkpoints, schema drift,
    unsupported target plugins, feature degradations —
    `SAFE_TO_PROCEED` only when all are empty; executor refuses to run
    a `BLOCKED` dry run and rolls back (never leaves partial state) if
    `applyFn` throws
  - `runDisasterRecoveryTest()`: orchestrates
    backup->destroy(test-instance)->restore->verify-identity->
    verify-relationships; identity/relationship checks only run after
    a `PASSED` restore, never fabricated on a failed one
  - `apps/android`: NOT_CONFIGURED scaffold documenting the 18 required
    screens and the split-brain-safe multi-device role
- Typecheck clean across all 13 packages/apps that have a `typecheck`
  script (`apps/web`, `apps/android` don't); **354/354**
  `@airdrop-os/core` tests passing (321 Phase 1-8 + 33 new Phase 9),
  plus **14/14** `apps/extension`, **6/6** `@airdrop-os/identity`,
  **6/6** `@airdrop-os/security`, **3/3** `@airdrop-os/config` tests
  (all unchanged/re-verified this phase), for
  354+14+6+6+3=**383 non-live-DB tests passing repo-wide** (excludes
  the 3 live-DB-only `apps/api` auth tests, which fail here with
  ECONNREFUSED as expected — no Postgres in this sandbox)

## Partial / mocked / not-configured
- All 14 Phase 8 `IntegrationProvider`s (`DISCORD`, `X`, `TELEGRAM`,
  `GITHUB`, `QUEST_PLATFORM`, `DEPIN_NETWORK`, `AI_COMPUTE_PLATFORM`,
  `GAMEFI_PLATFORM`, `PREDICTION_TRADING_PLATFORM`,
  `REFERRAL_PLATFORM`, `AMBASSADOR_PLATFORM`, `EXCHANGE`,
  `WAITLIST_PLATFORM`, `LEARN_PLATFORM`): **NOT_CONFIGURED** — no real
  credentials exist in this environment
- Phase 8's off-chain adapters and Plugin SDK are not wired into
  `apps/api`, `apps/worker`, `apps/local-agent`, or `apps/extension`
  yet — `packages/core` library only, same as Phases 2-7
- Plugin SDK has no actual sandboxed execution runtime (process
  isolation, resource-limit enforcement) — it is the registration/
  authorization/permission-intersection layer only
- **Phase 9, new this session:** no real encryption implementation —
  `buildBackupManifest()`'s `encrypted` flag is caller-reported, not
  self-performed; `defaultHash()` is a simple deterministic checksum
  for integrity comparison, not cryptographic (a real deployment
  should inject SHA-256 or similar via `hashFn`); no real cross-device
  transport exists (no VPS<->VPS/PC<->PC/PC<->VPS sync protocol, no
  Android build) — `executeMigration()`'s `applyFn`/`rollbackFn` are
  caller-supplied hooks, same pattern as Phase 7's firewall stages
  needing real RPC/explorer data; `apps/android` remains an empty
  workspace placeholder like `apps/web`; multi-device modules are not
  wired into `apps/api` or any running service — `packages/core`
  library only
- `/auth/*` routes exercised against a real local Postgres/Redis in a
  prior session (see Known bugs) - `/devices/*` still not run against
  a live DB. This sandbox has no Docker, so the 3 live-DB `auth`
  integration tests fail here with ECONNREFUSED — expected, not a
  regression
- `apps/web`: real Next.js 14 console (typechecked, `next build`
  verified in this sandbox except Google Fonts optimization, which is
  blocked by this sandbox's network allowlist and degrades gracefully
  — not a code defect). Wires `/login`, `/register`,
  `/dashboard` (readiness check), `/dashboard/devices` (real list +
  trust-state transitions) to the actual `apps/api` routes. Device
  transitions require an ADMIN-scoped session, which the backend never
  auto-grants, so the console surfaces that as a real 403 rather than
  hiding it. `/dashboard/system` is a documentation view transcribed
  from this file, explicitly labeled as not live telemetry — there is
  no API route reporting phase completion, and none was fabricated to
  make the page look more complete than the backend actually is.
  Phase 2-9's domain logic (agent runs, projects, eligibility, chain
  activity, workflows, transaction firewall, off-chain adapters,
  multi-device) has no API route yet, so the console shows explicit
  "not wired" cards for those sections instead of mock data
- `apps/local-agent`: real job-auth/session/checkpoint wiring, but
  `connectToVps()` and `launchBrowser()` are NOT_CONFIGURED — no
  reachable VPS and no permitted network path to Playwright's browser
  binaries from this sandbox
- `apps/extension`: real message-validation/routing logic, but
  `registerMessageListener()`, `authenticateDevice()`, and
  `attachObservers()` are NOT_CONFIGURED — no Chrome extension runtime
  or DOM available here, and no reachable VPS for the device-auth
  handshake
- `packages/core` (all of Phases 2-9's stores): **in-memory only** - no
  repository layer connects any of it to `packages/database` yet. This
  is now the **eighth consecutive phase** to defer persistence,
  flagged again as worth addressing together rather than a ninth
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
- No API route exposes the kernel or any Phase 3/4/5/6/7/9 store yet
- `apps/worker`: only a placeholder heartbeat queue
- Rate limiting: single global limiter only
- Gas/volume/frequency/active-days/unique-contracts aggregation
  functions not built - the `OnChainActivity` type captures the raw
  data; rollups are a natural follow-up
- `WorkflowRunner` has no retry/backoff policy beyond the
  regression-pause signal
- `detectCaptchaType()` is a name-only heuristic against
  caller-supplied page signals, not a real DOM/page inspector
- Phase 7: `checkDomain()` has no live DNS/WHOIS/reputation service
  (offline heuristics only); `ContractIntelligenceReport` is
  NOT_CONFIGURED unless a caller-supplied real source is connected (no
  explorer/indexer/bytecode-analysis integration exists); no real
  simulation engine feeds `checkSimulationFreshness()`; no
  wallet-signing integration exists, so `runFirewall()` structurally
  never reaches SUBMIT/VERIFY; Phase 7 modules are not wired into
  `apps/api`, `apps/local-agent`, or `apps/extension` yet

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
   re-exports them. Fixed by importing them from `@airdrop-os/types`
   directly (already a declared dependency). Found by running the
   full-repo typecheck baseline before writing anything new, per the
   "verify prior claims" contract.

### Phase 7
No bugs found in what was built this phase - like Phase 5, the entire
transaction-firewall/EIP-7702/claim-security layer remains untested
against a live chain, real wallet signing, a real block explorer, or a
real domain-reputation service, so integration-level bugs remain
unverified by construction, not because they were checked and found
absent. A test-quality note: `decidePolicy()`'s
`FACTOR_TO_BLOCK_REASON` maps both `LOW_REPUTATION_CONTRACT` and
`PHISHING` risk factors to the same `PHISHING` block reason -
intentional, but worth flagging.

### Phase 9
No bugs found in what was built this phase on unit-test inspection.
Like Phases 5 and 7, the entire multi-device/backup/restore/migration
layer remains untested against real cross-device transport, a real
VPS/PC network, or a real Android build, so integration-level bugs
(real network partition timing, real backup payload sizes, real
Android lifecycle edge cases) remain unverified by construction, not
because they were checked and found absent.

Caveats still open:
- Concurrent-refresh races and kernel-to-DB persistence races remain
  unverified (Phase 1/2)
- Phase 2 was previously built once already (commit `f7db4b2`) and
  reverted (`df172d1`) with no reason recorded in that revert's commit
  message
- Phase 3/4/5/6/7/9's in-memory stores are untested against realistic
  data volumes or concurrent writers
- Phase 6's `apps/local-agent`/`apps/extension` wiring has never run
  against a real browser, VPS, or Chrome runtime — only the pure logic
  underneath has been exercised
- Phase 7's domain-protection heuristics (typosquatting edit-distance,
  homoglyph map) are a best-effort offline approximation, not a
  substitute for a real reputation/DNS service
- Phase 9's split-brain protection has only been exercised against a
  single in-process `DeviceRegistry` instance - it has never run
  against real concurrent devices racing over a network, where
  message-ordering/partition edge cases could differ from the
  in-memory guarantee

## Migrations
- `0000_tearful_rafael_vega.sql` - 13 Phase 1 tables
- `0001_mixed_sister_grimm.sql` - Phase 2 tables
- `0002_majestic_red_ghost.sql` - `agent_label_seq`
No new migration in Phase 3-9 (all defer persistence - see
Partial/not-configured).

## API routes
`GET /health`, `GET /readiness`, `POST /auth/register`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/revoke`,
`GET /devices`, `POST /devices/transition`. No kernel- or Phase
3/4/5/6/7/9-backed routes exist yet.

## Environment variables
API: `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_SECONDS`, `API_HOST`, `API_PORT`, `RATE_LIMIT_MAX`,
`RATE_LIMIT_WINDOW_MS`, `POSTGRES_PASSWORD`.
`apps/local-agent`: `VPS_API_URL`, `DEVICE_ID`, `DEVICE_REFRESH_TOKEN`,
`AGENT_VERSION` - fail-closed via zod, no insecure defaults. Real RPC
provider URLs will still be needed once Phase 5's network calls are
wired up. Phase 7 introduces no new environment variables. Phase 9
introduces no new environment variables either — it is pure
state-management/decision logic with no external service
configuration of its own (a future real backup-transport/Android-auth
integration will need its own env vars when built).

## Required external integrations
RPC providers per chain (Alchemy/Infura/self-hosted): **NOT_CONFIGURED**.
Block explorers/indexers (also needed for Phase 7 contract
intelligence): **NOT_CONFIGURED**. Playwright browser binaries:
**NOT_CONFIGURED**. Live VPS endpoint: **NOT_CONFIGURED**. Chrome
extension runtime (to load/test `manifest.json`): **NOT_CONFIGURED**.
Domain-reputation/DNS/WHOIS service (for real-time Phase 7 domain
protection): **NOT_CONFIGURED**. Wallet-signing integration (for Phase
7's SIGN/SUBMIT/VERIFY stages): **NOT_CONFIGURED** — by design,
sensitive signing stays user-controlled. Phase 8's
Discord/X/Telegram/GitHub API credentials: **NOT_CONFIGURED**.
Android SDK/Gradle/emulator (Phase 9): **NOT_CONFIGURED**. Real
VPS<->PC<->Android sync transport (Phase 9): **NOT_CONFIGURED**. Real
encryption-at-rest for backups (Phase 9): **NOT_CONFIGURED**
(caller-supplied hook only). Real cryptographic hash function for
backup integrity (Phase 9): **NOT_CONFIGURED** (deterministic checksum
placeholder only).

## Next-phase dependencies
Phase 7's `runFirewall()`, `verifyClaimSecurity()`, and
`evaluateEip7702()` are the natural gate for whichever phase first
wires a real RPC provider, block explorer, or wallet-signing flow —
none of those integrations should bypass this firewall once they
exist. Phase 6's `WorkflowStore`/`WorkflowRunner`, `CheckpointManager`,
and `BrowserSessionManager` remain the natural foundation for whichever
phase first wires a real Playwright browser or Chrome runtime
end-to-end. Phase 9's `DeviceRegistry`/`MultiDeviceCheckpointStore` are
the natural gate for whichever phase first wires real cross-device
transport — no future sync implementation should bypass the
split-brain or checkpoint-compatibility guarantees. Any future real
Android build should register through `DeviceRegistry` exactly as
documented in `apps/android/README.md`. The still-deferred persistence
phase (now eight phases running in-memory-only) remains the largest
open architectural item, and is worth doing before wiring real
multi-device sync so there is real data to sync.

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
   `ethers`/`viem` client behind `RpcManager.selectProvider()`'s output,
   then feed real simulation/block data into Phase 7's
   `checkSimulationFreshness()`/`assessRisk()` instead of caller-supplied
   stand-ins.
5. If/when a block-explorer/indexer API key becomes available, wire it
   behind `buildContractIntelligenceReport()`'s `sourceConnected: true`
   path so contract checks stop defaulting to NOT_CONFIGURED.
6. On a machine with Android Studio: scaffold the Kotlin/Compose app
   per `apps/android/README.md`'s screen list, wire its device-auth
   handshake against a live VPS API, and register through
   `DeviceRegistry` on first successful handshake.
7. Replace `packages/core/src/multidevice/backup.ts`'s `defaultHash()`
   placeholder with a real cryptographic hash (e.g. SHA-256) before any
   production backup is taken, and wire a real encryption step ahead of
   `buildBackupManifest()`'s `encryptionApplied: true` path.
8. Consider a dedicated persistence phase to connect `packages/core`'s
   seven-plus phases of in-memory stores to `packages/database`, rather
   than deferring an eighth time — this would also give Phase 9's
   multi-device sync real data to synchronize.

## Phase 10
Ran full verification with real Postgres 16 + Redis 7 installed and
started in the build environment (not mocked). `pnpm -r typecheck`:
0 errors. `pnpm -r test`: 390/390 passing across all 6 packages that
have tests (config, identity, security, api, core, extension) — the
3 previously-ECONNREFUSED `apps/api` auth tests now pass for real.
`/health` and `/readiness` verified live: both `ok`, readiness
confirms `database: ok` and `redis: ok`. Fixed
`packages/core/src/multidevice/backup.ts`'s `defaultHash()`
placeholder (32-bit rolling hash) → real SHA-256 via `node:crypto`;
all 354 core tests and `backup.test.ts` still pass. No other bugs
found. See `docs/phases/PHASE-10.md` and `docs/FINAL_STATUS.md` for
the full report and verdict: **PRODUCTION BLOCKED** (persistence for
`packages/core` domain stores still in-memory-only; backup encryption
not implemented; RPC/explorer/Playwright/VPS/extension-runtime/
Discord-X-Telegram-GitHub/Android integrations remain NOT_CONFIGURED
with zero real-network integration testing — this sandbox has no
network path to any of them).

STOP after Phase 10 (per contract) - all 10 phases complete.
