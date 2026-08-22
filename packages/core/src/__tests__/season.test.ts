import { describe, expect, it } from "vitest";
import { SeasonStore, UnknownEpochError, UnknownSeasonError } from "../season.js";

describe("SeasonStore", () => {
  it("creates a season with UPCOMING status", () => {
    const store = new SeasonStore();
    const season = store.createSeason({ campaignId: "campaign-1", name: "Season 1" });
    expect(season.status).toBe("UPCOMING");
    expect(season.campaignId).toBe("campaign-1");
  });

  it("throws UnknownSeasonError for a missing season", () => {
    const store = new SeasonStore();
    expect(() => store.getSeason("missing")).toThrow(UnknownSeasonError);
  });

  it("transitions season status", () => {
    const store = new SeasonStore();
    const season = store.createSeason({ campaignId: "c1", name: "S1" });
    const updated = store.setSeasonStatus(season.seasonId, "ACTIVE");
    expect(updated.status).toBe("ACTIVE");
  });

  it("finds the single active season for a campaign", () => {
    const store = new SeasonStore();
    const s1 = store.createSeason({ campaignId: "c1", name: "S1" });
    store.createSeason({ campaignId: "c1", name: "S2" });
    store.setSeasonStatus(s1.seasonId, "ACTIVE");
    const active = store.activeSeasonFor("c1");
    expect(active).not.toBe("NONE");
    expect(active).not.toBe("CONFLICTED");
    if (active !== "NONE" && active !== "CONFLICTED") {
      expect(active.seasonId).toBe(s1.seasonId);
    }
  });

  it("returns NONE when no season is active", () => {
    const store = new SeasonStore();
    store.createSeason({ campaignId: "c1", name: "S1" });
    expect(store.activeSeasonFor("c1")).toBe("NONE");
  });

  it("flags CONFLICTED when two seasons are simultaneously active rather than silently picking one", () => {
    const store = new SeasonStore();
    const s1 = store.createSeason({ campaignId: "c1", name: "S1" });
    const s2 = store.createSeason({ campaignId: "c1", name: "S2" });
    store.setSeasonStatus(s1.seasonId, "ACTIVE");
    store.setSeasonStatus(s2.seasonId, "ACTIVE");
    expect(store.activeSeasonFor("c1")).toBe("CONFLICTED");
  });

  it("creates epochs under a season, ordered by index", () => {
    const store = new SeasonStore();
    const season = store.createSeason({ campaignId: "c1", name: "S1" });
    store.createEpoch({ seasonId: season.seasonId, index: 2 });
    store.createEpoch({ seasonId: season.seasonId, index: 1 });
    const epochs = store.epochsForSeason(season.seasonId);
    expect(epochs.map((e) => e.index)).toEqual([1, 2]);
  });

  it("refuses to create an epoch under an unknown season", () => {
    const store = new SeasonStore();
    expect(() => store.createEpoch({ seasonId: "missing", index: 1 })).toThrow(UnknownSeasonError);
  });

  it("throws UnknownEpochError for a missing epoch", () => {
    const store = new SeasonStore();
    expect(() => store.getEpoch("missing")).toThrow(UnknownEpochError);
  });

  it("records a snapshot and moves epoch status to SNAPSHOT_TAKEN", () => {
    const store = new SeasonStore();
    const season = store.createSeason({ campaignId: "c1", name: "S1" });
    const epoch = store.createEpoch({ seasonId: season.seasonId, index: 1 });
    const updated = store.recordSnapshot(epoch.epochId, 123456);
    expect(updated.status).toBe("SNAPSHOT_TAKEN");
    expect(updated.snapshotBlock).toBe(123456);
    expect(updated.snapshotAt).not.toBeNull();
  });

  it("records points awarded for an epoch", () => {
    const store = new SeasonStore();
    const season = store.createSeason({ campaignId: "c1", name: "S1" });
    const epoch = store.createEpoch({ seasonId: season.seasonId, index: 1 });
    const updated = store.recordPointsAwarded(epoch.epochId, 500);
    expect(updated.pointsAwarded).toBe(500);
  });

  it("finds the current (ACTIVE or SNAPSHOT_PENDING) epoch for a season", () => {
    const store = new SeasonStore();
    const season = store.createSeason({ campaignId: "c1", name: "S1" });
    const e1 = store.createEpoch({ seasonId: season.seasonId, index: 1 });
    store.setEpochStatus(e1.epochId, "ENDED");
    const e2 = store.createEpoch({ seasonId: season.seasonId, index: 2 });
    store.setEpochStatus(e2.epochId, "ACTIVE");
    const current = store.currentEpochFor(season.seasonId);
    expect(current).not.toBe("NONE");
    if (current !== "NONE") expect(current.epochId).toBe(e2.epochId);
  });

  it("returns NONE for currentEpochFor when no epoch is active or pending snapshot", () => {
    const store = new SeasonStore();
    const season = store.createSeason({ campaignId: "c1", name: "S1" });
    const e1 = store.createEpoch({ seasonId: season.seasonId, index: 1 });
    store.setEpochStatus(e1.epochId, "ENDED");
    expect(store.currentEpochFor(season.seasonId)).toBe("NONE");
  });
});
