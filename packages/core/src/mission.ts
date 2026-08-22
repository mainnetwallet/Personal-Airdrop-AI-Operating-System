/**
 * Mission store. A mission tracks an objective for a project/campaign,
 * the requirements and tasks attached to it, and progress derived from
 * task completion — never set directly, always recomputed from the
 * attached tasks' actual statuses.
 */
import { randomUUID } from "node:crypto";
import type { EligibilityState, Mission, MissionStatus, Task } from "@airdrop-os/types";

export class UnknownMissionError extends Error {
  constructor(missionId: string) {
    super(`Unknown missionId: ${missionId}`);
    this.name = "UnknownMissionError";
  }
}

export class InvalidMissionTransitionError extends Error {
  constructor(public readonly from: MissionStatus, public readonly to: MissionStatus) {
    super(`Invalid mission status transition: ${from} -> ${to}`);
    this.name = "InvalidMissionTransitionError";
  }
}

const MISSION_TRANSITIONS: Record<MissionStatus, ReadonlySet<MissionStatus>> = {
  DRAFT: new Set(["ACTIVE", "ABANDONED"]),
  ACTIVE: new Set(["PAUSED", "BLOCKED", "COMPLETED", "ABANDONED"]),
  PAUSED: new Set(["ACTIVE", "ABANDONED"]),
  BLOCKED: new Set(["ACTIVE", "ABANDONED"]),
  COMPLETED: new Set([]),
  ABANDONED: new Set([]),
};

export interface CreateMissionInput {
  projectId: string;
  campaignId?: string | null;
  objective: string;
  deadline?: string | null;
  budget?: number | null;
  timeBudget?: string | null;
  risk?: number | null;
}

export class MissionStore {
  private readonly missions = new Map<string, Mission>();

  create(input: CreateMissionInput): Mission {
    const now = new Date().toISOString();
    const mission: Mission = {
      missionId: randomUUID(),
      projectId: input.projectId,
      campaignId: input.campaignId ?? null,
      objective: input.objective,
      requirements: [],
      tasks: [],
      dependencies: [],
      deadline: input.deadline ?? null,
      budget: input.budget ?? null,
      timeBudget: input.timeBudget ?? null,
      risk: input.risk ?? null,
      status: "DRAFT",
      progress: 0,
      eligibility: "UNKNOWN",
      rewardSignal: null,
      workflow: null,
      checkpoint: null,
      createdAt: now,
      updatedAt: now,
    };
    this.missions.set(mission.missionId, mission);
    return mission;
  }

  get(missionId: string): Mission {
    const mission = this.missions.get(missionId);
    if (!mission) throw new UnknownMissionError(missionId);
    return mission;
  }

  transition(missionId: string, to: MissionStatus): Mission {
    const mission = this.get(missionId);
    if (!MISSION_TRANSITIONS[mission.status].has(to)) {
      throw new InvalidMissionTransitionError(mission.status, to);
    }
    mission.status = to;
    mission.updatedAt = new Date().toISOString();
    return mission;
  }

  attachRequirement(missionId: string, requirementId: string): Mission {
    const mission = this.get(missionId);
    if (!mission.requirements.includes(requirementId)) mission.requirements.push(requirementId);
    mission.updatedAt = new Date().toISOString();
    return mission;
  }

  attachTask(missionId: string, taskId: string): Mission {
    const mission = this.get(missionId);
    if (!mission.tasks.includes(taskId)) mission.tasks.push(taskId);
    mission.updatedAt = new Date().toISOString();
    return mission;
  }

  /** Recomputes progress as the fraction of the mission's attached tasks that are DONE, and stamps a checkpoint. Auto-completes the mission when every attached task is done. */
  recomputeProgress(missionId: string, tasks: Task[]): Mission {
    const mission = this.get(missionId);
    const relevant = tasks.filter((t) => mission.tasks.includes(t.taskId));
    mission.progress = relevant.length === 0 ? 0 : relevant.filter((t) => t.status === "DONE").length / relevant.length;
    const now = new Date().toISOString();
    mission.checkpoint = now;
    mission.updatedAt = now;
    if (mission.status === "ACTIVE" && relevant.length > 0 && mission.progress === 1) {
      mission.status = "COMPLETED";
    }
    return mission;
  }

  setEligibility(missionId: string, eligibility: EligibilityState): Mission {
    const mission = this.get(missionId);
    mission.eligibility = eligibility;
    mission.updatedAt = new Date().toISOString();
    return mission;
  }

  forProject(projectId: string): Mission[] {
    return [...this.missions.values()].filter((m) => m.projectId === projectId);
  }
}
