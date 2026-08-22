import { describe, it, expect } from "vitest";
import { scoreOpportunity } from "../chain/opportunityRadar.js";

describe("scoreOpportunity", () => {
  it("scores a strong, well-evidenced, low-risk opportunity highly", () => {
    const result = scoreOpportunity({
      officialEvidenceStrength: 0.9,
      projectQuality: 0.9,
      cost: 0.1,
      time: 0.1,
      risk: 0.1,
      deadlinePressure: 0.3,
      competition: 0.2,
      userFit: 0.8,
      confidence: "VERIFIED",
    });
    expect(result.score).toBeGreaterThan(0.5);
  });

  it("caps the score low for SPECULATIVE confidence regardless of other inputs", () => {
    const result = scoreOpportunity({
      officialEvidenceStrength: 1,
      projectQuality: 1,
      cost: 0,
      time: 0,
      risk: 0,
      deadlinePressure: 1,
      competition: 0,
      userFit: 1,
      confidence: "SPECULATIVE",
    });
    expect(result.score).toBeLessThanOrEqual(0.25);
  });

  it("never produces a negative score or one above 1", () => {
    const result = scoreOpportunity({
      officialEvidenceStrength: 0, projectQuality: 0, cost: 1, time: 1, risk: 1,
      deadlinePressure: 0, competition: 1, userFit: 0, confidence: "VERIFIED",
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("rejects an out-of-range input", () => {
    expect(() =>
      scoreOpportunity({
        officialEvidenceStrength: 1.5, projectQuality: 0.5, cost: 0.5, time: 0.5,
        risk: 0.5, deadlinePressure: 0.5, competition: 0.5, userFit: 0.5, confidence: "LIKELY",
      })
    ).toThrow();
  });

  it("returns a breakdown so the score is explainable, not a black box", () => {
    const result = scoreOpportunity({
      officialEvidenceStrength: 0.5, projectQuality: 0.5, cost: 0.5, time: 0.5,
      risk: 0.5, deadlinePressure: 0.5, competition: 0.5, userFit: 0.5, confidence: "LIKELY",
    });
    expect(result.breakdown).toHaveProperty("positive");
    expect(result.breakdown).toHaveProperty("negative");
  });
});
