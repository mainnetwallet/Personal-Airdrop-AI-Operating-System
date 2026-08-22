/**
 * Phase 8: Airdrop coverage / off-chain intelligence / plugins.
 *
 * Registers mock adapters (see mockOffChainAdapter.ts) for every
 * AirdropType named in the Phase 8 build prompt, grouped by the
 * category the prompt describes. Nothing here fetches live data —
 * `registerPhase8Adapters()` only wires shape + safety contract +
 * IntegrationRegistry status reporting into the existing
 * AirdropAdapterRegistry from Phase 3.
 *
 * Prediction/trading and exchange categories intentionally have no
 * "execute trade" or "auto-claim" capability anywhere in their
 * config — `estimateRisk`/`claim` stay generic mock-adapter behavior,
 * per "NO autonomous financial trading" / "never auto-execute
 * sensitive financial actions."
 */
import type { AirdropType, OffChainCategory } from "@airdrop-os/types";
import type { AirdropAdapterRegistry } from "./registry.js";
import type { IntegrationRegistry } from "../integrations/integrationRegistry.js";
import { createMockOffChainAdapter, type MockOffChainAdapterConfig } from "./mockOffChainAdapter.js";

interface CategorySpec {
  category: OffChainCategory;
  types: AirdropType[];
  requiredIntegrations: MockOffChainAdapterConfig["requiredIntegrations"];
  requirementTemplates: string[];
  costEstimate: number | null;
  timeEstimate: string | null;
  riskEstimate: number | null;
}

