import { describe, it, expect } from "vitest";
import { AgentOSKernel, PermissionDeniedError, DeviceNotSupportedError, RunNotFoundError } from "../kernel.js";
import { InvalidStateTransitionError } from "../kernelState.js";
import { RunLimitExceededError } from "../runLimits.js";
import type { ToolDefinition } from "@airdrop-os/types";

const readTool: ToolDefinition = {
  name: "http.get",
  description: "Fetch a URL",
  inputSchema: {},
  outputSchema: {},
  permission: "RESEARCH",
  risk: "LOW",
  supportedDevices: ["VPS", "PC"],
  timeoutMs: 5000,
  retryPolicy: { maxRetries: 2, backoffMs: 500 },
  auditEvent: true,
  requiresApproval: false,
};

const txTool: ToolDefinition = {
  name: "tx.sign",
  description: "Sign a transaction",
  inputSchema: {},
  outputSchema: {},
  permission: "TRANSACTION_APPROVAL",
  risk: "CRITICAL",
  supportedDevices: ["PC"],
  timeoutMs: 5000,
  retryPolicy: { maxRetries: 0, backoffMs: 0 },
  auditEvent: true,
  requiresApproval: true,
};

describe("AgentOSKernel — run lifecycle", () => {
  it("creates a run in IDLE and emits run.created", () => {
    const kernel = new AgentOSKernel();
    const run = kernel.createRun({ agentId: "agent-1", deviceId: null, goal: "find airdrops", permissions: ["READ"] });
    expect(run.status).toBe("IDLE");
    const created = kernel.eventBus.getLog().find((e) => e.eventType === "run.created");
    expect(created?.correlationId).toBe(run.runId);
  });

  it("transitions through valid states and marks endTime on completion", () => {
    const kernel = new AgentOSKernel();
    const run = kernel.createRun({ agentId: "a", deviceId: null, goal: "g", permissions: [] });
    kernel.transitionRun(run.runId, "THINKING");
    kernel.transitionRun(run.runId, "PLANNING");
    kernel.transitionRun(run.runId, "PREPARING");
    kernel.transitionRun(run.runId, "EXECUTING");
    kernel.transitionRun(run.runId, "VERIFYING");
    kernel.transitionRun(run.runId, "CHECKPOINTING");
    const done = kernel.transitionRun(run.runId, "COMPLETED");
    expect(done.status).toBe("COMPLETED");
    expect(done.endTime).not.toBeNull();
  });

  it("rejects an invalid transition and does not mutate run state", () => {
    const kernel = new AgentOSKernel();
    const run = kernel.createRun({ agentId: "a", deviceId: null, goal: "g", permissions: [] });
    expect(() => kernel.transitionRun(run.runId, "COMPLETED")).toThrow(InvalidStateTransitionError);
    expect(kernel.getRun(run.runId).status).toBe("IDLE");
  });

  it("throws RunNotFoundError for an unknown run", () => {
    const kernel = new AgentOSKernel();
    expect(() => kernel.getRun("nope")).toThrow(RunNotFoundError);
  });

  it("blocks further transitions once a run hits its step limit", () => {
    const kernel = new AgentOSKernel();
    const run = kernel.createRun({
      agentId: "a",
      deviceId: null,
      goal: "g",
      permissions: [],
      limits: { maxSteps: 1, maxRuntimeMs: 60_000, maxToolCalls: 100, maxRetries: 5, maxCost: 5 },
    });
    kernel.transitionRun(run.runId, "THINKING"); // step 1 -> steps becomes 1, hits the limit
    expect(() => kernel.transitionRun(run.runId, "PLANNING")).toThrow(RunLimitExceededError);
  });

  it("still allows escaping to BLOCKED/STOPPED/FAILED even over the step limit", () => {
    const kernel = new AgentOSKernel();
    const run = kernel.createRun({
      agentId: "a",
      deviceId: null,
      goal: "g",
      permissions: [],
      limits: { maxSteps: 1, maxRuntimeMs: 60_000, maxToolCalls: 100, maxRetries: 5, maxCost: 5 },
    });
    kernel.transitionRun(run.runId, "THINKING");
    const blocked = kernel.transitionRun(run.runId, "BLOCKED");
    expect(blocked.status).toBe("BLOCKED");
  });
});

