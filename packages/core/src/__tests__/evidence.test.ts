import { describe, it, expect } from "vitest";
import { EvidenceGraph, hashContent, UnknownSourceError, UnknownClaimError } from "../evidence.js";

describe("EvidenceGraph", () => {
  it("adds a source and retrieves it", () => {
    const graph = new EvidenceGraph();
    const source = graph.addSource({ url: "https://example.xyz/docs", sourceType: "OFFICIAL_DOC" });
    expect(graph.getSource(source.sourceId)).toEqual(source);
  });

  it("throws UnknownSourceError for an unregistered source", () => {
    const graph = new EvidenceGraph();
    expect(() => graph.getSource("nope")).toThrow(UnknownSourceError);
  });

  it("snapshot() content-hashes and knowledge-versions each snapshot", () => {
    const graph = new EvidenceGraph();
    const source = graph.addSource({ url: "https://x.io", sourceType: "OFFICIAL_ANNOUNCEMENT" });
    const s1 = graph.snapshot(source.sourceId, { tge: "Q3 2026" });
    const s2 = graph.snapshot(source.sourceId, { tge: "Q4 2026" });
    expect(s1.contentHash).toBe(hashContent({ tge: "Q3 2026" }));
    expect(s2.knowledgeVersion).toBeGreaterThan(s1.knowledgeVersion);
  });

  it("diff() reports NO_PRIOR_SNAPSHOT on the first snapshot, then UNCHANGED/CHANGED", () => {
    const graph = new EvidenceGraph();
    const source = graph.addSource({ url: "https://x.io", sourceType: "OFFICIAL_DOC" });
    graph.snapshot(source.sourceId, { status: "live" });
    expect(graph.diff(source.sourceId).status).toBe("NO_PRIOR_SNAPSHOT");

    graph.snapshot(source.sourceId, { status: "live" });
    expect(graph.diff(source.sourceId).status).toBe("UNCHANGED");

    graph.snapshot(source.sourceId, { status: "paused" });
    expect(graph.diff(source.sourceId).status).toBe("CHANGED");
  });

  it("addEvidence() carries full lineage: source, url, type, hash, knowledge version", () => {
    const graph = new EvidenceGraph();
    const source = graph.addSource({ url: "https://x.io/tge", sourceType: "PRIMARY_OFFICIAL" });
    const claim = graph.addClaim({ projectId: "p1", field: "tgeDate", value: "2026-09-01" });
    const evidence = graph.addEvidence({ claimId: claim.claimId, sourceId: source.sourceId, content: "2026-09-01" });
    expect(evidence.url).toBe("https://x.io/tge");
    expect(evidence.sourceType).toBe("PRIMARY_OFFICIAL");
    expect(evidence.contentHash).toBe(hashContent("2026-09-01"));
    expect(evidence.knowledgeVersion).toBeGreaterThan(0);
  });

  it("throws UnknownClaimError when attaching evidence to a nonexistent claim", () => {
    const graph = new EvidenceGraph();
    const source = graph.addSource({ url: "https://x.io", sourceType: "COMMUNITY" });
    expect(() => graph.addEvidence({ claimId: "nope", sourceId: source.sourceId, content: "x" })).toThrow(
      UnknownClaimError
    );
  });

  it("detectContradiction() reports no contradiction when all evidence agrees", () => {
    const graph = new EvidenceGraph();
    const claim = graph.addClaim({ projectId: "p1", field: "chain", value: "Base" });
    const s1 = graph.addSource({ url: "https://a.io", sourceType: "OFFICIAL_DOC" });
    const s2 = graph.addSource({ url: "https://b.io", sourceType: "TRUSTED_RESEARCH" });
    graph.addEvidence({ claimId: claim.claimId, sourceId: s1.sourceId, content: "Base" });
    graph.addEvidence({ claimId: claim.claimId, sourceId: s2.sourceId, content: "Base" });
    const result = graph.detectContradiction(claim.claimId);
    expect(result.contradicted).toBe(false);
    expect(result.resolved).toBe("Base");
  });

  it("detectContradiction() resolves in favor of PRIMARY_OFFICIAL over COMMUNITY, regardless of order", () => {
    const graph = new EvidenceGraph();
    const claim = graph.addClaim({ projectId: "p1", field: "tgeDate", value: null });
    const community = graph.addSource({ url: "https://discord.gg/rumor", sourceType: "COMMUNITY" });
    const official = graph.addSource({ url: "https://official.io/tge", sourceType: "PRIMARY_OFFICIAL" });

    // community evidence arrives first...
    graph.addEvidence({ claimId: claim.claimId, sourceId: community.sourceId, content: "2026-08-01" });
    // ...but official evidence still wins the resolution.
    graph.addEvidence({ claimId: claim.claimId, sourceId: official.sourceId, content: "2026-09-01" });

    const result = graph.detectContradiction(claim.claimId);
    expect(result.contradicted).toBe(true);
    expect(result.resolved).toBe("2026-09-01");
    expect(result.conflictingValues).toContain("2026-08-01");
    expect(result.conflictingValues).toContain("2026-09-01");
  });

  it("detectContradiction() prefers PRIMARY_OFFICIAL even when many low-tier sources agree with each other", () => {
    const graph = new EvidenceGraph();
    const claim = graph.addClaim({ projectId: "p1", field: "supply", value: null });
    const official = graph.addSource({ url: "https://official.io", sourceType: "PRIMARY_OFFICIAL" });
    graph.addEvidence({ claimId: claim.claimId, sourceId: official.sourceId, content: "1000000000" });

    for (let i = 0; i < 5; i++) {
      const rumor = graph.addSource({ url: `https://rumor${i}.io`, sourceType: "RUMOR" });
      graph.addEvidence({ claimId: claim.claimId, sourceId: rumor.sourceId, content: "2100000000" });
    }

    const result = graph.detectContradiction(claim.claimId);
    expect(result.contradicted).toBe(true);
    expect(result.resolved).toBe("1000000000");
  });
});
