import { describe, it, expect } from "vitest";
import { WorkflowStore, WorkflowRunner, UnknownStepDependencyError } from "../agent/workflow.js";
import type { WorkflowDefinitionInput } from "@airdrop-os/types";

function twoStepDefinition(): WorkflowDefinitionInput {
  return {
    name: "Claim testnet points",
    goal: "Claim points for the testnet campaign",
    variables: [{ name: "wallet", kind: "wallet" }],
    steps: [
      { stepId: "connect", name: "Connect wallet", dependsOn: [], conditions: [], expectedOutput: "connected", gate: "NONE", onFailure: "STOP" },
      { stepId: "claim", name: "Claim points", dependsOn: ["connect"], conditions: [], expectedOutput: "claimed", gate: "APPROVAL_GATE", onFailure: "HUMAN_REVIEW" },
    ],
  };
}

describe("WorkflowStore", () => {
  it("creates V1 and never mutates it when a new version is saved", () => {
    const store = new WorkflowStore();
    const v1 = store.create("wf1", twoStepDefinition());
    expect(v1.version).toBe(1);
    store.saveNewVersion("wf1", { ...twoStepDefinition(), name: "Claim testnet points (updated)" });
    const historyV1 = store.getVersion("wf1", 1)!;
    expect(historyV1.definition.name).toBe("Claim testnet points");
    expect(store.latest("wf1").version).toBe(2);
    expect(store.history("wf1")).toHaveLength(2);
  });

  it("rejects a step that depends on a step not yet declared (structural cycle prevention)", () => {
    const store = new WorkflowStore();
    const bad: WorkflowDefinitionInput = {
      name: "bad",
      goal: "bad",
      variables: [],
      steps: [{ stepId: "a", name: "a", dependsOn: ["b"], conditions: [], expectedOutput: null, gate: "NONE", onFailure: "STOP" }],
    };
    expect(() => store.create("wf-bad", bad)).toThrow(UnknownStepDependencyError);
  });

  it("records supersedes linkage between versions", () => {
    const store = new WorkflowStore();
    store.create("wf1", twoStepDefinition());
    const v2 = store.saveNewVersion("wf1", twoStepDefinition());
    expect(v2.supersedes).toBe(1);
    expect(v2.label).toBe("V2");
  });
});

describe("WorkflowRunner", () => {
  it("starts a run with all steps PENDING", () => {
    const store = new WorkflowStore();
    store.create("wf1", twoStepDefinition());
    const runner = new WorkflowRunner(store);
    const run = runner.start("wf1", "run1", 0);
    expect(run.status).toBe("RUNNING");
    expect(run.stepResults.every((r) => r.status === "PENDING")).toBe(true);
  });

  it("only surfaces a step once its dependencies succeed", () => {
    const store = new WorkflowStore();
    store.create("wf1", twoStepDefinition());
    const runner = new WorkflowRunner(store);
    const run = runner.start("wf1", "run1");
    expect(runner.nextStep(run, "wf1")?.stepId).toBe("connect");
    runner.recordStepResult(run, "connect", { success: true, output: "connected" });
    expect(runner.nextStep(run, "wf1")?.stepId).toBe("claim");
  });

  it("puts the run into WAITING_FOR_APPROVAL for an approval-gated step and clears it on approval", () => {
    const store = new WorkflowStore();
    store.create("wf1", twoStepDefinition());
    const runner = new WorkflowRunner(store);
    const run = runner.start("wf1", "run1");
    runner.recordStepResult(run, "connect", { success: true });
    const claimStep = runner.nextStep(run, "wf1")!;
    runner.requestGate(run, claimStep);
    expect(run.status).toBe("WAITING_FOR_APPROVAL");
    runner.clearGate(run);
    expect(run.status).toBe("RUNNING");
  });

  it("marks the run COMPLETED once every step succeeds", () => {
    const store = new WorkflowStore();
    store.create("wf1", twoStepDefinition());
    const runner = new WorkflowRunner(store);
    const run = runner.start("wf1", "run1");
    runner.recordStepResult(run, "connect", { success: true });
    runner.recordStepResult(run, "claim", { success: true }, 5000);
    expect(run.status).toBe("COMPLETED");
    expect(run.finishedAt).toBe(new Date(5000).toISOString());
  });

  it("marks the run FAILED when a step fails", () => {
    const store = new WorkflowStore();
    store.create("wf1", twoStepDefinition());
    const runner = new WorkflowRunner(store);
    const run = runner.start("wf1", "run1");
    runner.recordStepResult(run, "connect", { success: false, error: "wallet rejected connection" });
    expect(run.status).toBe("FAILED");
  });

  it("pauses for regression review when a previously-successful workflow fails again", () => {
    const store = new WorkflowStore();
    store.create("wf1", twoStepDefinition());
    const runner = new WorkflowRunner(store);

    const priorRun = runner.start("wf1", "run0");
    runner.recordStepResult(priorRun, "connect", { success: true });
    runner.recordStepResult(priorRun, "claim", { success: true });

    const newRun = runner.start("wf1", "run1");
    runner.recordStepResult(newRun, "connect", { success: false, error: "site changed" });
    runner.handlePossibleRegression(newRun, [priorRun]);
    expect(newRun.status).toBe("PAUSED_REGRESSION");
  });

  it("does NOT flag regression for a workflow with no prior success", () => {
    const store = new WorkflowStore();
    store.create("wf1", twoStepDefinition());
    const runner = new WorkflowRunner(store);
    const run = runner.start("wf1", "run1");
    runner.recordStepResult(run, "connect", { success: false });
    runner.handlePossibleRegression(run, []);
    expect(run.status).toBe("FAILED");
  });
});
