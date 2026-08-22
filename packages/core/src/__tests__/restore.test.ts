import { describe, it, expect } from "vitest";
import { buildBackupManifest } from "../multidevice/backup.js";
import { verifyRestore } from "../multidevice/restore.js";

const hashFn = (data: unknown) => JSON.stringify(data);

describe("verifyRestore", () => {
  it("PASSES only when counts, hashes, relationships, checkpoints, and workflows all check out", () => {
    const { manifest } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "VPS",
      encryptionApplied: true,
      entities: { projects: [{ id: "p1" }] },
      hashFn,
    });
    const result = verifyRestore(manifest, {
      entities: { projects: [{ id: "p1" }] },
      hashFn,
      checkRelationships: () => ({ ok: true, problems: [] }),
      checkpointsPresent: true,
      workflowsPresent: true,
    });
    expect(result.status).toBe("PASSED");
  });

  it("FAILS on a record count mismatch, and reports which entity", () => {
    const { manifest } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "VPS",
      encryptionApplied: true,
      entities: { projects: [{ id: "p1" }, { id: "p2" }] },
      hashFn,
    });
    const result = verifyRestore(manifest, {
      entities: { projects: [{ id: "p1" }] },
      hashFn,
      checkRelationships: () => ({ ok: true, problems: [] }),
      checkpointsPresent: true,
      workflowsPresent: true,
    });
    expect(result.status).toBe("FAILED");
    expect(result.countsMatch).toBe(false);
    expect(result.mismatchedEntities.some((m) => m.startsWith("projects:count"))).toBe(true);
  });

  it("FAILS (not passes) when no relationship checker is supplied - never assumes relationships are fine", () => {
    const { manifest } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "VPS",
      encryptionApplied: true,
      entities: {},
      hashFn,
    });
    const result = verifyRestore(manifest, {
      entities: {},
      hashFn,
      checkpointsPresent: true,
      workflowsPresent: true,
    });
    expect(result.relationshipsMatch).toBe(false);
    expect(result.status).toBe("FAILED");
  });

  it("FAILS when checkpoints or workflows did not come back, even if data counts/hashes match", () => {
    const { manifest } = buildBackupManifest({
      agentId: "a1",
      schemaVersion: "1.0.0",
      databaseVersion: "1.0.0",
      sourceDevice: "VPS",
      encryptionApplied: true,
      entities: {},
      hashFn,
    });
    const result = verifyRestore(manifest, {
      entities: {},
      hashFn,
      checkRelationships: () => ({ ok: true, problems: [] }),
      checkpointsPresent: false,
      workflowsPresent: true,
    });
    expect(result.status).toBe("FAILED");
  });
});
