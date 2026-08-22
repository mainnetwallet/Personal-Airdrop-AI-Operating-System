import { describe, it, expect } from "vitest";
import { ResearchEngine } from "../researchEngine.js";

describe("ResearchEngine", () => {
  it("discover() registers a source, retrieve() snapshots supplied content without any network call", () => {
    const engine = new ResearchEngine();
    const source = engine.discover({ url: "https://project.xyz", sourceType: "OFFICIAL_DOC" });
    const snapshot = engine.retrieve(source.sourceId, { status: "live" });
    expect(snapshot.sourceId).toBe(source.sourceId);
    expect(engine.reputation.get(source.sourceId).availability).toBe(1);
  });

  it("markUnavailable() lowers a source's availability without a snapshot", () => {
    const engine = new ResearchEngine();
    const source = engine.discover({ url: "https://flaky.xyz", sourceType: "COMMUNITY" });
    engine.markUnavailable(source.sourceId);
    expect(engine.reputation.get(source.sourceId).availability).toBeLessThan(1);
  });

  it("normalize() flattens raw content into field/value records", () => {
    const engine = new ResearchEngine();
    const records = engine.normalize({ chain: "Base", tgeDate: "2026-09-01" });
    expect(records).toEqual([
      { field: "chain", value: "Base" },
      { field: "tgeDate", value: "2026-09-01" },
    ]);
  });

  it("deduplicate() flags a record for a field that already has a claim, even with a different value", () => {
    const engine = new ResearchEngine();
    const source = engine.discover({ url: "https://a.io", sourceType: "OFFICIAL_DOC" });
    engine.ingest("proj-1", source.sourceId, { field: "chain", value: "Base" });

    // Same value: still matches the existing claim.
    const [dup] = engine.deduplicate("proj-1", [{ field: "chain", value: "Base" }]);
    expect(dup.isDuplicate).toBe(true);
    expect(dup.claimId).not.toBeNull();

    // Different value for the *same field*: still matches — a claim is
    // the slot for that field, so a conflicting value must land as
    // competing evidence on it (see the CONFLICTED test), not a
    // separate, never-compared claim.
    const [conflicting] = engine.deduplicate("proj-1", [{ field: "chain", value: "Optimism" }]);
    expect(conflicting.isDuplicate).toBe(true);
    expect(conflicting.claimId).toBe(dup.claimId);

    // A genuinely new field has no match.
    const [fresh] = engine.deduplicate("proj-1", [{ field: "tgeDate", value: "2026-09-01" }]);
    expect(fresh.isDuplicate).toBe(false);
  });

  it("ingest() merges a duplicate record as new evidence rather than creating a second claim", () => {
    const engine = new ResearchEngine();
    const s1 = engine.discover({ url: "https://a.io", sourceType: "OFFICIAL_DOC" });
    const s2 = engine.discover({ url: "https://b.io", sourceType: "TRUSTED_RESEARCH" });

    const claim1 = engine.ingest("proj-1", s1.sourceId, { field: "chain", value: "Base" });
    const claim2 = engine.ingest("proj-1", s2.sourceId, { field: "chain", value: "Base" });

    expect(claim2.claimId).toBe(claim1.claimId);
    expect(engine.graph.getEvidence(claim1.claimId)).toHaveLength(2);
    expect(engine.graph.claimsForProject("proj-1")).toHaveLength(1);
  });

  it("verify() returns VERIFIED once high-tier evidence backs a claim", () => {
    const engine = new ResearchEngine();
    const source = engine.discover({ url: "https://official.io", sourceType: "PRIMARY_OFFICIAL" });
    const claim = engine.ingest("proj-1", source.sourceId, { field: "tgeDate", value: "2026-09-01" });
    expect(claim.confidence).toBe("VERIFIED");
  });

  it("verify() returns SPECULATIVE for community-only evidence and LIKELY for trusted research", () => {
    const engine = new ResearchEngine();
    const community = engine.discover({ url: "https://discord.gg/x", sourceType: "COMMUNITY" });
    const speculative = engine.ingest("proj-1", community.sourceId, { field: "airdropRumor", value: true });
    expect(speculative.confidence).toBe("SPECULATIVE");

    const research = engine.discover({ url: "https://research.io", sourceType: "TRUSTED_RESEARCH" });
    const likely = engine.ingest("proj-1", research.sourceId, { field: "estimatedValue", value: "500" });
    expect(likely.confidence).toBe("LIKELY");
  });

  it("verify() returns CONFLICTED once contradicting evidence is attached, even after being VERIFIED", () => {
    const engine = new ResearchEngine();
    const official = engine.discover({ url: "https://official.io", sourceType: "PRIMARY_OFFICIAL" });
    const claim = engine.ingest("proj-1", official.sourceId, { field: "tgeDate", value: "2026-09-01" });
    expect(claim.confidence).toBe("VERIFIED");

    const rival = engine.discover({ url: "https://official2.io", sourceType: "OFFICIAL_ANNOUNCEMENT" });
    const reIngested = engine.ingest("proj-1", rival.sourceId, { field: "tgeDate", value: "2026-10-01" });
    expect(reIngested.confidence).toBe("CONFLICTED");
  });

  it("isStale() is true only when every evidence row predates the cutoff", () => {
    const engine = new ResearchEngine();
    const source = engine.discover({ url: "https://a.io", sourceType: "OFFICIAL_DOC" });
    const claim = engine.ingest("proj-1", source.sourceId, { field: "chain", value: "Base" });
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(engine.isStale(claim.claimId, future)).toBe(true);
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(engine.isStale(claim.claimId, past)).toBe(false);
  });
});
