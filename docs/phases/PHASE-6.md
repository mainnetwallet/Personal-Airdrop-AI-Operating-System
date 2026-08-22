# PHASE 6 — BROWSER / PC AGENT / EXTENSION / WORKFLOW / CHECKPOINT

Status: **IMPLEMENTED** (core state-management layer, fully unit tested;
`apps/local-agent` and `apps/extension` are wired to it but NOT_CONFIGURED
for live browser/VPS/Chrome-runtime execution — see "NOT_CONFIGURED" below)

## Verification of Phases 1–5 before starting
Fresh `git clone` of the repo, then in this sandbox:
- `pnpm install`
- `tsc --noEmit` across all packages/apps that existed — clean
- `vitest run` on `packages/core` — **180/180 passing**, matching
  `docs/phases/CURRENT_STATE.md`'s end-of-Phase-5 claim exactly. No
  discrepancy found before building on top of it.

## Implemented

**PC agent job authorization** (`packages/core/src/agent/pcAgentAuth.ts`)
- `PcAgentAuthorizer`: issues time-boxed, scope-bound job authorizations
  for an already-authenticated device connection. Pure state management —
  it never performs device auth itself (that's Phase 1's access/refresh
  token machinery); it governs whether a given *job* is currently
  allowed to run. `authorize()` checks validity, device binding, and
  scope on every call rather than trusting a previously-valid result.

**Browser session isolation** (`browserSession.ts`)
- `BrowserSessionManager`: owns session lifecycle for both
  `CONTROLLED_BROWSER` (PC agent driving Playwright) and
  `USER_BROWSER_EXTENSION` modes. Two sessions are only ever considered
  the same context if every field of the isolation key (project,
  campaign, mission, wallet, account, browser profile, chain, device)
  matches — a task for wallet A/project X can never observe or reuse
  state from wallet B/project Y. Refuses to open a second `OPEN` session
  for an isolation context that already has one.

**Safe browser event capture** (`browserEvent.ts`)
- `toSafeBrowserEvent()` / `BrowserEventStore`: converts a raw DOM
  observation into a persisted event, stripping any element-metadata
  field whose *name* matches a sensitive-field pattern (password, seed
  phrase, private/secret key, OTP/2FA, recovery code, card number, CVV,
  session/auth token, API key). Decides purely on field name, never
  value — fail-closed when a field name is ambiguous. Non-primitive
  values are dropped rather than serialized blindly.

**Checkpointing** (`checkpoint.ts`)
- `CheckpointManager`: stores only safe operational state (step index,
  session/run ids, non-secret variables) — `create()` throws if any key
  looks sensitive, refusing to checkpoint it rather than silently
  including it. Every checkpoint is stamped with `schemaVersion` /
  `agentVersion` / `workflowVersion`; `checkCompatibility()` requires an
  exact match on all three before a resume is allowed.

**Workflow engine** (`workflow.ts`)
- `WorkflowStore`: append-only version history per workflow — saving a
  new version (V2, V3, …) never overwrites or deletes a prior one, so a
  regression can always be diffed against what previously worked. Step
  dependencies must reference an already-declared `stepId`, structurally
  ruling out cycles the same way Phase 4's task DAG does.
- `WorkflowRunner`: schedules the next runnable step (dependencies all
  `SUCCESS`, not already resolved), drives `HUMAN_GATE`/`APPROVAL_GATE`
  steps into `WAITING_FOR_USER`/`WAITING_FOR_APPROVAL` rather than
  running through them, and records step outcomes. This is pure
  scheduling/gate logic — it does not itself drive a browser; a PC
  agent or extension reports real step outcomes into it.
- `handlePossibleRegression()`: if a workflow with at least one prior
  successful run at the same version fails again, the run is marked
  `PAUSED_REGRESSION` instead of silently retried — a previously-working
  workflow failing again is itself a signal something changed upstream.

**Teach-agent** (`teachAgent.ts`)
- `TeachAgentSession`: observes a sequence of already-safe
  `BrowserEvent`s while a user performs a workflow themselves, and
  derives a `TaughtWorkflowDraft`. The agent never acts during a teach
  session, only observes and proposes. Confidence is capped by how much
  of the observation is clean signal — any redacted event or a thin (<3
  step) observation caps confidence below `LIKELY`. The user always
  makes the final SAVE/EDIT/DISCARD call via
  `TeachAgentSession.applyDecision` — nothing auto-saves.

**CAPTCHA handoff** (`captcha.ts`)
- `detectCaptchaType()`: name-only heuristic detection (reCAPTCHA,
  hCaptcha, Turnstile, Cloudflare challenge, generic human check).
- `CaptchaHandoff`: a strict state machine —
  `DETECTED → PAUSED → CHECKPOINTED → AWAITING_USER → USER_COMPLETED →
  VERIFIED → RESUMED` (with `TIMED_OUT` looping back to
  `AWAITING_USER`). There is no transition anywhere in this module that
  solves or bypasses a challenge — the only path forward is a human
  completing it, and `verify()` only accepts a caller-supplied,
  real-page-derived confirmation; it never self-certifies.

**Recovery** (`recovery.ts`)
- `RecoveryManager`: drives crash/restart/network-interruption recovery
  as `RESTORE → VERIFY → RESUME`. A missing checkpoint, a
  version-incompatible checkpoint, or a checkpoint that fails live
  verification each produce their own explicit `BLOCKED_*` outcome —
  none of those cases is ever silently resumed from.

**`apps/local-agent`** (Node.js PC agent)
- Fail-closed env config (`VPS_API_URL`, `DEVICE_ID`,
  `DEVICE_REFRESH_TOKEN`; zod-validated, throws rather than defaulting).
- `LocalAgent` class wires `PcAgentAuthorizer`, `BrowserSessionManager`,
  and `CheckpointManager` together and reports health.
