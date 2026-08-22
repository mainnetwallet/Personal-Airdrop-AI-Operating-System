import { randomUUID } from "node:crypto";
import type { HistoricalStateRecord, ChainId } from "@airdrop-os/types";

export class HistoricalStateNotFoundError extends Error {
  constructor(wallet: string, block: number, kind: string) {
    super(`No historical state recorded for wallet ${wallet} at block ${block} (${kind})`);
    this.name = "HistoricalStateNotFoundError";
  }
}

/**
 * Append-only store of point-in-time chain state. This is the single
 * mechanism the rest of the system may use to answer "what was wallet
 * X's balance/position at block Y" - there is deliberately NO method
 * that returns "current" state dressed up as historical. A reorg
 * invalidates (not deletes) affected records via
 * `invalidatedByReorgId`, preserving the audit trail of what was
 * believed true and when.
 */
export class HistoricalStateStore {
  private readonly records: HistoricalStateRecord[] = [];

  record(input: Omit<HistoricalStateRecord, "recordId" | "recordedAt" | "invalidatedByReorgId">, now: string = new Date().toISOString()): HistoricalStateRecord {
    const record: HistoricalStateRecord = {
      ...input,
      recordId: randomUUID(),
      invalidatedByReorgId: null,
      recordedAt: now,
    };
    this.records.push(record);
    return record;
  }

  /**
   * Returns the state for a wallet at the exact block requested, or
   * throws if none was recorded - callers must not silently substitute
   * the nearest available block or current state for a missing
   * historical record.
   */
  getAt(wallet: string, block: number, kind: HistoricalStateRecord["kind"]): HistoricalStateRecord {
    const match = this.records.find(
      (r) => r.wallet === wallet && r.block === block && r.kind === kind && !r.invalidatedByReorgId
    );
    if (!match) throw new HistoricalStateNotFoundError(wallet, block, kind);
    return match;
  }

  invalidateForReorg(reorgId: string, chain: ChainId, fromBlock: number, toBlock: number, now: string = new Date().toISOString()): HistoricalStateRecord[] {
    const invalidated: HistoricalStateRecord[] = [];
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      if (r.chain === chain && r.block >= fromBlock && r.block <= toBlock && !r.invalidatedByReorgId) {
        const updated = { ...r, invalidatedByReorgId: reorgId };
        this.records[i] = updated;
        invalidated.push(updated);
      }
    }
    return invalidated;
  }

  all(): readonly HistoricalStateRecord[] {
    return this.records;
  }
}
