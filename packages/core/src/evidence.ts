/**
 * Evidence graph: claims backed by sources, with content hashing and a
 * monotonic knowledge version so every claim can be traced back to
 * exactly which source, at what URL, of what source type, retrieved
 * when, said what, and under which version of the knowledge base
 * (data lineage).
 *
 * Source reputation (sourceReputation.ts) is deliberately never
 * consulted here to decide which evidence wins a contradiction:
 * detectContradiction() always prefers PRIMARY_OFFICIAL-tier evidence
 * (official docs/contracts/announcements/on-chain) over
 * community/unknown/rumor tiers, regardless of how many
 * lower-tier sources agree or how good their historical reputation is.
 * Reputation can only ever weight confidence *among* same-tier sources.
 */
import { randomUUID, createHash } from "node:crypto";
import type { Source, Snapshot, Claim, Evidence, SourceType } from "@airdrop-os/types";

export function hashContent(content: unknown): string {
  const json = typeof content === "string" ? content : JSON.stringify(content);
  return createHash("sha256").update(json).digest("hex");
}

export class UnknownSourceError extends Error {
  constructor(sourceId: string) {
    super(`Unknown sourceId: ${sourceId}`);
    this.name = "UnknownSourceError";
  }
}

export class UnknownClaimError extends Error {
  constructor(claimId: string) {
    super(`Unknown claimId: ${claimId}`);
    this.name = "UnknownClaimError";
  }
}

// Evidence tier precedence, highest-precedence first. Used only to
// resolve contradictions in favor of stronger evidence.
const SOURCE_PRECEDENCE: readonly SourceType[] = [
  "PRIMARY_OFFICIAL",
  "OFFICIAL_DOC",
  "OFFICIAL_CONTRACT",
  "OFFICIAL_ANNOUNCEMENT",
  "ONCHAIN_EVIDENCE",
  "OFFICIAL_SOCIAL",
  "OFFICIAL_GITHUB",
  "OFFICIAL_DISCORD",
  "TRUSTED_RESEARCH",
  "COMMUNITY",
  "UNKNOWN",
  "RUMOR",
];

export interface ContradictionResult {
  contradicted: boolean;
  resolved: unknown | null;
  conflictingValues: unknown[];
}

export interface DiffResult {
  status: "NO_PRIOR_SNAPSHOT" | "UNCHANGED" | "CHANGED";
  previous: Snapshot | null;
  latest: Snapshot;
}

export class EvidenceGraph {
  private readonly sources = new Map<string, Source>();
  private readonly snapshots = new Map<string, Snapshot[]>();
  private readonly claims = new Map<string, Claim>();
  private readonly evidenceByClaim = new Map<string, Evidence[]>();
  private knowledgeVersion = 0;

  addSource(input: { url: string; sourceType: SourceType }): Source {
    const source: Source = {
      sourceId: randomUUID(),
      url: input.url,
      sourceType: input.sourceType,
      discoveredAt: new Date().toISOString(),
    };
    this.sources.set(source.sourceId, source);
    return source;
  }

  getSource(sourceId: string): Source {
    const source = this.sources.get(sourceId);
    if (!source) throw new UnknownSourceError(sourceId);
    return source;
  }

  /** Records a point-in-time snapshot of a source's content, content-hashed and knowledge-versioned. */
  snapshot(sourceId: string, content: unknown): Snapshot {
    this.getSource(sourceId);
    this.knowledgeVersion += 1;
    const snap: Snapshot = {
      snapshotId: randomUUID(),
      sourceId,
      contentHash: hashContent(content),
      retrievedAt: new Date().toISOString(),
      knowledgeVersion: this.knowledgeVersion,
      content,
    };
    const list = this.snapshots.get(sourceId) ?? [];
    list.push(snap);
    this.snapshots.set(sourceId, list);
    return snap;
  }

  getSnapshots(sourceId: string): Snapshot[] {
    return this.snapshots.get(sourceId) ?? [];
  }

