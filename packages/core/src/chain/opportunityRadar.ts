import type { OpportunityScoreInput, OpportunityScoreResult, ClaimConfidence } from "@airdrop-os/types";

/**
 * Scores an opportunity signal. This is explicitly a PRIORITIZATION
 * signal, never a promise: the score never implies a reward is
 * guaranteed, and callers must not present it to a user or downstream
 * system as one. High risk/cost/competition/deadline pressure pull the
 * score down; strong official evidence, project quality, and user fit
 * pull it up. Weak-evidence opportunities are capped regardless of how
 * attractive the other factors look, so a well-produced scam/rumor
 * can't outscore a well-evidenced but less flashy real opportunity.
 */
const CONFIDENCE_CAP: Record<ClaimConfidence, number> = {
  SPECULATIVE: 0.25,
  UNCERTAIN: 0.45,
  STALE: 0.35,
  CONFLICTED: 0.2,
  LIKELY: 0.75,
  VERIFIED: 1,
};

export function scoreOpportunity(input: OpportunityScoreInput): OpportunityScoreResult {
  for (const [key, value] of Object.entries(input)) {
    if (key === "confidence") continue;
    if (typeof value === "number" && (value < 0 || value > 1)) {
      throw new Error(`${key} must be between 0 and 1`);
    }
  }

  const positive =
    input.officialEvidenceStrength * 0.3 +
    input.projectQuality * 0.2 +
    input.userFit * 0.15 +
    input.deadlinePressure * 0.05; // slight urgency boost, capped low on its own

  const negative =
    input.cost * 0.1 + input.time * 0.1 + input.risk * 0.2 + input.competition * 0.1;

  const raw = Math.max(0, Math.min(1, positive - negative + 0.5 * 0)); // positive/negative already 0..1-ish weighted
  const cap = CONFIDENCE_CAP[input.confidence];
  const score = Math.min(raw, cap);

  return {
    score,
    breakdown: {
      positive,
      negative,
      preCapScore: raw,
      confidenceCap: cap,
    },
    confidence: input.confidence,
  };
}
