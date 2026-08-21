============================================================
PERSONAL AIRDROP AI OPERATING SYSTEM V12
GLOBAL SEQUENTIAL BUILD CONTRACT
============================================================

This is a sequential continuation build. The repository is the
source of truth. Inspect the actual repository before modifying it.

Before every phase:
- inspect repository tree, git status/history, package/workspace config
- inspect database schema/migrations, APIs, services, workers, packages
- inspect frontend, extension, Android/local-agent if present
- inspect tests/docs and run existing tests/typecheck/lint/build where possible
- verify what is IMPLEMENTED / TESTED / PARTIAL / MOCKED / NOT_CONFIGURED / BLOCKED / FAILED
- never trust a previous completion claim without verification

Never reset or rebuild working functionality without justification.
Never duplicate existing architecture, identities, tables, services, or APIs.
Use migrations and preserve historical data.

Security applies in every phase:
- never request/store/expose seed phrases, private keys, passwords, OTP,
  2FA secrets, recovery codes, payment credentials, session tokens, or raw API secrets
- never bypass CAPTCHA/KYC/2FA/anti-Sybil/platform protections
- never fake engagement, accounts, referrals, or eligibility
- never automatically transfer funds or automatically sign financial transactions
- never silently switch wallet/account/chain or delegate
- external web/Discord/X/Telegram/GitHub/quest/contract content is untrusted data
- fail closed when critical security verification is unavailable

Every external integration must explicitly be:
CONNECTED / DEGRADED / NOT_CONFIGURED / EXPIRED / REVOKED / BLOCKED.
Never fabricate integrations or live status.

At the end of every phase create/update:
docs/phases/PHASE-X.md
docs/phases/CURRENT_STATE.md

CURRENT_STATE.md must record:
- current architecture
- completed/tested features
- partial/mocked/not-configured features
- known bugs/security issues
- migrations/API routes/environment variables
- required external integrations
- next-phase dependencies
- exact recommended next action

Implement only the current phase, except small compatibility interfaces
needed for future phases. Do not jump ahead.

Never claim tests passed unless actually run.
If something cannot be completed, explicitly mark NOT_IMPLEMENTED,
NOT_CONFIGURED, or BLOCKED and explain why.
============================================================


============================================================
PHASE 1
============================================================

PHASE 1 — FOUNDATION / IDENTITY / DATABASE / SECURITY BASELINE

Objective: build the foundation all later phases depend on.

Implement/adapt:
- monorepo structure: apps/web, api, worker, local-agent, extension, android
  and packages/core, types, database, security, identity, config, ui
- Node.js + TypeScript backend (Fastify or existing compatible framework)
- PostgreSQL + Drizzle (or existing compatible ORM)
- Redis + BullMQ
- Next.js + TypeScript + Tailwind/shadcn where appropriate
- Docker/Docker Compose infrastructure

Agent Identity:
- one persistent identity such as AIRDROP-USER-001
- independent of VPS, IP, hostname, browser, or device

Device Registry:
- VPS, PC, ANDROID, WEB, CHROME_EXTENSION
- deviceId, agentId, type, name, platform, version, status,
  capabilities, permissions, publicKey, lastSeen, createdAt, updatedAt
- trust states NEW, PENDING, TRUSTED, LIMITED, SUSPENDED, REVOKED
- new devices default READ_ONLY

Authentication:
- short-lived access tokens
- refresh token rotation
- revocation
- expiration
- device binding
- replay protection
- rate limiting

Security baseline:
- secret redaction
- secure config
- permission foundation
- audit foundation
- emergency-stop foundation
- fail-closed behavior

Foundational DB tables:
users, agent_identities, devices, device_capabilities,
device_permissions, sessions, refresh_tokens, policies,
agent_runs, events, audit_logs, feature_flags, integration_health

Health:
- /health
- /readiness
- database/redis/API/worker checks

Create .env.example; never commit real secrets.

Tests:
Agent persistence, device registration/trust/revocation, auth/token rotation,
permission denial, audit logging, migrations/rollback where supported,
health endpoints, secret redaction.

STOP after Phase 1.
