/**
 * Global Search (spec section 224).
 *
 * A cross-entity search index. Callers (project store, campaign store,
 * task store, wallet store, etc.) register/update/remove
 * SearchableRecord entries here as their entities change; this module
 * does not reach into other stores itself; it only indexes what it is
 * given. That keeps it decoupled from every other domain module and
 * honest about not silently going stale relative to a store it never
 * hooked into.
 *
 * Scoring is deliberately simple (token overlap + substring bonus) —
 * this is a operational-data search over a few thousand records, not a
 * relevance-ranked web search engine, and an overcomplicated ranker
 * would be a false precision claim.
 */
import type { SearchableRecord, SearchResult } from "@airdrop-os/types";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

export class GlobalSearchIndex {
  private readonly records = new Map<string, SearchableRecord>();

  private key(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  upsert(record: SearchableRecord): void {
    this.records.set(this.key(record.entityType, record.entityId), record);
  }

  remove(entityType: string, entityId: string): void {
    this.records.delete(this.key(entityType, entityId));
  }

  /** Removes every indexed record for an entityType (e.g. on full re-sync). */
  clearType(entityType: string): void {
    for (const [key, record] of this.records) {
      if (record.entityType === entityType) this.records.delete(key);
    }
  }

  size(): number {
    return this.records.size;
  }

  /**
   * Search across all indexed records, optionally restricted to a set
   * of entityTypes. Returns results sorted by score descending;
   * zero-score records are excluded entirely.
   */
  search(query: string, entityTypes?: string[]): SearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];
    const lowerQuery = query.toLowerCase();

    const results: SearchResult[] = [];
    for (const record of this.records.values()) {
      if (entityTypes && !entityTypes.includes(record.entityType)) continue;

      const haystack = `${record.label} ${record.searchableText}`.toLowerCase();
      const haystackTokens = tokenize(haystack);

      let score = 0;
      for (const qt of queryTokens) {
        if (haystackTokens.includes(qt)) score += 2;
        else if (haystackTokens.some((ht) => ht.includes(qt))) score += 1;
      }
      // Bonus for exact substring match (e.g. matching a slug or ID fragment).
      if (haystack.includes(lowerQuery)) score += 3;
      // Extra weight if the match is in the label itself, not just the body text.
      if (record.label.toLowerCase().includes(lowerQuery)) score += 2;

      if (score > 0) {
        results.push({
          entityType: record.entityType,
          entityId: record.entityId,
          label: record.label,
          score,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}
