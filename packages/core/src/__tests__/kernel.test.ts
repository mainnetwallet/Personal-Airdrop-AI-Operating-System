import { describe, it, expect } from "vitest";
import { AgentOsKernel } from "../kernel.js";
import { RunLimitExceededError } from "../runLimits.js";
import { PermissionDeniedError } from "../toolRegistry.js";
import { InvalidAgentStateTransitionError } from "../kernelState.js";
import type { ToolDefinition } from "@airdrop-os/types";

const researchTool: ToolDefinition = {
  name: "research.fetch",
  description: "Fetch a public URL for research",
  inputSchema: {},
  outputSchema: {},
  permission: "RESEARCH",
  risk: "LOW",
  supportedDevices: ["VPS"],
  timeoutMs: 5000,
  retryPolicy: { maxRetries: 1, backoffMs: 100 },
  auditEvent: true,
  requiresApproval: false,
};

describe("AgentOsKernel", () => {
  it("creates a run in IDLE and emits a run.created event", () => {
    const kernel = new AgentOsKernel();
    const run = kernel.createRun({ agentId: "agent-1", goal: "find airdrops", permissions: ["RESEARCH"] });
    expect(run.status).toBe("IDLE");
    expect(kernel.eventBus.history.some((e) => e.eventType === "run.created")).toBe(true);
  });

  it("transitions a run and logs a run.state_changed event with the correct correlationId", () => {
    const kernel = new AgentOsKernel();
    const run = kernel.createRun({ agentId: "agent-1", goal: "g", permissions: [] });
    kernel.transitionRun(run.runId, "THINKING");
    const updated = kernel.getRun(run.runId);
    expect(updated.status).toBe("THINKING");
    const events = kernel.eventBus.chain(run.runId);
    expect(events.some((e) => e.eventType === "run.state_changed")).toBe(true);
  });

  it("rejects an invalid state transition and leaves the run's status unchanged", () => {
    const kernel = new AgentOsKernel();
    const run = kernel.createRun({ agentId: "agent-1", goal: "g", permissions: [] });
    expect(() => kernel.transitionRun(run.runId, "COMPLETED")).toThrow(InvalidAgentStateTransitionError);
    expect(kernel.getRun(run.runId).status).toBe("IDLE");
  });

  it("denies a tool call when the run lacks the required permission", () => {
    const kernel = new AgentOsKernel();
    kernel.tools.register(researchTool);
    const run = kernel.createRun({ agentId: "agent-1", goal: "g", permissions: ["READ"] });
    expect(() => kernel.callTool({ runId: run.runId, toolName: "research.fetch", device: "VPS" })).toThrow(
      PermissionDeniedError
    );
  });

  it("allows a tool call with the right permission and records it on the run", () => {
    const kernel = new AgentOsKernel();
    kernel.tools.register(researchTool);
    const run = kernel.createRun({ agentId: "agent-1", goal: "g", permissions: ["RESEARCH"] });
    const updated = kernel.callTool({ runId: run.runId, toolName: "research.fetch", device: "VPS" });
    expect(updated.toolsUsed).toEqual(["research.fetch"]);
    expect(updated.cost.toolCalls).toBe(1);
  });

  it("enforces run limits across tool calls (no infinite loop)", () => {
    const kernel = new AgentOsKernel();
    kernel.tools.register(researchTool);
    const run = kernel.createRun({
      agentId: "agent-1",
      goal: "g",
      permissions: ["RESEARCH"],
      limits: { maxSteps: 100, maxRuntimeMs: 60_000, maxToolCalls: 1, maxRetries: 1 },
    });
    kernel.callTool({ runId: run.runId, toolName: "research.fetch", device: "VPS" });
    expect(() => kernel.callTool({ runId: run.runId, toolName: "research.fetch", device: "VPS" })).toThrow(
      RunLimitExceededError
    );
  });

  it("recordError appends to run.errors and emits a run.error event", () => {
    const kernel = new AgentOsKernel();
    const run = kernel.createRun({ agentId: "agent-1", goal: "g", permissions: [] });
    kernel.recordError(run.runId, "network timeout");
    expect(kernel.getRun(run.runId).errors).toEqual(["network timeout"]);
    expect(kernel.eventBus.chain(run.runId).some((e) => e.eventType === "run.error")).toBe(true);
  });

  it("throws for an unknown runId rather than silently no-op-ing", () => {
    const kernel = new AgentOsKernel();
    expect(() => kernel.getRun("nope")).toThrow(/Unknown agent run/);
  });
});
