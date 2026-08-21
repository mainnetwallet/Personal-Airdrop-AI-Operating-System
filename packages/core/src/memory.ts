/**
 * Agent memory store.
 *
 * Corrections never overwrite history: `correct()` appends the prior
 * content to `correctionHistory` and only then updates `content`, so a
 * later phase (or a human) can always see what the agent used to
 * believe and why it changed. Every write is passed through
 * redactSecrets() first — this store has no code path that persists an
 * un-redacted value, regardless of what the caller passes in.
 */
import { randomUUID } from "node:crypto";
import { redactSecrets } from "@airdrop-os/security";
import type { MemoryEntry, MemoryLifecycle, MemoryType } from "@airdrop-os/types";

export interface WriteMemoryInput {
  agentId: string;
  type: MemoryType;
  content: unknown;
  source: string;
  confidence: number;
}

export class MemoryStore {
  private readonly entries = new Map<string, MemoryEntry>();

  write(input: WriteMemoryInput): MemoryEntry {
    if (input.confidence < 0 || input.confidence > 1) {
      throw new RangeError("confidence must be between 0 and 1");
    }
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      memoryId: randomUUID(),
      agentId: input.agentId,
      type: input.type,
      content: redactSecrets(input.content),
      source: input.source,
      confidence: input.confidence,
      lifecycle: "NEW",
      correctionHistory: [],
      createdAt: now,
      updatedAt: now,
    };
    this.entries.set(entry.memoryId, entry);
    return entry;
  }

  get(memoryId: string): MemoryEntry | undefined {
    return this.entries.get(memoryId);
  }

  /** Advances lifecycle without touching content (e.g. NEW -> CONFIRMED -> VERIFIED, or -> STALE/ARCHIVED). */
  setLifecycle(memoryId: string, lifecycle: MemoryLifecycle): MemoryEntry {
    const entry = this.requireEntry(memoryId);
    entry.lifecycle = lifecycle;
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  /**
   * Records a correction: the existing content is pushed onto
   * correctionHistory (never dropped), the new (redacted) content
   * replaces it, and lifecycle moves to CORRECTED.
   */
  correct(memoryId: string, newContent: unknown, reason: string | null = null): MemoryEntry {
    const entry = this.requireEntry(memoryId);
    entry.correctionHistory.push({
      previousContent: entry.content,
      correctedAt: new Date().toISOString(),
      reason,
    });
    entry.content = redactSecrets(newContent);
    entry.lifecycle = "CORRECTED";
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  query(filter: { agentId?: string; type?: MemoryType; lifecycle?: MemoryLifecycle }): MemoryEntry[] {
    return [...this.entries.values()].filter((e) => {
      if (filter.agentId && e.agentId !== filter.agentId) return false;
      if (filter.type && e.type !== filter.type) return false;
      if (filter.lifecycle && e.lifecycle !== filter.lifecycle) return false;
      return true;
    });
  }

  private requireEntry(memoryId: string): MemoryEntry {
    const entry = this.entries.get(memoryId);
    if (!entry) throw new Error(`Unknown memoryId: ${memoryId}`);
    return entry;
  }
}
