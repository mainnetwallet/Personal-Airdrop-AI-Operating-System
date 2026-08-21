/**
 * Agent run state machine.
 *
 * Every transition is validated against an explicit adjacency list and,
 * on success, produces a StateTransitionRecord the kernel is expected to
 * persist/audit. Invalid transitions throw rather than silently
 * clamping state, so callers cannot accidentally skip states (e.g.
 * jumping straight from IDLE to COMPLETED).
 */
import type { AgentState, StateTransitionRecord } from "@airdrop-os/types";

export const TERMINAL_STATES: ReadonlySet<AgentState> = new Set([
  "FAILED",
  "STOPPED",
  "COMPLETED",
]);

// Adjacency list of allowed transitions. BLOCKED and PAUSED are reachable
// from (almost) any non-terminal state since they represent external
// interruption, not a normal step in the happy path.
const TRANSITIONS: Record<AgentState, ReadonlySet<AgentState>> = {
  IDLE: new Set(["THINKING", "STOPPED"]),
  THINKING: new Set(["RESEARCHING", "PLANNING", "WAITING_FOR_USER", "BLOCKED", "FAILED", "PAUSED"]),
  RESEARCHING: new Set(["THINKING", "PLANNING", "WAITING_FOR_USER", "BLOCKED", "FAILED", "PAUSED"]),
  PLANNING: new Set(["WAITING_FOR_APPROVAL", "PREPARING", "WAITING_FOR_USER", "BLOCKED", "FAILED", "PAUSED"]),
  WAITING_FOR_USER: new Set(["THINKING", "PLANNING", "STOPPED", "BLOCKED", "PAUSED"]),
  WAITING_FOR_APPROVAL: new Set(["PREPARING", "STOPPED", "BLOCKED", "PAUSED"]),
  PREPARING: new Set(["EXECUTING", "WAITING_FOR_APPROVAL", "BLOCKED", "FAILED", "PAUSED"]),
  EXECUTING: new Set(["VERIFYING", "CHECKPOINTING", "BLOCKED", "FAILED", "PAUSED"]),
  VERIFYING: new Set(["CHECKPOINTING", "LEARNING", "THINKING", "BLOCKED", "FAILED", "PAUSED"]),
  CHECKPOINTING: new Set(["LEARNING", "COMPLETED", "THINKING", "BLOCKED", "FAILED", "PAUSED"]),
  RESUMING: new Set(["THINKING", "EXECUTING", "VERIFYING", "BLOCKED", "FAILED", "PAUSED"]),
  LEARNING: new Set(["COMPLETED", "IDLE", "BLOCKED", "FAILED", "PAUSED"]),
  PAUSED: new Set(["RESUMING", "STOPPED", "BLOCKED"]),
  BLOCKED: new Set(["RESUMING", "STOPPED", "FAILED"]),
  FAILED: new Set([]),
  STOPPED: new Set([]),
  COMPLETED: new Set([]),
};

export class InvalidStateTransitionError extends Error {
  constructor(public readonly from: AgentState, public readonly to: AgentState) {
    super(`Invalid agent state transition: ${from} -> ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

export function isValidTransition(from: AgentState, to: AgentState): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].has(to);
}

export function isTerminal(state: AgentState): boolean {
  return TERMINAL_STATES.has(state);
}

/**
 * Validates and records a transition. Throws InvalidStateTransitionError
 * on an illegal transition or when `from` is already terminal — callers
 * must never trust an out-of-band completion claim over this check.
 */
export function transition(
  runId: string,
  from: AgentState,
  to: AgentState,
  reason: string | null = null
): StateTransitionRecord {
  if (isTerminal(from)) {
    throw new InvalidStateTransitionError(from, to);
  }
  if (!isValidTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
  return {
    runId,
    from,
    to,
    reason,
    at: new Date().toISOString(),
  };
}
