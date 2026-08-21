import { describe, it, expect } from "vitest";
import { checkRunLimits, RunLimitExceededError, DEFAULT_RUN_LIMITS } from "../runLimits.js";
import type { AgentRun } from "@airdrop-os/types";

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    runId: "run-1",
    parentRunId: null,
    agentId: "agent-1",
    deviceId: null,
    goal: "test",
    context: {},
    toolsUsed: [],
    permissions: [],
    status: "IDLE",
    startTime: new Date().toISOString(),
    endTime: null,
    steps: 0,
    toolCalls: 0,
    retries: 0,
    cost: { toolCalls: 0, amount: 0 },
    result: null,
    errors: [],
    checkpointId: null,
    ...overrides,
  };
}

describe("run limits", () => {
  it("passes for a fresh run under all limits", () => {
    expect(() => checkRunLimits(makeRun())).not.toThrow();
  });

  it("throws MAX_STEPS_EXCEEDED once steps reach the ceiling", () => {
    const run = makeRun({ steps: DEFAULT_RUN_LIMITS.maxSteps });
    expect(() => checkRunLimits(run)).toThrow(RunLimitExceededError);
    try {
      checkRunLimits(run);
    } catch (e) {
      expect((e as RunLimitExceededError).violation).toBe("MAX_STEPS_EXCEEDED");
    }
  });

  it("throws MAX_TOOL_CALLS_EXCEEDED once tool calls reach the ceiling", () => {
    const run = makeRun({ toolCalls: DEFAULT_RUN_LIMITS.maxToolCalls });
    try {
      checkRunLimits(run);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as RunLimitExceededError).violation).toBe("MAX_TOOL_CALLS_EXCEEDED");
    }
  });

  it("throws MAX_RETRIES_EXCEEDED once retries reach the ceiling", () => {
    const run = makeRun({ retries: DEFAULT_RUN_LIMITS.maxRetries });
    try {
      checkRunLimits(run);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as RunLimitExceededError).violation).toBe("MAX_RETRIES_EXCEEDED");
    }
  });

  it("throws MAX_COST_EXCEEDED once cost reaches the ceiling", () => {
    const run = makeRun({ cost: { toolCalls: 0, amount: DEFAULT_RUN_LIMITS.maxCost } });
    try {
      checkRunLimits(run);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as RunLimitExceededError).violation).toBe("MAX_COST_EXCEEDED");
    }
  });

  it("throws MAX_RUNTIME_EXCEEDED once elapsed time passes the ceiling", () => {
    const run = makeRun({ startTime: new Date(Date.now() - DEFAULT_RUN_LIMITS.maxRuntimeMs - 1000).toISOString() });
    try {
      checkRunLimits(run);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as RunLimitExceededError).violation).toBe("MAX_RUNTIME_EXCEEDED");
    }
  });

  it("respects custom limit overrides tighter than the defaults", () => {
    const run = makeRun({ steps: 2 });
    expect(() => checkRunLimits(run, { ...DEFAULT_RUN_LIMITS, maxSteps: 2 })).toThrow(RunLimitExceededError);
    expect(() => checkRunLimits(run, { ...DEFAULT_RUN_LIMITS, maxSteps: 3 })).not.toThrow();
  });
});
