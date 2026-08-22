/**
 * Phase 8: Generic factory for the broad off-chain intelligence
 * adapters (Discord, social, quest, developer, DePIN, AI/compute,
 * gaming/GameFi, prediction/trading, referral, ambassador/creator,
 * exchange, waitlist/beta, learn-to-earn).
 *
 * These are MOCK adapters: status "IMPLEMENTED" here means "the
 * adapter shape and safety contract are real," not "this pulls live
 * data." No live data ever appears — `research`/`verify`/`monitor`
 * report the underlying IntegrationRegistry state and nothing else.
 * calculateEligibility() never returns `eligible: true` without a real
 * evidence source and claim() never returns anything but
 * NOT_CONFIGURED (this repo's transaction/claim rule: claiming is
 * never automatic in any case). This mirrors the same "never fabricate
 * completion" contract every other Phase 8 category prompt names.
 */
import type { AdapterClaimResult, AirdropAdapter, AirdropType, IntegrationProvider, Project } from "@airdrop-os/types";
import type { IntegrationRegistry } from "../integrations/integrationRegistry.js";

export interface MockOffChainAdapterConfig {
  type: AirdropType;
  category: string;
  requiredIntegrations: IntegrationProvider[];
  requirementTemplates: string[];
  costEstimate: number | null;
  timeEstimate: string | null;
  riskEstimate: number | null;
}

export function createMockOffChainAdapter(
  config: MockOffChainAdapterConfig,
  integrations: IntegrationRegistry,
): AirdropAdapter {
  const integrationSummary = () => config.requiredIntegrations.map((p) => integrations.getStatus(p));
  const anyConnected = () => config.requiredIntegrations.some((p) => integrations.isConnected(p));
  const allConnected = () => config.requiredIntegrations.every((p) => integrations.isConnected(p));

  return {
    type: config.type,
    status: "IMPLEMENTED",

    detect: (input) => {
      const haystack = [input.category ?? "", input.name, ...input.keywords].join(" ").toUpperCase();
      return haystack.includes(config.type) || haystack.includes(config.category);
    },

    research: (_project: Project) => ({
      category: config.category,
      airdropType: config.type,
      integrations: integrationSummary(),
      note: "Mock adapter — no live data source connected in this sandbox.",
    }),

    verify: (_project: Project) => ({
      verified: false,
      reason: allConnected()
        ? "Integration(s) connected, but no live verification call is wired yet in this sandbox."
        : "NOT_CONFIGURED: required integration(s) not connected.",
      integrations: integrationSummary(),
    }),

    extractRequirements: () => [...config.requirementTemplates],

    calculateEligibility: (_project: Project, _context: Record<string, unknown>) => ({
      eligible: "UNKNOWN" as const,
      reason: `Mock ${config.category} adapter for ${config.type}: no live evidence source connected, so eligibility is never fabricated as true or false.`,
    }),

    estimateCost: () => config.costEstimate,
    estimateTime: () => config.timeEstimate,
    estimateRisk: () => config.riskEstimate,

    buildTasks: () => config.requirementTemplates.map((requirement) => ({
      title: requirement,
      description: `Complete and verify: ${requirement}`,
    })),

    buildMission: () => ({
      title: `${config.category} mission (mock — ${config.type})`,
      steps: [...config.requirementTemplates],
    }),

    monitor: () => ({
      checkedAt: new Date().toISOString(),
      changed: false,
      notes: anyConnected()
        ? "Integration connected, but live polling is not yet wired in this sandbox."
        : "NOT_CONFIGURED: no required integration is connected.",
    }),

    claim: (_project: Project): AdapterClaimResult => ({
      status: "NOT_CONFIGURED",
      reason: "Mock adapter with no live integration; claiming is never automatic in any case.",
    }),

    report: () => ({
      summary: `Mock ${config.category} coverage for ${config.type} — no live data in this sandbox.`,
      generatedAt: new Date().toISOString(),
    }),
  };
}
