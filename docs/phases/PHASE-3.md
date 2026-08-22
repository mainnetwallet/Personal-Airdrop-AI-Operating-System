# PHASE 3 — Project / Research / Evidence / Campaign / Airdrop Intelligence

## Verified before starting
- `pnpm -r typecheck`: clean across all 9 packages/apps (both before and
  after this phase's changes).
- `pnpm --filter @airdrop-os/core test`: 48/48 Phase 1–2 tests passing
  before this phase's changes.
- `apps/api` auth tests (3) fail with `ECONNREFUSED 127.0.0.1:5432` in
  this sandbox — expected, no live Postgres available here; matches
  `CURRENT_STATE.md`'s documented caveat, not a regression.
- `git status`: clean, matches `origin/main` at commit `608d405`.

## What this phase adds
All in `@airdrop-os/types` (interfaces) and `@airdrop-os/core` (logic),
following the Phase 2 pattern: in-memory libraries, no persistence
wiring yet.

- **`project.ts`** — `ProjectStore`: full `Project` entity (all fields
  from the spec) with a validated state-machine (`DISCOVERED` ->
  `RESEARCHING` -> `VERIFIED` -> `WATCHING`/`ACTIVE` -> `CLAIMABLE` ->
  `CLAIMED` -> `COMPLETED`, with `RISKY`/`REJECTED`/`EXPIRED` as
  escape hatches). Illegal/terminal transitions throw
  `InvalidProjectTransitionError`, mirroring `kernelState.ts`.
- **`evidence.ts`** — `EvidenceGraph`: sources, content-hashed
  timestamped snapshots (`snapshot()`/`diff()` for change detection),
  claims, and evidence rows carrying full lineage (source, URL, source
  type, retrievedAt, content hash, knowledge version).
  `detectContradiction()` groups a claim's evidence by content hash and
  — when more than one distinct value exists — resolves in favor of
  the highest-precedence source tier (`PRIMARY_OFFICIAL` >
  `OFFICIAL_*`/`ONCHAIN_EVIDENCE` > `TRUSTED_RESEARCH` > `COMMUNITY` >
  `UNKNOWN` > `RUMOR`), never by majority vote or reputation.
- **`sourceReputation.ts`** — `SourceReputationTracker`: accuracy
  (correct/incorrect outcome counts), availability (EMA over retrieval
  attempts), freshness, and a derived reputation score. Deliberately
  has no method that can influence evidence resolution — it is a
  confidence-weighting signal only; `evidence.ts` never consults it.
- **`researchEngine.ts`** — `ResearchEngine`: `discover()` ->
  `retrieve()` (snapshots caller-supplied content; performs no network
  I/O itself) -> `normalize()` (flattens raw content to field/value
  records) -> `deduplicate()` (matches by `(projectId, field)`, **not**
  value — see "Bug found and fixed" below) -> `ingest()` (creates or
  reuses a claim, attaches evidence, recomputes confidence) ->
  `verify()` (`UNCERTAIN`/`CONFLICTED`/`VERIFIED`/`LIKELY`/
  `SPECULATIVE` from evidence source tiers and contradiction state) ->
  `isStale()`.
- **`campaign.ts`** — `CampaignStore`: campaign/season/epoch timeline.
  `recordPhase()` never rejects an out-of-order phase (e.g. skipping
  `WAITLIST`/`BETA` straight to `TESTNET`) since campaign phases are
  observed from an external process this system doesn't control — it
  only appends history and advances `currentPhase`.
- **`airdropTypes.ts`** — `classifyAirdropType()`: normalizes free-form
  input against the full `AirdropType` taxonomy from the spec; anything
  unrecognized (including `null`/empty) resolves to
  `UNKNOWN_AIRDROP_TYPE` rather than guessing or throwing.
- **`adapters/`** — `AirdropAdapter` contract (in `@airdrop-os/types`):
  `detect/research/verify/extractRequirements/calculateEligibility/
  estimateCost/estimateTime/estimateRisk/buildTasks/buildMission/
  monitor/claim/report`. `AirdropAdapterRegistry.resolve()` always
  returns *some* adapter — a registered one, or a `NOT_CONFIGURED` stub
  (`notConfiguredAdapter.ts`) whose `claim()` only ever returns
  `NOT_CONFIGURED` or `REQUIRES_MANUAL_APPROVAL`, never anything
  implying automatic execution. **No real per-type adapters are
  implemented this phase** — every `AirdropType` currently resolves to
  the stub; that is Phase 4+ work per the phase boundary ("Implement
  only the current phase").
- **`tools/researchTools.ts`** — registers the first real tool,
  `source.http_fetch`, into the Phase 2 `ToolRegistry` (previously
  empty), per `CURRENT_STATE.md`'s documented Phase 3 dependency. This
  is declarative metadata only (permission `RESEARCH`, risk `LOW`,
  read-only) — `ToolDefinition` has no execution field in this
  codebase, so no HTTP call is made from `@airdrop-os/core`; actual
  fetch execution is Phase 6+ (`apps/worker`/browser automation).

## Bug found and fixed (this phase)
**`deduplicate()` originally matched on `(projectId, field, valueHash)`**
instead of `(projectId, field)`. That meant two observations of the
same field with *different* values (e.g. one source says TGE is
2026-09-01, another says 2026-10-01) were never recognized as the same
fact — each became its own claim with a single piece of agreeing
evidence, so `detectContradiction()` never saw them together and a
real contradiction silently went undetected instead of being flagged
`CONFLICTED`. Caught by
`researchEngine.test.ts > verify() returns CONFLICTED once
contradicting evidence is attached, even after being VERIFIED`,
which failed (`expected 'VERIFIED' to be 'CONFLICTED'`) before the
fix. **Fixed** by matching dedup on `(projectId, field)` only — a
claim is the slot for "what we know about this field," and competing
values now correctly land as competing evidence on the same claim.
Exact re-observations of an unchanged value are still deduplicated at
the evidence/snapshot layer via content hashing, so this doesn't lose
duplicate suppression for the common case.

## Tests
`packages/core/src/__tests__/`: `project.test.ts` (9),
`evidence.test.ts` (9), `sourceReputation.test.ts` (5),
`researchEngine.test.ts` (9), `campaign.test.ts` (5),
`airdropTypes.test.ts` (5), `adapterRegistry.test.ts` (4) — 46 new
tests, covering project lifecycle transitions, deduplication,
evidence lineage, contradiction resolution (including the
many-low-tier-sources-agree-but-still-lose-to-one-official-source
case), reputation weighting, campaign/timeline recording, airdrop-type
classification (including unknown-type fallback and a full
round-trip of every declared type), and the adapter registry's
`NOT_CONFIGURED` fallback behavior.

`pnpm --filter @airdrop-os/core test`: **94/94 passing** (48 Phase 1–2
+ 46 new Phase 3).
`pnpm -r typecheck`: clean across all 9 packages/apps.

## Partial / NOT_CONFIGURED
- **No real `AirdropAdapter` implementations** — every `AirdropType`
  resolves to the `NOT_CONFIGURED` stub. Building real adapters (even
  for one or two common types like `QUEST`/`POINTS`) is next-phase
  work.
- **No persistence layer** — `ProjectStore`, `EvidenceGraph`,
  `SourceReputationTracker`, `CampaignStore` are in-memory only, same
  posture as the Phase 2 kernel. No Drizzle schema/migration was added
  this phase for `projects`/`sources`/`claims`/`evidence`/`campaigns`
  tables — **explicitly deferred**, not forgotten: doing it without
  also wiring a repository layer (which Phase 2's kernel state still
  doesn't have either) would add schema surface with no code path
  exercising it, so it's marked `NOT_CONFIGURED` here rather than
  built ahead of need.
- **No API routes** expose any Phase 3 functionality yet — same
  "library only" posture as Phase 2's kernel.
- **`source.http_fetch` is declarative only** — no execution path
  exists anywhere in the repo yet; it cannot actually be invoked to
  fetch anything until a worker/executor is built (Phase 6+).
- **`ResearchEngine.retrieve()` takes caller-supplied content** — by
  design (keeps `@airdrop-os/core` free of network I/O), but this also
  means there is currently no code anywhere in the repo that actually
  performs the fetch; a caller must be built to supply real content.

## Migrations
None this phase (see "Partial / NOT_CONFIGURED" above). Existing
migrations unchanged: `0000_tearful_rafael_vega.sql`,
`0001_mixed_sister_grimm.sql`, `0002_majestic_red_ghost.sql`.

## API routes
Unchanged from Phase 2: `GET /health`, `GET /readiness`,
`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
`POST /auth/revoke`, `GET /devices`, `POST /devices/transition`.

## Environment variables
No new environment variables needed this phase.

## Required external integrations
None required through Phase 3 (research retrieval is caller-supplied
in this phase, not a live integration). Phase 6+ will need browser
automation for actual source retrieval; Phase 8+ will need
Discord/X/Telegram/GitHub API credentials for social-source
verification — all still `NOT_CONFIGURED`.

## Next-phase dependencies
A future phase building real airdrop adapters (Phase 4+, per the
original 10-phase plan's own numbering — this repo's `PHASE-4.md`
onward were not provided in this session, only Phase 1–3) will
consume: `ProjectStore` (to read/update projects), `ResearchEngine` +
`EvidenceGraph` (to ingest and verify claims about a project),
`AirdropAdapterRegistry` (to register real per-type adapters
replacing the `NOT_CONFIGURED` stub), `CampaignStore` (to track a
project's live campaign timeline), and the `source.http_fetch` tool
declaration (once an executor exists to back it).

## Exact recommended next action
1. Hand `PHASE-4.md` to Claude in a fresh chat pointed at this
   repository, per the README's sequential-build instructions — this
   session does not have a Phase 4 prompt to work from.
2. Before that, consider (not required, but flagged): adding the
   Drizzle schema for `projects`/`sources`/`snapshots`/`claims`/
   `evidence`/`campaigns` and a repository layer, mirroring how Phase 2
   left `agent_runs`/`events` as durable mirrors of kernel state — this
   phase deliberately left that gap open rather than building
   unexercised schema.
