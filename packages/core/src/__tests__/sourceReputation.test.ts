import { describe, it, expect } from "vitest";
import { SourceReputationTracker } from "../sourceReputation.js";

describe("SourceReputationTracker", () => {
  it("starts a new source at neutral 0.5 reputation with no history", () => {
    const tracker = new SourceReputationTracker();
    const record = tracker.get("s1");
    expect(record.correctCount).toBe(0);
    expect(record.incorrectCount).toBe(0);
    expect(record.reputationScore).toBe(0.5);
  });

  it("recordOutcome() raises reputation on accurate outcomes and lowers it on inaccurate ones", () => {
    const tracker = new SourceReputationTracker();
    for (let i = 0; i < 5; i++) tracker.recordOutcome("good", true);
    for (let i = 0; i < 5; i++) tracker.recordOutcome("bad", false);
    expect(tracker.get("good").reputationScore).toBeGreaterThan(tracker.get("bad").reputationScore);
  });

  it("recordAvailability() uses an EMA so a single failure doesn't zero the score", () => {
    const tracker = new SourceReputationTracker();
    for (let i = 0; i < 10; i++) tracker.recordAvailability("s1", true);
    const beforeFailure = tracker.get("s1").availability;
    tracker.recordAvailability("s1", false);
    const afterFailure = tracker.get("s1").availability;
    expect(afterFailure).toBeLessThan(beforeFailure);
    expect(afterFailure).toBeGreaterThan(0);
  });

  it("recordFreshness() scores 0 once content age reaches the staleness threshold", () => {
    const tracker = new SourceReputationTracker();
    const record = tracker.recordFreshness("s1", 100_000, 100_000);
    expect(record.freshnessScore).toBe(0);
    const fresher = tracker.recordFreshness("s1", 0, 100_000);
    expect(fresher.freshnessScore).toBe(1);
  });

  it("does not let reputation influence evidence contradiction resolution (weighting-only, enforced in evidence.ts)", () => {
    // This tracker has no API to resolve contradictions — that's a
    // deliberate design boundary. Confirming its surface has no such
    // method guards against that boundary eroding later.
    const tracker = new SourceReputationTracker();
    expect((tracker as unknown as { resolveContradiction?: unknown }).resolveContradiction).toBeUndefined();
  });
});
