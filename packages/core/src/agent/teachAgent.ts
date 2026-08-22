import type { BrowserEvent, TaughtWorkflowDraft, TeachDecision, WorkflowStep } from "@airdrop-os/types";

/**
 * Turns a sequence of already-safe BrowserEvents (observed while the user
 * performs a legitimate workflow themselves) into a draft workflow. The
 * agent never acts during a teach session - it only observes and
 * proposes. The user always has the final SAVE/EDIT/DISCARD decision;
 * nothing here auto-saves a taught workflow.
 */
export class TeachAgentSession {
  private readonly observed: BrowserEvent[] = [];

  constructor(private readonly sessionId: string) {}

  observe(event: BrowserEvent): void {
    if (event.sessionId !== this.sessionId) {
      throw new Error("Observed event belongs to a different session");
    }
    this.observed.push(event);
  }

  /** Derives a draft workflow from what was observed so far. Confidence
   * is capped by how much of the observation is clean signal (no
   * redactions, enough steps to infer a goal) - a thin observation never
   * gets reported as high confidence. */
  deriveDraft(draftId: string, goal: string, now: number = Date.now()): TaughtWorkflowDraft {
    const steps: WorkflowStep[] = this.observed.map((event, index) => ({
      stepId: `observed-${index}`,
      name: event.action ?? `${event.eventType} on ${event.url}`,
      dependsOn: index === 0 ? [] : [`observed-${index - 1}`],
      conditions: [],
      expectedOutput: null,
      gate: "NONE",
      onFailure: "HUMAN_REVIEW",
    }));

    const redactedCount = this.observed.filter((e) => e.sensitivity === "REDACTED").length;
    const manualInterventionPoints = this.observed
      .filter((e) => e.sensitivity === "REDACTED")
      .map((e) => `manual step required at ${e.eventId} (redacted field involved)`);

    let confidence: TaughtWorkflowDraft["confidence"] = "UNCERTAIN";
    if (this.observed.length >= 3 && redactedCount === 0) confidence = "LIKELY";
    if (this.observed.length === 0) confidence = "SPECULATIVE";

    return {
      draftId,
      observedSessionId: this.sessionId,
      goal,
      steps,
      successCriteria: [],
      failureCriteria: [],
      manualInterventionPoints,
      estimatedTimeMs: this.observed.length > 0
        ? new Date(this.observed[this.observed.length - 1].timestamp).getTime() - new Date(this.observed[0].timestamp).getTime()
        : 0,
      estimatedCost: 0,
      confidence,
      decision: null,
    };
  }

  static applyDecision(draft: TaughtWorkflowDraft, decision: TeachDecision): TaughtWorkflowDraft {
    return { ...draft, decision };
  }
}
