/**
 * Agent OS Kernel.
 *
 * Owns run lifecycle (create/transition/complete), enforces run limits
 * before each step or tool call, enforces tool permission scopes, and
 * emits a kernel event for every state transition and tool invocation so
 * the durable audit trail is never dependent on the caller remembering
 * to log it separately.
 *
 * Signing authority: TRANSACTION_APPROVAL is never granted implicitly.
 * A device's granted permission set must already contain
 * TRANSACTION_APPROVAL before the kernel will allow a tool that
 * declares that permission to run; the kernel itself never elevates a
 * run's permissions mid-flight.
 */
import { randomUUID } from "node:crypto";
import type { AgentRun, AgentState, DeviceType, PermissionScope, RunLimits } from "@airdrop-os/types";
import { KernelEventBus } from "./eventBus.js";
import { MemoryStore } from "./memory.js";
import { checkRunLimits, DEFAULT_RUN_LIMITS } from "./runLimits.js";
import { isTerminal, transition } from "./kernelState.js";
import { ToolRegistry } from "./toolRegistry.js";

export class PermissionDeniedError extends Error {
  constructor(public readonly runId: string, public readonly required: PermissionScope) {
    super(`Run ${runId} lacks required permission: ${required}`);
    this.name = "PermissionDeniedError";
  }
}

export class DeviceNotSupportedError extends Error {
  constructor(tool: string, device: DeviceType) {
    super(`Tool ${tool} does not support device ${device}`);
    this.name = "DeviceNotSupportedError";
  }
}

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Unknown runId: ${runId}`);
    this.name = "RunNotFoundError";
  }
}

export interface CreateRunInput {
  agentId: string;
  deviceId: string | null;
  goal: string;
  permissions: PermissionScope[];
  context?: Record<string, unknown>;
  parentRunId?: string | null;
  limits?: RunLimits;
}

export interface CallToolInput {
  runId: string;
  toolName: string;
  device: DeviceType;
  causationId?: string | null;
}

export class AgentOSKernel {
  readonly eventBus = new KernelEventBus();
  readonly memory = new MemoryStore();
  readonly tools = new ToolRegistry();

  private readonly runs = new Map<string, AgentRun>();
  private readonly runLimitOverrides = new Map<string, RunLimits>();

  createRun(input: CreateRunInput): AgentRun {
    const run: AgentRun = {
      runId: randomUUID(),
      parentRunId: input.parentRunId ?? null,
      agentId: input.agentId,
      deviceId: input.deviceId,
      goal: input.goal,
      context: input.context ?? {},
      toolsUsed: [],
      permissions: input.permissions,
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
    };
    this.runs.set(run.runId, run);
    if (input.limits) this.runLimitOverrides.set(run.runId, input.limits);

    this.eventBus.emit({
      eventType: "run.created",
      source: "kernel",
      agentId: run.agentId,
      deviceId: run.deviceId,
      correlationId: run.runId,
      payload: { goal: run.goal },
    });
    return run;
  }

  getRun(runId: string): AgentRun {
    const run = this.runs.get(runId);
    if (!run) throw new RunNotFoundError(runId);
    return run;
  }

  /**
   * Validates and applies a state transition, checks run limits first
   * (a run already over budget cannot be advanced further except into a
   * terminal/BLOCKED/PAUSED state), and emits a kernel event.
   */
  transitionRun(runId: string, to: AgentState, reason: string | null = null): AgentRun {
    const run = this.getRun(runId);
    const limits = this.runLimitOverrides.get(runId) ?? DEFAULT_RUN_LIMITS;

    const isEscapeHatch = to === "BLOCKED" || to === "STOPPED" || to === "FAILED" || to === "PAUSED";
    if (!isEscapeHatch) {
      checkRunLimits(run, limits);
    }

    const record = transition(runId, run.status, to, reason);
    run.status = to;
    run.steps += 1;
    if (isTerminal(to)) {
      run.endTime = record.at;
    }

    this.eventBus.emit({
      eventType: "run.transitioned",
      source: "kernel",
      agentId: run.agentId,
      deviceId: run.deviceId,
      correlationId: run.runId,
      payload: { from: record.from, to: record.to, reason: record.reason },
    });
    return run;
  }

  hasPermission(runId: string, scope: PermissionScope): boolean {
    return this.getRun(runId).permissions.includes(scope);
  }

  /**
   * Enforces: (1) the tool exists, (2) the run holds the tool's required
   * permission scope, (3) the target device is one the tool supports,
   * (4) run limits are not exceeded. Every call — allowed or denied —
   * is audited via a kernel event.
   */
  callTool(input: CallToolInput): { toolName: string; correlationId: string } {
    const run = this.getRun(input.runId);
    const tool = this.tools.get(input.toolName);

    if (!this.hasPermission(input.runId, tool.permission)) {
      this.eventBus.emit({
        eventType: "tool.denied",
        source: "kernel",
        agentId: run.agentId,
        deviceId: run.deviceId,
        correlationId: input.runId,
        causationId: input.causationId ?? null,
        payload: { tool: tool.name, requiredPermission: tool.permission },
      });
      throw new PermissionDeniedError(input.runId, tool.permission);
    }

    if (!tool.supportedDevices.includes(input.device)) {
      this.eventBus.emit({
        eventType: "tool.denied",
        source: "kernel",
        agentId: run.agentId,
        deviceId: run.deviceId,
        correlationId: input.runId,
        causationId: input.causationId ?? null,
        payload: { tool: tool.name, device: input.device, reason: "DEVICE_NOT_SUPPORTED" },
      });
      throw new DeviceNotSupportedError(tool.name, input.device);
    }

    const limits = this.runLimitOverrides.get(input.runId) ?? DEFAULT_RUN_LIMITS;
    checkRunLimits(run, limits);

    run.toolCalls += 1;
    run.cost.toolCalls += 1;
    if (!run.toolsUsed.includes(tool.name)) run.toolsUsed.push(tool.name);

    const event = this.eventBus.emit({
      eventType: "tool.called",
      source: "kernel",
      agentId: run.agentId,
      deviceId: run.deviceId,
      correlationId: input.runId,
      causationId: input.causationId ?? null,
      payload: { tool: tool.name, device: input.device, requiresApproval: tool.requiresApproval },
    });

    return { toolName: tool.name, correlationId: event.correlationId };
  }

  recordRetry(runId: string): AgentRun {
    const run = this.getRun(runId);
    const limits = this.runLimitOverrides.get(runId) ?? DEFAULT_RUN_LIMITS;
    checkRunLimits(run, limits);
    run.retries += 1;
    return run;
  }
}
