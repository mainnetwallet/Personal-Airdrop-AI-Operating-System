import type { Database } from "@airdrop-os/database";
import { schema } from "@airdrop-os/database";
import { redactSecrets } from "@airdrop-os/security";

export interface RecordAuditInput {
  actorType: "USER" | "AGENT" | "SYSTEM";
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an audit log entry. All metadata passes through redactSecrets
 * first, so even a programming mistake upstream (accidentally including
 * a token or password in metadata) cannot land raw secrets in the
 * audit trail.
 */
export async function recordAudit(db: Database, input: RecordAuditInput): Promise<void> {
  await db.insert(schema.auditLogs).values({
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: redactSecrets(input.metadata ?? {}),
  });
}
