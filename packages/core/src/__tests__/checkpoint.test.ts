import { describe, it, expect } from "vitest";
import { CheckpointManager } from "../agent/checkpoint.js";

describe("CheckpointManager", () => {
  const versions = { schemaVersion: 1, agentVersion: "1.0.0", workflowVersion: 1 };

  it("creates a checkpoint with the manager's current versions stamped on it", () => {
    const mgr = new CheckpointManager(versions);
    const cp = mgr.create({ checkpointId: "cp1", label: "BEFORE_CLAIM", safeState: { step: 2 }, now: 0 });
    expect(cp.versions).toEqual(versions);
  });

  it("refuses to store a field that looks like a secret", () => {
    const mgr = new CheckpointManager(versions);
    expect(() => mgr.create({ checkpointId: "cp1", label: "x", safeState: { privateKey: "abc" } })).toThrow();
  });

  it("reports COMPATIBLE when current versions match", () => {
    const mgr = new CheckpointManager(versions);
    mgr.create({ checkpointId: "cp1", label: "x", safeState: {} });
    expect(mgr.checkCompatibility("cp1").result).toBe("COMPATIBLE");
  });

  it("reports INCOMPATIBLE when a restored checkpoint's schema version has been superseded", () => {
    const original = new CheckpointManager(versions);
    const cp = original.create({ checkpointId: "cp1", label: "x", safeState: {} });

    // Simulate resuming on an agent that has since moved to schema v2 -
    // the restored checkpoint keeps ITS original (v1) versions.
    const upgraded = new CheckpointManager({ ...versions, schemaVersion: 2 });
    upgraded.load(cp);
    expect(upgraded.checkCompatibility("cp1")).toEqual({ result: "INCOMPATIBLE", mismatches: ["schemaVersion"] });
  });

  it("reports INCOMPATIBLE with CHECKPOINT_NOT_FOUND for an unknown id", () => {
    const mgr = new CheckpointManager(versions);
    const check = mgr.checkCompatibility("missing");
    expect(check).toEqual({ result: "INCOMPATIBLE", mismatches: ["CHECKPOINT_NOT_FOUND"] });
  });

  it("lists every mismatched version field", () => {
    const original = new CheckpointManager(versions);
    const cp = original.create({ checkpointId: "cp1", label: "x", safeState: {} });
    const upgraded = new CheckpointManager({ schemaVersion: 2, agentVersion: "2.0.0", workflowVersion: 3 });
    upgraded.load(cp);
    const check = upgraded.checkCompatibility("cp1");
    expect(check.result).toBe("INCOMPATIBLE");
    expect(check.mismatches.sort()).toEqual(["agentVersion", "schemaVersion", "workflowVersion"].sort());
  });
});
