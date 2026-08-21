import type { RunLimitConfig } from "@airdrop-os/types";

export const DEFAULT_RUN_LIMITS: RunLimitConfig = {
  maxSteps: 200,
  maxRuntimeMs: 30 * 60 * 1000, // 30 minutes
  maxToolCalls: 100,
  maxRetries: 3,
};

export class RunLimitExceededError extends Error {
  constructor(public readonly limit: keyof RunLimitConfig, public readonly value: number) {
    super(`Agent run limit exceeded: ${String(limit)} (value=${value})`);
    this.name = "RunLimitExceededError";
  }
}

/**
 * Tracks resource usage for a single agent run and throws as soon as any
 * configured limit is exceeded. There is no path in this class that
 * allows steps/tool calls/runtime to grow without bound - every
 * increment is checked immediately.
 */
export class RunLimitTracker {
  private steps = 0;
  private toolCalls = 0;
  private retries = 0;
  private costUsd = 0;
  private readonly startedAt = Date.now();

  constructor(private readonly limits: RunLimitConfig = DEFAULT_RUN_LIMITS) {}

  private assertRuntime(): void {
    const elapsed = Date.now() - this.startedAt;
    if (elapsed > this.limits.maxRuntimeMs) {
      throw new RunLimitExceededError("maxRuntimeMs", elapsed);
    }
  }

  recordStep(): void {
    this.assertRuntime();
    this.steps += 1;
    if (this.steps > this.limits.maxSteps) {
      throw new RunLimitExceededError("maxSteps", this.steps);
    }
  }

  recordToolCall(): void {
    this.assertRuntime();
    this.toolCalls += 1;
    if (this.toolCalls > this.limits.maxToolCalls) {
      throw new RunLimitExceededError("maxToolCalls", this.toolCalls);
    }
  }

  recordRetry(): void {
    this.retries += 1;
    if (this.retries > this.limits.maxRetries) {
      throw new RunLimitExceededError("maxRetries", this.retries);
    }
  }

  recordCost(deltaUsd: number): void {
    this.costUsd += deltaUsd;
    if (this.limits.maxCostUsd !== undefined && this.costUsd > this.limits.maxCostUsd) {
      throw new RunLimitExceededError("maxCostUsd", this.costUsd);
    }
  }

  get usage() {
    return {
      steps: this.steps,
      toolCalls: this.toolCalls,
      retries: this.retries,
      costUsd: this.costUsd,
      elapsedMs: Date.now() - this.startedAt,
    };
  }
}
