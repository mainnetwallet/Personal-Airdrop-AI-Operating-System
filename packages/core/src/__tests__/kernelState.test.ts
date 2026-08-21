import { describe, it, expect } from "vitest";
import {
  AgentRunStateMachine,
  canTransitionAgentState,
  assertValidAgentStateTransition,
  InvalidAgentStateTransitionError,
} from "../kernelState.js";

describe("agent state machine", () => {
  it("starts IDLE and logs each valid transition", () => {
    const m = new AgentRunStateMachine();
    expect(m.state).toBe("IDLE");
    m.transition("THINKING", "starting work");
    m.transition("PLANNING");
    expect(m.state).toBe("PLANNING");
    expect(m.log).toHaveLength(2);
    expect(m.log[0]).toMatchObject({ from: "IDLE", to: "THINKING", reason: "starting work" });
  });

  it("rejects invalid transitions and does not log them", () => {
    const m = new AgentRunStateMachine();
    expect(() => m.transition("COMPLETED")).toThrow(InvalidAgentStateTransitionError);
    expect(m.state).toBe("IDLE");
    expect(m.log).toHaveLength(0);
  });

  it("COMPLETED and STOPPED are terminal", () => {
    expect(canTransitionAgentState("COMPLETED", "IDLE")).toBe(false);
    expect(canTransitionAgentState("STOPPED", "THINKING")).toBe(false);
  });

  it("assertValidAgentStateTransition throws with a descriptive error", () => {
    expect(() => assertValidAgentStateTransition("IDLE", "EXECUTING")).toThrow(
      /Invalid agent state transition: IDLE -> EXECUTING/
    );
  });

  it("isTerminal reflects COMPLETED/STOPPED only", () => {
    const m = new AgentRunStateMachine("VERIFYING");
    expect(m.isTerminal()).toBe(false);
    m.transition("COMPLETED");
    expect(m.isTerminal()).toBe(true);
  });
});
