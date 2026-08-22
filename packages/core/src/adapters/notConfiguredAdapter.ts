/**
 * Fallback adapter for any AirdropType without a real, registered
 * adapter. Every method reports NOT_CONFIGURED explicitly rather than
 * fabricating a result, per the Phase 3 build contract ("unimplemented
 * adapters must be NOT_CONFIGURED"). claim() in particular never
 * returns anything other than NOT_CONFIGURED or REQUIRES_MANUAL_APPROVAL
 * — this system never auto-signs or auto-transfers funds, and an
 * unimplemented adapter has no path to change that.
 */
import type { AdapterClaimResult, AirdropAdapter, AirdropType, Project } from "@airdrop-os/types";

export function createNotConfiguredAdapter(type: AirdropType): AirdropAdapter {
  return {
    type,
    status: "NOT_CONFIGURED",
    detect: () => false,
    research: () => ({ status: "NOT_CONFIGURED" }),
    verify: () => ({ status: "NOT_CONFIGURED" }),
    extractRequirements: () => [],
    calculateEligibility: () => ({
      eligible: "UNKNOWN",
      reason: `NOT_CONFIGURED: no adapter implemented for airdrop type ${type}`,
    }),
    estimateCost: () => null,
    estimateTime: () => null,
    estimateRisk: () => null,
    buildTasks: () => [],
    buildMission: () => ({ title: "NOT_CONFIGURED", steps: [] }),
    monitor: () => ({ checkedAt: new Date().toISOString(), changed: false, notes: "NOT_CONFIGURED" }),
    claim: (_project: Project): AdapterClaimResult => ({
      status: "NOT_CONFIGURED",
      reason: "No adapter implemented for this airdrop type; claiming is never automatic in any case.",
    }),
    report: () => ({ summary: "NOT_CONFIGURED", generatedAt: new Date().toISOString() }),
  };
}
