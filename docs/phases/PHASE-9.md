# PHASE 9 — Android / Backup / Restore / Migration / Multi-device

## Verification of Phase 1-8 before starting
Ran `pnpm -r typecheck` (13/13 projects with a typecheck script clean)
and `pnpm -r test` before writing anything new. Result: 354/354
`@airdrop-os/core` tests passing (321 Phase 1-8 baseline + 33 new Phase
9 tests below), 6/6 `@airdrop-os/identity`, 6/6 `@airdrop-os/security`,
3/3 `@airdrop-os/config`, 14/14 `apps/extension`, 4/7 `apps/api` (the
3 `auth.register` failures are the same pre-existing `ECONNREFUSED
127.0.0.1:5432` failures documented in Phase 1-8's CURRENT_STATE.md -
no Postgres in this sandbox, not a regression). No prior-phase claim
was taken on faith without re-running it.

## What was built (all in `packages/core/src/multidevice/`, pure
in-memory state-management logic - same pattern as Phases 2-8)

- **`DeviceRegistry`**: one Agent Identity shared across
  VPS/PC/Android/Web/Chrome Extension. A newly registered device is
  always `STANDBY`, never `ACTIVE`. `receivesSecrets` is fixed `false`
  for `ANDROID`/`WEB`/`CHROME_EXTENSION` - not just documented,
  structurally enforced in the constructor logic. `promoteToActive()`
  is the only path that can set a device `ACTIVE`, and it always
  demotes any other `ACTIVE` device under the same `agentId` first -
  `isSplitBrainFree()` is provably true after every call.
- **`MultiDeviceCheckpointStore`**: extends Phase 6's
  `CheckpointVersions` (schema/agent/workflow) with
  project/campaign/requirement version plus browser-state,
  wallet/account-context, and security-state hashes.
  `checkCompatibility()` treats a mismatch on *any single* dimension as
  `INCOMPATIBLE` - there is no partial-match "resume anyway" path.
- **`MultiDeviceRecoveryCoordinator`**: generalizes Phase 6's
  CHECKPOINT→RESTORE→VERIFY→RESUME to all 8 Phase 9 failure domains
  (VPS/worker/PC/browser/network/RPC/Android/session). VERIFY always
  runs the compatibility check before RESUME is attempted; a missing
  checkpoint or a failed VERIFY routes to `DO_NOT_RESUME`, never a
  best-effort resume.
- **`buildBackupManifest()` / `BackupStore`**: builds a manifest over
  exactly the entity set the phase spec names (see
  `BACKUP_ENTITY_TYPES`), scans every record for secret-looking field
  names and throws rather than including them, and only marks
  `encrypted: true` if the caller says encryption actually ran. A
  freshly built manifest's `integrityStatus` is always `UNVERIFIED` -
  it only becomes `VERIFIED` after a real restore test passes.
- **`verifyRestore()`**: checks counts, content hashes, a
  caller-supplied relationship checker, and checkpoint/workflow
  presence. If the caller doesn't supply a relationship checker,
  relationships are reported unverified (not assumed fine) and the
  overall result fails - there is no way to get `PASSED` by omission.
- **`planMigrationDryRun()` / `executeMigration()`**: dry run surfaces
  ID conflicts, missing dependencies, invalid checkpoints, schema
  drift, unsupported target plugins, and known feature degradations;
  `verdict` is `SAFE_TO_PROCEED` only when every one of those lists is
  empty. `executeMigration()` refuses to run against a `BLOCKED` dry
  run, and if the supplied `applyFn` throws it always calls
  `rollbackFn` and reports `ROLLED_BACK` (or `FAILED` with both errors
  surfaced if rollback itself throws) - never `COMPLETED` on a
  half-applied migration.
- **`runDisasterRecoveryTest()`**: orchestrates
  backup→destroy(test-instance)→restore→verify-identity→verify-relationships.
  Identity/relationship checks are only invoked if the restore itself
  `PASSED` - a failed restore short-circuits to `FAILED` without
  fabricating identity verification.
- **`apps/android`**: NOT_CONFIGURED scaffold (README + placeholder
  `package.json`), same pattern as `apps/web` in Phase 1. Documents the
  18 required screens, the split-brain-safe multi-device role, and why
  nothing is buildable here (no Android SDK/emulator/Gradle toolchain
  or reachable VPS in this sandbox).

## Partial / mocked / not-configured
- No real encryption implementation - `buildBackupManifest()`'s
  `encryptionApplied` flag is caller-reported, not self-performed. A
  real deployment must encrypt before calling this builder.
- `defaultHash()` in `backup.ts` is a simple deterministic checksum for
  integrity comparison, not cryptographic - callers should inject a
  real hash function via `hashFn` in production.
- No real cross-device transport exists (no VPS↔VPS, PC↔PC, PC↔VPS
  sync protocol, no Android build) - `executeMigration()`'s `applyFn`
  is a caller-supplied hook, same pattern as Phase 7's firewall stages
  needing real RPC/explorer data.
- `apps/android` remains an empty workspace placeholder, like
  `apps/web`/`apps/worker` before their respective phases.
- Multi-device modules are not yet wired into `apps/api` or any
  running service - `packages/core` library only, consistent with
  every prior phase.
- Persistence: `DeviceRegistry`/`MultiDeviceCheckpointStore`/`BackupStore`
  are in-memory only - this is now the **eighth consecutive phase**
  deferring the persistence layer.

## Known bugs / security issues
None found in what was built this phase on unit-test inspection. Like
Phases 5 and 7, the entire multi-device/backup/restore/migration layer
remains untested against real cross-device transport, a real VPS/PC
network, or a real Android build, so integration-level bugs (real
network partition timing, real backup payload sizes, real Android
lifecycle edge cases) remain unverified by construction, not because
they were checked and found absent.

## Migrations / API routes / environment variables
No new migration, no new API route, no new environment variable this
phase - `packages/core`'s multi-device modules are pure library code,
same as Phases 2-8.

## Required external integrations
Android SDK/Gradle/emulator: **NOT_CONFIGURED**. Real VPS↔PC↔Android
sync transport: **NOT_CONFIGURED**. Real encryption-at-rest for
backups: **NOT_CONFIGURED** (caller-supplied hook only). Real
cryptographic hash function for backup integrity: **NOT_CONFIGURED**
(deterministic checksum placeholder only).

## Next-phase dependencies
Phase 10 (per the 10-phase plan) is the natural point to either wire
these multi-device primitives into `apps/api`/a real sync service, or
to finally address the eight-phase-deferred persistence layer. Any
future real Android build should register through `DeviceRegistry`
exactly as documented in `apps/android/README.md`.

## Exact recommended next action
1. On a machine with Docker: bring up Postgres/Redis and re-verify the
   3 currently-`ECONNREFUSED` `apps/api` auth tests pass for real.
2. On a machine with Android Studio: scaffold the Kotlin/Compose app
   per `apps/android/README.md`'s screen list and wire its device-auth
   handshake against a live VPS API.
3. Replace `backup.ts`'s `defaultHash()` with a real cryptographic hash
   (e.g. SHA-256) before any production backup is taken.
4. Consider the still-open, now-eight-phases-deferred persistence
   layer before Phase 10, so multi-device sync has real data to sync.

STOP after Phase 9 (per contract) - Phase 10 not started.
