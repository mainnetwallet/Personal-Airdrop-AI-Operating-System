# FRONTEND ADDITION — apps/web (post-Phase-9)

Status: **PARTIAL** (real, verified Next.js app; wired only to what
the backend actually exposes)

## Why this wasn't "Phase N" of the 10-phase plan
The 10-phase build prompts don't include a dedicated frontend phase —
`apps/web` was reserved as a Phase 1 workspace slot with a note that
the dashboard would be "built out starting around Phase 6." No later
phase actually built it, so at the start of this work `apps/web` was
still the original empty placeholder. This addition was done in
response to an explicit request to add the frontend, not as a
numbered phase.

## What was built
Real Next.js 14 (App Router) + TypeScript + Tailwind app in `apps/web`:

- **Design**: a console/ops aesthetic (not a marketing page) — deep
  near-black base, four semantic signal colors (active/pending/
  blocked/verified/idle) used consistently for every status
  everywhere, Space Grotesk + Inter + IBM Plex Mono type system. The
  signature structural device is a "state rail" (a strip of dots
  showing position in a sequence) used for device trust state and
  reused wherever the product shows a state machine — chosen because
  the actual backend architecture across all 9 completed phases is
  built almost entirely out of explicit state machines, so the device
  encodes something true about the system rather than decorating it.
- `/login`, `/register` — real forms calling `apps/api`'s actual
  `POST /auth/login` / `POST /auth/register`
- `/dashboard` — calls the real `GET /readiness` and displays actual
  Postgres/Redis component status; the "Domain modules" section
  explicitly states Phase 2-5's logic exists in `packages/core` but
  has no API route yet, rather than showing anything fabricated for it
- `/dashboard/devices` — lists real devices via `GET /devices` and
  offers trust-state transitions via `POST /devices/transition`. The
  UI only offers transitions the backend's actual state machine
  allows (mirrors `packages/identity/src/deviceRegistry.ts`'s
  transition table) and explicitly warns that transitions require an
  ADMIN-scoped session the backend never auto-grants — a real 403 from
  the API surfaces to the user rather than being hidden
- `/dashboard/system` — a documentation view transcribed from
  `docs/phases/CURRENT_STATE.md`'s phase summaries, explicitly labeled
  in the page itself as documentation, not live telemetry (no API
  route reports phase completion, so none was invented)
- Auth session persisted in `localStorage`, guarded dashboard layout
  redirecting unauthenticated visitors to `/login`

## Verification actually performed in this sandbox
- `pnpm install` succeeded for the new workspace member
- `tsc --noEmit` — clean, zero errors
- `next build` — **succeeded**, all 7 routes compiled and prerendered
  as static content. One non-fatal warning: Google Fonts optimization
  was skipped because `fonts.googleapis.com` is outside this sandbox's
  network allowlist — this is a sandbox network restriction, not a
  code defect, and degrades gracefully (the font `<link>` still loads
  client-side over the network at runtime in any real deployment)
- Re-ran `tsc --noEmit` across all other 9 packages/apps afterward —
  no regressions

## NOT verified in this sandbox (explicitly, not fabricated)
- No live `apps/api` server was running in this sandbox while building
  the frontend, so the login/register/devices flows were verified by
  **code inspection against the actual route implementations**
  (`apps/api/src/routes/auth.ts`, `devices.ts`) and by confirming the
  TypeScript request/response shapes match exactly — not by an
  end-to-end run against a live server. This mirrors the same
  limitation every backend phase's `PHASE-N.md` has disclosed for its
  own live-DB testing.
- No visual QA / screenshot review was performed (no browser rendering
  tool available in this sandbox) — the build compiling successfully
  confirms the code is valid, not that the visual result matches the
  design intent pixel-for-pixel.
- No accessibility audit tool was run; keyboard focus rings and
  `prefers-reduced-motion` handling were added by hand in
  `globals.css` but not verified with an automated checker.

## Known gaps
- No shadcn/ui or other component library was added, despite the
  original Phase 1 placeholder note mentioning it — plain Tailwind
  kept the dependency surface smaller for a first real pass; nothing
  here blocks adding one later
- No token refresh flow — the web console stores the access/refresh
  token pair but never calls `POST /auth/refresh` before the access
  token expires; a session will start failing requests after
  `ACCESS_TOKEN_TTL_SECONDS` (15 min default) until the user logs in
  again
- No forms/pages exist yet for anything beyond auth + devices, because
  nothing else has an API route to call (see System status page)
- `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:4000` with
  no production config guidance beyond the `.env.example` comment

## Environment variables introduced
`NEXT_PUBLIC_API_BASE_URL` (see `apps/web/.env.example`)

## Recommended next action
1. Run `apps/api` locally (per its own README/CURRENT_STATE
   instructions), then `pnpm --filter @airdrop-os/web dev` and
   exercise register → login → device list → device transition
   end-to-end against the real server before trusting this in
   production.
2. Add token refresh before the access token's 15-minute TTL expires.
3. As each backend phase (2-9) gets an API route, add the
   corresponding dashboard page and remove that phase's `NotWiredCard`
   — the honest-placeholder pattern here is meant to be replaced
   incrementally, not left in place indefinitely.
