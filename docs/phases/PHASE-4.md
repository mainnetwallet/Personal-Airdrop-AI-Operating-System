# PHASE 4 — Requirement / Identity / Mission / Task / Eligibility

## Verified before starting
- `git pull origin main`: already up to date at `e588f72` (Phase 3).
- `pnpm -r typecheck`: clean across all 9 packages/apps.
- `pnpm --filter @airdrop-os/core test`: 94/94 passing (confirmed
  before touching any code).
- Confirmed `PHASE-4.md` exists at
  `PERSONAL_AIRDROP_AI_OS_V12_10_PHASES/PHASE-4.md` in this repo
  (Phase 3's handoff had incorrectly assumed it didn't).

## What this phase adds
All in `@airdrop-os/types` (interfaces) and `@airdrop-os/core` (logic),
same in-memory-library posture as Phases 2–3 — no persistence wiring.

- **`requirement.ts`** — `RequirementStore`: append-only versioning.
  Every `Requirement` row is one version; `supersede()` closes the
  current version's `validUntil` and appends a new version with
  `supersedesVersion` pointing back to it — history is never
  overwritten. `versionAt(requirementId, atIso)` returns whichever
  version's `[validFrom, validUntil)` window contains a given instant —
  the building block for historical backtesting. `expire()`/`retract()`
  are terminal and don't create a new version.
- **`identityGraph.ts`** — `IdentityGraph`: USER -> account edges
  across all 9 account types from the spec. `associate()` never
  silently merges — linking an account already owned by a different
  user throws `ConflictingIdentityAssociationError`. Re-associating the
  same user upgrades the association state (`OBSERVED` ->  `KNOWN` ->
  `USER_CONFIRMED`) but never downgrades it. `reassociate()` exists for
  an intentional, explicit reassignment that must name the user it's
  displacing.
- **`wallet.ts`** — `WalletStore`: metadata only (address/label/
  chains/status) — no keys or signing capability anywhere in this
  codebase.
- **`task.ts`** — `TaskGraph`: `addTask()` only accepts dependencies
  that already exist in the graph, which makes a dependency cycle
  structurally impossible to construct (a task can only reference
  tasks created before it) rather than something detected after the
  fact. `hasCycle()` is still provided as a defensive/testable
  invariant. `complete()` unblocks dependents once *all* their
  dependencies are done, routing to `WAITING_HUMAN` instead of `READY`
  when a human/approval gate is set.
- **`mission.ts`** — `MissionStore`: objective + attached
  requirements/tasks, validated status transitions (`DRAFT` ->
  `ACTIVE` -> `PAUSED`/`BLOCKED` -> ... -> `COMPLETED`/`ABANDONED`).
  `progress` is never set directly — `recomputeProgress()` derives it
  from the attached tasks' actual statuses and auto-completes the
  mission at 100%.
