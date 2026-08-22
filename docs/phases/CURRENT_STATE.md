# CURRENT STATE — Personal Airdrop AI Operating System V12

Last updated: end of Phase 8.

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

`apps/local-agent` and `apps/extension` are real, tested wiring around
Phase 6's core logic (job auth, session isolation, checkpoints, safe
event redaction, teach sessions) but NOT_CONFIGURED for live execution —
no Playwright browser, no reachable VPS, no Chrome runtime in this
sandbox. `apps/web` and `apps/android` are still empty scaffolds. Phase
7's transaction firewall and Phase 8's off-chain adapters are not yet
wired into either app or into `apps/api` — see Next-phase dependencies.
See `docs/phases/PHASE-1.md` through `PHASE-8.md` for full detail.

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
- **Phase 7 (new this session), all in `packages/core/src/tx/`:**
  - `checkDomain()`/`checkRedirectChain()`: offline typosquatting,
    Unicode-homoglyph, fake-subdomain, and URL-shortener detection
    against a caller-supplied official-domain list — no live DNS/WHOIS
  - `buildContractIntelligenceReport()`: NOT_CONFIGURED with every
    field null unless the caller supplies real connected-source data;
    `isReportUsable()`/`hasDangerousCapability()` treat unknown/
    unverified as risk, never a free pass
  - `diffIntent()`: field-by-field expected-vs-actual comparison
    (action/wallet/chain/contract/recipient/token/amount/spender);
    any mismatch is a material change
  - `ApprovalStore`: binds an approval to
    project/campaign/mission/task/wallet/account/chain/contract/intent
    hash/expiration; `checkAndConsume()` is single-use, never
    re-validates a used/expired/revoked/mismatched approval
  - `checkSimulationFreshness()`: stale on age, block-advanced, or
    RPC-provider mismatch; never re-simulates itself
  - `assessRisk()`/`decidePolicy()`: weighted risk factors ->
    LOW/MEDIUM/HIGH/CRITICAL; hard-block factors (phishing, material
    intent change, stale approval, low-reputation contract) force
    BLOCK regardless of score; only LOW with no hard-block factors is
    ALLOW
  - `verifyClaimSecurity()`: ALLOW only when official
    source/domain/contract/chain/function/recipient/token/approval/
    simulation/risk are *all* explicitly verified
  - `checkChainLock()`/`evaluateEip7702()`: EIP-7702 unknown target
    BLOCKs by default with no exceptions; chain-lock mismatch BLOCKs;
    even a fully known, chain-locked target returns
    NEEDS_USER_REVIEW, never ALLOW; always carries a
    current-vs-proposed delegation diff
  - `AntiSybilAwarenessStore`: records/reports signals per wallet,
    fixed awareness-only note, no code path bypasses a platform check
  - `EmergencyStopController`: ALL_SENSITIVE_OPERATIONS/WALLET/
    PROJECT/SESSION scoped freeze; read-only investigation always
    allowed (fixed `true`)
  - `scanForPromptInjection()`: pattern-matches untrusted external
    content for instruction-override/secret-disclosure/auto-approve/
    security-bypass attempts; every result fixed
    `contentTreatedAsData: true`
  - `runFirewall()`: orchestrates the full 13-stage pipeline; stops
    immediately on any earlier-stage failure or Security Agent BLOCK
    (final, never overridden downstream); checks emergency stop
    immediately before SIGN; never reaches SUBMIT/VERIFY in this
    sandbox — a fully clean run stops at SIGN with NEEDS_USER_REVIEW
    because signing is user-controlled by contract, never automated
- **Phase 8 (new this session):**
  - `IntegrationRegistry` (`packages/core/src/integrations/`):
    per-provider CONNECTED/DEGRADED/NOT_CONFIGURED/EXPIRED/REVOKED/
    BLOCKED status for the 14 external services Phase 8 names; every
    provider starts and stays NOT_CONFIGURED until a caller explicitly
    calls `setStatus()` — no inference path to CONNECTED
  - `createMockOffChainAdapter()` (`packages/core/src/adapters/`): a
    generic factory implementing the existing Phase 3 `AirdropAdapter`
    contract; `calculateEligibility()` always `UNKNOWN`, `claim()`
    always `NOT_CONFIGURED` — mock adapters never fabricate
    eligibility or auto-claim
  - `registerPhase8Adapters()`: registers a mock adapter for every
    `AirdropType` across 13 category groups (Discord, social, quest,
    developer, DePIN, AI/compute, gaming/GameFi, prediction/trading —
    no autonomous trading capability anywhere in the adapter,
    referral, ambassador/creator, exchange — no auto-execute, waitlist/
    beta, learn-to-earn)
  - Plugin SDK (`packages/core/src/plugins/pluginSdk.ts`):
    `PluginRegistry` — a newly registered plugin is always DISABLED;
    `activate()` only succeeds on an exact integrity-hash match
    (mismatch -> BLOCKED) and grants only
    `requestedPermissions ∩ grantPermissions`, never a permission
    outside what the plugin's own manifest requested; unknown
    `pluginId` resolves to a fixed DISABLED registration