describe("AgentOSKernel — permission enforcement", () => {
  it("allows a tool call when the run holds the required permission", () => {
    const kernel = new AgentOSKernel();
    kernel.tools.register(readTool);
    const run = kernel.createRun({ agentId: "a", deviceId: null, goal: "g", permissions: ["RESEARCH"] });
    const result = kernel.callTool({ runId: run.runId, toolName: "http.get", device: "VPS" });
    expect(result.toolName).toBe("http.get");
    expect(kernel.getRun(run.runId).toolCalls).toBe(1);
  });

  it("denies a tool call when the run lacks the required permission", () => {
    const kernel = new AgentOSKernel();
    kernel.tools.register(readTool);
    const run = kernel.createRun({ agentId: "a", deviceId: null, goal: "g", permissions: ["READ"] });
    expect(() => kernel.callTool({ runId: run.runId, toolName: "http.get", device: "VPS" })).toThrow(
      PermissionDeniedError
    );
  });

  it("never implicitly grants TRANSACTION_APPROVAL — a run without it cannot invoke a signing tool", () => {
    const kernel = new AgentOSKernel();
    kernel.tools.register(txTool);
    const run = kernel.createRun({
      agentId: "a",
      deviceId: null,
      goal: "g",
      permissions: ["READ", "RESEARCH", "TRANSACTION_PREPARE"], // deliberately missing TRANSACTION_APPROVAL
    });
    expect(() => kernel.callTool({ runId: run.runId, toolName: "tx.sign", device: "PC" })).toThrow(
      PermissionDeniedError
    );
  });

  it("allows the signing tool only once TRANSACTION_APPROVAL is explicitly present", () => {
    const kernel = new AgentOSKernel();
    kernel.tools.register(txTool);
    const run = kernel.createRun({
      agentId: "a",
      deviceId: null,
      goal: "g",
      permissions: ["TRANSACTION_APPROVAL"],
    });
    const result = kernel.callTool({ runId: run.runId, toolName: "tx.sign", device: "PC" });
    expect(result.toolName).toBe("tx.sign");
  });

  it("rejects a tool call on an unsupported device", () => {
    const kernel = new AgentOSKernel();
    kernel.tools.register(readTool);
    const run = kernel.createRun({ agentId: "a", deviceId: null, goal: "g", permissions: ["RESEARCH"] });
    expect(() => kernel.callTool({ runId: run.runId, toolName: "http.get", device: "ANDROID" })).toThrow(
      DeviceNotSupportedError
    );
  });

  it("audits both allowed and denied tool calls as kernel events", () => {
    const kernel = new AgentOSKernel();
    kernel.tools.register(readTool);
    const allowedRun = kernel.createRun({ agentId: "a", deviceId: null, goal: "g", permissions: ["RESEARCH"] });
    const deniedRun = kernel.createRun({ agentId: "a", deviceId: null, goal: "g", permissions: [] });

    kernel.callTool({ runId: allowedRun.runId, toolName: "http.get", device: "VPS" });
    try {
      kernel.callTool({ runId: deniedRun.runId, toolName: "http.get", device: "VPS" });
    } catch {
      // expected
    }

    const calledEvents = kernel.eventBus.getLog().filter((e) => e.eventType === "tool.called");
    const deniedEvents = kernel.eventBus.getLog().filter((e) => e.eventType === "tool.denied");
    expect(calledEvents).toHaveLength(1);
    expect(deniedEvents).toHaveLength(1);
  });

  it("stops tool calls once maxToolCalls is reached (no infinite loops)", () => {
    const kernel = new AgentOSKernel();
    kernel.tools.register(readTool);
    const run = kernel.createRun({
      agentId: "a",
      deviceId: null,
      goal: "g",
      permissions: ["RESEARCH"],
      limits: { maxSteps: 1000, maxRuntimeMs: 60_000, maxToolCalls: 2, maxRetries: 5, maxCost: 5 },
    });
    kernel.callTool({ runId: run.runId, toolName: "http.get", device: "VPS" });
    kernel.callTool({ runId: run.runId, toolName: "http.get", device: "VPS" });
    expect(() => kernel.callTool({ runId: run.runId, toolName: "http.get", device: "VPS" })).toThrow(
      RunLimitExceededError
    );
  });
});

describe("AgentOSKernel — memory integration", () => {
  it("kernel.memory is a working MemoryStore shared across the kernel instance", () => {
    const kernel = new AgentOSKernel();
    const entry = kernel.memory.write({
      agentId: "a",
      type: "RESEARCH_FACT",
      content: { note: "example" },
      source: "test",
      confidence: 0.5,
    });
    expect(kernel.memory.get(entry.memoryId)).toBeDefined();
  });
});
