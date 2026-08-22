# PHASE 8 — AIRDROP COVERAGE / OFF-CHAIN INTELLIGENCE / PLUGINS

Status: **IMPLEMENTED** (mock adapter layer + integration status
tracking + Plugin SDK, fully unit tested; every external service —
Discord/X/Telegram/GitHub/quest/DePIN/AI-compute/GameFi/prediction-
trading/referral/ambassador/exchange/waitlist/learn-to-earn platforms —
is NOT_CONFIGURED in this sandbox; no live credentials exist)

## Verification of Phases 1–7 before starting
Fresh clone of the repo in this sandbox, then:
- `pnpm install` — clean (161 packages)
- `pnpm -r typecheck` across all 12 packages/apps with a typecheck
  script — clean, matching `docs/phases/CURRENT_STATE.md`'s claim
- `pnpm --filter @airdrop-os/core test` — **304/304 passing** before
  any Phase 8 code was added, matching the recorded end-of-Phase-7
  count exactly. No discrepancy found before building on top of it.
- `apps/api`'s 3 live-DB `auth` integration tests fail with
  `ECONNREFUSED` — expected in this no-Docker sandbox, not a
  regression (documented since Phase 1).

## Implemented

**`IntegrationRegistry`** (`packages/core/src/integrations/integrationRegistry.ts`)
Tracks per-provider status (`CONNECTED`/`DEGRADED`/`NOT_CONFIGURED`/
`EXPIRED`/`REVOKED`/`BLOCKED`, reusing the existing
`IntegrationHealthState` vocabulary) for the 14 external services Phase
8 names: `DISCORD`, `X`, `TELEGRAM`, `GITHUB`, `QUEST_PLATFORM`,
`DEPIN_NETWORK`, `AI_COMPUTE_PLATFORM`, `GAMEFI_PLATFORM`,
`PREDICTION_TRADING_PLATFORM`, `REFERRAL_PLATFORM`,
`AMBASSADOR_PLATFORM`, `EXCHANGE`, `WAITLIST_PLATFORM`,
`LEARN_PLATFORM`. Every provider starts `NOT_CONFIGURED` and only
changes when a caller explicitly calls `setStatus()` — there is no
inference path to `CONNECTED`. `getStatus()` on an unknown provider
also resolves to `NOT_CONFIGURED` rather than throwing.

**`createMockOffChainAdapter()`** (`packages/core/src/adapters/mockOffChainAdapter.ts`)
A generic factory implementing the existing Phase 3 `AirdropAdapter`
contract for any off-chain category. `status: "IMPLEMENTED"` here means
the shape and safety contract are real, not that live data flows —
`research()`/`verify()`/`monitor()` all surface `IntegrationRegistry`
state and nothing else. `calculateEligibility()` always returns
`eligible: "UNKNOWN"` (never fabricates true/false without a real
evidence source) and `claim()` always returns `NOT_CONFIGURED` (mock
adapters never auto-claim, matching the existing claim-is-never-
automatic rule from Phase 3/7).

**`registerPhase8Adapters()`** (`packages/core/src/adapters/phase8Adapters.ts`)
Registers a mock adapter for every `AirdropType` in the 13 category
groups the Phase 8 prompt names: Discord intelligence, social
intelligence, quest, developer, DePIN, AI/compute, gaming/GameFi,
prediction/trading (no autonomous financial trading — no
execute-trade capability exists anywhere in this adapter), referral,
ambassador/creator, exchange (no auto-execute financial actions),
waitlist/beta, and learn-to-earn. `AirdropType`s outside this scope are
untouched and continue to resolve to the Phase 3 `NOT_CONFIGURED` stub.

**Plugin SDK** (`packages/core/src/plugins/pluginSdk.ts`)
`PluginRegistry` for third-party adapters:
- `register()` always leaves a new plugin `DISABLED` — there is no
  path from "just registered" to "running."
- `activate()` only succeeds if the caller's integrity hash matches
  the manifest's `integrityHash` exactly; a mismatch sets `BLOCKED`
  with `blockedReason: "INTEGRITY_HASH_MISMATCH"` instead of silently
  reducing permissions.
- Granted permissions are always `requestedPermissions ∩
  grantPermissions` — `activate()` can never grant a permission the
  plugin's own manifest didn't request, even if the caller passes one.
- `resolve()` on an unknown `pluginId` returns a fixed `DISABLED`
  registration (`blockedReason: "UNKNOWN_PLUGIN_NEVER_TRUSTED_BY_DEFAULT"`)
  rather than `undefined`.
