import { describe, it, expect } from "vitest";
import { CheckpointManager } from "../agent/checkpoint.js";
import { RecoveryManager } from "../agent/recovery.js";

const versions = { schemaVersion: 1, agentVersion: "1.0.0", workflowVersion: 1 };

describe("RecoveryManager", () => {
  it("resumes when a compatible checkpoint verifies cleanly", () => {
    const checkpoints = new CheckpointManager(versions);
    checkpoints.create({ checkpointId: "cp1", label: "x", safeState: {} });
    const recovery = new RecoveryManager(checkpoints, { verify: () => true });
    const event = recovery.handle({ recoveryId: "r1", trigger: "BROWSER_CRASH", checkpointId: "cp1", now: 0 });
    expect(event.outcome).toBe("RESUMED");
    expect(event.resolvedAt).not.toBeNull();
  });

  it("blocks with BLOCKED_NO_CHECKPOINT when there is nothing to restore from", () => {
    const checkpoints = new CheckpointManager(versions);
    const recovery = new RecoveryManager(checkpoints, { verify: () => true });
    const event = recovery.handle({ recoveryId: "r1", trigger: "PC_RESTART", checkpointId: null });
    expect(event.outcome).toBe("BLOCKED_NO_CHECKPOINT");
  });

  it("blocks with BLOCKED_INCOMPATIBLE_CHECKPOINT rather than resuming under a mismatched schema", () => {
    const original = new CheckpointManager(versions);
    const cp = original.create({ checkpointId: "cp1", label: "x", safeState: {} });
    const upgraded = new CheckpointManager({ ...versions, schemaVersion: 2 });
    upgraded.load(cp);
    const recovery = new RecoveryManager(upgraded, { verify: () => true });
    const event = recovery.handle({ recoveryId: "r1", trigger: "SESSION_EXPIRY", checkpointId: "cp1" });
    expect(event.outcome).toBe("BLOCKED_INCOMPATIBLE_CHECKPOINT");
  });

  it("blocks with BLOCKED_VERIFICATION_FAILED when live verification disagrees with the checkpoint", () => {
    const checkpoints = new CheckpointManager(versions);
    checkpoints.create({ checkpointId: "cp1", label: "x", safeState: {} });
    const recovery = new RecoveryManager(checkpoints, { verify: () => false });
    const event = recovery.handle({ recoveryId: "r1", trigger: "NETWORK_FAILURE", checkpointId: "cp1" });
    expect(event.outcome).toBe("BLOCKED_VERIFICATION_FAILED");
  });

  it("records the trigger and ids on every outcome", () => {
    const checkpoints = new CheckpointManager(versions);
    checkpoints.create({ checkpointId: "cp1", label: "x", safeState: {} });
    const recovery = new RecoveryManager(checkpoints, { verify: () => true });
    const event = recovery.handle({ recoveryId: "r1", trigger: "RPC_FAILURE", sessionId: "s1", runId: "run1", checkpointId: "cp1" });
    expect(event.trigger).toBe("RPC_FAILURE");
    expect(event.sessionId).toBe("s1");
    expect(event.runId).toBe("run1");
  });
});