  /** Compares a source's two most recent snapshots for change detection. */
  diff(sourceId: string): DiffResult {
    const list = this.snapshots.get(sourceId) ?? [];
    if (list.length === 0) throw new Error(`No snapshots for source ${sourceId}`);
    const latest = list[list.length - 1];
    if (list.length === 1) return { status: "NO_PRIOR_SNAPSHOT", previous: null, latest };
    const previous = list[list.length - 2];
    return {
      status: previous.contentHash === latest.contentHash ? "UNCHANGED" : "CHANGED",
      previous,
      latest,
    };
  }

  addClaim(input: { projectId: string | null; field: string; value: unknown }): Claim {
    const now = new Date().toISOString();
    const claim: Claim = {
      claimId: randomUUID(),
      projectId: input.projectId,
      field: input.field,
      value: input.value,
      confidence: "UNCERTAIN",
      createdAt: now,
      updatedAt: now,
    };
    this.claims.set(claim.claimId, claim);
    return claim;
  }

  getClaim(claimId: string): Claim {
    const claim = this.claims.get(claimId);
    if (!claim) throw new UnknownClaimError(claimId);
    return claim;
  }

  setClaimConfidence(claimId: string, confidence: Claim["confidence"]): Claim {
    const claim = this.getClaim(claimId);
    claim.confidence = confidence;
    claim.updatedAt = new Date().toISOString();
    return claim;
  }

  /** Attaches sourced evidence to a claim, carrying full lineage (source, url, type, retrievedAt, contentHash, knowledgeVersion). */
  addEvidence(input: { claimId: string; sourceId: string; content: unknown }): Evidence {
    const claim = this.getClaim(input.claimId);
    const source = this.getSource(input.sourceId);
    this.knowledgeVersion += 1;
    const evidence: Evidence = {
      evidenceId: randomUUID(),
      claimId: claim.claimId,
      sourceId: source.sourceId,
      url: source.url,
      sourceType: source.sourceType,
      retrievedAt: new Date().toISOString(),
      content: input.content,
      contentHash: hashContent(input.content),
      knowledgeVersion: this.knowledgeVersion,
      createdAt: new Date().toISOString(),
    };
    const list = this.evidenceByClaim.get(claim.claimId) ?? [];
    list.push(evidence);
    this.evidenceByClaim.set(claim.claimId, list);
    return evidence;
  }

  getEvidence(claimId: string): Evidence[] {
    return this.evidenceByClaim.get(claimId) ?? [];
  }

  claimsForProject(projectId: string): Claim[] {
    return [...this.claims.values()].filter((c) => c.projectId === projectId);
  }

  /**
   * Groups a claim's evidence by distinct content hash. If more than
   * one distinct value exists, resolves to the value backed by the
   * highest-precedence source tier (see SOURCE_PRECEDENCE) — never the
   * majority value, never the most-reputable value.
   */
  detectContradiction(claimId: string): ContradictionResult {
    const evidence = this.getEvidence(claimId);
    if (evidence.length === 0) return { contradicted: false, resolved: null, conflictingValues: [] };

    const byHash = new Map<string, { content: unknown; sources: Evidence[] }>();
    for (const e of evidence) {
      if (!byHash.has(e.contentHash)) byHash.set(e.contentHash, { content: e.content, sources: [] });
      byHash.get(e.contentHash)!.sources.push(e);
    }

    if (byHash.size <= 1) {
      return { contradicted: false, resolved: evidence[0].content, conflictingValues: [] };
    }

    let best: { content: unknown; rank: number } | null = null;
    for (const group of byHash.values()) {
      const rank = Math.min(...group.sources.map((s) => {
        const idx = SOURCE_PRECEDENCE.indexOf(s.sourceType);
        return idx === -1 ? SOURCE_PRECEDENCE.length : idx;
      }));
      if (best === null || rank < best.rank) best = { content: group.content, rank };
    }

    return {
      contradicted: true,
      resolved: best!.content,
      conflictingValues: [...byHash.values()].map((g) => g.content),
    };
  }
}
