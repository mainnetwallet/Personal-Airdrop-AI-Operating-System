import { describe, it, expect } from "vitest";
import type { MultiDeviceCheckpointVersions } from "@airdrop-os/types";
import { MultiDeviceCheckpointStore } from "../multidevice/checkpointCompat.js";
import { MultiDeviceRecoveryCoordinator } from "../multidevice/recovery.js";

const versions: MultiDeviceCheckpointVersions = {
  schemaVersion: 1,
  agentVersion: "1.0.0",
  workflowVersion: 1,
  projectVersion: 1,
  campaignVersion: 1,
  requirementVersion: 1,
  browserStateHash: null,
  walletAccountContextHash: null,
  securityStateHash: "s1",
};

describe("MultiDeviceRecoveryCoordinator", () => {
  it("resumes only when the checkpoint is compatible", () => {
    const store = new MultiDeviceCheckpointStore();
    store.create({ checkpointId: "c1", sourceDeviceId: "vps1", versions, safeState: {} });
    const coordinator = new MultiDeviceRecoveryCoordinator(store);
    const attempt = coordinator.attemptRecovery({ failureDomain: "NETWORK", checkpointId: "c1", targetVersions: versions });
    expect(attempt.stage).toBe("RESUME");
  });

  it("routes to DO_NOT_RESUME on any version mismatch, across every failure domain", () => {
    const store = new MultiDeviceCheckpointStore();
    store.create({ checkpointId: "c1", sourceDeviceId: "vps1", versions, safeState: {} });
    const coordinator = new MultiDeviceRecoveryCoordinator(store);
    for (const domain of ["VPS", "WORKER", "PC", "BROWSER", "NETWORK", "RPC", "ANDROID", "SESSION"] as const) {
      const attempt = coordinator.attemptRecovery({
        failureDomain: domain,
        checkpointId: "c1",
        targetVersions: { ...versions, securityStateHash: "different" },
      });
      expect(attempt.stage).toBe("DO_NOT_RESUME");
      expect(attempt.reason).toContain("INCOMPATIBLE");
    }
  });

  it("routes to DO_NOT_RESUME when no checkpoint is available at all", () => {
    const store = new MultiDeviceCheckpointStore();
    const coordinator = new MultiDeviceRecoveryCoordinator(store);
    const attempt = coordinator.attemptRecovery({ failureDomain: "SESSION", checkpointId: null, targetVersions: versions });
    expect(attempt.stage).toBe("DO_NOT_RESUME");
    expect(attempt.reason).toBe("NO_CHECKPOINT_AVAILABLE");
  });

  it("records every attempt in history, in order", () => {
    const store = new MultiDeviceCheckpointStore();
    store.create({ checkpointId: "c1", sourceDeviceId: "vps1", versions, safeState: {} });
    const coordinator = new MultiDeviceRecoveryCoordinator(store);
    coordinator.attemptRecovery({ failureDomain: "RPC", checkpointId: "c1", targetVersions: versions });
    coordinator.attemptRecovery({ failureDomain: "ANDROID", checkpointId: null, targetVersions: versions });
    expect(coordinator.history()).toHaveLength(2);
  });
});
