# Personal Airdrop AI Operating System (V12)

A personal research/tracking assistant for airdrop opportunities, built as
a 10-phase sequential monorepo. See `PERSONAL_AIRDROP_AI_OS_V12_10_PHASES/`
(build prompts) and `docs/phases/` (actual progress + current state).

**Security posture (applies to every phase):** never stores seed phrases,
private keys, passwords in plaintext, OTP/2FA secrets, or session tokens;
never bypasses CAPTCHA/KYC/2FA; never fakes engagement/eligibility; never
auto-signs or auto-transfers funds; fails closed when verification is
unavailable.

## Status
Phase 7 of 10 complete. See `docs/phases/CURRENT_STATE.md`.

## Getting started
```bash
pnpm install
cp .env.example .env   # fill in real secrets, never commit .env
docker compose up -d   # postgres + redis
pnpm --filter @airdrop-os/database db:migrate
pnpm dev:api
```

## Structure
- `apps/api` — Fastify + TypeScript backend
- `apps/worker` — BullMQ background workers
- `apps/web`, `apps/local-agent`, `apps/extension`, `apps/android` — scaffolded, built in later phases
- `packages/*` — shared core/types/database/security/identity/config/ui
