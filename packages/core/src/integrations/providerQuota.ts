/**
 * Phase 11: Provider Quota (spec section 262).
 *
 * Tracks call budgets for external providers (RPC, explorer, LLM,
 * research, Discord, social, quest, browser) so the system can refuse
 * to call a provider it has no remaining quota for, rather than
 * silently hammering a rate-limited API. A provider with no `limit`
 * configured is NOT_CONFIGURED - never reported as OK by default.
 */
import type { ProviderQuotaKind, ProviderQuotaRecord, ProviderQuotaStatus } from "@airdrop-os/types";

const NEAR_LIMIT_THRESHOLD = 0.9;

function computeStatus(limit: number | null, used: number): ProviderQuotaStatus {
  if (limit === null) return "NOT_CONFIGURED";
  if (used >= limit) return "EXHAUSTED";
  if (used / limit >= NEAR_LIMIT_THRESHOLD) return "NEAR_LIMIT";
  return "OK";
}

export class ProviderQuotaTracker {
  private readonly providers = new Map<string, ProviderQuotaRecord>();

  register(providerId: string, kind: ProviderQuotaKind, limit: number | null, resetAt: string | null = null): ProviderQuotaRecord {
    const record: ProviderQuotaRecord = {
      providerId,
      kind,
      limit,
      used: 0,
      remaining: limit,
      resetAt,
      status: computeStatus(limit, 0),
    };
    this.providers.set(providerId, record);
    return record;
  }

  /** Whether a call is currently allowed (limit configured and not exhausted). */
  canCall(providerId: string): boolean {
    const record = this.providers.get(providerId);
    if (!record) return false;
    return record.status === "OK" || record.status === "NEAR_LIMIT";
  }

  recordUsage(providerId: string, amount: number = 1): ProviderQuotaRecord {
    const record = this.providers.get(providerId);
    if (!record) throw new Error(`Unknown providerId: ${providerId}`);
    const used = record.used + amount;
    const remaining = record.limit === null ? null : Math.max(0, record.limit - used);
    const updated: ProviderQuotaRecord = {
      ...record,
      used,
      remaining,
      status: computeStatus(record.limit, used),
    };
    this.providers.set(providerId, updated);
    return updated;
  }

  reset(providerId: string, resetAt: string | null = null): ProviderQuotaRecord {
    const record = this.providers.get(providerId);
    if (!record) throw new Error(`Unknown providerId: ${providerId}`);
    const updated: ProviderQuotaRecord = {
      ...record,
      used: 0,
      remaining: record.limit,
      resetAt,
      status: computeStatus(record.limit, 0),
    };
    this.providers.set(providerId, updated);
    return updated;
  }

  get(providerId: string): ProviderQuotaRecord | null {
    return this.providers.get(providerId) ?? null;
  }

  list(): ProviderQuotaRecord[] {
    return [...this.providers.values()];
  }
}
