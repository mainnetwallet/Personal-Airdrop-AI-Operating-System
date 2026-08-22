/**
 * Task DAG for a mission.
 *
 * `addTask()` only accepts dependencies that already exist in the
 * graph, so a task can never depend on itself or on a task created
 * after it — this makes a dependency cycle structurally impossible to
 * construct rather than something that has to be detected after the
 * fact. `hasCycle()` is still provided as a defensive/testable
 * invariant check.
 */
import { randomUUID } from "node:crypto";
import type { Task, TaskStatus, TaskType } from "@airdrop-os/types";

export class UnknownTaskError extends Error {
  constructor(taskId: string) {
    super(`Unknown taskId: ${taskId}`);
    this.name = "UnknownTaskError";
  }
}

export class SelfDependencyError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} cannot depend on itself`);
    this.name = "SelfDependencyError";
  }
}

export interface AddTaskInput {
  missionId: string;
  type: TaskType;
  title: string;
  description: string;
  dependencies?: string[];
  requiresHumanGate?: boolean;
  requiresApprovalGate?: boolean;
}

export class TaskGraph {
  private readonly tasks = new Map<string, Task>();

  addTask(input: AddTaskInput): Task {
    const dependencies = input.dependencies ?? [];
    for (const depId of dependencies) {
      // A dependency must already exist — this is what makes a cycle
      // structurally unreachable (a task can only ever point "backward"
      // in insertion order).
      if (!this.tasks.has(depId)) throw new UnknownTaskError(depId);
    }
    const now = new Date().toISOString();
    const requiresGate = Boolean(input.requiresHumanGate || input.requiresApprovalGate);
    const task: Task = {
      taskId: randomUUID(),
      missionId: input.missionId,
      type: input.type,
      title: input.title,
      description: input.description,
      dependencies,
      conditions: [],
      outputs: [],
      requiresHumanGate: input.requiresHumanGate ?? false,
      requiresApprovalGate: input.requiresApprovalGate ?? false,
      status: dependencies.length > 0 ? "BLOCKED" : requiresGate ? "WAITING_HUMAN" : "READY",
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.taskId, task);
    return task;
  }

  get(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) throw new UnknownTaskError(taskId);
    return task;
  }

  tasksForMission(missionId: string): Task[] {
    return [...this.tasks.values()].filter((t) => t.missionId === missionId);
  }

  setStatus(taskId: string, status: TaskStatus): Task {
    const task = this.get(taskId);
    task.status = status;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  /**
   * Marks a task DONE and unblocks any dependent tasks whose *other*
   * dependencies are also all DONE — those move to WAITING_HUMAN if
   * they carry a human/approval gate, otherwise READY.
   */
  complete(taskId: string): Task {
    const task = this.get(taskId);
    task.status = "DONE";
    task.updatedAt = new Date().toISOString();

    for (const candidate of this.tasks.values()) {
      if (candidate.status !== "BLOCKED" || !candidate.dependencies.includes(taskId)) continue;
      const allDepsDone = candidate.dependencies.every((depId) => this.get(depId).status === "DONE");
      if (!allDepsDone) continue;
      candidate.status =
        candidate.requiresHumanGate || candidate.requiresApprovalGate ? "WAITING_HUMAN" : "READY";
      candidate.updatedAt = new Date().toISOString();
    }
    return task;
  }

  /** Defensive invariant check: DFS for a cycle among all tasks currently in the graph. addTask()'s construction rule should make this always false. */
  hasCycle(): boolean {
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (taskId: string): boolean => {
      if (visiting.has(taskId)) return true;
      if (visited.has(taskId)) return false;
      visiting.add(taskId);
      const task = this.tasks.get(taskId);
      if (task) {
        for (const depId of task.dependencies) {
          if (dfs(depId)) return true;
        }
      }
      visiting.delete(taskId);
      visited.add(taskId);
      return false;
    };

    for (const taskId of this.tasks.keys()) {
      if (dfs(taskId)) return true;
    }
    return false;
  }
}
