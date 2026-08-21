import { randomUUID } from "node:crypto";
import { redactSecrets } from "@airdrop-os/security";
import type { MemoryEntry, MemoryLifecycle, MemoryType } from "@airdrop-os/types";

const ALLOWED_MEMORY_TRANSITIONS: Record<MemoryLifecycle, MemoryLifecycle[]> = {
  NEW: ["CONFIRMED", "VERIFIED", "STALE", "CORRECTED", "ARCHIVED"],
  CONFIRMED: ["VERIFIED", "STALE", "CORRECTED", "ARCHIVED"],
  VERIFIED: ["STALE", "CORRECTED", "ARCHIVED"],
  STALE: ["VERIFIED", "CORRECTED", "ARCHIVED"],
  CORRECTED: ["VERIFIED", "STALE", "ARCHIVED"],
  ARCHIVED: [], // terminal - archived memory is never silently revived
};

export class InvalidMemoryTransitionError extends Error {
  constructor(from: MemoryLifecycle, to: MemoryLifecycle) {
    super(`Invalid memory lifecycle transition: ${from} -> ${to}`);
    this.name = "InvalidMemoryTransitionError";
  }
}

export function canTransitionMemoryLifecycle(from: MemoryLifecycle, to: MemoryLifecycle): boolean {
  return ALLOWED_MEMORY_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface AddMemoryInput {
  agentId: string;
  type: MemoryType;
  content: unknown;
  source: string;
  confidence: number;
}

/**
 * In-memory store for kernel Memory records.
 *
 * - Every write passes through redactSecrets() first: memory can never
 *   persist a seed phrase, private key, password, or token even if one
 *   is accidentally included in `content`.
 * - Lifecycle changes are validated against ALLOWED_MEMORY_TRANSITIONS;
 *   ARCHIVED is terminal.
 * - correct() never mutates content in place - it appends the previous
 *   content to correctionHistory so the full correction trail survives.
 */
export class MemoryStore {
  private readonly entries = new Map<string, MemoryEntry>();

  add(input: AddMemoryInput): MemoryEntry {
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

  list(agentId: string): MemoryEntry[] {
    return [...this.entries.values()].filter((e) => e.agentId === agentId);
  }

  transitionLifecycle(memoryId: string, to: MemoryLifecycle): MemoryEntry {
    const entry = this.requireEntry(memoryId);
    if (!canTransitionMemoryLifecycle(entry.lifecycle, to)) {
      throw new InvalidMemoryTransitionError(entry.lifecycle, to);
    }
    entry.lifecycle = to;
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  /** Correct an existing memory: preserves the old content in correctionHistory. */
  correct(memoryId: string, newContent: unknown, reason: string): MemoryEntry {
    const entry = this.requireEntry(memoryId);
    if (!canTransitionMemoryLifecycle(entry.lifecycle, "CORRECTED")) {
      throw new InvalidMemoryTransitionError(entry.lifecycle, "CORRECTED");
    }
    entry.correctionHistory.push({
      correctedAt: new Date().toISOString(),
      previousContent: entry.content,
      reason,
    });
    entry.content = redactSecrets(newContent);
    entry.lifecycle = "CORRECTED";
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  archive(memoryId: string): MemoryEntry {
    return this.transitionLifecycle(memoryId, "ARCHIVED");
  }

  private requireEntry(memoryId: string): MemoryEntry {
    const entry = this.entries.get(memoryId);
    if (!entry) throw new Error(`Memory entry not found: ${memoryId}`);
    return entry;
  }
}
