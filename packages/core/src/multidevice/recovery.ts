import type { RecoveryAttempt, RecoveryFailureDomain, RecoveryStage } from "@airdrop-os/types";
import type { MultiDeviceCheckpointStore } from "./checkpointCompat.js";
import type { MultiDeviceCheckpointVersions } from "@airdrop-os/types";

/**
 * Generalizes Phase 6's CHECKPOINT -> RESTORE -> VERIFY -> RESUME
 * recovery flow to every Phase 9 failure domain (VPS, worker, PC,
 * browser, network, RPC, Android, session). VERIFY always runs the
 * multi-device checkpoint compatibility check before RESUME is ever
 * attempted - an incompatible checkpoint routes to DO_NOT_RESUME, not
 * a best-effort resume.
 */
export class MultiDeviceRecoveryCoordinator {
  private readonly checkpointStore: MultiDeviceCheckpointStore;
  readonly attempts: RecoveryAttempt[] = [];

  constructor(checkpointStore: MultiDeviceCheckpointStore) {
    this.checkpointStore = checkpointStore;
  }

  attemptRecovery(params: {
    failureDomain: RecoveryFailureDomain;
    checkpointId: string | null;
    targetVersions: MultiDeviceCheckpointVersions;
    now?: number;
  }): RecoveryAttempt {
    const attemptedAt = new Date(params.now ?? Date.now()).toISOString();

    if (!params.checkpointId) {
      const attempt: RecoveryAttempt = {
        failureDomain: params.failureDomain,
        checkpointId: null,
        stage: "DO_NOT_RESUME",
        reason: "NO_CHECKPOINT_AVAILABLE",
        attemptedAt,
      };
      this.attempts.push(attempt);
      return attempt;
    }

    // RESTORE
    const record = this.checkpointStore.get(params.checkpointId);
    if (!record) {
      const attempt: RecoveryAttempt = {
        failureDomain: params.failureDomain,
        checkpointId: params.checkpointId,
        stage: "DO_NOT_RESUME",
        reason: "CHECKPOINT_NOT_FOUND",
        attemptedAt,
      };
      this.attempts.push(attempt);
      return attempt;
    }

    // VERIFY
    const compat = this.checkpointStore.checkCompatibility(params.checkpointId, params.targetVersions);
    if (compat.result !== "COMPATIBLE") {
      const attempt: RecoveryAttempt = {
        failureDomain: params.failureDomain,
        checkpointId: params.checkpointId,
        stage: "DO_NOT_RESUME",
        reason: `INCOMPATIBLE: ${compat.mismatches.join(", ")}`,
        attemptedAt,
      };
      this.attempts.push(attempt);
      return attempt;
    }

    // RESUME
    const attempt: RecoveryAttempt = {
      failureDomain: params.failureDomain,
      checkpointId: params.checkpointId,
      stage: "RESUME",
      reason: null,
      attemptedAt,
    };
    this.attempts.push(attempt);
    return attempt;
  }

  history(): RecoveryAttempt[] {
    return [...this.attempts];
  }
}

export type { RecoveryStage };
