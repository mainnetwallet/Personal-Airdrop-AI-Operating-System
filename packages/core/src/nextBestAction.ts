/**
 * Next-best-action: a pure decision function over eligibility,
 * deadline, reward signal, cost, time, risk, budget, availability,
 * confidence, workflow match, and user preference. No state, no side
 * effects — a mission/task orchestrator calls this and acts on the
 * single output it returns.
 *
 * Priority order (checked top to bottom, first match wins):
 * 1. Ineligible/expired/conflicted eligibility short-circuits first —
 *    no amount of good reward/cost math should override those.
 * 2. Unavailability (rate-limited, source down, etc.) -> WAIT.
 * 3. Over budget -> BLOCK, before anything else is considered.
 * 4. Unknown eligibility -> RESEARCH (we don't know enough to act).
 * 5. Deadline already passed -> NO_ACTION.
 * 6. No workflow match, or high risk -> HUMAN_REVIEW.
 * 7. Otherwise: POSSIBLE -> WATCH; LIKELY/QUALIFIED/VERIFIED -> DO.
 */
import type { NextBestAction, NextBestActionInput } from "@airdrop-os/types";

const HIGH_RISK_THRESHOLD = 8; // risk is expected on a 0-10 scale

export function decideNextBestAction(input: NextBestActionInput): NextBestAction {
  if (input.eligibility === "INELIGIBLE") return "SKIP";
  if (input.eligibility === "EXPIRED") return "NO_ACTION";
  if (input.eligibility === "CONFLICTED") return "HUMAN_REVIEW";

  if (!input.availability) return "WAIT";

  if (input.budget !== null && input.cost !== null && input.cost > input.budget) return "BLOCK";

  if (input.eligibility === "UNKNOWN") return "RESEARCH";

  if (input.deadline !== null && new Date(input.deadline).getTime() < Date.now()) return "NO_ACTION";

  if (!input.workflowMatch) return "HUMAN_REVIEW";
  if (input.risk !== null && input.risk >= HIGH_RISK_THRESHOLD) return "HUMAN_REVIEW";

  if (input.eligibility === "POSSIBLE") return "WATCH";
  // LIKELY / QUALIFIED / VERIFIED
  return "DO";
}
