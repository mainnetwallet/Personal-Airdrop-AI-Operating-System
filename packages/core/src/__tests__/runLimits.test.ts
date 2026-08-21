import { describe, it, expect } from "vitest";
import { RunLimitTracker, RunLimitExceededError } from "../runLimits.js";

describe("run limit tracker", () => {
  it("allows steps/tool calls up to the configured max", () => {
    const t = new RunLimitTracker({ maxSteps: 2, maxRuntimeMs: 60_000, maxToolCalls: 2, maxRetries: 1 });
    t.recordStep();
    t.recordStep();
    t.recordToolCall();
    t.recordToolCall();
    expect(t.usage.steps).toBe(2);
    expect(t.usage.toolCalls).toBe(2);
  });

  it("throws once maxSteps is exceeded, preventing an infinite loop", () => {
    const t = new RunLimitTracker({ maxSteps: 1, maxRuntimeMs: 60_000, maxToolCalls: 10, maxRetries: 1 });
    t.recordStep();
    expect(() => t.recordStep()).toThrow(RunLimitExceededError);
  });

  it("throws once maxToolCalls is exceeded", () => {
    const t = new RunLimitTracker({ maxSteps: 10, maxRuntimeMs: 60_000, maxToolCalls: 1, maxRetries: 1 });
    t.recordToolCall();
    expect(() => t.recordToolCall()).toThrow(RunLimitExceededError);
  });

  it("throws once maxRetries is exceeded", () => {
    const t = new RunLimitTracker({ maxSteps: 10, maxRuntimeMs: 60_000, maxToolCalls: 10, maxRetries: 1 });
    t.recordRetry();
    expect(() => t.recordRetry()).toThrow(RunLimitExceededError);
  });

  it("throws once the runtime budget is exceeded", () => {
    const t = new RunLimitTracker({ maxSteps: 10, maxRuntimeMs: -1, maxToolCalls: 10, maxRetries: 1 });
    expect(() => t.recordStep()).toThrow(RunLimitExceededError);
  });

  it("throws once the cost budget is exceeded when configured", () => {
    const t = new RunLimitTracker({ maxSteps: 10, maxRuntimeMs: 60_000, maxToolCalls: 10, maxRetries: 1, maxCostUsd: 1 });
    t.recordCost(0.5);
    expect(() => t.recordCost(0.6)).toThrow(RunLimitExceededError);
  });
});
