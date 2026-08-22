import type { BackupManifest, DisasterRecoveryTestResult, RestoreVerificationResult } from "@airdrop-os/types";

/**
 * Orchestrates the Phase 9 disaster-recovery test: take a backup of a
 * realistic dataset, destroy a (test-only) instance, restore from the
 * backup, and verify identity + relationships actually came back
 * correctly. This never runs against a live/production instance -
 * `destroyFn`/`restoreFn` are supplied by the caller and must target an
 * isolated test environment.
 */
export async function runDisasterRecoveryTest(params: {
  manifest: BackupManifest;
  testInstanceId: string;
  destroyFn: (testInstanceId: string) => Promise<void>;
  restoreFn: (backupId: string) => Promise<RestoreVerificationResult>;
  verifyIdentityFn: () => Promise<boolean>;
  verifyRelationshipsFn: () => Promise<boolean>;
  now?: number;
}): Promise<DisasterRecoveryTestResult> {
  await params.destroyFn(params.testInstanceId);
  const restoreResult = await params.restoreFn(params.manifest.backupId);
  const identityVerified = restoreResult.status === "PASSED" ? await params.verifyIdentityFn() : false;
  const relationshipsVerified = restoreResult.status === "PASSED" ? await params.verifyRelationshipsFn() : false;

  const status: DisasterRecoveryTestResult["status"] =
    restoreResult.status === "PASSED" && identityVerified && relationshipsVerified ? "PASSED" : "FAILED";

  return {
    backupId: params.manifest.backupId,
    destroyedTestInstanceId: params.testInstanceId,
    restoreResult,
    identityVerified,
    relationshipsVerified,
    status,
    ranAt: new Date(params.now ?? Date.now()).toISOString(),
  };
}
