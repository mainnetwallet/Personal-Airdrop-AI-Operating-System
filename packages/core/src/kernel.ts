import { randomUUID } from "node:crypto";
import type { AgentRun, AgentState, DeviceType, PermissionScope, RunLimitConfig } from "@airdrop-os/types";
import { AgentRunStateMachine } from "./kernelState.js";
import { KernelEventBus } from "./eventBus.js";
import { DEFAULT_RUN_LIMITS, RunLimitTracker } from "./runLimits.js";
import { ToolRegistry } from "./toolRegistry.js";

export interface CreateRunInput {
  agentId: string;
  deviceId?: string | null;
  parentRunId?: string | null;
  goal: string;
  permissions: PermissionScope[];
  context?: Record<string, unknown>;
  limits?: RunLimitConfig;
}

interface ManagedRun {
  run: AgentRun;
  machine: AgentRunStateMachine;
  limits: RunLimitTracker;
}

/**
 * Central Agent OS Kernel for a single process. Owns run lifecycle,
 * state transitions, event publication, resource limits, and the tool
 * permission gate. Every mutation to a run goes through this class so
 * state, events, and limits can never drift out of sync with each
 * other.
 */
export class AgentOsKernel {
  readonly eventBus = new KernelEventBus();
  readonly tools = new ToolRegistry();
  private readonly runs = new Map<string, ManagedRun>();

  createRun(input: CreateRunInput): AgentRun {
    const runId = randomUUID();
    const now = new Date().toISOString();
    const run: AgentRun = {
      runId,
      parentRunId: input.parentRunId ?? null,
      agentId: input.agentId,
      deviceId: input.deviceId ?? null,
      goal: input.goal,
      context: input.context ?? {},
      toolsUsed: [],
      permissions: input.permissions,
      status: "IDLE",
      startTime: now,
      endTime: null,
      result: null,
      errors: [],
      cost: { toolCalls: 0 },
      checkpointId: null,
    };

    this.runs.set(runId, {
      run,
      machine: new AgentRunStateMachine("IDLE"),
      limits: new RunLimitTracker(input.limits ?? DEFAULT_RUN_LIMITS),
    });

    void this.eventBus.publish({
      eventType: "run.created",
      source: "kernel",
      agentId: input.agentId,
      deviceId: input.deviceId ?? null,
      correlationId: runId,
      payload: { runId, goal: input.goal },
    });

    return run;
  }

  getRun(runId: string): AgentRun {
    return this.requireManagedRun(runId).run;
  }

  /**
   * Transitions a run's state. Every transition emits a
   * `run.state_changed` event on the shared event bus (this is the log
   * required by the kernel contract) and, before applying, advances the
   * run's step counter so runaway loops trip RunLimitExceededError
   * instead of transitioning forever.
   */
  transitionRun(runId: string, to: AgentState, reason?: string): AgentRun {
    const managed = this.requireManagedRun(runId);
    managed.limits.recordStep();
    const record = managed.machine.transition(to, reason);
    managed.run.status = record.to;
    if (managed.machine.isTerminal()) {
      managed.run.endTime = new Date().toISOString();
    }

    void this.eventBus.publish({
      eventType: "run.state_changed",
      source: "kernel",
      agentId: managed.run.agentId,
      deviceId: managed.run.deviceId,
      correlationId: runId,
      payload: { runId, from: record.from, to: record.to, reason: reason ?? null },
    });

    return managed.run;
  }

  /**
   * Validates and records a tool call against the run's granted
   * permissions and resource limits, then emits an audit-worthy
   * `tool.called` event. Throws (rather than silently skipping) if the
   * permission is missing, approval is required and absent, the device
   * is unsupported, or any run limit would be exceeded.
   */
  callTool(input: {
    runId: string;
    toolName: string;
    device?: DeviceType;
    approved?: boolean;
    args?: Record<string, unknown>;
  }): AgentRun {
    const managed = this.requireManagedRun(input.runId);
    managed.limits.recordToolCall();

    const tool = this.tools.assertCallAllowed({
      toolName: input.toolName,
      grantedPermissions: managed.run.permissions,
      device: input.device,
      approved: input.approved,
    });

    if (!managed.run.toolsUsed.includes(tool.name)) {
      managed.run.toolsUsed.push(tool.name);
    }
    managed.run.cost.toolCalls += 1;

    void this.eventBus.publish({
      eventType: "tool.called",
      source: "kernel",
      agentId: managed.run.agentId,
      deviceId: managed.run.deviceId,
      correlationId: input.runId,
      payload: { runId: input.runId, tool: tool.name, args: input.args ?? {} },
    });

    return managed.run;
  }

  recordError(runId: string, error: string): AgentRun {
    const managed = this.requireManagedRun(runId);
    managed.run.errors.push(error);
    void this.eventBus.publish({
      eventType: "run.error",
      source: "kernel",
      agentId: managed.run.agentId,
      deviceId: managed.run.deviceId,
      correlationId: runId,
      payload: { runId, error },
    });
    return managed.run;
  }

  usage(runId: string) {
    return this.requireManagedRun(runId).limits.usage;
  }

  private requireManagedRun(runId: string): ManagedRun {
    const managed = this.runs.get(runId);
    if (!managed) throw new Error(`Unknown agent run: ${runId}`);
    return managed;
  }
}
