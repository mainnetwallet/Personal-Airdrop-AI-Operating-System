# Gap Analysis — Repository vs. the 325-Section Master Build Prompt

> **Update (Phase 13):** the top Phase-12 follow-up ("no store pushes
> records into GlobalSearchIndex") is now closed — see "What Phase 13
> added" below.

> **Update (Phase 12):** three more gaps closed this session — see
> "What Phase 12 added" below. This section list still reflects the
> state after Phase 11 for historical context; the "Confirmed gaps"
> section further down has been updated to remove what Phase 12 closed.

This compares what actually exists in
`mainnetwallet/Personal-Airdrop-AI-Operating-System` against the full
"PERSONAL AIRDROP AI OPERATING SYSTEM V12 — ULTIMATE FINAL MASTER
BUILD PROMPT". The master prompt describes a multi-year, many-engineer
scope (325 numbered sections). This document is an honest inventory,
not a claim that everything is now built — building all 325 sections
in full is not something any single session can honestly claim to
complete, and this doc says so explicitly rather than papering over it.

## What Phase 11 added this session (real, tested)

Cross-referenced against specific spec sections, all under
`packages/core/src`:

| Spec section | Module | Status |
|---|---|---|
| 191 Decision Journal / 192 Reconsideration | `decisionJournal.ts` | Implemented, 6 tests |
| 218 Notification Intelligence / 219 Dedup / 220 Escalation | `notificationEngine.ts` | Implemented, 8 tests |
| 134 Distributed Lock / 136 Job Lease / 137 Stale Job | `multidevice/concurrency.ts` | Implemented, 13 tests |
| 262 Provider Quota | `integrations/providerQuota.ts` | Implemented, 6 tests |
| 180 Knowledge Graph / 181 Queries | `knowledgeGraph.ts` | Implemented, 6 tests |
| 198 Shadow Agent | `shadowAgent.ts` | Implemented, 5 tests |

All exported from `@airdrop-os/core`. Full suite: 434/434 tests
passing, 0 typecheck errors, verified against real Postgres 16 + Redis
7 (see `docs/FINAL_STATUS.md` for the Phase 10 verification run this
built on).

## What Phase 13 added this session (real, tested)

Closed the #2 recommended priority from Phase 12: wired
`GlobalSearchIndex` into the actual domain stores instead of leaving
it populated by nothing.

| What | Module | Status |
|---|---|---|
| `listAll()` added to CampaignStore, TaskGraph, MissionStore, WalletStore | (respective files) | Additive, non-breaking |
| `listAllCurrent()` added to RequirementStore (latest version per requirement) | `requirement.ts` | Additive, non-breaking |
| Mapper functions Project/Campaign/Requirement/Task/Mission/Wallet → `SearchableRecord` | `searchIndexers.ts` | Implemented, 9 tests |
| `reindexAll()` — idempotent bulk sync of a store's contents into a `GlobalSearchIndex` | `searchIndexers.ts` | Implemented, tested for idempotency + stale-entry clearing + multi-type coexistence |

Design notes, stated plainly rather than glossed over:
- `reindexAll()` is a **pull-based bulk sync**, not a push-based
  per-mutation hook. No store's `create()`/`update()` method calls
  `index.upsert()` automatically — a caller (kernel wiring or an API
  route) must invoke `reindexAll()` after mutations, or on a schedule.
  This was a deliberate choice to avoid making every domain store take
  a hard constructor dependency on `GlobalSearchIndex`, which would
  have been a much larger, more invasive change than what "wire search
  in" strictly requires. The tradeoff: search results can go stale
  between `reindexAll()` calls until something actually calls it in
  application code — which nothing does yet outside tests. That
  remaining wiring (kernel-level or API-route-level) is listed below,
  not silently assumed complete.
- Only the 6 entities from spec 224's list that already had a
  `listAll()`-style store method are wired: Projects, Campaigns,
  Requirements, Tasks, Missions, Wallets. Accounts, Transactions,
  Activities, Workflows, Research, Evidence, Claims, Rewards,
  Memories, Events, Checkpoints, and Devices are also named in section
  224 but are not wired — most of those stores don't currently expose
  a bulk `listAll()`, and adding one to each was out of scope for this
  session.

All exported from `@airdrop-os/core`. 436/436 core tests passing (up
from 426; 10 new tests in `searchIndexers.test.ts`), 0 typecheck
errors across all 13 workspace projects.

## What Phase 12 added this session (real, tested)

| Spec section | Module | Status |
|---|---|---|
| 48 Season/Epoch Engine (first-class entities) | `season.ts` (`SeasonStore`) | Implemented, 13 tests |
| 224 Global Search | `globalSearch.ts` (`GlobalSearchIndex`) | Implemented, 9 tests |
| 241 Audit Replay | `auditReplay.ts` (`replay`, `replayYesterday`) | Implemented, 6 tests |

Notes on scope/design honesty:
- `season.ts` is additive to, not a replacement for, `campaign.ts`'s
  existing `CampaignPhase` timeline (which still records SEASON/EPOCH
  as phase transitions). A caller that wants both a timeline entry and
  a queryable Season/Epoch record must write to both — this module
  does not auto-derive one from the other, since campaign.ts's own
  header comment explains timeline events are unordered/observational
  and shouldn't be silently promoted into structured entities without
  a decision to do so.
- `globalSearch.ts` is a standalone index that other stores must push
  records into (`upsert`/`remove`) as their entities change; it does
  not reach into ProjectStore/TaskStore/etc. itself. No store currently
  calls it, so as of this commit it is wired and tested but not yet
  populated by production code paths — that wiring is the next step,
  not done here, and is listed below rather than silently assumed.
- `auditReplay.ts` reads whatever is in a `KernelEventBus`'s in-memory
  log (or, once durable, the `events` table). It categorizes by
  eventType prefix matching spec 241's list and falls back to "Other"
  for anything unrecognized, so replay coverage is always complete —
  it never drops an event because it didn't match a known category.

All three exported from `@airdrop-os/core`. Full core suite: 426/426
tests passing (68 test files), 0 typecheck errors across all 13
workspace projects. `apps/api`'s `auth.register.test.ts` (3 tests)
still requires a live Postgres connection not available in this
sandbox — same documented limitation as Phase 10/11, unrelated to this
session's changes (verified: that file was not touched).

## What was already implemented (Phases 1-10, confirmed by inspection)

Kernel/state machine/event bus/tool registry/run limits, project/
research/evidence/source-reputation, campaign timeline (season/epoch
handled as timeline phases, not separate entities — see gap below),
requirement + requirement versioning, identity graph, wallet, task,
mission, eligibility + next-best-action, RPC manager/finality/reorg/
reconciliation/attribution/historical-state/snapshot-proof/points/
opportunity-radar, browser session/event/checkpoint/workflow/teach-
agent/CAPTCHA/recovery, transaction firewall/risk-policy/simulation/
approval/intent-diff/EIP-7702/claim-security/domain-protection/
contract-intelligence/anti-Sybil/prompt-injection/emergency-stop,
integration registry, off-chain adapter (mock) + Phase 8 adapters
(Discord/social/quest/developer/DePIN placeholders — see gap below),
plugin SDK, device registry/checkpoint-compat/multi-device-recovery/
backup/restore/migration/disaster-recovery. Auth/devices/health/
readiness are the only pieces backed by real Postgres persistence;
everything else in `packages/core` is in-memory (flagged since Phase
3, still true).

## Confirmed gaps — not built, and not claimed to be

Grep-verified absent from `packages/core`, `packages/types`, and
`apps/*/src` as of this session:

- **Model Router** (199) and **Model Cost Controller** (200) — no
  model-selection-by-task-complexity logic exists; nothing currently
  calls an LLM from this codebase to route.
- **Command Center** (221) and **Command Palette** (222) as backend
  aggregation endpoints — `globalSearch.ts` + `searchIndexers.ts`
  (Phase 12/13) now provide the cross-entity search primitive and are
  wired to 6 of ~19 entity stores via `reindexAll()`, and
  `auditReplay.ts` (Phase 12) provides the "what happened" primitive,
  but no API route or kernel hook actually *calls* `reindexAll()` on a
  schedule or after mutations yet, and no single "morning dashboard"
  endpoint aggregates urgent items/claims/budget/paused workflows into
  one response per section 221's list.
- **Calendar engine** (235) — no deadline/reset/claim-window
  aggregation view exists.
- **Referral Integrity (86), Ambassador/Creator Engine (78), Waitlist/
  Beta/Early-Access Engine (80), Learn-to-Earn Engine (81), CEX/
  Exchange Campaign Engine (79)** — no dedicated adapters; only
  Discord/social/quest/developer/DePIN have Phase 8 adapter stubs.
- **Gaming/GameFi Engine (75)**, **Prediction/Trading Campaign Engine
  (76)** — not present in any form, not even as a stub adapter.
- **Multi-RPC Consensus (68)** as a dedicated cross-provider agreement
  check — `reconciliation.ts` compares two sources on request, but
  there's no N-way consensus/quorum policy.
- **Information Value Engine (176)** and **Research Cost Ceiling
  (175)** — no research-value-vs-cost estimator exists.
- **Opportunity Decay (172)** and **Opportunity Competition (173)** —
  `opportunityRadar.ts` scores opportunities but does not model time-
  decay or competition/saturation.
- **Portfolio Optimizer Agent (19's list) / Attention Portfolio (238)**
  — no cross-project attention-reallocation logic.
- **Eligibility Simulator (182)** as a distinct "what-if" projection
  tool — `eligibility.ts` calculates current eligibility; a forward-
  looking simulator on top of it is not built.
- **Feature Flags with SAFE_ONLY/DRY_RUN/COPILOT/LIVE states (204)** —
  a `feature_flags` DB table exists (Phase 1/2), but the graduated-
  state autonomy-ladder logic (300) that should gate it is not built.
- **Web dashboard (apps/web)** and **Android app (apps/android)** are
  both still empty/scaffold-only — no actual UI screens exist for any
  of sections 221-238's pages, including a UI for the new Global
  Search / Audit Replay primitives.
- **Discord/Social/Quest/Developer/DePIN "intelligence" (70-74)** have
  typed adapter *interfaces* (Phase 8) but no real platform API
  wiring — same NOT_CONFIGURED status recorded in every prior phase's
  CURRENT_STATE.md.
- **GlobalSearchIndex coverage of Accounts/Transactions/Activities/
  Workflows/Research/Evidence/Claims/Rewards/Memories/Events/
  Checkpoints/Devices** (also named in spec 224) — only Projects/
  Campaigns/Requirements/Tasks/Missions/Wallets are wired
  (`searchIndexers.ts`, Phase 13); the remaining ~12 entity types
  named in section 224 don't have `listAll()`-style store methods yet
  to wire against.

## Why this document exists instead of silently claiming completion

The master prompt's own rules (section 319, 325) require: never
fabricate completion, never claim an integration exists when it does
not, and report what exists / what was implemented / what was tested
/ what remains. This document is that report for this session. The
honest state is: **Phase 11-13 each closed a small number of specific,
real gaps** (decision journal, notifications, distributed locks/
leases, provider quotas, knowledge graph, shadow agent, Season/Epoch
entities, Global Search, Audit Replay, and search-index wiring for 6
entity types) **with working, tested code** — this did not, and could
not in a handful of sessions, close the entire 325-section gap between
this ~66-module core package and the full V12 vision, which by its own
description spans 21 phases of specialized engineering (section 306)
across teams that don't exist in this sandbox (no Discord/X/Telegram/
GitHub credentials, no RPC providers, no Android SDK, no live VPS, no
browser runtime — see `docs/FINAL_STATUS.md`).

## Recommended next priorities (largest leverage per the spec's own priorities)

1. Persistence for `packages/core` domain stores (flagged as the
   single largest open item since Phase 3/9/10) — most of the gaps
   above are meaningless to build against in-memory Maps that reset on
   every process restart.
2. Actually call `reindexAll()` from somewhere in application code
   (kernel wiring after mutations, an API route, or a scheduled job) —
   Phase 13 built the sync mechanism and proved it works via tests,
   but nothing in `apps/api` invokes it yet, so `GlobalSearchIndex` is
   wired but not yet live.
3. Real Discord/social/quest platform credentials, once available, to
   move Phase 8 adapters from interface-only to CONNECTED.
4. An API route exposing `auditReplay.replay()`/`replayYesterday()`
   and `GlobalSearchIndex.search()` so Global Search (224) and Audit
   Replay (241) are reachable from `apps/web`/`apps/android`, not just
   from `@airdrop-os/core` internally.
5. Decide whether `SeasonStore` (Phase 12) should be the source of
   truth `CampaignStore.recordPhase()` writes through for SEASON/EPOCH
   phases, or remain a parallel structured index — currently they can
   drift independently since nothing links them.
