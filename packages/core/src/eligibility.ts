/**
 * Eligibility engine.
 *
 * `evaluate()` evaluates each activity against the requirement
 * *version* that was valid at that activity's own timestamp (via
 * RequirementStore.versionAt), never against whatever the current
 * requirement version says — this is the historical-backtesting rule:
 * old activity is judged by the rules that existed when it happened.
 */
import type {
  ClaimConfidence,
  EligibilityActivity,
  EligibilityProofPackage,
  EligibilityState,
} from "@airdrop-os/types";
import { RequirementStore } from "./requirement.js";

export interface EvaluateEligibilityInput {
  projectId: string;
  campaignId?: string | null;
  seasonId?: string | null;
  epochId?: string | null;
  wallet?: string | null;
  account?: string | null;
  requirementIds: string[];
  activities: EligibilityActivity[];
  snapshot?: string | null;
  evidence?: string[];
}

type PerRequirementResult = { requirementId: string; version: number | null; met: boolean | null };

export class EligibilityEngine {
  constructor(private readonly requirements: RequirementStore) {}

  evaluate(input: EvaluateEligibilityInput): EligibilityProofPackage {
    const unknowns: string[] = [];
    const results: PerRequirementResult[] = [];

    for (const requirementId of input.requirementIds) {
      results.push(this.evaluateOneRequirement(requirementId, input, unknowns));
    }

    const state = this.deriveState(results, unknowns);
    const confidence: ClaimConfidence =
      state === "QUALIFIED" || state === "VERIFIED"
        ? "LIKELY"
        : state === "CONFLICTED"
          ? "CONFLICTED"
          : "UNCERTAIN";

    return {
      projectId: input.projectId,
      campaignId: input.campaignId ?? null,
      seasonId: input.seasonId ?? null,
      epochId: input.epochId ?? null,
      wallet: input.wallet ?? null,
      account: input.account ?? null,
      requirements: results
        .filter((r): r is PerRequirementResult & { version: number } => r.version !== null)
        .map((r) => ({ requirementId: r.requirementId, version: r.version })),
      activities: input.activities,
      snapshot: input.snapshot ?? null,
      evidence: input.evidence ?? [],
      calculation: `Evaluated ${input.requirementIds.length} requirement(s) against the requirement version historically valid at each activity's own timestamp (backtested, not current-version).`,
      confidence,
      unknowns,
      state,
      generatedAt: new Date().toISOString(),
    };
  }

  private evaluateOneRequirement(
    requirementId: string,
    input: EvaluateEligibilityInput,
    unknowns: string[]
  ): PerRequirementResult {
    const relevantActivities = input.activities.filter(
      (a) => (input.wallet && a.wallet === input.wallet) || (input.account && a.account === input.account)
    );

    if (relevantActivities.length === 0) {
      unknowns.push(`No activity supplied to evaluate requirement ${requirementId}`);
      return { requirementId, version: null, met: null };
    }

    let bestVersion: number | null = null;
    let met = false;
    let evaluatedAny = false;

    for (const activity of relevantActivities) {
      const versionAtActivity = this.requirements.versionAt(requirementId, activity.timestamp);
      if (!versionAtActivity) {
        unknowns.push(
          `No version of requirement ${requirementId} was valid at activity timestamp ${activity.timestamp} (historical backtest found nothing in force)`
        );
        continue;
      }
      evaluatedAny = true;
      bestVersion = versionAtActivity.version;

      const meetsMinimum = versionAtActivity.minimum === null || (activity.value ?? 0) >= versionAtActivity.minimum;
      const meetsMaximum = versionAtActivity.maximum === null || (activity.value ?? 0) <= versionAtActivity.maximum;
      const chainMatches = versionAtActivity.chain === null || versionAtActivity.chain === activity.chain;
      if (meetsMinimum && meetsMaximum && chainMatches) met = true;
    }

    if (!evaluatedAny) return { requirementId, version: null, met: null };
    return { requirementId, version: bestVersion, met };
  }

  private deriveState(results: PerRequirementResult[], unknowns: string[]): EligibilityState {
    if (results.length === 0) return "UNKNOWN";
    if (results.some((r) => r.met === null)) {
      // Some requirement couldn't be evaluated at all.
      return results.some((r) => r.met === true) ? "POSSIBLE" : "UNKNOWN";
    }
    if (results.every((r) => r.met === true)) return "QUALIFIED";
    if (results.every((r) => r.met === false)) return "INELIGIBLE";
    // A genuine mix of met/unmet across requirements, with unknowns
    // present too, is treated as CONFLICTED — the picture disagrees
    // with itself rather than cleanly resolving either way.
    if (unknowns.length > 0) return "CONFLICTED";
    return "POSSIBLE";
  }
}
