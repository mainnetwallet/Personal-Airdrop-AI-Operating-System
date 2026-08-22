import { randomUUID } from "node:crypto";
import type { ReconciliationResult, ReconciliationSource, ChainId } from "@airdrop-os/types";

/**
 * Compares values reported by multiple sources (primary RPC, backup
 * RPC, block explorer, indexer) for the same subject (e.g. a tx's
 * finality, or a wallet's balance at a block). Any disagreement -> 
 * RECONCILIATION_REQUIRED. Agreement requires ALL sources to match, not
 * just a majority, because a minority-disagreeing source might be the
 * one that's actually correct (e.g. it already saw a reorg the others
 * haven't caught up to yet) - fail closed rather than outvote it.
 */
export function reconcile(params: {
  chain: ChainId;
  subject: string;
  sources: ReconciliationSource[];
  now?: string;
}): ReconciliationResult {
  const distinctValues = new Set(params.sources.map((s) => s.value));
  const status = distinctValues.size <= 1 ? "MATCH" : "RECONCILIATION_REQUIRED";

  return {
    reconciliationId: randomUUID(),
    chain: params.chain,
    subject: params.subject,
    sources: params.sources,
    status,
    checkedAt: params.now ?? new Date().toISOString(),
  };
}
