import { describe, it, expect } from "vitest";
import { isTerminal, isValidTransition, transition, InvalidStateTransitionError } from "../kernelState.js";

describe("kernel state machine", () => {
  it("allows the happy-path chain", () => {
    expect(isValidTransition("IDLE", "THINKING")).toBe(true);
    expect(isValidTransition("THINKING", "PLANNING")).toBe(true);
    expect(isValidTransition("PLANNING", "PREPARING")).toBe(true);
    expect(isValidTransition("PREPARING", "EXECUTING")).toBe(true);
    expect(isValidTransition("EXECUTING", "VERIFYING")).toBe(true);
    expect(isValidTransition("VERIFYING", "CHECKPOINTING")).toBe(true);
    expect(isValidTransition("CHECKPOINTING", "COMPLETED")).toBe(true);
  });

  it("rejects skipping straight to a terminal state", () => {
    expect(isValidTransition("IDLE", "COMPLETED")).toBe(false);
    expect(() => transition("run-1", "IDLE", "COMPLETED")).toThrow(InvalidStateTransitionError);
  });

  it("rejects self-transitions", () => {
    expect(isValidTransition("THINKING", "THINKING")).toBe(false);
  });

  it("rejects any transition out of a terminal state", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("FAILED")).toBe(true);
    expect(isTerminal("STOPPED")).toBe(true);
    expect(() => transition("run-1", "COMPLETED", "THINKING")).toThrow(InvalidStateTransitionError);
    expect(() => transition("run-1", "FAILED", "IDLE")).toThrow(InvalidStateTransitionError);
  });

  it("allows BLOCKED/PAUSED as interruptions from active states", () => {
    expect(isValidTransition("EXECUTING", "BLOCKED")).toBe(true);
    expect(isValidTransition("PLANNING", "PAUSED")).toBe(true);
  });

  it("produces a timestamped record with reason on success", () => {
    const record = transition("run-1", "IDLE", "THINKING", "starting work");
    expect(record.from).toBe("IDLE");
    expect(record.to).toBe("THINKING");
    expect(record.reason).toBe("starting work");
    expect(record.runId).toBe("run-1");
    expect(new Date(record.at).toString()).not.toBe("Invalid Date");
  });

  it("allows resuming from PAUSED back into execution", () => {
    expect(isValidTransition("PAUSED", "RESUMING")).toBe(true);
    expect(isValidTransition("RESUMING", "EXECUTING")).toBe(true);
  });
});
