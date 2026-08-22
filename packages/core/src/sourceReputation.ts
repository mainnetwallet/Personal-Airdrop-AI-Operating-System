/**
 * Source reputation tracking: historical accuracy (correct/incorrect
 * outcomes), availability (EMA of successful retrievals), freshness,
 * and a derived reputation score.
 *
 * This module is a confidence-*weighting* signal only. It never
 * decides which evidence is true — evidence.ts detectContradiction()
 * always prefers PRIMARY_OFFICIAL-tier evidence regardless of what a
 * source's reputation score says, so a highly-reputable community
 * account can never outrank an official announcement.
 */
import type { SourceReputationRecord } from "@airdrop-os/types";

const AVAILABILITY_EMA_ALPHA = 0.2;

export class SourceReputationTracker {
  private readonly records = new Map<string, SourceReputationRecord>();

  private getOrCreate(sourceId: string): SourceReputationRecord {
    let record = this.records.get(sourceId);
    if (!record) {
      record = {
        sourceId,
        correctCount: 0,
        incorrectCount: 0,
        lastSeenAt: null,
        availability: 1,
        freshnessScore: 1,
        reputationScore: 0.5,
      };
      this.records.set(sourceId, record);
    }
    return record;
  }

  get(sourceId: string): SourceReputationRecord {
    return this.getOrCreate(sourceId);
  }

  /** Records whether a claim sourced from this source turned out to be accurate (confirmed) or not (false positive/negative). */
  recordOutcome(sourceId: string, wasAccurate: boolean): SourceReputationRecord {
    const record = this.getOrCreate(sourceId);
    if (wasAccurate) record.correctCount += 1;
    else record.incorrectCount += 1;
    record.lastSeenAt = new Date().toISOString();
    this.recompute(record);
    return record;
  }

  /** Records a retrieval attempt outcome; availability is an EMA so a single blip doesn't tank the score, and sustained downtime does. */
  recordAvailability(sourceId: string, wasAvailable: boolean): SourceReputationRecord {
    const record = this.getOrCreate(sourceId);
    record.availability =
      record.availability * (1 - AVAILABILITY_EMA_ALPHA) + (wasAvailable ? 1 : 0) * AVAILABILITY_EMA_ALPHA;
    this.recompute(record);
    return record;
  }

  /** Recomputes freshness from how old the most recent retrieved content is relative to a staleness threshold. */
  recordFreshness(sourceId: string, ageMs: number, staleThresholdMs: number): SourceReputationRecord {
    const record = this.getOrCreate(sourceId);
    record.freshnessScore = ageMs >= staleThresholdMs ? 0 : 1 - ageMs / staleThresholdMs;
    this.recompute(record);
    return record;
  }

  private recompute(record: SourceReputationRecord): void {
    const total = record.correctCount + record.incorrectCount;
    const accuracy = total === 0 ? 0.5 : record.correctCount / total;
    record.reputationScore = accuracy * 0.6 + record.availability * 0.2 + record.freshnessScore * 0.2;
  }
}
