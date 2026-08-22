import { describe, it, expect } from "vitest";
import type { Project } from "@airdrop-os/types";
import { AirdropAdapterRegistry } from "../adapters/registry.js";
import { IntegrationRegistry } from "../integrations/integrationRegistry.js";
import { registerPhase8Adapters, PHASE8_CATEGORY_SPECS } from "../adapters/phase8Adapters.js";

const dummyProject = { projectId: "p1" } as Project;

function buildRegistry() {
  const integrations = new IntegrationRegistry();
  const registry = new AirdropAdapterRegistry();
  registerPhase8Adapters(registry, integrations);
  return { integrations, registry };
}

describe("registerPhase8Adapters", () => {
  it("registers an IMPLEMENTED mock adapter for every type in every category spec", () => {
    const { registry } = buildRegistry();
    for (const spec of PHASE8_CATEGORY_SPECS) {
      for (const type of spec.types) {
        expect(registry.isConfigured(type)).toBe(true);
        expect(registry.resolve(type).status).toBe("IMPLEMENTED");
      }
    }
  });

  it("never fabricates eligibility as true/false with no live integration connected", () => {
    const { registry } = buildRegistry();
    const adapter = registry.resolve("DISCORD");
    const result = adapter.calculateEligibility(dummyProject, {});
    expect(result.eligible).toBe("UNKNOWN");
  });

  it("claim() is always NOT_CONFIGURED for a mock adapter, never automatic", () => {
    const { registry } = buildRegistry();
    for (const type of ["QUEST", "GITHUB", "REFERRAL", "TRADING", "EXCHANGE_CAMPAIGN"] as const) {
      const result = registry.resolve(type).claim(dummyProject);
      expect(result.status).toBe("NOT_CONFIGURED");
    }
  });

  it("prediction/trading and exchange adapters never expose any execute/trade/auto-claim capability", () => {
    const { registry } = buildRegistry();
    for (const type of ["PREDICTION_MARKET", "TRADING", "EXCHANGE_CAMPAIGN"] as const) {
      const adapter = registry.resolve(type);
      expect(Object.keys(adapter)).not.toContain("executeTrade");
      expect(Object.keys(adapter)).not.toContain("autoClaim");
      expect(adapter.claim(dummyProject).status).toBe("NOT_CONFIGURED");
    }
  });

  it("monitor() reflects IntegrationRegistry state instead of fabricating live polling", () => {
    const { registry, integrations } = buildRegistry();
    const before = registry.resolve("GITHUB").monitor(dummyProject);
    expect(before.notes).toContain("NOT_CONFIGURED");

    integrations.setStatus("GITHUB", "CONNECTED", "token verified");
    const after = registry.resolve("GITHUB").monitor(dummyProject);
    expect(after.notes).not.toContain("NOT_CONFIGURED");
    expect(after.changed).toBe(false);
  });

  it("research() surfaces the underlying integration state for the caller", () => {
    const { registry } = buildRegistry();
    const research = registry.resolve("DEPIN").research(dummyProject) as { integrations: Array<{ status: string }> };
    expect(research.integrations[0].status).toBe("NOT_CONFIGURED");
  });

  it("AirdropTypes outside Phase 8's scope are untouched (still NOT_CONFIGURED stub)", () => {
    const { registry } = buildRegistry();
    expect(registry.resolve("STAKING").status).toBe("NOT_CONFIGURED");
  });
});
