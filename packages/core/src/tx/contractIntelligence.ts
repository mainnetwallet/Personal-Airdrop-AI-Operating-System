import type { ContractCapability, ContractIntelligenceReport } from "@airdrop-os/types";

/**
 * Phase 7: Contract intelligence.
 *
 * This repository has no block explorer/indexer/bytecode-analysis
 * integration configured (see docs/phases/CURRENT_STATE.md). This module
 * therefore never fabricates verification results - `buildReport()` only
 * assembles a report from data the caller explicitly supplies (from a
 * future real adapter). Any field the caller omits stays `null`/unknown,
 * and unknown fields are treated as risk-positive by the risk engine,
 * never as "probably fine".
 */

export interface ContractIntelligenceInput {
  chainId: number;
  address: string;
  /** True if a real explorer/verification source confirmed this. Omit if unknown. */
  verifiedSource?: boolean | null;
  isProxy?: boolean | null;
  implementationAddress?: string | null;
  ownerAddress?: string | null;
  isUpgradeable?: boolean | null;
  capabilities?: ContractCapability[];
  deploymentAgeDays?: number | null;
  knownIncidents?: string[];
  lastChangedAt?: string | null;
  /** Whether the caller actually reached a live data source for this input. */
  sourceConnected: boolean;
}

export function buildContractIntelligenceReport(input: ContractIntelligenceInput): ContractIntelligenceReport {
  if (!input.sourceConnected) {
    return {
      chainId: input.chainId,
      address: input.address,
      status: "NOT_CONFIGURED",
      verifiedSource: null,
      isProxy: null,
      implementationAddress: null,
      ownerAddress: null,
      isUpgradeable: null,
      capabilities: [],
      deploymentAgeDays: null,
      knownIncidents: [],
      lastChangedAt: null,
      generatedAt: new Date().toISOString(),
    };
  }

  return {
    chainId: input.chainId,
    address: input.address,
    status: "CONNECTED",
    verifiedSource: input.verifiedSource ?? null,
    isProxy: input.isProxy ?? null,
    implementationAddress: input.implementationAddress ?? null,
    ownerAddress: input.ownerAddress ?? null,
    isUpgradeable: input.isUpgradeable ?? null,
    capabilities: input.capabilities ?? [],
    deploymentAgeDays: input.deploymentAgeDays ?? null,
    knownIncidents: input.knownIncidents ?? [],
    lastChangedAt: input.lastChangedAt ?? null,
    generatedAt: new Date().toISOString(),
  };
}

/** True if the report gives the risk engine enough to reason about (not NOT_CONFIGURED/unknown-everywhere). */
export function isReportUsable(report: ContractIntelligenceReport): boolean {
  return report.status === "CONNECTED" && report.verifiedSource !== null;
}

const DANGEROUS_CAPABILITIES: ContractCapability[] = ["SELFDESTRUCT", "BLACKLIST", "DELEGATECALL"];

export function hasDangerousCapability(report: ContractIntelligenceReport): boolean {
  return report.capabilities.some((c) => DANGEROUS_CAPABILITIES.includes(c));
}
