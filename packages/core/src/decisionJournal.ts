/**
 * Phase 11: Decision Journal (spec section 191) and Project
 * Reconsideration (section 192).
 *
 * Every DO/WAIT/WATCH/SKIP/RESEARCH_MORE/HUMAN_REVIEW/BLOCK/NO_ACTION
 * decision the agent makes gets an append-only journal entry with its
 * reason and evidence references, so "কেন এটা করলে না?" always has an
 * answer. Skipped projects are never permanently suppressed - if new
 * evidence arrives, reconsider() surfaces the entry again rather than
 * requiring the user to remember they skipped it.
 */
import { randomUUID } from "node:crypto";
import type { DecisionJournalEntry, DecisionType } from "@airdrop-os/types";

export class UnknownDecisionError extends Error {
  constructor(decisionId: string) {
    super(`Unknown decisionId: ${decisionId}`);
    this.name = "UnknownDecisionError";
  }
}

export interface RecordDecisionInput {
  projectId?: string | null;
  campaignId?: string | null;
  decision: DecisionType;
  reason: string;
  evidenceIds?: string[];
  confidence: number;
  alternative?: string | null;
}

export class DecisionJournal {
  private readonly entries = new Map<string, DecisionJournalEntry>();

  record(input: RecordDecisionInput): DecisionJournalEntry {
    const entry: DecisionJournalEntry = {
      decisionId: randomUUID(),
      projectId: input.projectId ?? null,
      campaignId: input.campaignId ?? null,
      decision: input.decision,
      reason: input.reason,
      evidenceIds: input.evidenceIds ?? [],
      confidence: input.confidence,
      alternative: input.alternative ?? null,
      outcome: null,
      decidedAt: new Date().toISOString(),
      reconsideredAt: null,
    };
    this.entries.set(entry.decisionId, entry);
    return entry;
  }

  get(decisionId: string): DecisionJournalEntry {
    const entry = this.entries.get(decisionId);
    if (!entry) throw new UnknownDecisionError(decisionId);
    return entry;
  }

  recordOutcome(decisionId: string, outcome: string): DecisionJournalEntry {
    const entry = this.get(decisionId);
    const updated = { ...entry, outcome };
    this.entries.set(decisionId, updated);
    return updated;
  }

  /** Section 192: project status changed - reopen a prior SKIP/WAIT for review, never silently. */
  reconsider(decisionId: string): DecisionJournalEntry {
    const entry = this.get(decisionId);
    if (entry.decision !== "SKIP" && entry.decision !== "WAIT" && entry.decision !== "WATCH") {
      throw new Error(`Decision ${decisionId} is not reconsiderable (was ${entry.decision})`);
    }
    const updated = { ...entry, reconsideredAt: new Date().toISOString() };
    this.entries.set(decisionId, updated);
    return updated;
  }

  listForProject(projectId: string): DecisionJournalEntry[] {
    return [...this.entries.values()]
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => a.decidedAt.localeCompare(b.decidedAt));
  }

  list(): DecisionJournalEntry[] {
    return [...this.entries.values()].sort((a, b) => a.decidedAt.localeCompare(b.decidedAt));
  }
}
