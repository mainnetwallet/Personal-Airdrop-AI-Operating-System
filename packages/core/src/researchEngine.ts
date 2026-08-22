/**
 * Research engine: discover -> retrieve -> normalize -> deduplicate ->
 * verify -> snapshot/diff pipeline over the evidence graph.
 *
 * This engine performs no network I/O itself. `retrieve()` takes
 * already-fetched content supplied by the caller, so
 * @airdrop-os/core stays a pure, fully unit-testable library — the
 * real HTTP fetch/browser automation lives in apps/worker (Phase 6+),
 * invoked through the "source.http_fetch" tool declared in
 * tools/researchTools.ts and gated by the kernel's normal permission
 * checks, never called directly from here.
 */
import type { Claim, ClaimConfidence, Source, SourceType } from "@airdrop-os/types";
import { EvidenceGraph, type DiffResult } from "./evidence.js";
import { SourceReputationTracker } from "./sourceReputation.js";

export interface DiscoverInput {
  url: string;
  sourceType: SourceType;
}

export interface NormalizedRecord {
  field: string;
  value: unknown;
}

export interface DeduplicatedRecord extends NormalizedRecord {
  claimId: string | null;
  isDuplicate: boolean;
}

// High-tier evidence that alone is sufficient to mark a claim VERIFIED,
// consistent with evidence.ts's contradiction-resolution precedence.
const HIGH_TIER: readonly SourceType[] = [
  "PRIMARY_OFFICIAL", "OFFICIAL_DOC", "OFFICIAL_CONTRACT",
  "OFFICIAL_ANNOUNCEMENT", "OFFICIAL_SOCIAL", "OFFICIAL_GITHUB",
  "OFFICIAL_DISCORD", "ONCHAIN_EVIDENCE",
];

export class ResearchEngine {
  readonly graph = new EvidenceGraph();
  readonly reputation = new SourceReputationTracker();

  discover(input: DiscoverInput): Source {
    return this.graph.addSource(input);
  }

  /** Records a retrieved snapshot for a source and marks it available. Content is supplied by the caller — no fetch happens here. */
  retrieve(sourceId: string, content: unknown) {
    this.reputation.recordAvailability(sourceId, true);
    return this.graph.snapshot(sourceId, content);
  }

  /** Records a failed retrieval attempt so availability/reputation reflects it, without a snapshot to diff against. */
  markUnavailable(sourceId: string): void {
    this.reputation.recordAvailability(sourceId, false);
  }

  diff(sourceId: string): DiffResult {
    return this.graph.diff(sourceId);
  }

  /** Flattens arbitrary raw retrieved content into field/value records a claim can be built from. */
  normalize(raw: Record<string, unknown>): NormalizedRecord[] {
    return Object.entries(raw).map(([field, value]) => ({ field, value }));
  }

  /**
   * Deduplicates normalized records against a project's existing
   * claims by (projectId, field). A claim is the slot for "what do we
   * know about this field for this project" — matching on field alone
   * (not value) is deliberate: two records for the same field with
   * *different* values must land as competing evidence on the same
   * claim so detectContradiction()/verify() can see and flag the
   * conflict, rather than silently becoming two separate, agreeing-
   * with-nobody claims that never get compared against each other.
   * Exact-duplicate observations (same field, same value, re-fetched)
   * are still deduplicated at the evidence layer via content hashing.
   */
  deduplicate(projectId: string, records: NormalizedRecord[]): DeduplicatedRecord[] {
    const existing = this.graph.claimsForProject(projectId);
    return records.map((r) => {
      const match = existing.find((c) => c.field === r.field);
      return { field: r.field, value: r.value, claimId: match?.claimId ?? null, isDuplicate: Boolean(match) };
    });
  }

  /** Creates (or reuses, via deduplicate) a claim for one normalized record and attaches sourced evidence to it. */
  ingest(projectId: string, sourceId: string, record: NormalizedRecord): Claim {
    const [dedup] = this.deduplicate(projectId, [record]);
    const claim = dedup.isDuplicate && dedup.claimId
      ? this.graph.getClaim(dedup.claimId)
      : this.graph.addClaim({ projectId, field: record.field, value: record.value });

    this.graph.addEvidence({ claimId: claim.claimId, sourceId, content: record.value });
    const confidence = this.verify(claim.claimId);
    return this.graph.setClaimConfidence(claim.claimId, confidence);
  }

  /**
   * Recomputes a claim's confidence from its accumulated evidence:
   * - no evidence -> UNCERTAIN
   * - contradicted evidence -> CONFLICTED (regardless of source tier)
   * - any high-tier (official/on-chain) evidence -> VERIFIED
   * - agreeing TRUSTED_RESEARCH -> LIKELY
   * - only COMMUNITY/UNKNOWN/RUMOR -> SPECULATIVE
   */
  verify(claimId: string): ClaimConfidence {
    const evidence = this.graph.getEvidence(claimId);
    if (evidence.length === 0) return "UNCERTAIN";

    const { contradicted } = this.graph.detectContradiction(claimId);
    if (contradicted) return "CONFLICTED";

    if (evidence.some((e) => HIGH_TIER.includes(e.sourceType))) return "VERIFIED";
    if (evidence.some((e) => e.sourceType === "TRUSTED_RESEARCH")) return "LIKELY";
    if (evidence.some((e) => e.sourceType === "COMMUNITY" || e.sourceType === "UNKNOWN" || e.sourceType === "RUMOR")) {
      return "SPECULATIVE";
    }
    return "UNCERTAIN";
  }

  /** A claim is STALE if every evidence row for it predates the given cutoff, i.e. nothing has re-confirmed it since. */
  isStale(claimId: string, staleBeforeIso: string): boolean {
    const evidence = this.graph.getEvidence(claimId);
    if (evidence.length === 0) return false;
    return evidence.every((e) => e.retrievedAt < staleBeforeIso);
  }
}
