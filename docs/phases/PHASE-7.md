# PHASE 7 — ADVANCED SECURITY / TRANSACTION / CLAIM / EIP-7702

Status: **IMPLEMENTED** (pure decision-logic layer, fully unit tested;
every I/O-bound step — live RPC/simulation, block-explorer/bytecode
lookup, real DNS/WHOIS, wallet signing — is NOT_CONFIGURED in this
sandbox and is driven entirely by data a future real adapter would
supply, never fabricated)

## Verification of Phases 1–6 before starting
Fresh clone of the repo in this sandbox, then:
- `pnpm install` — clean
- `pnpm -r typecheck` across all 12 packages/apps with a typecheck
  script — clean, matching `docs/phases/CURRENT_STATE.md`'s claim
- `pnpm --filter @airdrop-os/core test` — **233/233 passing** before any
  Phase 7 code was added, matching the recorded end-of-Phase-6 count
  exactly. No discrepancy found before building on top of it.
- `apps/api`'s 3 live-DB `auth` integration tests fail with
  `ECONNREFUSED` — expected in this no-Docker sandbox, not a regression
  (documented since Phase 1/6).

## Implemented

All new code lives in `packages/core/src/tx/` and the matching Phase 7
type block appended to `packages/types/src/index.ts`. Security Agent
veto is enforced structurally: once the POLICY step (or an earlier
hard-stop stage) returns BLOCK, nothing downstream can turn it back into
ALLOW — `runFirewall()` returns immediately on any BLOCK.

**Domain protection** (`tx/domainProtection.ts`)
- `checkDomain()`: offline heuristics against a caller-supplied list of
  official domains — typosquatting (edit-distance ≤2 on the registrable
  name), Unicode/homoglyph lookalikes (Cyrillic/fullwidth confusable
  map), fake subdomains (official name embedded as a label of an
  unrelated domain), known URL shorteners, and a residual
  "UNEXPECTED_DOMAIN" catch-all. No live DNS/WHOIS/reputation service is
  queried — this is a deliberate, documented limitation.
- `checkRedirectChain()`: flags a redirect landing on a non-official
  domain; never follows redirects itself (no network access here).

**Contract intelligence** (`tx/contractIntelligence.ts`)
- `buildContractIntelligenceReport()`: assembles a report only from
  caller-supplied data; returns `NOT_CONFIGURED` with every field `null`
  when no live source is connected — never fabricates verification.
- `isReportUsable()` / `hasDangerousCapability()`: a report is only
  "usable" by the risk engine when actually `CONNECTED` with a non-null
  `verifiedSource`; unknown/unverified is always treated as risk, not a
  free pass.

**Intent diff** (`tx/intentDiff.ts`)
- `diffIntent()`: compares expected vs. actual
  action/wallet/chain/contract/recipient/token/amount/spender field by
  field (case-insensitive address comparison); any mismatch is a
  material change.

**Approval binding** (`tx/approval.ts`)
- `ApprovalStore`: binds an approval to
  project/campaign/mission/task/wallet/account/chain/contract/intent
  hash/expiration. `checkAndConsume()` is single-use — a used, expired,
  revoked, unknown, or intent-hash-mismatched approval always BLOCKs,
  never silently re-validates.

**Simulation freshness** (`tx/simulation.ts`)
- `checkSimulationFreshness()`: stale if older than `maxAgeMs`, if the
  chain has advanced past the simulated block, or if the current RPC
  provider differs from the one the simulation ran against. Never
  re-simulates itself.

**Risk assessment + policy** (`tx/riskPolicy.ts`)
- `assessRisk()`: converts domain/contract/intent-diff/approval/
  simulation signals into weighted risk factors (0–100 score →
  LOW/MEDIUM/HIGH/CRITICAL). Unknown contract intelligence is itself a
  risk factor, not neutral.
- `decidePolicy()`: hard-block factor codes (phishing, material intent
  change, stale approval, low-reputation contract) force BLOCK
  regardless of total score; CRITICAL always BLOCKs; HIGH/MEDIUM require
  user review; only LOW with no hard-block factors is ALLOW.

**Claim security** (`tx/claimSecurity.ts`)
- `verifyClaimSecurity()`: a claim is ALLOW only when official source,
  domain, contract, chain, function, recipient, token, approval,
  simulation, and risk are *all* explicitly verified — any missing or
  negative check produces BLOCK/NEEDS_USER_REVIEW, never a default
  ALLOW on missing data.

**EIP-7702 delegation risk** (`tx/eip7702.ts`)
- `checkChainLock()`: authorization/current/intended chain must all
  match; any mismatch fails.
- `evaluateEip7702()`: unknown target → BLOCK BY DEFAULT, no exceptions,
  even with confirmed user intent. Chain-lock failure → BLOCK. A fully
  known, chain-locked target still returns `NEEDS_USER_REVIEW`, never
  `ALLOW` — delegation is never silently signed. Always carries a
  current-vs-proposed `Eip7702DelegationDiff` for display.

