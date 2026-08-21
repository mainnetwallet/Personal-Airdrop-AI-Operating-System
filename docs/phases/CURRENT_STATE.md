# CURRENT STATE — Personal Airdrop AI Operating System V12

Last updated: end of Phase 1.

## Current architecture
pnpm monorepo. Fastify API + Drizzle/Postgres + Redis/BullMQ backend.
Next.js web app and PC/extension/Android agents are scaffolded but empty.
See `docs/phases/PHASE-1.md` for full detail.

## Completed / tested (this sandbox)
- Monorepo scaffold, fail-closed config loading
- Drizzle schema for 13 foundational tables + generated SQL migration
- Device trust-state machine (unit tested)
- Secret redaction (unit tested)
- Device-bound access/refresh token issuance + verification (unit tested)
- Fastify health/readiness endpoints (unit tested with mocked db/redis)
- Typecheck clean across all 9 packages/apps

## Partial / mocked / not-configured
- `/auth/*` and `/devices/*` routes are implemented but **not yet run
  against a live Postgres/Redis** — no DB engine available in this
  sandbox. Needs verification on a machine with Docker before trusting
  in production.
- `apps/web`, `apps/local-agent`, `apps/extension`, `apps/android`:
  NOT_CONFIGURED, workspace placeholders only
- `packages/core` (Agent OS Kernel): NOT_CONFIGURED, Phase 2
- `apps/worker`: only a placeholder heartbeat queue; real job types
  NOT_CONFIGURED until Phase 2
- Rate limiting: single global limiter only, no per-route/per-auth-endpoint
  tuning yet

## Known bugs / security issues
None found in what was built. Caveat: integration-level behavior (real DB
constraints, concurrent refresh races) is unverified in this sandbox — see
above.

## Migrations
`packages/database/drizzle/0000_tearful_rafael_vega.sql` — 13 tables,
generated via `drizzle-kit generate`, not yet applied to a live database.

## API routes
`GET /health`, `GET /readiness`, `POST /auth/register`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/revoke`,
`GET /devices`, `POST /devices/transition`

## Environment variables
`NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_SECONDS`, `API_HOST`, `API_PORT`, `RATE_LIMIT_MAX`,
`RATE_LIMIT_WINDOW_MS`, `POSTGRES_PASSWORD` (all documented in
`.env.example`, no real secrets committed).

## Required external integrations
None required for Phase 1 itself. Phase 3+ will need chain RPC providers,
Phase 6+ will need browser automation, Phase 8+ will need
Discord/X/Telegram/GitHub API credentials — all currently
NOT_CONFIGURED, to be added explicitly (never fabricated) when those
phases are built.

## Next-phase dependencies
Phase 2 (Agent OS Kernel) consumes: `agentIdentities`, `devices`,
`devicePermissions`, `agent_runs`/`events` table stubs, `audit_logs`,
`policies`, `feature_flags`, and `requireAuth()` middleware.

## Exact recommended next action
1. On a machine with Docker: `docker compose up -d`, then
   `pnpm --filter @airdrop-os/database db:migrate`, then start the API
   and confirm `/readiness` reports `CONNECTED` for both Postgres and
   Redis.
2. Manually exercise `/auth/register` → `/auth/login` →
   `/devices/transition` (promote a device to TRUSTED) → `/auth/refresh`
   once against the real database to confirm the flow end-to-end before
   starting Phase 2.
3. Then hand Phase 2's prompt to Claude, in a fresh chat pointed at this
   repository, per the README's sequential-build instructions.