- Typecheck clean across all 12 packages/apps that have a `typecheck`
  script (`apps/web`, `apps/android` don't); **321/321**
  `@airdrop-os/core` tests passing (304 Phase 1-7 + 17 new Phase 8),
  plus **14/14** `apps/extension` tests (unchanged); 253 tests passing
  repo-wide outside `packages/core` and excluding the live-DB-only auth
  suite (unchanged from Phase 6/7), for 321+253=574 total non-live-DB
  tests passing repo-wide

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
- `packages/core` (all of Phases 2-8's stores): **in-memory only** - no
  repository layer connects any of it to `packages/database` yet. This
  is now the **seventh consecutive phase** to defer persistence,
  flagged again as worth addressing together rather than an eighth
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
- No API route exposes the kernel or any Phase 3/4/5/6/7 store yet
- `apps/worker`: only a placeholder heartbeat queue
- Rate limiting: single global limiter only
- Gas/volume/frequency/active-days/unique-contracts aggregation
  functions not built - the `OnChainActivity` type captures the raw
  data; rollups are a natural follow-up
- `WorkflowRunner` has no retry/backoff policy beyond the
  regression-pause signal
- `detectCaptchaType()` is a name-only heuristic against
  caller-supplied page signals, not a real DOM/page inspector
- **Phase 7, new this session:** `checkDomain()` has no live DNS/WHOIS/
  reputation service (offline heuristics only); `ContractIntelligenceReport`
  is NOT_CONFIGURED unless a caller-supplied real source is connected
  (no explorer/indexer/bytecode-analysis integration exists); no real
  simulation engine feeds `checkSimulationFreshness()`; no wallet-signing
  integration exists, so `runFirewall()` structurally never reaches
  SUBMIT/VERIFY; Phase 7 modules are not wired into `apps/api`,
  `apps/local-agent`, or `apps/extension` yet

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

### Phase 7
No bugs found in what was built this phase - like Phase 5, the entire
transaction-firewall/EIP-7702/claim-security layer remains untested
against a live chain, real wallet signing, a real block explorer, or a
real domain-reputation service, so integration-level bugs (real
simulation error shapes, real bytecode analysis edge cases, real
7702 authorization encoding quirks) remain unverified by construction,
not because they were checked and found absent. A test-quality note:
`decidePolicy()`'s `FACTOR_TO_BLOCK_REASON` maps both
`LOW_REPUTATION_CONTRACT` and `PHISHING` risk factors to the same
`PHISHING` block reason - intentional (both represent "this is
malicious," not two different reasons), but worth flagging since it
means `blockReasons` won't always have a 1:1 count with `factors`.

Caveats still open:
- Concurrent-refresh races and kernel-to-DB persistence races remain
  unverified (Phase 1/2)
- Phase 2 was previously built once already (commit `f7db4b2`) and
  reverted (`df172d1`) with no reason recorded in that revert's commit
  message
- Phase 3/4/5/6/7's in-memory stores are untested against realistic
  data volumes or concurrent writers
- Phase 6's `apps/local-agent`/`apps/extension` wiring has never run
  against a real browser, VPS, or Chrome runtime — only the pure logic
  underneath has been exercised
- Phase 7's domain-protection heuristics (typosquatting edit-distance,
  homoglyph map) are a best-effort offline approximation, not a
  substitute for a real reputation/DNS service - the module documents
  this limitation itself

## Migrations
- `0000_tearful_rafael_vega.sql` - 13 Phase 1 tables
- `0001_mixed_sister_grimm.sql` - Phase 2 tables
- `0002_majestic_red_ghost.sql` - `agent_label_seq`
No new migration in Phase 3, 4, 5, 6, or 7 (all defer persistence - see
Partial/not-configured).

## API routes
`GET /health`, `GET /readiness`, `POST /auth/register`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/revoke`,
`GET /devices`, `POST /devices/transition`. No kernel- or Phase
3/4/5/6/7-backed routes exist yet.

## Environment variables
API: `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_SECONDS`, `API_HOST`, `API_PORT`, `RATE_LIMIT_MAX`,
`RATE_LIMIT_WINDOW_MS`, `POSTGRES_PASSWORD`.
`apps/local-agent`: `VPS_API_URL`, `DEVICE_ID`, `DEVICE_REFRESH_TOKEN`,
`AGENT_VERSION` - fail-closed via zod, no insecure defaults. Real RPC
provider URLs will still be needed once Phase 5's network calls are
wired up. Phase 7 introduces no new environment variables - it is
pure decision logic with no external service configuration of its own
(future adapters that feed it real RPC/explorer/DNS data will need
their own env vars when built).

## Required external integrations
RPC providers per chain (Alchemy/Infura/self-hosted): **NOT_CONFIGURED**.
Block explorers/indexers (also needed for Phase 7 contract
intelligence): **NOT_CONFIGURED**. Playwright browser binaries:
**NOT_CONFIGURED**. Live VPS endpoint: **NOT_CONFIGURED**. Chrome
extension runtime (to load/test `manifest.json`): **NOT_CONFIGURED**.
Domain-reputation/DNS/WHOIS service (for real-time Phase 7 domain
protection): **NOT_CONFIGURED**. Wallet-signing integration (for Phase
7's SIGN/SUBMIT/VERIFY stages): **NOT_CONFIGURED** — by design,
sensitive signing stays user-controlled. Phase 8+ will need
Discord/X/Telegram/GitHub API credentials: **NOT_CONFIGURED**.

## Next-phase dependencies
Phase 7's `runFirewall()`, `verifyClaimSecurity()`, and
`evaluateEip7702()` are the natural gate for whichever phase first
wires a real RPC provider, block explorer, or wallet-signing flow —
none of those integrations should bypass this firewall once they
exist. `scanForPromptInjection()` is ready for Phase 8's
Discord/X/Telegram/GitHub content ingestion. Phase 6's
`WorkflowStore`/`WorkflowRunner`, `CheckpointManager`, and
`BrowserSessionManager` remain the natural foundation for whichever
phase first wires a real Playwright browser or Chrome runtime
end-to-end. The still-deferred persistence phase (now six phases
running in-memory-only) remains the largest open architectural item.

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
6. Consider a dedicated persistence phase to connect `packages/core`'s
   six phases of in-memory stores to `packages/database`, rather than
   deferring a seventh time.
