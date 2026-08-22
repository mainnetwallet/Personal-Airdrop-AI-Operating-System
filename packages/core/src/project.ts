/**
 * Project store + lifecycle state machine.
 *
 * Mirrors kernelState.ts: transitions are validated against an explicit
 * adjacency list so a project can't jump straight from DISCOVERED to
 * CLAIMED without passing through RESEARCHING/VERIFIED first, and
 * COMPLETED/EXPIRED/REJECTED are terminal. RISKY is reachable from most
 * non-terminal states since risk can surface at any point in research.
 */
import { randomUUID } from "node:crypto";
import type { Project, ProjectState } from "@airdrop-os/types";

export const PROJECT_TERMINAL_STATES: ReadonlySet<ProjectState> = new Set([
  "COMPLETED",
  "EXPIRED",
  "REJECTED",
]);

const PROJECT_TRANSITIONS: Record<ProjectState, ReadonlySet<ProjectState>> = {
  DISCOVERED: new Set(["RESEARCHING", "REJECTED"]),
  RESEARCHING: new Set(["VERIFIED", "WATCHING", "RISKY", "REJECTED"]),
  VERIFIED: new Set(["WATCHING", "ACTIVE", "RISKY", "REJECTED"]),
  WATCHING: new Set(["ACTIVE", "RISKY", "EXPIRED", "REJECTED"]),
  ACTIVE: new Set(["PAUSED", "CLAIMABLE", "RISKY", "EXPIRED"]),
  PAUSED: new Set(["ACTIVE", "EXPIRED", "REJECTED"]),
  CLAIMABLE: new Set(["CLAIMED", "EXPIRED", "RISKY"]),
  CLAIMED: new Set(["COMPLETED"]),
  COMPLETED: new Set([]),
  EXPIRED: new Set([]),
  REJECTED: new Set([]),
  RISKY: new Set(["WATCHING", "RESEARCHING", "REJECTED"]),
};

export class InvalidProjectTransitionError extends Error {
  constructor(public readonly from: ProjectState, public readonly to: ProjectState) {
    super(`Invalid project state transition: ${from} -> ${to}`);
    this.name = "InvalidProjectTransitionError";
  }
}

export function isValidProjectTransition(from: ProjectState, to: ProjectState): boolean {
  if (from === to) return false;
  return PROJECT_TRANSITIONS[from].has(to);
}

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Unknown projectId: ${projectId}`);
    this.name = "ProjectNotFoundError";
  }
}

export class DuplicateProjectSlugError extends Error {
  constructor(slug: string) {
    super(`Project slug already exists: ${slug}`);
    this.name = "DuplicateProjectSlugError";
  }
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  website?: string | null;
  chains?: string[];
  category?: string | null;
}

export class ProjectStore {
  private readonly projects = new Map<string, Project>();
  private readonly slugIndex = new Map<string, string>();

  create(input: CreateProjectInput): Project {
    if (this.slugIndex.has(input.slug)) {
      throw new DuplicateProjectSlugError(input.slug);
    }
    const now = new Date().toISOString();
    const project: Project = {
      projectId: randomUUID(),
      name: input.name,
      slug: input.slug,
      logo: null,
      website: input.website ?? null,
      officialSources: [],
      socialLinks: {},
      docs: null,
      github: null,
      discord: null,
      telegram: null,
      xAccount: null,
      chains: input.chains ?? [],
      contracts: [],
      category: input.category ?? null,
      funding: null,
      backers: [],
      status: "DISCOVERED",
      airdropStatus: null,
      confidence: "UNCERTAIN",
      opportunityScore: 0,
      riskScore: 0,
      estimatedCost: null,
      estimatedTime: null,
      priority: 0,
      lastVerified: null,
      nextCheck: null,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(project.projectId, project);
    this.slugIndex.set(project.slug, project.projectId);
    return project;
  }

  get(projectId: string): Project {
    const project = this.projects.get(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);
    return project;
  }

  getBySlug(slug: string): Project | undefined {
    const id = this.slugIndex.get(slug);
    return id ? this.projects.get(id) : undefined;
  }

  /** Validates and applies a state transition. Throws on an illegal transition or when the project is already terminal. */
  transition(projectId: string, to: ProjectState, _reason: string | null = null): Project {
    const project = this.get(projectId);
    if (PROJECT_TERMINAL_STATES.has(project.status) || !isValidProjectTransition(project.status, to)) {
      throw new InvalidProjectTransitionError(project.status, to);
    }
    project.status = to;
    project.updatedAt = new Date().toISOString();
    if (to === "VERIFIED") project.lastVerified = project.updatedAt;
    return project;
  }

  update(projectId: string, patch: Partial<Omit<Project, "projectId" | "createdAt">>): Project {
    const project = this.get(projectId);
    Object.assign(project, patch, { updatedAt: new Date().toISOString() });
    return project;
  }

  list(filter?: { status?: ProjectState }): Project[] {
    const all = [...this.projects.values()];
    if (!filter?.status) return all;
    return all.filter((p) => p.status === filter.status);
  }
}
