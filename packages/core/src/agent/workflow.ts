import { randomUUID } from "node:crypto";
import type {
  WorkflowDefinitionInput,
  WorkflowVersionRecord,
  WorkflowStep,
  WorkflowRun,
} from "@airdrop-os/types";

export class UnknownWorkflowError extends Error {
  constructor(workflowId: string) {
    super(`Unknown workflowId: ${workflowId}`);
    this.name = "UnknownWorkflowError";
  }
}

export class UnknownStepDependencyError extends Error {
  constructor(stepId: string) {
    super(`Step depends on unknown/not-yet-declared step: ${stepId}`);
    this.name = "UnknownStepDependencyError";
  }
}

/**
 * Stores workflow definitions as an append-only version history - saving
 * a new version never overwrites V1/V2/etc, so a regression can always be
 * compared against exactly what previously worked.
 */
export class WorkflowStore {
  private readonly versions = new Map<string, WorkflowVersionRecord[]>();

  /** Declares a brand-new workflow (V1). Steps must reference dependency
   * stepIds that appear earlier in the same `steps` array, structurally
   * ruling out cycles the same way the task DAG does. */
  create(workflowId: string, input: WorkflowDefinitionInput, now: number = Date.now()): WorkflowVersionRecord {
    this.validateSteps(input.steps);
    const record: WorkflowVersionRecord = {
      workflowId,
      version: 1,
      label: "V1",
      definition: input,
      createdAt: new Date(now).toISOString(),
      supersedes: null,
    };
    this.versions.set(workflowId, [record]);
    return record;
  }

  /** Adds a new version derived from learning (success/failure/time/cost).
   * Never mutates or removes prior versions. */
  saveNewVersion(workflowId: string, input: WorkflowDefinitionInput, stats?: WorkflowVersionRecord["derivedFromRunStats"], now: number = Date.now()): WorkflowVersionRecord {
    const history = this.versions.get(workflowId);
    if (!history) throw new UnknownWorkflowError(workflowId);
    this.validateSteps(input.steps);
    const previous = history[history.length - 1];
    const record: WorkflowVersionRecord = {
      workflowId,
      version: previous.version + 1,
      label: `V${previous.version + 1}`,
      definition: input,
      createdAt: new Date(now).toISOString(),
      supersedes: previous.version,
      derivedFromRunStats: stats,
    };
    history.push(record);
    return record;
  }

  latest(workflowId: string): WorkflowVersionRecord {
    const history = this.versions.get(workflowId);
    if (!history || history.length === 0) throw new UnknownWorkflowError(workflowId);
    return history[history.length - 1];
  }

  getVersion(workflowId: string, version: number): WorkflowVersionRecord | undefined {
    return this.versions.get(workflowId)?.find((v) => v.version === version);
  }

  history(workflowId: string): WorkflowVersionRecord[] {
    return this.versions.get(workflowId) ?? [];
  }

  private validateSteps(steps: WorkflowStep[]): void {
    const seen = new Set<string>();
    for (const step of steps) {
      for (const dep of step.dependsOn) {
        if (!seen.has(dep)) throw new UnknownStepDependencyError(dep);
      }
      seen.add(step.stepId);
    }
  }
}

/**
 * Executes a workflow version against a run record. This does not itself
 * drive a real browser - it is the pure scheduling/gate/regression logic
 * that a PC agent or extension reports real step outcomes into.
 */
export class WorkflowRunner {
  constructor(private readonly store: WorkflowStore) {}

  start(workflowId: string, runId: string, now: number = Date.now()): WorkflowRun {
    const version = this.store.latest(workflowId);
    return {
      runId,
      workflowId,
      version: version.version,
      status: "RUNNING",
      stepResults: version.definition.steps.map((s) => ({
        stepId: s.stepId,
        status: "PENDING",
        output: null,
        error: null,
        startedAt: null,
        finishedAt: null,
      })),
      startedAt: new Date(now).toISOString(),
      finishedAt: null,
      checkpointId: null,
    };
  }

  /** Returns the next step eligible to run: PENDING, all dependencies
   * SUCCESS, and (if gated) not yet cleared by an external approval/human
   * decision - gated steps are surfaced via run.status rather than run
   * silently. Returns null if nothing is runnable right now. */
  nextStep(run: WorkflowRun, workflowId: string): WorkflowStep | null {
    const version = this.store.getVersion(workflowId, run.version);
    if (!version) throw new UnknownWorkflowError(workflowId);
    for (const step of version.definition.steps) {
      const result = run.stepResults.find((r) => r.stepId === step.stepId);
      if (!result || result.status !== "PENDING") continue;
      const depsOk = step.dependsOn.every((dep) => run.stepResults.find((r) => r.stepId === dep)?.status === "SUCCESS");
      if (!depsOk) continue;
      return step;
    }
    return null;
  }

  /** Marks a gated step as awaiting the appropriate external decision.
   * Must be called before executing a HUMAN_GATE/APPROVAL_GATE step. */
  requestGate(run: WorkflowRun, step: WorkflowStep): WorkflowRun {
    if (step.gate === "HUMAN_GATE") run.status = "WAITING_FOR_USER";
    else if (step.gate === "APPROVAL_GATE") run.status = "WAITING_FOR_APPROVAL";
    return run;
  }

  clearGate(run: WorkflowRun): WorkflowRun {
    if (run.status === "WAITING_FOR_USER" || run.status === "WAITING_FOR_APPROVAL") run.status = "RUNNING";
    return run;
  }

  recordStepResult(run: WorkflowRun, stepId: string, outcome: { success: boolean; output?: string; error?: string }, now: number = Date.now()): WorkflowRun {
    const result = run.stepResults.find((r) => r.stepId === stepId);
    if (!result) throw new Error(`Unknown stepId in run: ${stepId}`);
    result.status = outcome.success ? "SUCCESS" : "FAILED";
    result.output = outcome.output ?? null;
    result.error = outcome.error ?? null;
    result.finishedAt = new Date(now).toISOString();
    if (!outcome.success) run.status = "FAILED";
    else if (run.stepResults.every((r) => r.status === "SUCCESS")) {
      run.status = "COMPLETED";
      run.finishedAt = new Date(now).toISOString();
    }
    return run;
  }

  /**
   * Regression handling: if a workflow that has at least one prior
   * SUCCESSFUL run at this version fails again, the run is PAUSED for
   * comparison/diagnosis rather than silently retried - a previously
   * working workflow failing is itself a signal something changed
   * upstream (site update, requirement change, etc).
   */
  handlePossibleRegression(run: WorkflowRun, priorRunsAtThisVersion: WorkflowRun[]): WorkflowRun {
    const hadPriorSuccess = priorRunsAtThisVersion.some((r) => r.status === "COMPLETED");
    if (run.status === "FAILED" && hadPriorSuccess) {
      run.status = "PAUSED_REGRESSION";
    }
    return run;
  }
}

export function newWorkflowId(): string {
  return randomUUID();
}
