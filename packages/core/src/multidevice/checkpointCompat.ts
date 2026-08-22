import type { MultiDeviceCheckpointRecord, MultiDeviceCheckpointVersions, CheckpointCompatibility } from "@airdrop-os/types";

const SENSITIVE_KEY_PATTERN = /pass(word)?|seed|mnemonic|private[_ ]?key|secret|otp|2fa|recovery[_ ]?code|token/i;

/**
 * Extends Phase 6's CheckpointManager compatibility check across every
 * dimension Phase 9 requires: schema, agent, workflow, project,
 * campaign, requirement version, browser state, wallet/account
 * context, and security state. A mismatch on ANY dimension is
 * INCOMPATIBLE - there is no "resume anyway" path. This mirrors
 * Phase 6's fail-closed checkpoint contract, not a looser one.
 */
export class MultiDeviceCheckpointStore {
  private readonly checkpoints = new Map<string, MultiDeviceCheckpointRecord>();

  create(params: {
    checkpointId: string;
    sourceDeviceId: string;
    versions: MultiDeviceCheckpointVersions;
    safeState: Record<string, unknown>;
    now?: number;
  }): MultiDeviceCheckpointRecord {
    for (const key of Object.keys(params.safeState)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        throw new Error(`Refusing to checkpoint field that looks sensitive: ${key}`);
      }
    }
    const record: MultiDeviceCheckpointRecord = {
      checkpointId: params.checkpointId,
      sourceDeviceId: params.sourceDeviceId,
      versions: params.versions,
      safeState: params.safeState,
      createdAt: new Date(params.now ?? Date.now()).toISOString(),
    };
    this.checkpoints.set(record.checkpointId, record);
    return record;
  }

  /** Loads a checkpoint restored from durable storage without re-stamping
   * its versions, so compatibility is checked against its true origin. */
  load(record: MultiDeviceCheckpointRecord): void {
    this.checkpoints.set(record.checkpointId, record);
  }

  get(checkpointId: string): MultiDeviceCheckpointRecord | undefined {
    return this.checkpoints.get(checkpointId);
  }

  checkCompatibility(
    checkpointId: string,
    targetVersions: MultiDeviceCheckpointVersions,
  ): { result: CheckpointCompatibility; mismatches: string[] } {
    const record = this.checkpoints.get(checkpointId);
    if (!record) return { result: "INCOMPATIBLE", mismatches: ["CHECKPOINT_NOT_FOUND"] };

    const mismatches: string[] = [];
    const v = record.versions;
    if (v.schemaVersion !== targetVersions.schemaVersion) mismatches.push("schemaVersion");
    if (v.agentVersion !== targetVersions.agentVersion) mismatches.push("agentVersion");
    if (v.workflowVersion !== targetVersions.workflowVersion) mismatches.push("workflowVersion");
    if (v.projectVersion !== targetVersions.projectVersion) mismatches.push("projectVersion");
    if (v.campaignVersion !== targetVersions.campaignVersion) mismatches.push("campaignVersion");
    if (v.requirementVersion !== targetVersions.requirementVersion) mismatches.push("requirementVersion");
    if (v.browserStateHash !== targetVersions.browserStateHash) mismatches.push("browserStateHash");
    if (v.walletAccountContextHash !== targetVersions.walletAccountContextHash) mismatches.push("walletAccountContextHash");
    if (v.securityStateHash !== targetVersions.securityStateHash) mismatches.push("securityStateHash");

    return { result: mismatches.length === 0 ? "COMPATIBLE" : "INCOMPATIBLE", mismatches };
  }

  /** Convenience gate: never returns true unless every dimension matches.
   * Callers must treat false as DO_NOT_RESUME, full stop. */
  isResumeSafe(checkpointId: string, targetVersions: MultiDeviceCheckpointVersions): boolean {
    return this.checkCompatibility(checkpointId, targetVersions).result === "COMPATIBLE";
  }
}
