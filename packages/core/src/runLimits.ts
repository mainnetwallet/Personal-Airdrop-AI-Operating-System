/**
 * Run-limit enforcement. Every AgentRun is bounded so a misbehaving or
 * looping agent cannot run indefinitely, spam tool calls, or spend past
 * a budget. Limits are checked *before* each step/tool call is allowed
 * to proceed, not just observed after the fact.
 */
import type { AgentRun, RunLimits } from "@airdrop-os/types";

export const DEFAULT_RUN_LIMITS: RunLimits = {
  maxSteps: 200,
  maxRuntimeMs: 30 * 60 * 1000, // 30 minutes
  maxToolCalls: 100,
  maxRetries: 5,
  maxCost: 5, // abstract cost units; real currency conversion is Phase 6+
};

export type RunLimitViolation =
  | "MAX_STEPS_EXCEEDED"
  | "MAX_RUNTIME_EXCEEDED"
  | "MAX_TOOL_CALLS_EXCEEDED"
  | "MAX_RETRIES_EXCEEDED"
  | "MAX_COST_EXCEEDED";

export class RunLimitExceededError extends Error {
  constructor(public readonly violation: RunLimitViolation, public readonly runId: string) {
    super(`Run ${runId} exceeded limit: ${violation}`);
    this.name = "RunLimitExceededError";
  }
}

/**
 * Throws RunLimitExceededError on the first violated limit. Callers
 * should invoke this before incrementing steps/toolCalls/retries and
 * again after, so a run cannot slip one unit past its ceiling.
 */
export function checkRunLimits(run: AgentRun, limits: RunLimits = DEFAULT_RUN_LIMITS): void {
  if (run.steps >= limits.maxSteps) {
    throw new RunLimitExceededError("MAX_STEPS_EXCEEDED", run.runId);
  }
  if (run.toolCalls >= limits.maxToolCalls) {
    throw new RunLimitExceededError("MAX_TOOL_CALLS_EXCEEDED", run.runId);
  }
  if (run.retries >= limits.maxRetries) {
    throw new RunLimitExceededError("MAX_RETRIES_EXCEEDED", run.runId);
  }
  if (run.cost.amount >= limits.maxCost) {
    throw new RunLimitExceededError("MAX_COST_EXCEEDED", run.runId);
  }
  const elapsed = Date.now() - new Date(run.startTime).getTime();
  if (elapsed >= limits.maxRuntimeMs) {
    throw new RunLimitExceededError("MAX_RUNTIME_EXCEEDED", run.runId);
  }
}
