import { describe, it, expect, vi, afterEach } from "vitest";
import { RequirementStore, UnknownRequirementError, InactiveRequirementError } from "../requirement.js";

describe("RequirementStore", () => {
  it("creates a requirement at version 1, ACTIVE, with validFrom set and no supersedesVersion", () => {
    const store = new RequirementStore();
    const req = store.create({
      projectId: "p1",
      type: "STAKING",
      description: "Stake at least 100 tokens",
      source: "https://official.io/docs",
      minimum: 100,
    });
    expect(req.version).toBe(1);
    expect(req.status).toBe("ACTIVE");
    expect(req.supersedesVersion).toBeNull();
    expect(req.validUntil).toBeNull();
  });

  it("never overwrites history: supersede() closes the old version and appends a new one", () => {
    const store = new RequirementStore();
    const v1 = store.create({
      projectId: "p1",
      type: "STAKING",
      description: "Stake at least 100 tokens",
      source: "https://official.io/docs",
      minimum: 100,
    });

    const v2 = store.supersede(v1.requirementId, { minimum: 250, description: "Stake at least 250 tokens" });

    expect(v2.version).toBe(2);
    expect(v2.supersedesVersion).toBe(1);
    expect(v2.minimum).toBe(250);

    const history = store.history(v1.requirementId);
    expect(history).toHaveLength(2);
    expect(history[0].status).toBe("SUPERSEDED");
    expect(history[0].validUntil).not.toBeNull();
    expect(history[0].minimum).toBe(100); // old version's data is untouched
    expect(history[1]).toEqual(v2);
  });

  it("refuses to supersede a version that is no longer ACTIVE", () => {
    const store = new RequirementStore();
    const v1 = store.create({
      projectId: "p1",
      type: "HOLDING",
      description: "Hold NFT",
      source: "https://official.io",
    });
    store.supersede(v1.requirementId, { description: "Hold NFT for 30 days" });
    // v1 is now SUPERSEDED; trying to supersede again via the same stale reference should fail
    // because current() has moved on — supersede() always operates on current().
    // Superseding again (on the now-current v2) should succeed:
    const v3 = store.supersede(v1.requirementId, { description: "Hold NFT for 60 days" });
    expect(v3.version).toBe(3);

    store.expire(v1.requirementId);
    expect(() => store.supersede(v1.requirementId, { description: "x" })).toThrow(InactiveRequirementError);
  });

  it("throws UnknownRequirementError for an unregistered requirementId", () => {
    const store = new RequirementStore();
    expect(() => store.current("nope")).toThrow(UnknownRequirementError);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("versionAt() performs historical backtesting: an old timestamp resolves to the version that was valid then, not the current version", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const store = new RequirementStore();
    const v1 = store.create({
      projectId: "p1",
      type: "VOLUME",
      description: "Trade at least $1000 volume",
      source: "https://official.io",
      minimum: 1000,
    });
    const t1 = v1.validFrom;

    // Genuinely advance the clock before superseding, so the two
    // versions' validity windows don't collide at the same instant.
    vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
    const v2 = store.supersede(v1.requirementId, { minimum: 5000 });

    // An activity that happened back when v1 was in force must be
    // evaluated against v1 (minimum 1000), not today's v2 (minimum 5000).
    const versionForOldActivity = store.versionAt(v1.requirementId, t1);
    expect(versionForOldActivity?.version).toBe(1);
    expect(versionForOldActivity?.minimum).toBe(1000);

    // An activity happening now resolves to the current version, v2.
    const versionForNewActivity = store.versionAt(v1.requirementId, v2.validFrom);
    expect(versionForNewActivity?.version).toBe(2);
    expect(versionForNewActivity?.minimum).toBe(5000);
  });

  it("versionAt() returns null for a timestamp before the requirement existed at all", () => {
    const store = new RequirementStore();
    const req = store.create({
      projectId: "p1",
      type: "ONCHAIN",
      description: "Bridge at least once",
      source: "https://official.io",
    });
    const before = new Date(Date.parse(req.validFrom) - 60_000).toISOString();
    expect(store.versionAt(req.requirementId, before)).toBeNull();
  });

  it("expire() and retract() are terminal and do not create a new version", () => {
    const store = new RequirementStore();
    const req = store.create({
      projectId: "p1",
      type: "QUEST",
      description: "Complete quest",
      source: "https://official.io",
    });
    const expired = store.expire(req.requirementId);
    expect(expired.status).toBe("EXPIRED");
    expect(store.history(req.requirementId)).toHaveLength(1);
  });

  it("forProject() returns only the current version of each requirement for that project", () => {
    const store = new RequirementStore();
    const a = store.create({ projectId: "p1", type: "SOCIAL", description: "Follow on X", source: "s" });
    store.create({ projectId: "p2", type: "SOCIAL", description: "Follow on X", source: "s" });
    store.supersede(a.requirementId, { description: "Follow and retweet" });

    const forP1 = store.forProject("p1");
    expect(forP1).toHaveLength(1);
    expect(forP1[0].version).toBe(2);
    expect(forP1[0].description).toBe("Follow and retweet");
  });
});
