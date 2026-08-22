# apps/android

Status: **NOT_CONFIGURED** (Phase 9 scaffold, workspace slot only)

This will be the Android first-class control/visibility client sharing
one Agent Identity with VPS/PC/Web/Chrome Extension (see
`@airdrop-os/core` `DeviceRegistry`, `multidevice/*`).

No Android SDK, emulator, Gradle toolchain, or Play Store signing
identity exists in this sandbox, so nothing here is buildable or
runnable yet - this directory only reserves the workspace slot and
records the required screen set so a later phase doesn't have to
restructure the repo.

## Security posture
Android receives **no secret material**: no private keys, seed
phrases, passwords, OTP/2FA secrets, or raw session tokens. This is
enforced in `@airdrop-os/core`'s `DeviceRegistry` (`receivesSecrets` is
fixed `false` for `ANDROID`), not just documented here. The app is a
control/visibility surface over the kernel's state, not a wallet.

## Required screens (Phase 9 contract)
- Dashboard
- Projects
- Campaigns
- Missions
- Tasks
- Opportunity radar
- Eligibility
- Claims
- Rewards
- Reports
- Notifications
- Human handoff
- Approvals
- Security alerts
- VPS/PC/agent status
- Device management
- Backup/migration status
- Kill switch

(See `AndroidScreen` in `@airdrop-os/types` for the machine-checkable
version of this list.)

## Multi-device role
Android participates in the shared Agent Identity as one more
`DeviceRecord` (`kind: "ANDROID"`). It can hold `STANDBY` or
`READ_ONLY` coordinator roles like any other device, but per the
split-brain contract at most one device across the whole identity may
ever be `ACTIVE` at a time - `DeviceRegistry.promoteToActive()` is the
only path that can set that, and it always demotes any prior `ACTIVE`
holder first.

## Required external tooling (all NOT_CONFIGURED here)
Android SDK / Gradle, an emulator or physical test device, a reachable
VPS API endpoint for the device-auth handshake, and (for release
builds) a signing keystore. None of these are available in this
sandbox.

## Recommended next action
On a machine with Android Studio / the Android SDK installed: scaffold
a Kotlin + Jetpack Compose app targeting the screen list above, wire
its device-auth handshake against a live VPS API the same way
`apps/extension`'s `authenticateDevice()` is designed to (see Phase 6),
and register the device through `DeviceRegistry` on first successful
handshake.
