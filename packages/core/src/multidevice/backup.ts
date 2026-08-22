import type { BackupManifest, DeviceKind } from "@airdrop-os/types";
import { randomUUID, createHash } from "node:crypto";

const SENSITIVE_KEY_PATTERN = /pass(word)?|seed|mnemonic|private[_ ]?key|secret|otp|2fa|recovery[_ ]?code|session[_ ]?token|api[_ ]?key/i;

// The exact entity set Phase 9 names as backup-eligible. Anything not
// in this list is out of scope for backup, not silently included.
export const BACKUP_ENTITY_TYPES = [
  "projects", "campaigns", "seasons", "epochs", "requirements",
  "requirementVersions", "missions", "tasks", "activities", "evidence",
  "walletAccountMetadata", "eligibility", "eligibilityProofs",
  "research", "costs", "rewards", "claims", "workflows",
  "workflowVersions", "checkpoints", "humanHandoffs", "memory",
  "decisionJournal", "audit", "policies", "sourceReputation",
  "knowledgeVersions",
] as const;
export type BackupEntityType = (typeof BACKUP_ENTITY_TYPES)[number];

export interface BackupInput {
  agentId: string;
  schemaVersion: string;
  databaseVersion: string;
  sourceDevice: DeviceKind;
  // Caller supplies each entity type's real records; this builder never
  // fabricates data it wasn't given.
  entities: Partial<Record<BackupEntityType, unknown[]>>;
  // Whether the caller's encryption step actually ran before calling
  // this builder. If false, the manifest is honestly marked unencrypted
  // rather than claiming encryption that didn't happen.
  encryptionApplied: boolean;
  hashFn?: (data: unknown) => string;
}

function defaultHash(data: unknown): string {
  // Real cryptographic content hash (SHA-256) for backup integrity checking.
  // Callers may still inject a different hash function via hashFn.
  const json = JSON.stringify(data);
  return `sha256:${createHash("sha256").update(json).digest("hex")}`;
}

export function buildBackupManifest(input: BackupInput, now?: number): { manifest: BackupManifest; payload: Partial<Record<BackupEntityType, unknown[]>> } {
  const hashFn = input.hashFn ?? defaultHash;
  const recordCounts: Record<string, number> = {};
  const contentHashes: Record<string, string> = {};

  for (const entityType of BACKUP_ENTITY_TYPES) {
    const records = input.entities[entityType] ?? [];
    for (const record of records) {
      if (record && typeof record === "object") {
        for (const key of Object.keys(record as Record<string, unknown>)) {
          if (SENSITIVE_KEY_PATTERN.test(key)) {
            throw new Error(`Refusing to include sensitive field "${key}" in backup entity "${entityType}"`);
          }
        }
      }
    }
    recordCounts[entityType] = records.length;
    contentHashes[entityType] = hashFn(records);
  }

  const manifest: BackupManifest = {
    backupId: randomUUID(),
    agentId: input.agentId,
    schemaVersion: input.schemaVersion,
    databaseVersion: input.databaseVersion,
    createdAt: new Date(now ?? Date.now()).toISOString(),
    sourceDevice: input.sourceDevice,
    encrypted: input.encryptionApplied,
    recordCounts,
    contentHashes,
    // Honest default: a manifest is only VERIFIED once a restore test
    // has actually confirmed it (see restore.ts). Building it never
    // marks it verified by itself.
    integrityStatus: "UNVERIFIED",
  };

  return { manifest, payload: input.entities };
}

export class BackupStore {
  private readonly backups = new Map<string, { manifest: BackupManifest; payload: Partial<Record<BackupEntityType, unknown[]>> }>();

  save(manifest: BackupManifest, payload: Partial<Record<BackupEntityType, unknown[]>>): void {
    this.backups.set(manifest.backupId, { manifest, payload });
  }

  get(backupId: string) {
    return this.backups.get(backupId);
  }

  markIntegrityStatus(backupId: string, status: BackupManifest["integrityStatus"]): BackupManifest | undefined {
    const entry = this.backups.get(backupId);
    if (!entry) return undefined;
    entry.manifest.integrityStatus = status;
    return entry.manifest;
  }
}
