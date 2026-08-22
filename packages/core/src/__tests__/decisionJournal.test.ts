import { describe, expect, it } from "vitest";
import { DecisionJournal, UnknownDecisionError } from "../decisionJournal.js";

describe("DecisionJournal", () => {
  it("records a decision with reason and evidence", () => {
    const journal = new DecisionJournal();
    const entry = journal.record({
      projectId: "proj-1",
      decision: "SKIP",
      reason: "Cost exceeds budget threshold",
      evidenceIds: ["ev-1"],
      confidence: 0.8,
    });
    expect(entry.decision).toBe("SKIP");
    expect(entry.reconsideredAt).toBeNull();
    expect(journal.get(entry.decisionId)).toEqual(entry);
  });

  it("throws for unknown decisionId", () => {
    const journal = new DecisionJournal();
    expect(() => journal.get("nope")).toThrow(UnknownDecisionError);
  });

  it("records outcome after the fact", () => {
    const journal = new DecisionJournal();
    const entry = journal.record({ decision: "DO", reason: "High opportunity score", confidence: 0.9 });
    const updated = journal.recordOutcome(entry.decisionId, "Completed successfully");
    expect(updated.outcome).toBe("Completed successfully");
  });

  it("allows reconsidering a SKIP/WAIT/WATCH decision", () => {
    const journal = new DecisionJournal();
    const entry = journal.record({ decision: "SKIP", reason: "Too risky at the time", confidence: 0.5 });
    const reconsidered = journal.reconsider(entry.decisionId);
    expect(reconsidered.reconsideredAt).not.toBeNull();
  });

  it("refuses to reconsider a DO/BLOCK decision", () => {
    const journal = new DecisionJournal();
    const entry = journal.record({ decision: "BLOCK", reason: "Security veto", confidence: 1 });
    expect(() => journal.reconsider(entry.decisionId)).toThrow(/not reconsiderable/);
  });

  it("lists decisions for a project in chronological order", () => {
    const journal = new DecisionJournal();
    journal.record({ projectId: "p1", decision: "WATCH", reason: "early", confidence: 0.4 });
    journal.record({ projectId: "p2", decision: "DO", reason: "other project", confidence: 0.9 });
    const forP1 = journal.listForProject("p1");
    expect(forP1).toHaveLength(1);
    expect(forP1[0].projectId).toBe("p1");
  });
});
