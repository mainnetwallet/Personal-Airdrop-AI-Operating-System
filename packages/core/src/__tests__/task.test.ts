import { describe, it, expect } from "vitest";
import { TaskGraph, UnknownTaskError } from "../task.js";

describe("TaskGraph", () => {
  it("adds a task with no dependencies as READY", () => {
    const graph = new TaskGraph();
    const task = graph.addTask({ missionId: "m1", type: "SOCIAL", title: "Follow on X", description: "Follow the project" });
    expect(task.status).toBe("READY");
  });

  it("a task with dependencies starts BLOCKED", () => {
    const graph = new TaskGraph();
    const first = graph.addTask({ missionId: "m1", type: "SOCIAL", title: "Follow", description: "d" });
    const second = graph.addTask({
      missionId: "m1",
      type: "QUEST",
      title: "Complete quest",
      description: "d",
      dependencies: [first.taskId],
    });
    expect(second.status).toBe("BLOCKED");
  });

  it("prevents referencing a dependency that doesn't exist yet, making cycles structurally impossible", () => {
    const graph = new TaskGraph();
    expect(() =>
      graph.addTask({ missionId: "m1", type: "SOCIAL", title: "x", description: "d", dependencies: ["nonexistent"] })
    ).toThrow(UnknownTaskError);
  });

  it("hasCycle() is false for a well-formed DAG built via addTask()", () => {
    const graph = new TaskGraph();
    const a = graph.addTask({ missionId: "m1", type: "SOCIAL", title: "a", description: "d" });
    const b = graph.addTask({ missionId: "m1", type: "QUEST", title: "b", description: "d", dependencies: [a.taskId] });
    graph.addTask({ missionId: "m1", type: "ONCHAIN", title: "c", description: "d", dependencies: [a.taskId, b.taskId] });
    expect(graph.hasCycle()).toBe(false);
  });

  it("complete() unblocks a dependent task only once ALL of its dependencies are done", () => {
    const graph = new TaskGraph();
    const a = graph.addTask({ missionId: "m1", type: "SOCIAL", title: "a", description: "d" });
    const b = graph.addTask({ missionId: "m1", type: "QUEST", title: "b", description: "d" });
    const c = graph.addTask({
      missionId: "m1",
      type: "ONCHAIN",
      title: "c",
      description: "d",
      dependencies: [a.taskId, b.taskId],
    });

    graph.complete(a.taskId);
    expect(graph.get(c.taskId).status).toBe("BLOCKED"); // b not done yet

    graph.complete(b.taskId);
    expect(graph.get(c.taskId).status).toBe("READY");
  });

  it("a completed dependency chain with a human gate unblocks into WAITING_HUMAN, not READY", () => {
    const graph = new TaskGraph();
    const a = graph.addTask({ missionId: "m1", type: "KYC_HANDOFF", title: "a", description: "d" });
    const b = graph.addTask({
      missionId: "m1",
      type: "CLAIM",
      title: "b",
      description: "d",
      dependencies: [a.taskId],
      requiresApprovalGate: true,
    });
    graph.complete(a.taskId);
    expect(graph.get(b.taskId).status).toBe("WAITING_HUMAN");
  });

  it("tasksForMission() filters by missionId", () => {
    const graph = new TaskGraph();
    graph.addTask({ missionId: "m1", type: "SOCIAL", title: "a", description: "d" });
    graph.addTask({ missionId: "m2", type: "SOCIAL", title: "b", description: "d" });
    expect(graph.tasksForMission("m1")).toHaveLength(1);
  });
});