**Anti-Sybil awareness** (`tx/antiSybil.ts`)
- `AntiSybilAwarenessStore`: records and reports signals per wallet;
  every report carries a fixed literal note
  (`AWARENESS_ONLY_NEVER_BYPASSES_PLATFORM_PROTECTIONS`) and the module
  has no code path that blocks, disguises, or defeats a platform check.

**Emergency stop** (`tx/emergencyStop.ts`)
- `EmergencyStopController`: `ALL_SENSITIVE_OPERATIONS`/WALLET/PROJECT/
  SESSION scoped freeze. `readOnlyInvestigationAllowed` is a fixed
  `true` — investigation is never frozen, only sensitive ops.

**Prompt-injection defense** (`tx/promptInjection.ts`)
- `scanForPromptInjection()`: pattern-matches untrusted
  web/Discord/X/Telegram/GitHub/quest/contract-metadata content for
  instruction-override, secret-disclosure, auto-approve, and
  security-bypass attempts. Every result carries a fixed
  `contentTreatedAsData: true` — nothing found in this content is ever
  treated as an instruction to act on, only as a signal to surface.

**Transaction firewall** (`tx/firewall.ts`)
- `runFirewall()`: orchestrates PREPARE → DECODE → VALIDATE → ESTIMATE →
  SIMULATE → STATE_ANALYSIS → RISK → POLICY → INTENT_DIFF → APPROVAL →
  SIGN → SUBMIT → VERIFY. Never performs the sign/submit/RPC I/O itself;
  every earlier-stage failure or Security Agent BLOCK stops the pipeline
  immediately (`stopEarly()`), and an emergency stop for the wallet is
  checked immediately before SIGN and blocks unconditionally. Even a
  fully clean run never returns `ALLOW` — it stops at SIGN with
  `NEEDS_USER_REVIEW` because signing is user-controlled by contract,
  never automated.
- `stageOrderIsValid()`: helper asserting recorded stages never appear
  out of pipeline order.

## Tests
`pnpm --filter @airdrop-os/core test`: **304/304 passing** (233 carried
over from Phases 1–6, unchanged, + 71 new Phase 7 tests across 11 new
test files: `domainProtection`, `contractIntelligence`, `intentDiff`,
`approval`, `simulation`, `riskPolicy`, `claimSecurity`, `eip7702`,
`antiSybil`, `emergencyStop`, `promptInjection`, `firewall`).

Repo-wide (`pnpm -r test` across every package/app with a test script):
253 tests passing outside the 3 known-ECONNREFUSED live-DB `auth`
integration tests (unchanged from Phase 6 — `apps/extension` 14/14,
`packages/config` 3/3, `packages/identity` 6/6, `packages/security`
6/6, `apps/api` health 4/4, `packages/core` 304/304).

Full-repo `tsc --noEmit` across all 12 packages/apps with a `typecheck`
script: clean.

## Not implemented / NOT_CONFIGURED (by design, this phase)
- No real RPC/simulation provider is wired — `simulationSucceeded`,
  block numbers, and state fingerprints are all caller-supplied inputs,
  matching Phase 5's `RpcManager` posture (still zero real provider
  URLs configured in this sandbox).
- No live block-explorer/bytecode-verification/indexer integration —
  `ContractIntelligenceReport` is `NOT_CONFIGURED` unless the caller
  supplies `sourceConnected: true` with real data.
- No live DNS/WHOIS/domain-reputation service — domain protection is
  offline string heuristics only, as documented in the module.
- No wallet-signing integration of any kind — the firewall intentionally
  never reaches SUBMIT/VERIFY in this sandbox; SIGN always resolves to
  `NEEDS_USER_REVIEW`.
- `packages/database` persistence: **still deferred**, now the sixth
  consecutive phase running in-memory-only (flagged again — see Phase 6
  doc and Next-phase dependencies below).
- No API route exposes any Phase 7 module yet (matching Phases 2–6:
  `packages/core` remains unwired to `apps/api`).

## Known bugs / security issues found this phase
None found in the code written this phase (no live chain/RPC/wallet
integration exists yet to surface integration-level bugs against — the
same caveat Phase 5 recorded: absence of bugs here reflects absence of
live-integration testing, not a verified-clean live system).

## Next-phase dependencies
- Phase 8 (Discord/X/Telegram/GitHub API credentials, per
  `PERSONAL_AIRDROP_AI_OS_V12_10_PHASES/README.md`'s recommended order)
  can use `promptInjection.ts`'s `scanForPromptInjection()` directly
  against messages/posts pulled from those platforms.
- Whichever phase first wires a real RPC provider should feed
  `RpcManager`'s real call outcomes into `checkSimulationFreshness()`
  and `assessRisk()` rather than the currently caller-supplied stand-ins.
- Whichever phase first wires a real block explorer/indexer should
  populate `buildContractIntelligenceReport()`'s `sourceConnected: true`
  path instead of leaving every contract `NOT_CONFIGURED`.
- The deferred persistence phase (now six phases running in-memory-only)
  remains the single largest architectural debt in this repository.
