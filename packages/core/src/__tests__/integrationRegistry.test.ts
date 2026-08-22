import { describe, it, expect } from "vitest";
import { IntegrationRegistry } from "../integrations/integrationRegistry.js";

describe("IntegrationRegistry", () => {
  it("every known provider starts NOT_CONFIGURED", () => {
    const registry = new IntegrationRegistry();
    for (const state of registry.allStates()) {
      expect(state.status).toBe("NOT_CONFIGURED");
    }
    expect(registry.isConnected("DISCORD")).toBe(false);
  });

  it("an unregistered/unknown provider also resolves to NOT_CONFIGURED, never throws", () => {
    const registry = new IntegrationRegistry([]);
    const state = registry.getStatus("GITHUB");
    expect(state.status).toBe("NOT_CONFIGURED");
  });

  it("setStatus() only changes status when explicitly called", () => {
    const registry = new IntegrationRegistry();
    expect(registry.isConnected("GITHUB")).toBe(false);
    registry.setStatus("GITHUB", "CONNECTED", "real token verified");
    expect(registry.isConnected("GITHUB")).toBe(true);
    expect(registry.getStatus("GITHUB").detail).toBe("real token verified");
    // Unrelated providers are unaffected.
    expect(registry.isConnected("DISCORD")).toBe(false);
  });

  it("report() summarizes every provider's status", () => {
    const registry = new IntegrationRegistry(["DISCORD", "GITHUB"]);
    registry.setStatus("DISCORD", "DEGRADED", "rate limited");
    const report = registry.report();
    expect(report).toEqual({ DISCORD: "DEGRADED", GITHUB: "NOT_CONFIGURED" });
  });
});