- `connectToVps()` and `launchBrowser()` are explicit `NotConfiguredError`
  stubs — see NOT_CONFIGURED below.

**`apps/extension`** (Chrome Manifest V3)
- `manifest.json`: real MV3 skeleton (background service worker +
  content script registration).
- `messages.ts`: fail-closed zod schema for every message crossing the
  content-script/background boundary (`OBSERVATION`, `TEACH_CONTROL`).
  Malformed or unrecognized messages are rejected, not partially trusted.
- `background.ts` (`ExtensionBackground.handleMessage`): routes a
  validated `OBSERVATION` into the *same* `BrowserEventStore` /
  redaction logic the PC agent path uses (no separate redaction rules
  invented for the extension), and `TEACH_CONTROL` into a
  `TeachAgentSession`.
- `content.ts` (`buildObservationMessage`): pure, testable construction
  of a correctly-shaped observation message from page-context inputs.
- `registerMessageListener()`, `authenticateDevice()`, and
  `attachObservers()` are explicit `NotConfiguredError` stubs.

## Tests — actually run in this sandbox
```
packages/core (Phase 1-5 unchanged + Phase 6 new): 233/233 passing
  - pcAgentAuth: 8 tests (issue/expire/revoke/complete, device mismatch, scope check)
  - browserSession: 5 tests (isolation matching, duplicate-open refusal, status transitions)
  - browserEvent: 6 tests (redaction by field name, non-primitive drop, sensitivity flag)
  - checkpoint: 6 tests (create/get, sensitive-field refusal, compatibility match/mismatch)
  - workflow: 10 tests (versioning, cycle rejection, scheduling, gates, regression pause)
  - teachAgent: 5 tests (observation, draft derivation, confidence capping, decision apply)
  - captcha: 8 tests (valid/invalid transitions, detection, verify requires page confirmation)
  - recovery: 5 tests (missing/incompatible/failed-verification block, successful resume)

apps/extension (Phase 6 new): 14/14 passing
  - messages: 7 tests (valid OBSERVATION/TEACH_CONTROL, malformed/unknown-type rejection)
  - background: 5 tests (routing, redaction pass-through, teach-session feed, unknown session)
  - content: 2 tests (message construction, NOT_CONFIGURED stub)

Typecheck: 11 of 13 workspace projects have a `typecheck` script
(`apps/web` and `apps/android` don't); all 11, including the newly
added `apps/extension`, run clean.

apps/api: pre-existing 3-test failure (ECONNREFUSED 127.0.0.1:5432) —
no live Postgres/Docker available in this sandbox. Unrelated to Phase 6;
same category of gap noted in every prior phase's doc.
```

## NOT_CONFIGURED (explicitly, not fabricated)
- **No live browser automation.** Playwright is not installed or wired
  in `apps/local-agent` — this sandbox has no display and no permitted
  network path to Playwright's browser-binary CDN. `launchBrowser()`
  throws `NotConfiguredError` rather than pretending to drive a browser.
- **No live VPS connection.** `connectToVps()` throws
  `NotConfiguredError` — there is no reachable VPS from this sandbox.
  The real wiring point (WebSocket/HTTP to `VPS_API_URL`, authenticating
  with `DEVICE_ID`/`DEVICE_REFRESH_TOKEN` against Phase 1's
  `/auth/refresh` and `/devices`) is documented in
  `apps/local-agent/src/index.ts` but not exercised.
- **No live Chrome extension runtime.** `registerMessageListener()` and
  `attachObservers()` throw `NotConfiguredError` — there is no browser
  DOM or `chrome.*` runtime available here to attach real listeners to,
  and `manifest.json` has not been loaded into an actual Chrome
  instance.
- **No `CHROME_EXTENSION` device-auth handshake performed.**
  `authenticateDevice()` throws `NotConfiguredError` for the same
  reason as the VPS connection above, plus `chrome.storage.local`
  (needed to persist resulting credentials) doesn't exist outside a
  real browser.

## Known gaps
- All Phase 6 stores (`PcAgentAuthorizer`, `BrowserSessionManager`,
  `BrowserEventStore`, `CheckpointManager`, `WorkflowStore`) are
  in-memory only, consistent with every prior phase — no persistence
  layer connects any of it to `packages/database` yet. This is now the
  **fifth consecutive phase** to defer persistence.
- No API route exposes any Phase 6 functionality yet.
- `apps/android` was not touched this phase (not in original Phase 6
  scope discussion; flagged for a future phase).
- `WorkflowRunner` has no retry/backoff policy beyond the
  regression-pause signal — a caller must decide what to do with
  `PAUSED_REGRESSION` and `FAILED` runs.
- `detectCaptchaType()` is a name-only heuristic against caller-supplied
  page signals; it does not itself inspect a real page/DOM.

## Migrations
None this phase — no persistence layer added (see Known gaps).

## API routes
None added this phase.

## Environment variables
`apps/local-agent`: `VPS_API_URL`, `DEVICE_ID`, `DEVICE_REFRESH_TOKEN`,
`AGENT_VERSION` (all new this phase, fail-closed via zod). No new
`apps/api` env vars.

## Required external integrations
Playwright browser binaries: **NOT_CONFIGURED**. Live VPS endpoint:
**NOT_CONFIGURED**. Chrome extension runtime (for loading/testing
`manifest.json`): **NOT_CONFIGURED**.

## Next-phase dependency
Phase 6's `WorkflowStore`/`WorkflowRunner`, `CheckpointManager`, and
`BrowserSessionManager` are the natural foundation for a persistence
phase (all five phases now defer it) and for whatever phase first wires
a real Playwright browser or Chrome runtime to exercise
`apps/local-agent`/`apps/extension` end-to-end.
