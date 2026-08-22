import type { RecoveryEvent, RecoveryTrigger, RecoveryOutcome } from "@airdrop-os/types";
import { CheckpointManager } from "./checkpoint.js";

export interface RecoveryVerifier {
  /** Caller-supplied real-world check (e.g. "is the wallet still on the
   * expected chain", "does the page still show the expected state") -
   * this module never assumes a restored checkpoint is safe to resume
   * from without an explicit verification result. */
  verify(checkpointId: string): boolean;
}

/**
 * Handles interruption/recovery for a browser/workflow run:
 * RESTORE -> VERIFY -> RESUME. A checkpoint that is missing, or that
 * fails the versions.checkCompatibility() check, or that fails live
 * verification, must never be silently resumed from - each of those is
 * its own explicit BLOCKED_* outcome.
 */
export class RecoveryManager {
  constructor(private readonly checkpoints: CheckpointManager, private readonly verifier: RecoveryVerifier) {}

  handle(params: { recoveryId: string; trigger: RecoveryTrigger; sessionId?: string | null; runId?: string | null; checkpointId: string | null; now?: number }): RecoveryEvent {
    const now = params.now ?? Date.now();
    const base: Omit<RecoveryEvent, "outcome" | "resolvedAt"> = {
      recoveryId: params.recoveryId,
      trigger: params.trigger,
      sessionId: params.sessionId ?? null,
      runId: params.runId ?? null,
      checkpointId: params.checkpointId,
      detectedAt: new Date(now).toISOString(),
    };

    if (!params.checkpointId) {
      return { ...base, outcome: "BLOCKED_NO_CHECKPOINT", resolvedAt: null };
    }

    const compatibility = this.checkpoints.checkCompatibility(params.checkpointId);
    if (compatibility.result === "INCOMPATIBLE") {
      return { ...base, outcome: "BLOCKED_INCOMPATIBLE_CHECKPOINT", resolvedAt: null };
    }

    const verified = this.verifier.verify(params.checkpointId);
    if (!verified) {
      return { ...base, outcome: "BLOCKED_VERIFICATION_FAILED", resolvedAt: null };
    }

    const outcome: RecoveryOutcome = "RESUMED";
    return { ...base, outcome, resolvedAt: new Date(now).toISOString() };
  }
}
