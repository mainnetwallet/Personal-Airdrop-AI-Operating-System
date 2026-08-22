/**
 * Phase 11: Shadow Agent (spec section 198).
 *
 * The shadow agent never executes anything - it only records what it
 * *would* have recommended, next to what the live agent actually
 * recommended, so the two can be compared for divergence. This module
 * is intentionally just a comparator: the caller is responsible for
 * running its normal recommendation logic (e.g. decideNextBestAction)
 * twice - once against live state, once against a shadow/simulated
 * state - and passing both results in here.
 */
import { randomUUID } from "node:crypto";
import type { ShadowAgentComparison } from "@airdrop-os/types";

export interface CompareInput {
  runId?: string;
  liveRecommendation: string;
  shadowRecommendation: string;
  liveRisk?: string | null;
  shadowRisk?: string | null;
  liveCost?: number | null;
  shadowCost?: number | null;
}

export class ShadowAgentLedger {
  private readonly comparisons: ShadowAgentComparison[] = [];

  compare(input: CompareInput): ShadowAgentComparison {
    const record: ShadowAgentComparison = {
      runId: input.runId ?? randomUUID(),
      liveRecommendation: input.liveRecommendation,
      shadowRecommendation: input.shadowRecommendation,
      liveRisk: input.liveRisk ?? null,
      shadowRisk: input.shadowRisk ?? null,
      liveCost: input.liveCost ?? null,
      shadowCost: input.shadowCost ?? null,
      agree: input.liveRecommendation === input.shadowRecommendation,
      comparedAt: new Date().toISOString(),
    };
    this.comparisons.push(record);
    return record;
  }

  /** Fraction of comparisons where live and shadow agreed, for divergence monitoring. */
  agreementRate(): number | null {
    if (this.comparisons.length === 0) return null;
    const agreeing = this.comparisons.filter((c) => c.agree).length;
    return agreeing / this.comparisons.length;
  }

  divergences(): ShadowAgentComparison[] {
    return this.comparisons.filter((c) => !c.agree);
  }

  list(): ShadowAgentComparison[] {
    return [...this.comparisons];
  }
}
