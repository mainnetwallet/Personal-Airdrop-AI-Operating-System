import { describe, it, expect } from "vitest";
import { decideNextBestAction } from "../nextBestAction.js";
import type { NextBestActionInput } from "@airdrop-os/types";

const base: NextBestActionInput = {
  eligibility: "QUALIFIED",
  deadline: null,
  rewardSignal: 50,
  cost: 10,
  time: 30,
  risk: 2,
  budget: 100,
  availability: true,
  confidence: "LIKELY",
  workflowMatch: true,
  userPreference: "BALANCED",
};

describe("decideNextBestAction", () => {
  it("INELIGIBLE always yields SKIP, regardless of other favorable inputs", () => {
    expect(decideNextBestAction({ ...base, eligibility: "INELIGIBLE", rewardSignal: 1000 })).toBe("SKIP");
  });

  it("EXPIRED yields NO_ACTION", () => {
    expect(decideNextBestAction({ ...base, eligibility: "EXPIRED" })).toBe("NO_ACTION");
  });

  it("CONFLICTED yields HUMAN_REVIEW", () => {
    expect(decideNextBestAction({ ...base, eligibility: "CONFLICTED" })).toBe("HUMAN_REVIEW");
  });

  it("unavailability yields WAIT even when otherwise qualified", () => {
    expect(decideNextBestAction({ ...base, availability: false })).toBe("WAIT");
  });

  it("cost exceeding budget yields BLOCK", () => {
    expect(decideNextBestAction({ ...base, cost: 500, budget: 100 })).toBe("BLOCK");
  });

  it("UNKNOWN eligibility yields RESEARCH", () => {
    expect(decideNextBestAction({ ...base, eligibility: "UNKNOWN" })).toBe("RESEARCH");
  });

  it("a passed deadline yields NO_ACTION", () => {
    expect(decideNextBestAction({ ...base, deadline: new Date(Date.now() - 60_000).toISOString() })).toBe("NO_ACTION");
  });

  it("no workflow match yields HUMAN_REVIEW", () => {
    expect(decideNextBestAction({ ...base, workflowMatch: false })).toBe("HUMAN_REVIEW");
  });

  it("high risk yields HUMAN_REVIEW even with a workflow match", () => {
    expect(decideNextBestAction({ ...base, risk: 9 })).toBe("HUMAN_REVIEW");
  });

  it("POSSIBLE eligibility yields WATCH", () => {
    expect(decideNextBestAction({ ...base, eligibility: "POSSIBLE" })).toBe("WATCH");
  });

  it("QUALIFIED/LIKELY/VERIFIED with everything else favorable yields DO", () => {
    expect(decideNextBestAction({ ...base, eligibility: "QUALIFIED" })).toBe("DO");
    expect(decideNextBestAction({ ...base, eligibility: "LIKELY" })).toBe("DO");
    expect(decideNextBestAction({ ...base, eligibility: "VERIFIED" })).toBe("DO");
  });
});
