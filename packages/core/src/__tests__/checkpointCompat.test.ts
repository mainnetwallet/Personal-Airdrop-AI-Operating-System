import { describe, it, expect } from "vitest";
import type { MultiDeviceCheckpointVersions } from "@airdrop-os/types";
import { MultiDeviceCheckpointStore } from "../multidevice/checkpointCompat.js";

const versions: MultiDeviceCheckpointVersions = {
  schemaVersion: 1,
  agentVersion: "1.0.0",
  workflowVersion: 1,
  projectVersion: 3,
  campaignVersion: 2,
  requirementVersion: 5,
  browserStateHash: "b1",
  walletAccountContextHash: "w1",
  securityStateHash: "s1",
};

describe("MultiDeviceCheckpointStore", () => {
  it("is COMPATIBLE when every dimension matches exactly", () => {
    const store = new MultiDeviceCheckpointStore();
    store.create({ checkpointId: "c1", sourceDeviceId: "pc1", versions, safeState: {} });
    const result = store.checkCompatibility("c1", { ...versions });
    expect(result.result).toBe("COMPATIBLE");
    expect(result.mismatches).toEqual([]);
  });

  it("any single dimension mismatch makes it INCOMPATIBLE - e.g. requirementVersion drift", () => {
    const store = new MultiDeviceCheckpointStore();
    store.create({ checkpointId: "c1", sourceDeviceId: "pc1", versions, safeState: {} });
    const result = store.checkCompatibility("c1", { ...versions, requirementVersion: 6 });
    expect(result.result).toBe("INCOMPATIBLE");
    expect(result.mismatches).toEqual(["requirementVersion"]);
  });

  it("security state mismatch alone is enough to block resume", () => {
    const store = new MultiDeviceCheckpointStore();
    store.create({ checkpointId: "c1", sourceDeviceId: "pc1", versions, safeState: {} });
    expect(store.isResumeSafe("c1", { ...versions, securityStateHash: "different" })).toBe(false);
  });

  it("unknown checkpoint is INCOMPATIBLE, not silently treated as compatible", () => {
    const store = new MultiDeviceCheckpointStore();
    const result = store.checkCompatibility("never-created", versions);
    expect(result.result).toBe("INCOMPATIBLE");
    expect(result.mismatches).toContain("CHECKPOINT_NOT_FOUND");
  });

  it("refuses to store a safeState field that looks like a secret", () => {
    const store = new MultiDeviceCheckpointStore();
    expect(() =>
      store.create({ checkpointId: "c2", sourceDeviceId: "pc1", versions, safeState: { seedPhrase: "x" } }),
    ).toThrow();
  });
});
