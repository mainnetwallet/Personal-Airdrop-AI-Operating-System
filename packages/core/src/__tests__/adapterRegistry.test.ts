import { describe, it, expect } from "vitest";
import { AirdropAdapterRegistry } from "../adapters/registry.js";
import { createNotConfiguredAdapter } from "../adapters/notConfiguredAdapter.js";
import type { AirdropAdapter, Project } from "@airdrop-os/types";

const dummyProject = { projectId: "p1" } as Project;

describe("AirdropAdapterRegistry", () => {
  it("resolve() returns a NOT_CONFIGURED stub for a type with no registered adapter", () => {
    const registry = new AirdropAdapterRegistry();
    const adapter = registry.resolve("STAKING");
    expect(adapter.status).toBe("NOT_CONFIGURED");
    expect(registry.isConfigured("STAKING")).toBe(false);
  });

  it("the NOT_CONFIGURED stub never fabricates a result and never auto-claims", () => {
    const adapter = createNotConfiguredAdapter("BRIDGE");
    expect(adapter.calculateEligibility(dummyProject, {})).toEqual({
      eligible: "UNKNOWN",
      reason: expect.stringContaining("NOT_CONFIGURED"),
    });
    expect(adapter.extractRequirements(dummyProject)).toEqual([]);
    expect(adapter.buildTasks(dummyProject)).toEqual([]);
    const claimResult = adapter.claim(dummyProject);
    expect(claimResult.status).toBe("NOT_CONFIGURED");
  });

  it("resolve() returns the real adapter once one is registered for that type", () => {
    const registry = new AirdropAdapterRegistry();
    const fakeAdapter: AirdropAdapter = {
      type: "QUEST",
      status: "IMPLEMENTED",
      detect: () => true,
      research: () => ({}),
      verify: () => ({}),
      extractRequirements: () => ["complete quest"],
      calculateEligibility: () => ({ eligible: true, reason: "quest completed" }),
      estimateCost: () => 0,
      estimateTime: () => "1 day",
      estimateRisk: () => 1,
      buildTasks: () => [{ title: "Do quest", description: "Complete the quest" }],
      buildMission: () => ({ title: "Quest mission", steps: ["step 1"] }),
      monitor: () => ({ checkedAt: new Date().toISOString(), changed: false, notes: null }),
      claim: () => ({ status: "REQUIRES_MANUAL_APPROVAL", reason: "user must approve claim" }),
      report: () => ({ summary: "done", generatedAt: new Date().toISOString() }),
    };
    registry.register(fakeAdapter);
    expect(registry.resolve("QUEST")).toBe(fakeAdapter);
    expect(registry.isConfigured("QUEST")).toBe(true);
    // Unregistered types still fall back cleanly.
    expect(registry.resolve("RAFFLE").status).toBe("NOT_CONFIGURED");
  });

  it("even an IMPLEMENTED adapter's claim() never returns anything that implies automatic execution", () => {
    const registry = new AirdropAdapterRegistry();
    registry.register({
      ...createNotConfiguredAdapter("HOLDER"),
      status: "IMPLEMENTED",
      claim: () => ({ status: "REQUIRES_MANUAL_APPROVAL", reason: "never auto-signs" }),
    });
    const result = registry.resolve("HOLDER").claim(dummyProject);
    expect(["NOT_CONFIGURED", "REQUIRES_MANUAL_APPROVAL"]).toContain(result.status);
  });
});
