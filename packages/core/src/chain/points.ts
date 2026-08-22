import { randomUUID } from "node:crypto";
import type { PointsLedgerEntry, PointsUnit, RankThreshold } from "@airdrop-os/types";

/**
 * Points ledger: append-only, per (agentId, projectId, seasonId,
 * epochId, unit). Nothing is ever "set" to a value - every change is a
 * new signed entry (positive = earn, negative = decay/penalty), so the
 * running total is always a fold over history, not a mutable field
 * that could silently drift or be edited without a trace.
 *
 * Explicit rule enforced by the type system, not just docs: PointsUnit
 * is "POINTS" | "XP", never "TOKEN" - this ledger cannot represent a
 * token balance, and nothing here should be read as one.
 */
export class PointsLedger {
  private readonly entries: PointsLedgerEntry[] = [];

  record(input: Omit<PointsLedgerEntry, "entryId" | "recordedAt">, now: string = new Date().toISOString()): PointsLedgerEntry {
    const entry: PointsLedgerEntry = { ...input, entryId: randomUUID(), recordedAt: now };
    this.entries.push(entry);
    return entry;
  }

  total(params: { agentId: string; projectId: string; unit: PointsUnit; seasonId?: string | null; epochId?: string | null }): number {
    return this.entries
      .filter(
        (e) =>
          e.agentId === params.agentId &&
          e.projectId === params.projectId &&
          e.unit === params.unit &&
          (params.seasonId === undefined || e.seasonId === params.seasonId) &&
          (params.epochId === undefined || e.epochId === params.epochId)
      )
      .reduce((sum, e) => sum + e.amount * e.multiplier, 0);
  }

  history(agentId: string, projectId: string): readonly PointsLedgerEntry[] {
    return this.entries.filter((e) => e.agentId === agentId && e.projectId === projectId);
  }

  leaderboard(params: { projectId: string; unit: PointsUnit; seasonId?: string | null }): { agentId: string; total: number }[] {
    const totals = new Map<string, number>();
    for (const e of this.entries) {
      if (e.projectId !== params.projectId || e.unit !== params.unit) continue;
      if (params.seasonId !== undefined && e.seasonId !== params.seasonId) continue;
      totals.set(e.agentId, (totals.get(e.agentId) ?? 0) + e.amount * e.multiplier);
    }
    return [...totals.entries()]
      .map(([agentId, total]) => ({ agentId, total }))
      .sort((a, b) => b.total - a.total);
  }
}

/** Resolves the highest rank whose threshold the total meets, or null if below every threshold. */
export function resolveRank(total: number, thresholds: RankThreshold[]): string | null {
  const sorted = [...thresholds].sort((a, b) => b.minTotal - a.minTotal);
  for (const t of sorted) {
    if (total >= t.minTotal) return t.rank;
  }
  return null;
}

/**
 * Applies decay to a total (e.g. seasonal decay). Returns the new
 * ledger entry representing the decay itself (a negative amount),
 * rather than mutating any prior entry - decay is always a new dated
 * event, so "how much did I have before decay" remains answerable.
 */
export function applyDecay(params: {
  agentId: string;
  projectId: string;
  unit: PointsUnit;
  seasonId: string | null;
  epochId: string | null;
  currentTotal: number;
  decayRate: number; // 0..1
}, now: string = new Date().toISOString()): Omit<PointsLedgerEntry, "entryId" | "recordedAt"> {
  if (params.decayRate < 0 || params.decayRate > 1) {
    throw new Error("decayRate must be between 0 and 1");
  }
  const decayAmount = -(params.currentTotal * params.decayRate);
  return {
    agentId: params.agentId,
    projectId: params.projectId,
    seasonId: params.seasonId,
    epochId: params.epochId,
    unit: params.unit,
    amount: decayAmount,
    multiplier: 1,
    reason: `seasonal_decay:${params.decayRate}`,
    sourceActivityId: null,
  };
}
