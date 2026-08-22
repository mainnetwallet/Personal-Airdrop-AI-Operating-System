/**
 * Season / Epoch Engine (spec section 48).
 *
 * `campaign.ts` already records SEASON/EPOCH as phases in a campaign's
 * timeline, which is enough to know a season or epoch *happened*. This
 * module is the first-class version the spec actually asks for:
 * seasons and epochs as addressable entities with their own status,
 * date range, points cap, and (for epochs) snapshot metadata - so a
 * caller can ask "what epoch are we in for season X" or "has this
 * epoch's snapshot been taken" without re-deriving it from timeline
 * events.
 *
 * This does not replace CampaignStore's timeline; a caller that wants
 * both a timeline event *and* a first-class Season/Epoch record should
 * write to both (kernel wiring, not this module's job).
 */
import { randomUUID } from "node:crypto";
import type { Epoch, EpochStatus, Season, SeasonStatus } from "@airdrop-os/types";

export class UnknownSeasonError extends Error {
  constructor(seasonId: string) {
    super(`Unknown seasonId: ${seasonId}`);
    this.name = "UnknownSeasonError";
  }
}

export class UnknownEpochError extends Error {
  constructor(epochId: string) {
    super(`Unknown epochId: ${epochId}`);
    this.name = "UnknownEpochError";
  }
}

export interface CreateSeasonInput {
  campaignId: string;
  name: string;
  startAt?: string | null;
  endAt?: string | null;
  pointsCap?: number | null;
}

export interface CreateEpochInput {
  seasonId: string;
  index: number;
  startAt?: string | null;
  endAt?: string | null;
}

export class SeasonStore {
  private readonly seasons = new Map<string, Season>();
  private readonly epochs = new Map<string, Epoch>();

  createSeason(input: CreateSeasonInput): Season {
    const now = new Date().toISOString();
    const season: Season = {
      seasonId: randomUUID(),
      campaignId: input.campaignId,
      name: input.name,
      status: "UPCOMING",
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      pointsCap: input.pointsCap ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.seasons.set(season.seasonId, season);
    return season;
  }

  getSeason(seasonId: string): Season {
    const season = this.seasons.get(seasonId);
    if (!season) throw new UnknownSeasonError(seasonId);
    return season;
  }

  setSeasonStatus(seasonId: string, status: SeasonStatus): Season {
    const season = this.getSeason(seasonId);
    season.status = status;
    season.updatedAt = new Date().toISOString();
    return season;
  }

  seasonsForCampaign(campaignId: string): Season[] {
    return [...this.seasons.values()].filter((s) => s.campaignId === campaignId);
  }

  /** The season currently ACTIVE for a campaign, if any (never guesses among several — flags conflict instead). */
  activeSeasonFor(campaignId: string): Season | "NONE" | "CONFLICTED" {
    const active = this.seasonsForCampaign(campaignId).filter((s) => s.status === "ACTIVE");
    if (active.length === 0) return "NONE";
    if (active.length > 1) return "CONFLICTED";
    return active[0]!;
  }

  createEpoch(input: CreateEpochInput): Epoch {
    // Confirms the season exists; throws UnknownSeasonError otherwise.
    this.getSeason(input.seasonId);
    const now = new Date().toISOString();
    const epoch: Epoch = {
      epochId: randomUUID(),
      seasonId: input.seasonId,
      index: input.index,
      status: "UPCOMING",
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      snapshotBlock: null,
      snapshotAt: null,
      pointsAwarded: null,
      createdAt: now,
      updatedAt: now,
    };
    this.epochs.set(epoch.epochId, epoch);
    return epoch;
  }

  getEpoch(epochId: string): Epoch {
    const epoch = this.epochs.get(epochId);
    if (!epoch) throw new UnknownEpochError(epochId);
    return epoch;
  }

  setEpochStatus(epochId: string, status: EpochStatus): Epoch {
    const epoch = this.getEpoch(epochId);
    epoch.status = status;
    epoch.updatedAt = new Date().toISOString();
    return epoch;
  }

  /** Section 61-style snapshot proof anchor: records the block/timestamp an epoch's snapshot was taken at. */
  recordSnapshot(epochId: string, snapshotBlock: number, snapshotAt: string | null = null): Epoch {
    const epoch = this.getEpoch(epochId);
    epoch.snapshotBlock = snapshotBlock;
    epoch.snapshotAt = snapshotAt ?? new Date().toISOString();
    epoch.status = "SNAPSHOT_TAKEN";
    epoch.updatedAt = new Date().toISOString();
    return epoch;
  }

  recordPointsAwarded(epochId: string, points: number): Epoch {
    const epoch = this.getEpoch(epochId);
    epoch.pointsAwarded = points;
    epoch.updatedAt = new Date().toISOString();
    return epoch;
  }

  epochsForSeason(seasonId: string): Epoch[] {
    return [...this.epochs.values()]
      .filter((e) => e.seasonId === seasonId)
      .sort((a, b) => a.index - b.index);
  }

  /** The epoch currently ACTIVE (or awaiting/holding a snapshot) for a season, if any. */
  currentEpochFor(seasonId: string): Epoch | "NONE" {
    const epochs = this.epochsForSeason(seasonId);
    const current = epochs.find((e) => e.status === "ACTIVE" || e.status === "SNAPSHOT_PENDING");
    return current ?? "NONE";
  }
}
