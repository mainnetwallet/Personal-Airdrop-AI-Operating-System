import type { CheckpointRecord, CheckpointVersions, CheckpointCompatibility } from "@airdrop-os/types";

/**
 * Checkpoints are taken before/after important operations and store ONLY
 * safe operational state (step index, session/run ids, non-secret
 * variables) - never secrets. A checkpoint recorded under one
 * schema/agent/workflow version must never be resumed under an
 * incompatible one; compatibility is checked explicitly rather than
 * assumed.
 */
export class CheckpointManager {
  private readonly checkpoints = new Map<string, CheckpointRecord>();
  readonly currentVersions: CheckpointVersions;

  constructor(currentVersions: CheckpointVersions) {
    this.currentVersions = currentVersions;
  }

  create(params: { checkpointId: string; sessionId?: string | null; runId?: string | null; label: string; safeState: Record<string, unknown>; now?: number }): CheckpointRecord {
    for (const key of Object.keys(params.safeState)) {
      if (/pass(word)?|seed|mnemonic|private[_ ]?key|secret|otp|2fa|recovery[_ ]?code|token/i.test(key)) {
        throw new Error(`Refusing to checkpoint field that looks sensitive: ${key}`);
      }
    }
    const now = params.now ?? Date.now();
    const record: CheckpointRecord = {
      checkpointId: params.checkpointId,
      sessionId: params.sessionId ?? null,
      runId: params.runId ?? null,
      label: params.label,
      versions: this.currentVersions,
      safeState: params.safeState,
      createdAt: new Date(now).toISOString(),
    };
    this.checkpoints.set(record.checkpointId, record);
    return record;
  }

  get(checkpointId: string): CheckpointRecord | undefined {
    return this.checkpoints.get(checkpointId);
  }

  /** Loads a previously-persisted checkpoint record (e.g. restored from
   * durable storage after a crash) without re-stamping it with this
   * manager's current versions - its ORIGINAL versions are preserved so
   * compatibility can be checked honestly against them. */
  load(record: CheckpointRecord): void {
    this.checkpoints.set(record.checkpointId, record);
  }

  /** Compares the checkpoint's recorded versions against the manager's
   * current versions. Any mismatch is INCOMPATIBLE - resuming from an
   * incompatible checkpoint must never be attempted. */
  checkCompatibility(checkpointId: string): { result: CheckpointCompatibility; mismatches: string[] } {
    const record = this.checkpoints.get(checkpointId);
    if (!record) return { result: "INCOMPATIBLE", mismatches: ["CHECKPOINT_NOT_FOUND"] };
    const mismatches: string[] = [];
    if (record.versions.schemaVersion !== this.currentVersions.schemaVersion) mismatches.push("schemaVersion");
    if (record.versions.agentVersion !== this.currentVersions.agentVersion) mismatches.push("agentVersion");
    if (record.versions.workflowVersion !== this.currentVersions.workflowVersion) mismatches.push("workflowVersion");
    return { result: mismatches.length === 0 ? "COMPATIBLE" : "INCOMPATIBLE", mismatches };
  }
}
