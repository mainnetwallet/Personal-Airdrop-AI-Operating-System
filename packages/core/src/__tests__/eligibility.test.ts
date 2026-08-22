import { describe, it, expect, vi, afterEach } from "vitest";
import { RequirementStore } from "../requirement.js";
import { EligibilityEngine } from "../eligibility.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("EligibilityEngine", () => {
  it("returns QUALIFIED when the wallet's activity meets the requirement in force at the time", () => {
    const requirements = new RequirementStore();
    const engine = new EligibilityEngine(requirements);
    const req = requirements.create({
      projectId: "p1",
      type: "VOLUME",
      description: "Trade $1000+",
      source: "https://official.io",
      minimum: 1000,
    });

    const proof = engine.evaluate({
      projectId: "p1",
      wallet: "0xABC",
      requirementIds: [req.requirementId],
      activities: [
        { activityId: "a1", wallet: "0xABC", account: null, type: "trade", timestamp: new Date().toISOString(), block: null, value: 1500, chain: null },
      ],
    });

    expect(proof.state).toBe("QUALIFIED");
    expect(proof.requirements).toEqual([{ requirementId: req.requirementId, version: 1 }]);
  });

  it("returns INELIGIBLE when activity falls short of the requirement", () => {
    const requirements = new RequirementStore();
    const engine = new EligibilityEngine(requirements);
    const req = requirements.create({
      projectId: "p1",
      type: "VOLUME",
      description: "Trade $1000+",
      source: "https://official.io",
      minimum: 1000,
    });

    const proof = engine.evaluate({
      projectId: "p1",
      wallet: "0xABC",
      requirementIds: [req.requirementId],
      activities: [
        { activityId: "a1", wallet: "0xABC", account: null, type: "trade", timestamp: new Date().toISOString(), block: null, value: 200, chain: null },
      ],
    });

    expect(proof.state).toBe("INELIGIBLE");
  });

  it("returns UNKNOWN when no activity is supplied for the wallet/account being evaluated", () => {
    const requirements = new RequirementStore();
    const engine = new EligibilityEngine(requirements);
    const req = requirements.create({
      projectId: "p1",
      type: "SOCIAL",
      description: "Follow on X",
      source: "https://official.io",
    });

    const proof = engine.evaluate({
      projectId: "p1",
      wallet: "0xABC",
      requirementIds: [req.requirementId],
      activities: [],
    });

    expect(proof.state).toBe("UNKNOWN");
    expect(proof.unknowns.length).toBeGreaterThan(0);
  });

  it("historical backtest: an old activity is judged by the requirement version valid at its own timestamp, not the current (raised) minimum", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const requirements = new RequirementStore();
    const engine = new EligibilityEngine(requirements);

    const req = requirements.create({
      projectId: "p1",
      type: "VOLUME",
      description: "Trade $1000+",
      source: "https://official.io",
      minimum: 1000,
    });
    const oldTimestamp = req.validFrom;

    // Requirement tightens later: minimum raised to 5000.
    vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
    requirements.supersede(req.requirementId, { minimum: 5000 });

    // Old activity of $1500 would fail against today's $5000 minimum,
    // but it happened while the $1000 minimum was in force, so it
    // must still qualify.
    const proof = engine.evaluate({
      projectId: "p1",
      wallet: "0xABC",
      requirementIds: [req.requirementId],
      activities: [
        { activityId: "a1", wallet: "0xABC", account: null, type: "trade", timestamp: oldTimestamp, block: null, value: 1500, chain: null },
      ],
    });

    expect(proof.state).toBe("QUALIFIED");
    expect(proof.requirements[0].version).toBe(1); // backtested against v1, not v2
  });

  it("the proof package always cites which requirement version was used, not just the requirement id", () => {
    const requirements = new RequirementStore();
    const engine = new EligibilityEngine(requirements);
    const req = requirements.create({
      projectId: "p1",
      type: "STAKING",
      description: "Stake 100+",
      source: "https://official.io",
      minimum: 100,
    });
    requirements.supersede(req.requirementId, { minimum: 200 });

    const proof = engine.evaluate({
      projectId: "p1",
      wallet: "0xABC",
      requirementIds: [req.requirementId],
      activities: [
        { activityId: "a1", wallet: "0xABC", account: null, type: "stake", timestamp: new Date().toISOString(), block: null, value: 250, chain: null },
      ],
    });

    expect(proof.requirements[0]).toEqual({ requirementId: req.requirementId, version: 2 });
    expect(proof.calculation).toContain("historically valid");
  });
});
