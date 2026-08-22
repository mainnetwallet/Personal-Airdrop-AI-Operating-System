# PHASE 5 — BLOCKCHAIN / ACTIVITY / SNAPSHOT / POINTS / OPPORTUNITY RADAR

Status: **IMPLEMENTED** (architecture + pure logic layer; no live RPC
providers configured — see "NOT_CONFIGURED" below)

## Verification of Phase 1–4 before starting
Fresh `git clone` of the repo (not the stale local copy from an earlier
session), then:
- `pnpm install` on the clean clone
- `tsc --noEmit` across all 9 existing packages/apps — clean
- `vitest run` on `packages/config`, `packages/security`,
  `packages/identity`, `packages/core` — **157/157 passing**, matching
  exactly what `CURRENT_STATE.md` (end of Phase 4) claimed. No
  discrepancy found; the prior session's completion claims verified
  correct before building on top of them.

## Implemented

**Chains & RPC**
- `ChainId` union: 11 initial EVM chains (Ethereum, Base, Arbitrum,
  Optimism, Polygon, BNB Chain, Avalanche, zkSync, Linea, Scroll,
  Blast) + `NonEvmChain` (Solana, Sui, Aptos) reserved for future
  adapters — no non-EVM adapter is implemented, deliberately, per
  "design adapters for future" rather than build them now
- `RpcManager` (`packages/core/src/chain/rpcManager.ts`): per-chain
  primary/backup/backup2/backup3 provider ordering, latency-based
  HEALTHY/DEGRADED classification, consecutive-failure counting,
  circuit breaker (opens at 5 consecutive failures, half-opens after
  60s for one trial call), rate-limit cooldown window. A provider with
  `url: null` is always reported `NOT_CONFIGURED`, never fabricated as
  healthy

**Activity tracking**
- `OnChainActivity` type covers all 20 requested activity kinds (swap,
  bridge, lend/borrow, LP, staking/restaking, delegation, governance,
  NFT mint/trade/hold, contract interaction, perpetuals, prediction
  markets, payments, cross-chain)
- `TransactionFinality` state machine
  (`packages/core/src/chain/finality.ts`): PENDING → INCLUDED →
  CONFIRMED → FINALIZED, with REORGED reachable even from FINALIZED
  (deep reorgs are rare but real), DROPPED/REPLACED terminal.
  `isFinalitySafeForEligibility()` gates downstream calculations to
  CONFIRMED/FINALIZED only

**Attribution**
- `buildAttribution()` constructs the full chain (tx → trace →
  function → contract → token → protocol → browser context → task →
  mission → campaign → project) and **derives** confidence from how
  much of the chain is actually populated rather than accepting an
  asserted confidence — an agent-observed browser-initiated action
  scores `VERIFIED`; a bare transaction hash with nothing else scores
  `SPECULATIVE`

**Reorg protection**
- `detectReorg()` computes exactly which activities fall in the
  reorged block range; `applyReorgToActivity()` marks REORGED without
  fabricating replacement data — re-ingestion is left to the caller
- `HistoricalStateStore.invalidateForReorg()` invalidates (never
  deletes) historical records in the reorged range, preserving the
  audit trail of what was believed true and when

**RPC reconciliation**
- `reconcile()` compares primary RPC / backup RPC / explorer / indexer
  values for the same subject. Requires **all** sources to agree —
  majority vote is deliberately not used, since a lone dissenting
  source might be the one that already caught a reorg the others
  haven't. Any disagreement → `RECONCILIATION_REQUIRED`

**Historical state**
- `HistoricalStateStore`: append-only, keyed by (wallet, block, kind).
  `getAt()` throws `HistoricalStateNotFoundError` rather than
  substituting current or nearby state for a missing historical
  record — there is no code path that can silently pass off "now" as
  "then"

**Snapshot proof**
- `buildSnapshotProof()` requires project, campaign, block, timestamp,
  wallet, requirement + version, result, confidence, and **at least
  one** evidence citation — refuses to build an evidence-free proof

**Points / XP**
- `PointsLedger`: append-only ledger, entries are signed amounts ×
  multiplier, never a mutable running total. Totals are folds over
  history, correctly separated by unit — **`PointsUnit` is `"POINTS" |
  "XP"` only, enforced by the type system, so this ledger structurally
  cannot represent a token balance** (explicit POINTS != TOKEN rule)
- `resolveRank()` (thresholds/levels), `applyDecay()` (season decay as
  a new signed entry, never an in-place mutation), `leaderboard()`

