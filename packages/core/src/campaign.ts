/**
 * Campaign / season / epoch timeline tracking.
 *
 * Unlike project/agent-run state, campaign phases are observed from an
 * external process this system does not control (a project's own
 * announcement/testnet/mainnet/snapshot/claim schedule), so
 * recordPhase() never rejects an out-of-order phase — a project can
 * skip WAITLIST/BETA straight to TESTNET, or announce a SNAPSHOT before
 * a formally recorded MAINNET phase. It only appends to history and
 * updates the current phase; it is a record, not a validator.
 */
import { randomUUID } from "node:crypto";
import type { Campaign, CampaignPhase, CampaignTimelineEvent } from "@airdrop-os/types";

export const CAMPAIGN_PHASE_ORDER: readonly CampaignPhase[] = [
  "DISCOVERY", "ANNOUNCEMENT", "WAITLIST", "BETA", "ALPHA", "TESTNET",
  "MAINNET", "CAMPAIGN", "SEASON", "EPOCH", "SNAPSHOT", "ELIGIBILITY",
  "CLAIM", "DISTRIBUTION",
];

export class UnknownCampaignError extends Error {
  constructor(campaignId: string) {
    super(`Unknown campaignId: ${campaignId}`);
    this.name = "UnknownCampaignError";
  }
}

export interface CreateCampaignInput {
  projectId: string;
  name: string;
}

export class CampaignStore {
  private readonly campaigns = new Map<string, Campaign>();

  create(input: CreateCampaignInput): Campaign {
    const now = new Date().toISOString();
    const campaign: Campaign = {
      campaignId: randomUUID(),
      projectId: input.projectId,
      name: input.name,
      currentPhase: "DISCOVERY",
      timeline: [],
      createdAt: now,
      updatedAt: now,
    };
    this.campaigns.set(campaign.campaignId, campaign);
    return campaign;
  }

  get(campaignId: string): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new UnknownCampaignError(campaignId);
    return campaign;
  }

  recordPhase(
    campaignId: string,
    phase: CampaignPhase,
    occurredAt: string | null = null,
    note: string | null = null
  ): Campaign {
    const campaign = this.get(campaignId);
    const event: CampaignTimelineEvent = {
      eventId: randomUUID(),
      campaignId,
      phase,
      occurredAt: occurredAt ?? new Date().toISOString(),
      note,
    };
    campaign.timeline.push(event);
    campaign.currentPhase = phase;
    campaign.updatedAt = new Date().toISOString();
    return campaign;
  }

  timelineFor(campaignId: string): CampaignTimelineEvent[] {
    return this.get(campaignId).timeline;
  }

  listForProject(projectId: string): Campaign[] {
    return [...this.campaigns.values()].filter((c) => c.projectId === projectId);
  }
}
