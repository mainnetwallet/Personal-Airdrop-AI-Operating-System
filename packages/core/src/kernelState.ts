import type { AgentState } from "@airdrop-os/types";

/**
 * Allowed Agent OS Kernel state transitions.
 *
 * Terminal states (COMPLETED, STOPPED) have no outgoing transitions.
 * FAILED and BLOCKED can be recovered from (RESUMING) or terminated
 * (STOPPED) but never silently jump back to EXECUTING.
 */
const ALLOWED_TRANSITIONS: Record<AgentState, AgentState[]> = {
  IDLE: ["THINKING", "STOPPED"],
  THINKING: ["RESEARCHING", "PLANNING", "WAITING_FOR_USER", "FAILED", "STOPPED", "BLOCKED"],
  RESEARCHING: ["THINKING", "PLANNING", "WAITING_FOR_USER", "FAILED", "STOPPED", "BLOCKED"],
  PLANNING: ["WAITING_FOR_APPROVAL", "PREPARING", "WAITING_FOR_USER", "FAILED", "STOPPED", "BLOCKED"],
  WAITING_FOR_USER: ["THINKING", "PLANNING", "STOPPED", "FAILED"],
  WAITING_FOR_APPROVAL: ["PREPARING", "STOPPED", "FAILED", "BLOCKED"],
  PREPARING: ["EXECUTING", "WAITING_FOR_APPROVAL", "FAILED", "STOPPED", "BLOCKED"],
  EXECUTING: ["VERIFYING", "CHECKPOINTING", "FAILED", "PAUSED", "STOPPED", "BLOCKED"],
  VERIFYING: ["LEARNING", "COMPLETED", "FAILED", "CHECKPOINTING", "STOPPED", "BLOCKED"],
  CHECKPOINTING: ["EXECUTING", "PAUSED", "COMPLETED", "FAILED", "STOPPED"],
  RESUMING: ["EXECUTING", "THINKING", "FAILED", "STOPPED", "BLOCKED"],
  LEARNING: ["COMPLETED", "IDLE", "FAILED", "STOPPED"],
  FAILED: ["RESUMING", "STOPPED"],
  PAUSED: ["RESUMING", "STOPPED"],
  STOPPED: [],
  BLOCKED: ["RESUMING", "STOPPED", "WAITING_FOR_USER"],
  COMPLETED: [],
};

export class InvalidAgentStateTransitionError extends Error {
  constructor(from: AgentState, to: AgentState) {
    super(`Invalid agent state transition: ${from} -> ${to}`);
    this.name = "InvalidAgentStateTransitionError";
  }
}

export function canTransitionAgentState(from: AgentState, to: AgentState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidAgentStateTransition(from: AgentState, to: AgentState): void {
  if (!canTransitionAgentState(from, to)) {
    throw new InvalidAgentStateTransitionError(from, to);
  }
}

export interface StateTransitionRecord {
  from: AgentState;
  to: AgentState;
  at: string;
  reason?: string;
}

/**
 * Tracks the state of a single agent run and records every transition.
 * Every transition is validated against ALLOWED_TRANSITIONS and appended
 * to an immutable log - nothing here allows a transition to be applied
 * without also being logged.
 */
export class AgentRunStateMachine {
  private _state: AgentState;
  private readonly _log: StateTransitionRecord[] = [];

  constructor(initial: AgentState = "IDLE") {
    this._state = initial;
  }

  get state(): AgentState {
    return this._state;
  }

  get log(): readonly StateTransitionRecord[] {
    return this._log;
  }

  transition(to: AgentState, reason?: string): StateTransitionRecord {
    assertValidAgentStateTransition(this._state, to);
    const record: StateTransitionRecord = {
      from: this._state,
      to,
      at: new Date().toISOString(),
      reason,
    };
    this._state = to;
    this._log.push(record);
    return record;
  }

  isTerminal(): boolean {
    return this._state === "COMPLETED" || this._state === "STOPPED";
  }
}
