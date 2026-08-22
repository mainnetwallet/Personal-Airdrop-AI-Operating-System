import { describe, expect, it } from "vitest";
import { ProviderQuotaTracker } from "../integrations/providerQuota.js";

describe("ProviderQuotaTracker", () => {
  it("reports NOT_CONFIGURED for a provider with no limit", () => {
    const tracker = new ProviderQuotaTracker();
    const record = tracker.register("alchemy-eth", "RPC", null);
    expect(record.status).toBe("NOT_CONFIGURED");
    expect(tracker.canCall("alchemy-eth")).toBe(false);
  });

  it("reports OK when usage is well under limit", () => {
    const tracker = new ProviderQuotaTracker();
    tracker.register("openai", "LLM", 1000);
    expect(tracker.get("openai")?.status).toBe("OK");
    expect(tracker.canCall("openai")).toBe(true);
  });

  it("transitions to NEAR_LIMIT above 90% usage", () => {
    const tracker = new ProviderQuotaTracker();
    tracker.register("etherscan", "EXPLORER", 100);
    const record = tracker.recordUsage("etherscan", 91);
    expect(record.status).toBe("NEAR_LIMIT");
    expect(tracker.canCall("etherscan")).toBe(true);
  });

  it("transitions to EXHAUSTED at limit and blocks calls", () => {
    const tracker = new ProviderQuotaTracker();
    tracker.register("discord", "DISCORD", 10);
    const record = tracker.recordUsage("discord", 10);
    expect(record.status).toBe("EXHAUSTED");
    expect(tracker.canCall("discord")).toBe(false);
  });

  it("reset clears usage and recomputes status", () => {
    const tracker = new ProviderQuotaTracker();
    tracker.register("quest-api", "QUEST", 5);
    tracker.recordUsage("quest-api", 5);
    expect(tracker.get("quest-api")?.status).toBe("EXHAUSTED");
    const reset = tracker.reset("quest-api", "2026-09-01T00:00:00.000Z");
    expect(reset.used).toBe(0);
    expect(reset.status).toBe("OK");
    expect(reset.resetAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("throws for unknown providerId on usage recording", () => {
    const tracker = new ProviderQuotaTracker();
    expect(() => tracker.recordUsage("nope")).toThrow(/Unknown providerId/);
  });
});
