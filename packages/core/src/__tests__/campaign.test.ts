import { describe, it, expect } from "vitest";
import { CampaignStore, UnknownCampaignError } from "../campaign.js";

describe("CampaignStore", () => {
  it("creates a campaign starting at DISCOVERY with an empty timeline", () => {
    const store = new CampaignStore();
    const campaign = store.create({ projectId: "p1", name: "Season 1" });
    expect(campaign.currentPhase).toBe("DISCOVERY");
    expect(campaign.timeline).toEqual([]);
  });

  it("throws on an unknown campaignId", () => {
    const store = new CampaignStore();
    expect(() => store.get("nope")).toThrow(UnknownCampaignError);
  });

  it("recordPhase() appends to the timeline and advances currentPhase", () => {
    const store = new CampaignStore();
    const campaign = store.create({ projectId: "p1", name: "Season 1" });
    store.recordPhase(campaign.campaignId, "ANNOUNCEMENT", null, "official tweet");
    const updated = store.recordPhase(campaign.campaignId, "TESTNET");
    expect(updated.currentPhase).toBe("TESTNET");
    expect(store.timelineFor(campaign.campaignId)).toHaveLength(2);
  });

  it("recordPhase() allows skipping phases out of the canonical order (external process, not validated)", () => {
    const store = new CampaignStore();
    const campaign = store.create({ projectId: "p1", name: "Season 1" });
    // Jumps straight from DISCOVERY to SNAPSHOT, skipping everything between.
    const updated = store.recordPhase(campaign.campaignId, "SNAPSHOT");
    expect(updated.currentPhase).toBe("SNAPSHOT");
  });

  it("listForProject() returns only campaigns for that project", () => {
    const store = new CampaignStore();
    store.create({ projectId: "p1", name: "A" });
    store.create({ projectId: "p2", name: "B" });
    expect(store.listForProject("p1")).toHaveLength(1);
  });
});
