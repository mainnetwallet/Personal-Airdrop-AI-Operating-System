import type { BackupManifest, RestoreVerificationResult } from "@airdrop-os/types";
import type { BackupEntityType } from "./backup.js";

export interface RestoredDataset {
  entities: Partial<Record<BackupEntityType, unknown[]>>;
  hashFn: (data: unknown) => string;
  // Relationship checker supplied by the caller (e.g. "every task
  // references a mission that exists"). Never assumed true - if the
  // caller doesn't supply one, relationships are reported unverified.
  checkRelationships?: (entities: Partial<Record<BackupEntityType, unknown[]>>) => { ok: boolean; problems: string[] };
  checkpointsPresent: boolean;
  workflowsPresent: boolean;
}

/**
 * Restore tests must run in an isolated environment and verify counts,
 * relationships, hashes, checkpoints, workflows - this function is that
 * verification, never a rubber stamp. Any mismatch fails the restore;
 * PASSED only happens when every dimension checks out.
 */
export function verifyRestore(manifest: BackupManifest, restored: RestoredDataset, now?: number): RestoreVerificationResult {
  const mismatchedEntities: string[] = [];
  let countsMatch = true;
  let hashesMatch = true;

  for (const [entityType, expectedCount] of Object.entries(manifest.recordCounts)) {
    const actual = restored.entities[entityType as BackupEntityType] ?? [];
    if (actual.length !== expectedCount) {
      countsMatch = false;
      mismatchedEntities.push(`${entityType}:count(expected=${expectedCount},actual=${actual.length})`);
    }
    const expectedHash = manifest.contentHashes[entityType];
    const actualHash = restored.hashFn(actual);
    if (expectedHash !== actualHash) {
      hashesMatch = false;
      mismatchedEntities.push(`${entityType}:hash`);
    }
  }

  const relCheck = restored.checkRelationships?.(restored.entities);
  const relationshipsMatch = relCheck ? relCheck.ok : false;
  if (relCheck && !relCheck.ok) mismatchedEntities.push(...relCheck.problems.map((p) => `relationship:${p}`));
  if (!relCheck) mismatchedEntities.push("relationships:NOT_VERIFIED_NO_CHECKER_SUPPLIED");

  const status: RestoreVerificationResult["status"] =
    countsMatch && hashesMatch && relationshipsMatch && restored.checkpointsPresent && restored.workflowsPresent
      ? "PASSED"
      : "FAILED";

  return {
    backupId: manifest.backupId,
    countsMatch,
    hashesMatch,
    relationshipsMatch,
    checkpointsRestored: restored.checkpointsPresent,
    workflowsRestored: restored.workflowsPresent,
    mismatchedEntities,
    status,
    verifiedAt: new Date(now ?? Date.now()).toISOString(),
  };
}