- **`eligibility.ts`** — `EligibilityEngine.evaluate()`: for each
  requirement, evaluates the caller-supplied activities against
  whichever requirement *version* (`RequirementStore.versionAt`) was in
  force at each activity's own timestamp — never today's version
  applied retroactively. Produces an `EligibilityProofPackage` citing
  the exact `{requirementId, version}` pairs used, the activities
  considered, a plain-language `calculation` summary, a derived
  `state` (`UNKNOWN`/`POSSIBLE`/`QUALIFIED`/`INELIGIBLE`/`CONFLICTED`/
  etc.), and any `unknowns` (e.g. no activity supplied, or no
  requirement version was in force at some activity's timestamp).
- **`nextBestAction.ts`** — `decideNextBestAction()`: a pure function
  over eligibility/deadline/reward/cost/time/risk/budget/availability/
  confidence/workflow-match/user-preference, returning exactly one of
  `DO/WAIT/WATCH/SKIP/RESEARCH/HUMAN_REVIEW/BLOCK/NO_ACTION`. Priority
  order (documented in the file): ineligible/expired/conflicted
  short-circuit first, then unavailability, then budget, then unknown
  eligibility, then deadline, then workflow-match/risk, then the
  eligibility-tier fallback (`POSSIBLE` -> `WATCH`,
  `LIKELY`/`QUALIFIED`/`VERIFIED` -> `DO`).

## Bug found and fixed (in this phase's own tests, not production logic)
Two new tests (`requirement.test.ts` historical-backtest test,
`eligibility.test.ts` historical-backtest test) initially failed: they
called `create()` then `supersede()` back-to-back using real
`Date.now()`, which on a fast machine can land both calls in the same
millisecond. `versionAt()`'s half-open interval
(`[validFrom, validUntil)`) is then genuinely ambiguous/empty for that
instant — this is *correct* interval semantics, not a bug in
`requirement.ts`. The test itself was flawed: it computed a "later"
timestamp but never actually used it to advance anything. **Fixed** by
using `vi.useFakeTimers()`/`vi.setSystemTime()` to genuinely separate
the two versions in time, which is also a more deterministic way to
test wall-clock-dependent logic than hoping real execution is slow
enough. Production code (`requirement.ts`, `eligibility.ts`) was not
changed for this.

## Tests
`packages/core/src/__tests__/`: `requirement.test.ts` (8),
`identityGraph.test.ts` (7), `wallet.test.ts` (4), `task.test.ts` (7),
`mission.test.ts` (6), `eligibility.test.ts` (5),
`nextBestAction.test.ts` (11) — 48 new tests, covering: requirement
versioning (never-overwrite, supersede/expire/retract, unknown-id),
historical backtesting (old activity judged by the version in force
when it happened, not the current version), identity graph
(association, state-upgrade-only, conflict-on-different-user,
explicit `reassociate()`), mission DAG (creation, status transitions,
task/requirement attachment, progress recomputation, auto-completion),
task dependencies (structural cycle-prevention, blocked/ready/
waiting-human transitions on completion), eligibility proof-package
generation, and every branch of the next-best-action priority order.

`pnpm --filter @airdrop-os/core test`: **142/142 passing** (94 Phase
1–3 + 48 new Phase 4).
`pnpm -r typecheck`: clean across all 9 packages/apps.

## Partial / NOT_CONFIGURED
- **No persistence layer** — `RequirementStore`, `IdentityGraph`,
  `WalletStore`, `TaskGraph`, `MissionStore` are in-memory only, same
  posture as every prior phase's core stores. No Drizzle schema/
  migration was added this phase either — same reasoning as Phase 3:
  schema with no repository layer exercising it would just be
  unverified surface area.
- **No API routes** expose any Phase 4 functionality.
- **`EligibilityEngine`'s per-requirement satisfaction check is
  minimum/maximum/chain-threshold only.** The spec's full requirement
  shape includes `duration`, `snapshot`, `wallet`/`account` targeting,
  etc. — this phase implements the core historical-backtesting
  mechanism correctly and generally, but does not yet evaluate every
  possible requirement dimension (e.g. `duration`-based requirements
  like "held for 30+ days" aren't computed from activity timestamps
  yet). Flagging this explicitly rather than claiming full requirement-
  type coverage.
- **`decideNextBestAction()` risk threshold (`>= 8` on an assumed 0–10
  scale) and the exact CONFLICTED/POSSIBLE boundary in
  `EligibilityEngine.deriveState()` are reasonable defaults, not
  spec-mandated constants** — the spec lists the required inputs/
  outputs and states but not exact thresholds or a scoring formula.
  Both are isolated, single-purpose functions so tuning them later
  doesn't require touching anything else.
- Nothing from Phase 1–3's own "Partial / NOT_CONFIGURED" list changed
  this phase (real airdrop adapters, source.http_fetch executor, any
  persistence layer, `/devices/*` live-DB verification remain open).

## Migrations
None this phase — same reasoning as Phase 3 (see above). Existing
migrations unchanged: `0000_tearful_rafael_vega.sql`,
`0001_mixed_sister_grimm.sql`, `0002_majestic_red_ghost.sql`.

## API routes
Unchanged from Phase 2/3: `GET /health`, `GET /readiness`,
`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
`POST /auth/revoke`, `GET /devices`, `POST /devices/transition`.

## Environment variables
No new environment variables needed this phase.

## Required external integrations
None required through Phase 4. Same outstanding list as Phase 3:
Phase 6+ needs browser automation, Phase 8+ needs Discord/X/Telegram/
GitHub API credentials — all still NOT_CONFIGURED.

## Next-phase dependencies
Per `PERSONAL_AIRDROP_AI_OS_V12_10_PHASES/PHASE-5.md` (not yet read in
this session — that's the next step), a future phase would consume:
`RequirementStore` (requirement versions to check activity against),
`EligibilityEngine` (compute eligibility, generate proof packages),
`MissionStore` + `TaskGraph` (drive mission/task execution),
`IdentityGraph` + `WalletStore` (resolve which wallet/account a
mission targets), and `decideNextBestAction()` (drive orchestration
decisions).

## Exact recommended next action
1. Hand `PHASE-5.md` (confirmed present at
   `PERSONAL_AIRDROP_AI_OS_V12_10_PHASES/PHASE-5.md`) to Claude in a
   fresh chat pointed at this repository, per the README's sequential-
   build instructions.
2. Consider (not required, but flagged for whoever does the
   persistence pass): Phases 3 and 4 have now both deferred a
   persistence layer twice in a row. If Phase 5+ doesn't need new
   in-memory stores, that would be a natural point to add the Drizzle
   schema + repository layer for Phases 2–4's stores together, rather
   than deferring a third time.
