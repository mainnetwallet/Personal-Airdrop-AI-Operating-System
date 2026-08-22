import { describe, expect, it } from "vitest";
import { GlobalSearchIndex } from "../globalSearch.js";
import { ProjectStore } from "../project.js";
import { CampaignStore } from "../campaign.js";
import { TaskGraph } from "../task.js";
import { MissionStore } from "../mission.js";
import { WalletStore } from "../wallet.js";
import { RequirementStore } from "../requirement.js";
import {
  campaignToSearchRecord,
  missionToSearchRecord,
  projectToSearchRecord,
  reindexAll,
  requirementToSearchRecord,
  taskToSearchRecord,
  walletToSearchRecord,
} from "../searchIndexers.js";

describe("searchIndexers", () => {
  it("maps a Project to a SearchableRecord and it becomes findable", () => {
    const projects = new ProjectStore();
    const project = projects.create({ name: "LayerZero", slug: "layerzero", category: "Interoperability" });
    const index = new GlobalSearchIndex();
    reindexAll(index, "PROJECT", projects.list(), projectToSearchRecord);

    const results = index.search("LayerZero");
    expect(results[0]?.entityId).toBe(project.projectId);
    expect(results[0]?.entityType).toBe("PROJECT");
  });

  it("maps a Campaign to a SearchableRecord", () => {
    const campaigns = new CampaignStore();
    const campaign = campaigns.create({ projectId: "p1", name: "Retroactive Season 1" });
    const index = new GlobalSearchIndex();
    reindexAll(index, "CAMPAIGN", campaigns.listAll(), campaignToSearchRecord);

    const results = index.search("Retroactive Season");
    expect(results[0]?.entityId).toBe(campaign.campaignId);
  });

  it("maps a Task to a SearchableRecord", () => {
    const tasks = new TaskGraph();
    const task = tasks.addTask({ missionId: "m1", type: "BRIDGE", title: "Bridge to Base", description: "Bridge 0.01 ETH" });
    const index = new GlobalSearchIndex();
    reindexAll(index, "TASK", tasks.listAll(), taskToSearchRecord);

    const results = index.search("Bridge to Base");
    expect(results[0]?.entityId).toBe(task.taskId);
  });

  it("maps a Mission to a SearchableRecord", () => {
    const missions = new MissionStore();
    const mission = missions.create({ projectId: "p1", objective: "Qualify for Season 1 airdrop" });
    const index = new GlobalSearchIndex();
    reindexAll(index, "MISSION", missions.listAll(), missionToSearchRecord);

    const results = index.search("Qualify for Season 1");
    expect(results[0]?.entityId).toBe(mission.missionId);
  });

  it("maps a Wallet to a SearchableRecord", () => {
    const wallets = new WalletStore();
    const wallet = wallets.register({ address: "0xabc123", label: "MAIN", chains: ["base"] });
    const index = new GlobalSearchIndex();
    reindexAll(index, "WALLET", wallets.listAll(), walletToSearchRecord);

    const results = index.search("0xabc123");
    expect(results[0]?.entityId).toBe(wallet.walletId);
  });

  it("maps a Requirement to a SearchableRecord", () => {
    const requirements = new RequirementStore();
    const requirement = requirements.create({
      projectId: "p1",
      type: "ONCHAIN",
      description: "Complete 10 swaps on Base",
      source: "official-docs",
      chain: "base",
    });
    const index = new GlobalSearchIndex();
    reindexAll(index, "REQUIREMENT", requirements.listAllCurrent(), requirementToSearchRecord);

    const results = index.search("Complete 10 swaps on Base");
    expect(results[0]?.entityId).toBe(requirement.requirementId);
  });

  it("reindexAll is idempotent — calling it twice does not duplicate results", () => {
    const projects = new ProjectStore();
    projects.create({ name: "LayerZero", slug: "layerzero" });
    const index = new GlobalSearchIndex();
    reindexAll(index, "PROJECT", projects.list(), projectToSearchRecord);
    reindexAll(index, "PROJECT", projects.list(), projectToSearchRecord);

    expect(index.search("LayerZero")).toHaveLength(1);
  });

  it("reindexAll clears stale entries for entities no longer in the source list", () => {
    const index = new GlobalSearchIndex();
    // Simulate a previous sync that included an entity later removed from the store.
    index.upsert({ entityType: "PROJECT", entityId: "stale-1", label: "Stale Project", searchableText: "" });
    reindexAll(index, "PROJECT", [], projectToSearchRecord);

    expect(index.search("Stale Project")).toEqual([]);
  });

  it("reindexAll does not disturb records of a different entityType", () => {
    const index = new GlobalSearchIndex();
    index.upsert({ entityType: "WALLET", entityId: "w1", label: "0xdef", searchableText: "MAIN" });
    reindexAll(index, "PROJECT", [], projectToSearchRecord);

    expect(index.search("0xdef")[0]?.entityId).toBe("w1");
  });

  it("multiple entity types can coexist in one index after separate reindexAll calls", () => {
    const projects = new ProjectStore();
    projects.create({ name: "Scroll", slug: "scroll" });
    const wallets = new WalletStore();
    wallets.register({ address: "0xscroll", label: "MAIN", chains: ["scroll"] });

    const index = new GlobalSearchIndex();
    reindexAll(index, "PROJECT", projects.list(), projectToSearchRecord);
    reindexAll(index, "WALLET", wallets.listAll(), walletToSearchRecord);

    expect(index.search("Scroll").map((r) => r.entityType).sort()).toEqual(["PROJECT", "WALLET"]);
  });
});