export const PHASE8_CATEGORY_SPECS: readonly CategorySpec[] = [
  {
    category: "DISCORD_INTELLIGENCE",
    types: ["DISCORD"],
    requiredIntegrations: ["DISCORD"],
    requirementTemplates: [
      "Track official announcements, campaign updates, requirements, deadlines, and claim windows",
      "Track official links and security warnings posted by verified roles",
    ],
    costEstimate: 0,
    timeEstimate: "ongoing monitoring",
    riskEstimate: 1,
  },
  {
    category: "SOCIAL_INTELLIGENCE",
    types: ["SOCIAL", "TELEGRAM", "COMMUNITY", "CONTENT"],
    requiredIntegrations: ["X", "TELEGRAM"],
    requirementTemplates: [
      "Track official X/Telegram/community posts for campaign, referral, and ambassador updates",
      "Respect platform rules — never simulate or fabricate engagement",
    ],
    costEstimate: 0,
    timeEstimate: "ongoing monitoring",
    riskEstimate: 1,
  },
  {
    category: "QUEST",
    types: ["QUEST", "BOUNTY"],
    requiredIntegrations: ["QUEST_PLATFORM"],
    requirementTemplates: [
      "Track quest/XP/points/badge/leaderboard state from the quest platform",
      "Verify campaign completion criteria before marking any quest complete",
    ],
    costEstimate: 0,
    timeEstimate: "varies by quest",
    riskEstimate: 2,
  },
  {
    category: "DEVELOPER",
    types: ["DEVELOPER", "GITHUB", "CODE_CONTRIBUTION", "BUG_REPORT", "FEEDBACK"],
    requiredIntegrations: ["GITHUB"],
    requirementTemplates: [
      "Track repositories, commits, issues, PRs, bug reports, docs, SDK/API changes, testnets, hackathons, and bounties",
    ],
    costEstimate: 0,
    timeEstimate: "varies by contribution",
    riskEstimate: 2,
  },
  {
    category: "DEPIN",
    types: ["DEPIN", "STORAGE", "BANDWIDTH", "MOBILE_NETWORK"],
    requiredIntegrations: ["DEPIN_NETWORK"],
    requirementTemplates: [
      "Track node/device uptime, proof-of-resource, and proof-of-coverage epochs and points",
    ],
    costEstimate: null,
    timeEstimate: "ongoing (per epoch)",
    riskEstimate: 3,
  },
  {
    category: "AI_COMPUTE",
    types: ["AI", "GPU", "COMPUTE"],
    requiredIntegrations: ["AI_COMPUTE_PLATFORM"],
    requirementTemplates: [
      "Track GPU/compute/inference/model-usage/dataset/API task points and epochs",
    ],
    costEstimate: null,
    timeEstimate: "ongoing (per epoch)",
    riskEstimate: 3,
  },
  {
    category: "GAMING_GAMEFI",
    types: ["GAMING", "GAMEFI", "METAVERSE"],
    requiredIntegrations: ["GAMEFI_PLATFORM"],
    requirementTemplates: [
      "Track game account, sessions, NFT/mint activity, XP, levels, quests, achievements, leaderboard, season, and guild state",
    ],
    costEstimate: null,
    timeEstimate: "varies by season",
    riskEstimate: 3,
  },
  {
    category: "PREDICTION_TRADING",
    types: ["PREDICTION_MARKET", "TRADING"],
    requiredIntegrations: ["PREDICTION_TRADING_PLATFORM"],
    requirementTemplates: [
      "Track legitimate campaign data only — this adapter never places trades, opens positions, or executes any financial action",
    ],
    costEstimate: null,
    timeEstimate: null,
    riskEstimate: 4,
  },
  {
    category: "REFERRAL",
    types: ["REFERRAL"],
    requiredIntegrations: ["REFERRAL_PLATFORM"],
    requirementTemplates: [
      "Track referral code/source/invite/verified-status/reward conditions",
      "Flag self-referral, duplicate, or suspicious patterns for awareness only — never fabricate accounts",
    ],
    costEstimate: 0,
    timeEstimate: "ongoing",
    riskEstimate: 2,
  },
  {
    category: "AMBASSADOR_CREATOR",
    types: ["AMBASSADOR", "COMMUNITY_CONTRIBUTOR", "TRANSLATION", "CREATOR"],
    requiredIntegrations: ["AMBASSADOR_PLATFORM"],
    requirementTemplates: [
      "Track application/acceptance status, assigned tasks, content/events/translation deadlines, rewards, and submitted evidence",
    ],
    costEstimate: null,
    timeEstimate: "varies by program",
    riskEstimate: 2,
  },
  {
    category: "EXCHANGE",
    types: ["EXCHANGE_CAMPAIGN"],
    requiredIntegrations: ["EXCHANGE"],
    requirementTemplates: [
      "Track legitimate exchange campaign data only — this adapter never auto-executes sensitive financial actions",
    ],
    costEstimate: null,
    timeEstimate: null,
    riskEstimate: 4,
  },
  {
    category: "WAITLIST_BETA",
    types: ["WAITLIST", "BETA", "EARLY_ACCESS"],
    requiredIntegrations: ["WAITLIST_PLATFORM"],
    requirementTemplates: [
      "Track application/invite/access status, activity, deadlines, and submitted evidence",
    ],
    costEstimate: 0,
    timeEstimate: "varies by program",
    riskEstimate: 2,
  },
  {
    category: "LEARN_TO_EARN",
    types: ["LEARN_TO_EARN"],
    requiredIntegrations: ["LEARN_PLATFORM"],
    requirementTemplates: [
      "Track course/lesson/quiz progress, score, certificate, and completion status — never fabricate completion",
    ],
    costEstimate: 0,
    timeEstimate: "varies by course",
    riskEstimate: 1,
  },
];

/**
 * Registers a mock adapter for every AirdropType covered by Phase 8
 * into the given registry. AirdropTypes outside this list (e.g.
 * on-chain types owned by future phases) are untouched and continue
 * to resolve to the Phase 3 NOT_CONFIGURED stub.
 */
export function registerPhase8Adapters(
  registry: AirdropAdapterRegistry,
  integrations: IntegrationRegistry,
): void {
  for (const spec of PHASE8_CATEGORY_SPECS) {
    for (const type of spec.types) {
      registry.register(
        createMockOffChainAdapter(
          {
            type,
            category: spec.category,
            requiredIntegrations: spec.requiredIntegrations,
            requirementTemplates: spec.requirementTemplates,
            costEstimate: spec.costEstimate,
            timeEstimate: spec.timeEstimate,
            riskEstimate: spec.riskEstimate,
          },
          integrations,
        ),
      );
    }
  }
}
