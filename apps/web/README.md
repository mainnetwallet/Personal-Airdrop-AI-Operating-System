# apps/web

Status: **PARTIAL** — real Next.js console, wired to what the backend
actually exposes.

Next.js 14 (App Router) + TypeScript + Tailwind. No component library
dependency (shadcn was mentioned in the Phase 1 placeholder note but
was not added - this build uses plain Tailwind to keep the dependency
surface small).

## What's real
- `/login`, `/register` — call the actual `apps/api` `/auth/*` routes
- `/dashboard` — calls the actual `/readiness` route
- `/dashboard/devices` — lists and transitions real devices via
  `/devices` and `/devices/transition` (transitions require an
  ADMIN-scoped session, which the backend never auto-grants — see the
  note on that page)

## What's honestly not real
- `/dashboard/system` is a documentation view of
  `docs/phases/CURRENT_STATE.md`, not live telemetry — there is no API
  route that reports phase completion
- The overview page's "Domain modules" section explicitly says Phase
  2-5's logic is implemented in `packages/core` but not yet exposed via
  HTTP, rather than showing fabricated data for it

## Running
```bash
pnpm install
cp .env.example .env.local   # point at your running apps/api
pnpm --filter @airdrop-os/web dev
```