**Opportunity Radar**
- `OpportunitySignal` type covers all 13 requested categories (new
  projects, campaigns, testnets, points programs, quests, waitlists,
  beta, early access, developer, DePIN, gaming, AI/compute, community)
  plus `POTENTIAL_RETROACTIVE`
- `scoreOpportunity()` weighs official evidence, project quality, cost,
  time, risk, deadline pressure, competition, and user fit, then
  **caps** the result by confidence level (SPECULATIVE caps at 0.25
  regardless of how attractive the other inputs look) — a
  well-produced rumor cannot outscore a well-evidenced but less flashy
  real opportunity. Returns a breakdown, not a black-box number.
  Nothing in this module implies a guaranteed reward.

## Tests — actually run in this sandbox
```
packages/core (Phase 1-4 unchanged + Phase 5 new): 180/180 passing
  - rpcManager: 7 tests (failover, circuit breaker, half-open, rate limit, NOT_CONFIGURED)
  - finality: 5 tests (happy path, reorg-from-FINALIZED, illegal skip, terminal states)
  - reorg: 2 tests (affected-activity detection, non-fabricating mark-as-reorged)
  - reconciliation: 2 tests (unanimous match, single dissenter forces RECONCILIATION_REQUIRED)
  - attribution: 4 tests (confidence derivation at each population level)
  - historicalState: 3 tests (exact lookup, not-found fail-closed, reorg invalidation retains record)
  - snapshotProof: 2 tests (valid build, evidence-required refusal)
  - points: 8 tests (multiplier math, unit separation, history retention, leaderboard, rank, decay)
  - opportunityRadar: 5 tests (scoring, confidence cap, bounds, input validation, breakdown)
Typecheck: all 9 packages/apps clean, zero errors.
```

## NOT_CONFIGURED (explicitly, not fabricated)
- **No real RPC provider URLs** — no Alchemy/Infura/QuickNode/etc.
  API keys exist in this environment. `RpcManager` is complete state
  management logic, but every provider a real deployment would
  register still needs a real `url` supplied via environment
  configuration; none is hardcoded or invented here.
- **No real network calls are made anywhere in this phase** — no
  `ethers`/`viem`/`web3` client is wired up, since doing so without a
  real provider URL would either fail immediately or require
  fabricating a response. That client wiring is a small, well-scoped
  next step once real RPC credentials exist.
- **No indexer/explorer API integration** (e.g. Etherscan, The Graph) —
  `reconcile()`'s `ReconciliationSource` shape supports this but no
  adapter calls a real one.
- Solana/Sui/Aptos: type placeholders only, no adapter logic.

## Known gaps
- `RpcManager`, `HistoricalStateStore`, and `PointsLedger` are
  in-memory only, consistent with Phases 2-4's stores — no
  persistence layer connects any of Phase 5 to `packages/database`
  yet. This is now the fourth consecutive phase to defer persistence;
  flagged again (see Phase 4's note) as worth addressing together in
  a dedicated phase rather than deferring indefinitely.
- No API route exposes any Phase 5 functionality yet.
- `scoreOpportunity()`'s weighting constants (0.3/0.2/0.15/etc.) are
  reasonable defaults, not spec-mandated values — isolated in one
  function, easy to tune later.
- Gas cost tracking, volume/frequency/active-days aggregation, and
  unique-contracts/chains counting are covered by the `OnChainActivity`
  type shape but no aggregation functions were built this phase (not
  explicitly requested as a deliverable beyond "track" — the type
  captures the raw data; rollup queries are a natural Phase 5-follow-up
  or Phase 6 (radar/dashboard) concern).

## Migrations
None this phase — no persistence layer added (see Known gaps).

## API routes
None added this phase.

## Environment variables
None added this phase. Real RPC provider URLs (e.g.
`ETHEREUM_RPC_PRIMARY_URL`) will be needed once network calls are
wired up — not added speculatively here since no real values exist to
validate against.

## Required external integrations
RPC providers (Alchemy/Infura/etc. or self-hosted nodes) per chain:
**NOT_CONFIGURED**. Block explorers/indexers for reconciliation:
**NOT_CONFIGURED**.

## Next-phase dependency
Phase 6 (Browser / PC Agent / Extension / Workflow / Checkpoint) does
not directly depend on Phase 5's chain logic, but later phases
(monitoring dashboards, real eligibility computation against live
chain data) will consume: `RpcManager`, `HistoricalStateStore`,
`buildSnapshotProof()`, `PointsLedger`, and `scoreOpportunity()`.
