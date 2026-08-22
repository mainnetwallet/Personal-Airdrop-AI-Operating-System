import { describe, it, expect } from "vitest";
import { MissionStore, InvalidMissionTransitionError, UnknownMissionError } from "../mission.js";
import { TaskGraph } from "../task.js";

describe("MissionStore", () => {
  it("creates a mission in DRAFT status with zero progress", () => {
    const store = new MissionStore();
    const mission = store.create({ projectId: "p1", objective: "Complete the testnet campaign" });
    expect(mission.status).toBe("DRAFT");
    expect(mission.progress).toBe(0);
    expect(mission.eligibility).toBe("UNKNOWN");
  });

  it("throws on unknown missionId", () => {
    const store = new MissionStore();
    expect(() => store.get("nope")).toThrow(UnknownMissionError);
  });

  it("validates status transitions", () => {
    const store = new MissionStore();
    const mission = store.create({ projectId: "p1", objective: "x" });
    store.transition(mission.missionId, "ACTIVE");
    expect(() => store.transition(mission.missionId, "DRAFT")).toThrow(InvalidMissionTransitionError);
    store.transition(mission.missionId, "PAUSED");
    store.transition(mission.missionId, "ACTIVE");
    store.transition(mission.missionId, "COMPLETED");
    expect(() => store.transition(mission.missionId, "ACTIVE")).toThrow(InvalidMissionTransitionError);
  });

  it("attachTask()/attachRequirement() are idempotent", () => {
    const store = new MissionStore();
    const mission = store.create({ projectId: "p1", objective: "x" });
    store.attachTask(mission.missionId, "t1");
    store.attachTask(mission.missionId, "t1");
    expect(store.get(mission.missionId).tasks).toEqual(["t1"]);
  });

  it("recomputeProgress() derives progress from attached task statuses and auto-completes when all are DONE", () => {
    const missionStore = new MissionStore();
    const taskGraph = new TaskGraph();

    const mission = missionStore.create({ projectId: "p1", objective: "Do the campaign" });
    missionStore.transition(mission.missionId, "ACTIVE");

    const t1 = taskGraph.addTask({ missionId: mission.missionId, type: "SOCIAL", title: "a", description: "d" });
    const t2 = taskGraph.addTask({ missionId: mission.missionId, type: "QUEST", title: "b", description: "d" });
    missionStore.attachTask(mission.missionId, t1.taskId);
    missionStore.attachTask(mission.missionId, t2.taskId);

    taskGraph.complete(t1.taskId);
    const midway = missionStore.recomputeProgress(mission.missionId, taskGraph.tasksForMission(mission.missionId));
    expect(midway.progress).toBe(0.5);
    expect(midway.status).toBe("ACTIVE");

    taskGraph.complete(t2.taskId);
    const finished = missionStore.recomputeProgress(mission.missionId, taskGraph.tasksForMission(mission.missionId));
    expect(finished.progress).toBe(1);
    expect(finished.status).toBe("COMPLETED");
  });

  it("setEligibility() updates the mission's eligibility field", () => {
    const store = new MissionStore();
    const mission = store.create({ projectId: "p1", objective: "x" });
    const updated = store.setEligibility(mission.missionId, "QUALIFIED");
    expect(updated.eligibility).toBe("QUALIFIED");
  });
});
