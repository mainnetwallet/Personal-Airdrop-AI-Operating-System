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
PHASE 8
============================================================

PHASE 8 — AIRDROP COVERAGE / OFF-CHAIN INTELLIGENCE / PLUGINS

Verify Phase 1–7.

Implement broad adapters without rewriting core.

Discord intelligence:
announcements, campaign updates, requirements, deadlines, claims,
security warnings, official links; track legitimate user activity where
available; never impersonate/spam/mass-message/fake.

Social intelligence:
X, Telegram, community, creator, content, referral, ambassador.
Respect platform rules. No fake engagement.

Quest:
quests, XP, points, badges, leaderboards, campaign verification.
Never fabricate completion.

Developer:
GitHub repositories/commits/issues/PRs/bug reports/docs/SDK/API/testnet/
hackathons/bounties/feedback.

DePIN:
node/device/bandwidth/storage/GPU/CPU/sensor/uptime/proof-of-resource/
proof-of-coverage/epochs/points/rewards.

AI/Compute:
GPU/compute/inference/model usage/datasets/API/AI tasks/points/epochs.

Gaming/GameFi:
game/account/sessions/NFT/mint/activity/XP/levels/quests/achievements/
leaderboard/season/tournament/guild.

Prediction/trading:
track legitimate campaign data; NO autonomous financial trading.

Referral:
code/source/invites/verified status/reward conditions; detect self/
duplicate/suspicious; never fake accounts.

Ambassador/creator:
application/acceptance/tasks/content/events/translation/deadlines/rewards/evidence.

Exchange:
track legitimate campaigns; never auto-execute sensitive financial actions.

Waitlist/Beta:
application/invite/access/status/activity/deadline/evidence.

Learn-to-earn:
course/lesson/quiz/score/certificate/completion; never fabricate.

Plugin SDK:
detect, research, verify, requirements, eligibility, cost, time, risk,
tasks, mission, monitor, claim, report.
Third-party plugins require sandboxed permissions/resource limits/network
restrictions/version pinning/integrity/health. Unknown plugin DISABLED.

Use explicit integration states:
CONNECTED, DEGRADED, NOT_CONFIGURED, BLOCKED, REVOKED.

Mock every adapter. Real integrations only when actually available.

STOP after Phase 8.
