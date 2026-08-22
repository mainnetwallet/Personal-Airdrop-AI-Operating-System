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

### Option A — Native, no Docker (works on PC, VPS, or Android/Termux)
Postgres and Redis run as native processes — no container runtime
required.

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

### Option B — Managed cloud DB (no local install anywhere)
Use a free-tier hosted Postgres (e.g. Neon) and Redis (e.g. Upstash),
then just set `DATABASE_URL` / `REDIS_URL` in `.env` to the provided
connection strings. Same DB reachable from PC, VPS, and phone at once.


## Structure
- `apps/api` — Fastify + TypeScript backend
- `apps/worker` — BullMQ background workers
- `apps/web`, `apps/local-agent`, `apps/extension`, `apps/android` — scaffolded, built in later phases
- `packages/*` — shared core/types/database/security/identity/config/ui

## Frontend on Termux (`apps/web`)

Status: **known limitation, documented workaround below**. Next.js's
compiler (SWC) has no native binary published for Android/ARM64 at
all — not "not yet installed", genuinely never published — and its
`next dev`/`next build` startup tries to load that binary before a
`.babelrc` fallback (already added to `apps/web`) has a chance to take
effect. Adding `@next/swc-wasm-nodejs` as a fallback does **not** fix
this on stock Termux Node, because Termux's Node reports
`process.platform` in a way that skips the wasm fallback path
entirely for this target.

**Workaround: run the frontend inside a proot-distro Ubuntu chroot**,
where Node reports as a normal `linux-arm64` and native binaries
resolve normally (the same class of fix already applied to the backend
for `argon2`, but for the frontend the underlying tool itself has no
native path at all, so a chroot is required rather than a
pure-JS swap):

```bash
pkg install -y proot-distro
proot-distro install ubuntu
proot-distro login ubuntu

# inside the Ubuntu chroot:
apt update && apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm

cd /root
git clone https://github.com/mainnetwallet/Personal-Airdrop-AI-Operating-System.git
cd Personal-Airdrop-AI-Operating-System
pnpm install
cd apps/web
pnpm dev
```

The backend (`apps/api`) is unaffected and continues to run natively
in Termux as documented above — only the frontend's dev tooling needs
the chroot. `localhost` is shared between Termux and the proot-distro
chroot, so the web app can still reach the API at
`http://localhost:4000`.

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