- Manifests carry `networkAllowlist`/`maxCallsPerRun` for the future
  job/workflow runner to enforce — this SDK is the
  registry/authorization layer, not the sandbox execution environment
  itself (that remains NOT_CONFIGURED, same status as Phase
  6's `launchBrowser()`/`connectToVps()`).

**Types** (`packages/types/src/index.ts`, Phase 8 block)
`IntegrationProvider`, `IntegrationState`, `OffChainCategory`,
`PluginPermission`, `PluginRuntimeStatus`, `PluginManifest`,
`PluginRegistration`.

## Testing
- `packages/core/src/__tests__/integrationRegistry.test.ts` (4 tests)
- `packages/core/src/__tests__/phase8Adapters.test.ts` (7 tests)
- `packages/core/src/__tests__/pluginSdk.test.ts` (6 tests)
- `pnpm -r typecheck` — clean across all 12 typecheck-capable
  packages/apps
- `pnpm --filter @airdrop-os/core test` — **321/321** passing
  (304 Phase 1–7 + 17 new Phase 8)
- `apps/extension` — **14/14** passing (unchanged)
- `apps/api`'s 3 live-DB `auth` tests still fail with `ECONNREFUSED` in
  this no-Docker sandbox — expected, not a regression

## Partial / mocked / not-configured
- Every `IntegrationProvider` is `NOT_CONFIGURED` — no real Discord/X/
  Telegram/GitHub/quest-platform/DePIN-network/AI-compute-platform/
  GameFi-platform/prediction-platform/referral-platform/ambassador-
  platform/exchange/waitlist-platform/learn-platform credentials exist
  in this environment
- No adapter wiring into `apps/api` routes, `apps/worker` jobs, or
  `apps/local-agent`/`apps/extension` yet — Phase 8's adapters exist as
  a `packages/core` library, same as Phases 2–7
- Plugin SDK has no actual sandboxed execution runtime (process
  isolation, resource-limit enforcement) — it is the
  registration/authorization/permission-intersection layer only
- `packages/core` (all of Phases 2–8's stores) remains **in-memory
  only** — this is now the **seventh consecutive phase** to defer
  persistence

## Known bugs / security issues
No bugs found in what was built this phase. Like Phases 5 and 7, the
entire off-chain intelligence and plugin layer remains untested
against any real Discord/X/Telegram/GitHub/quest/DePIN/AI-compute/
GameFi/prediction/referral/ambassador/exchange/waitlist/learn-to-earn
API, so integration-level bugs (real API response shapes, real
rate-limit/pagination behavior, real webhook/event formats) remain
unverified by construction, not because they were checked and found
absent.

Caveats still open (carried from Phase 7, unchanged):
- Concurrent-refresh races and kernel-to-DB persistence races remain
  unverified (Phase 1/2)
- Phase 3/4/5/6/7/8's in-memory stores are untested against realistic
  data volumes or concurrent writers
- Phase 6's `apps/local-agent`/`apps/extension` wiring has never run
  against a real browser, VPS, or Chrome runtime
- Phase 7's domain-protection heuristics are a best-effort offline
  approximation, not a substitute for a real reputation/DNS service

## Migrations
No new migration in Phase 8 (defers persistence, same as Phases 3–7).

## API routes
Unchanged from Phase 7 — no kernel- or Phase 3–8-backed routes exist
yet.

## Environment variables
No new environment variables. Phase 8 introduces no external service
configuration of its own — real Discord/X/Telegram/GitHub/quest/DePIN/
AI-compute/GameFi/prediction/referral/ambassador/exchange/waitlist/
learn-platform credentials will need their own env vars (and
`IntegrationRegistry.setStatus()` calls) when a real adapter is built
behind each mock.

## Required external integrations
All 14 `IntegrationProvider`s: **NOT_CONFIGURED**. See
`docs/phases/CURRENT_STATE.md` for the full list carried forward from
Phase 7 plus these 14.

## Next-phase dependencies
`scanForPromptInjection()` from Phase 7 is the natural gate for
whichever adapter first ingests real Discord/X/Telegram/GitHub/quest
content — every Phase 8 mock adapter's `research()`/`verify()` should
route real fetched content through it before treating it as anything
but untrusted data. The Plugin SDK's `networkAllowlist`/
`maxCallsPerRun` fields are ready for whichever phase first builds an
actual sandboxed plugin execution runtime. The still-deferred
persistence phase (now seven phases running in-memory-only) remains
the largest open architectural item.

## Exact recommended next action
1. Same six items carried from Phase 7's `CURRENT_STATE.md` (Docker
   Postgres/Redis, Playwright wiring, Chrome extension runtime, real
   RPC provider, block-explorer API key, dedicated persistence phase).
2. When real credentials for any Phase 8 provider become available,
   wire a real adapter behind the matching `AirdropType`(s) and call
   `IntegrationRegistry.setStatus(provider, "CONNECTED", ...)` from an
   actual successful auth/health-check — never infer it.
3. Per the build contract, STOP after Phase 8 — do not begin Phase 9
   without an explicit go-ahead.
