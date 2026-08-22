import { describe, expect, it } from "vitest";
import { ShadowAgentLedger } from "../shadowAgent.js";

describe("ShadowAgentLedger", () => {
  it("records a comparison and detects agreement", () => {
    const ledger = new ShadowAgentLedger();
    const result = ledger.compare({ liveRecommendation: "DO", shadowRecommendation: "DO" });
    expect(result.agree).toBe(true);
  });

  it("detects divergence between live and shadow recommendations", () => {
    const ledger = new ShadowAgentLedger();
    const result = ledger.compare({ liveRecommendation: "DO", shadowRecommendation: "WAIT" });
    expect(result.agree).toBe(false);
  });

  it("computes agreement rate across comparisons", () => {
    const ledger = new ShadowAgentLedger();
    ledger.compare({ liveRecommendation: "DO", shadowRecommendation: "DO" });
    ledger.compare({ liveRecommendation: "DO", shadowRecommendation: "WAIT" });
    expect(ledger.agreementRate()).toBe(0.5);
  });

  it("returns null agreement rate with no comparisons", () => {
    const ledger = new ShadowAgentLedger();
    expect(ledger.agreementRate()).toBeNull();
  });

  it("lists only divergent comparisons", () => {
    const ledger = new ShadowAgentLedger();
    ledger.compare({ liveRecommendation: "DO", shadowRecommendation: "DO" });
    ledger.compare({ liveRecommendation: "SKIP", shadowRecommendation: "DO" });
    const divergences = ledger.divergences();
    expect(divergences).toHaveLength(1);
    expect(divergences[0].liveRecommendation).toBe("SKIP");
  });
});
