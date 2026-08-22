import { describe, it, expect } from "vitest";
import { buildBackupManifest } from "../multidevice/backup.js";
import { runDisasterRecoveryTest } from "../multidevice/disasterRecovery.js";
import type { RestoreVerificationResult } from "@airdrop-os/types";

function passedRestore(backupId: string): RestoreVerificationResult {
  return {
    backupId,
    countsMatch: true,
    hashesMatch: true,
    relationshipsMatch: true,
    checkpointsRestored: true,
    workflowsRestored: true,
    mismatchedEntities: [],
    status: "PASSED",
    verifiedAt: new Date().toISOString(),
  };
}

describe("runDisasterRecoveryTest", () => {
  it("PASSES only when restore, identity, and relationships all verify", async () => {
    const { manifest } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "VPS",
      encryptionApplied: true,
      entities: {},
    });
    const result = await runDisasterRecoveryTest({
      manifest,
      testInstanceId: "test-instance-1",
      destroyFn: async () => {},
      restoreFn: async (backupId) => passedRestore(backupId),
      verifyIdentityFn: async () => true,
      verifyRelationshipsFn: async () => true,
    });
    expect(result.status).toBe("PASSED");
  });

  it("FAILS if the restore itself failed, and never calls identity/relationship checks on a failed restore", async () => {
    const { manifest } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "VPS",
      encryptionApplied: true,
      entities: {},
    });
    let identityChecked = false;
    const result = await runDisasterRecoveryTest({
      manifest,
      testInstanceId: "test-instance-1",
      destroyFn: async () => {},
      restoreFn: async (backupId) => ({ ...passedRestore(backupId), status: "FAILED" }),
      verifyIdentityFn: async () => {
        identityChecked = true;
        return true;
      },
      verifyRelationshipsFn: async () => true,
    });
    expect(result.status).toBe("FAILED");
    expect(identityChecked).toBe(false);
  });

  it("FAILS if identity verification fails even though restore passed", async () => {
    const { manifest } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "VPS",
      encryptionApplied: true,
      entities: {},
    });
    const result = await runDisasterRecoveryTest({
      manifest,
      testInstanceId: "test-instance-1",
      destroyFn: async () => {},
      restoreFn: async (backupId) => passedRestore(backupId),
      verifyIdentityFn: async () => false,
      verifyRelationshipsFn: async () => true,
    });
    expect(result.status).toBe("FAILED");
    expect(result.identityVerified).toBe(false);
  });
});
