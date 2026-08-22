/**
 * Requirement store with append-only versioning.
 *
 * History is never overwritten: `supersede()` closes the current
 * version's `validUntil` and appends a brand-new version with
 * `supersedesVersion` pointing back to it. `versionAt()` is the
 * building block for historical backtesting — it returns whichever
 * version was valid at a given point in time, so evaluating an old
 * activity against "the requirement" always means the version that
 * was actually in force when that activity happened, never today's
 * version applied retroactively.
 */
import { randomUUID } from "node:crypto";
import type { Requirement, RequirementStatus, RequirementType, ClaimConfidence } from "@airdrop-os/types";

export class UnknownRequirementError extends Error {
  constructor(requirementId: string) {
    super(`Unknown requirementId: ${requirementId}`);
    this.name = "UnknownRequirementError";
  }
}

export class InactiveRequirementError extends Error {
  constructor(requirementId: string, status: RequirementStatus) {
    super(`Cannot supersede requirementId ${requirementId}: current version status is ${status}, not ACTIVE`);
    this.name = "InactiveRequirementError";
  }
}

export interface CreateRequirementInput {
  projectId: string;
  campaignId?: string | null;
  seasonId?: string | null;
  epochId?: string | null;
  type: RequirementType;
  description: string;
  source: string;
  evidence?: string[];
  confidence?: ClaimConfidence;
  deadline?: string | null;
  minimum?: number | null;
  maximum?: number | null;
  wallet?: string | null;
  account?: string | null;
  chain?: string | null;
  activity?: string | null;
  duration?: string | null;
  volume?: number | null;
  snapshot?: string | null;
}

export type SupersedeRequirementInput = Partial<
  Omit<CreateRequirementInput, "projectId"> & { status: RequirementStatus }
>;

export class RequirementStore {
  // requirementId -> versions, ordered ascending by version number.
  private readonly versions = new Map<string, Requirement[]>();

  create(input: CreateRequirementInput): Requirement {
    const now = new Date().toISOString();
    const requirement: Requirement = {
      requirementId: randomUUID(),
      projectId: input.projectId,
      campaignId: input.campaignId ?? null,
      seasonId: input.seasonId ?? null,
      epochId: input.epochId ?? null,
      type: input.type,
      description: input.description,
      source: input.source,
      evidence: input.evidence ?? [],
      confidence: input.confidence ?? "UNCERTAIN",
      status: "ACTIVE",
      deadline: input.deadline ?? null,
      minimum: input.minimum ?? null,
      maximum: input.maximum ?? null,
      wallet: input.wallet ?? null,
      account: input.account ?? null,
      chain: input.chain ?? null,
      activity: input.activity ?? null,
      duration: input.duration ?? null,
      volume: input.volume ?? null,
      snapshot: input.snapshot ?? null,
      version: 1,
      validFrom: now,
      validUntil: null,
      supersedesVersion: null,
      createdAt: now,
      updatedAt: now,
    };
    this.versions.set(requirement.requirementId, [requirement]);
    return requirement;
  }

  private historyOrThrow(requirementId: string): Requirement[] {
    const history = this.versions.get(requirementId);
    if (!history || history.length === 0) throw new UnknownRequirementError(requirementId);
    return history;
  }

  /** The latest version on record, regardless of its status. */
  current(requirementId: string): Requirement {
    const history = this.historyOrThrow(requirementId);
    return history[history.length - 1];
  }

  /** Full version history, oldest first. */
  history(requirementId: string): Requirement[] {
    return [...this.historyOrThrow(requirementId)];
  }

  /**
   * The requirement version that was valid at `atIso` — i.e. the
   * version whose [validFrom, validUntil) window contains it. Returns
   * null if no version was in force at that time (e.g. before the
   * requirement was first created).
   */
  versionAt(requirementId: string, atIso: string): Requirement | null {
    const history = this.historyOrThrow(requirementId);
    return (
      history.find((v) => v.validFrom <= atIso && (v.validUntil === null || atIso < v.validUntil)) ?? null
    );
  }

  /** Closes the current active version and appends a new one carrying the changes, linked via supersedesVersion. */
  supersede(requirementId: string, patch: SupersedeRequirementInput): Requirement {
    const history = this.historyOrThrow(requirementId);
    const activeVersion = history[history.length - 1];
    if (activeVersion.status !== "ACTIVE") {
      throw new InactiveRequirementError(requirementId, activeVersion.status);
    }
    const now = new Date().toISOString();
    activeVersion.status = "SUPERSEDED";
    activeVersion.validUntil = now;
    activeVersion.updatedAt = now;

    const next: Requirement = {
      ...activeVersion,
      ...patch,
      requirementId,
      version: activeVersion.version + 1,
      status: "ACTIVE",
      validFrom: now,
      validUntil: null,
      supersedesVersion: activeVersion.version,
      createdAt: now,
      updatedAt: now,
    };
    history.push(next);
    return next;
  }

  /** Terminal: marks the current version EXPIRED without creating a new version. */
  expire(requirementId: string): Requirement {
    const history = this.historyOrThrow(requirementId);
    const activeVersion = history[history.length - 1];
    activeVersion.status = "EXPIRED";
    activeVersion.updatedAt = new Date().toISOString();
    return activeVersion;
  }

  /** Terminal: marks the current version RETRACTED (it was wrong / withdrawn), without creating a new version. */
  retract(requirementId: string): Requirement {
    const history = this.historyOrThrow(requirementId);
    const activeVersion = history[history.length - 1];
    activeVersion.status = "RETRACTED";
    activeVersion.updatedAt = new Date().toISOString();
    return activeVersion;
  }

  forProject(projectId: string): Requirement[] {
    return [...this.versions.values()]
      .map((h) => h[h.length - 1])
      .filter((r) => r.projectId === projectId);
  }
}
