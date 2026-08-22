import { describe, it, expect } from "vitest";
import { buildBackupManifest, BackupStore } from "../multidevice/backup.js";

describe("buildBackupManifest", () => {
  it("records accurate record counts and content hashes per entity type", () => {
    const { manifest } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "VPS",
      encryptionApplied: true,
      entities: { projects: [{ id: "p1" }, { id: "p2" }], missions: [{ id: "m1" }] },
    });
    expect(manifest.recordCounts.projects).toBe(2);
    expect(manifest.recordCounts.missions).toBe(1);
    expect(manifest.recordCounts.tasks).toBe(0);
    expect(manifest.contentHashes.projects).toBeDefined();
  });

  it("never marks a manifest encrypted unless the caller actually applied encryption", () => {
    const { manifest } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "PC",
      encryptionApplied: false,
      entities: {},
    });
    expect(manifest.encrypted).toBe(false);
  });

  it("a freshly built manifest is UNVERIFIED, never fabricated as VERIFIED", () => {
    const { manifest } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "PC",
      encryptionApplied: true,
      entities: {},
    });
    expect(manifest.integrityStatus).toBe("UNVERIFIED");
  });

  it("refuses to build a backup containing a field that looks like a secret", () => {
    expect(() =>
      buildBackupManifest({
        agentId: "a1",
        schemaVersion: "1.0.0",
        databaseVersion: "1.0.0",
        sourceDevice: "VPS",
        encryptionApplied: true,
        entities: { walletAccountMetadata: [{ id: "w1", privateKey: "0xdead" }] },
      }),
    ).toThrow();
  });
});

describe("BackupStore", () => {
  it("saves and retrieves a manifest+payload, and can update integrity status after a restore test", () => {
    const store = new BackupStore();
    const { manifest, payload } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "VPS",
      encryptionApplied: true,
      entities: { projects: [{ id: "p1" }] },
    });
    store.save(manifest, payload);
    expect(store.get(manifest.backupId)?.manifest.backupId).toBe(manifest.backupId);
    store.markIntegrityStatus(manifest.backupId, "VERIFIED");
    expect(store.get(manifest.backupId)?.manifest.integrityStatus).toBe("VERIFIED");
  });
});
