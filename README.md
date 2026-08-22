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
Phase 9 of 10 complete. See `docs/phases/CURRENT_STATE.md`.

## Getting started

### Option A — Docker (PC/VPS with Docker available)
```bash
pnpm install
cp .env.example .env   # fill in real secrets, never commit .env
docker compose up -d   # postgres + redis
pnpm --filter @airdrop-os/database db:migrate
pnpm dev:api
```

### Option B — Native, no Docker (works on PC, VPS, or Android/Termux)
Postgres and Redis run as native processes instead of containers — same
DB/queue, no container runtime required. Useful when Docker isn't
available (e.g. Termux on Android, or a minimal VPS).

```bash
# Debian/Ubuntu (PC or VPS)
sudo apt install -y postgresql redis-server
sudo systemctl enable --now postgresql redis-server

# macOS
brew install postgresql redis
brew services start postgresql redis

# Termux (Android)
pkg install -y postgresql redis
initdb $PREFIX/var/lib/postgresql
pg_ctl -D $PREFIX/var/lib/postgresql start
redis-server --daemonize yes
```

Then, regardless of platform:
```bash
pnpm install
cp .env.example .env   # point DATABASE_URL / REDIS_URL at localhost
pnpm --filter @airdrop-os/database db:migrate
pnpm dev:api
```

### Option C — Managed cloud DB (no local install anywhere)
Use a free-tier hosted Postgres (e.g. Neon) and Redis (e.g. Upstash),
then just set `DATABASE_URL` / `REDIS_URL` in `.env` to the provided
connection strings. Same DB reachable from PC, VPS, and phone at once.


## Structure
- `apps/api` — Fastify + TypeScript backend
- `apps/worker` — BullMQ background workers
- `apps/web`, `apps/local-agent`, `apps/extension`, `apps/android` — scaffolded, built in later phases
- `packages/*` — shared core/types/database/security/identity/config/ui

## Local agent (`apps/local-agent`)

Status: partially wired. `launchBrowser()` uses `puppeteer-core` against
a Chromium binary set via `CHROMIUM_PATH` (e.g. Termux's
`pkg install chromium`) — fails closed if unset rather than guessing a
path. Known limits of this path: no browser-extension support (wallet
extensions like MetaMask won't load), reduced sandboxing
(`--no-sandbox` is required outside a container), and higher chance of
bot-detection blocks on headless/ARM Chromium. `connectToVps()` remains
unimplemented (`NOT_CONFIGURED`) — real remote-VPS wiring is future
work.

