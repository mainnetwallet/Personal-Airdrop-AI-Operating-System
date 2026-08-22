import type { SimulationFingerprint, SimulationFreshnessCheck } from "@airdrop-os/types";

/**
 * Phase 7: Simulation freshness.
 *
 * A pre-sign simulation is only trustworthy if the on-chain state it was
 * run against still matches reality. This module never re-simulates
 * itself (no RPC access here) - it only decides whether a caller-supplied
 * simulation is stale and must be redone before signing.
 */

export interface FreshnessInput {
  simulation: SimulationFingerprint | null;
  currentBlockNumber: string | null;
  currentRpcProviderId: string | null;
  maxAgeMs: number;
  now?: Date;
}

export function checkSimulationFreshness(input: FreshnessInput): SimulationFreshnessCheck {
  const { simulation, currentBlockNumber, currentRpcProviderId, maxAgeMs } = input;
  const now = input.now ?? new Date();

  if (!simulation) {
    return { fresh: false, reason: "NO_SIMULATION", maxAgeMs, ageMs: null };
  }

  const ageMs = now.getTime() - new Date(simulation.timestamp).getTime();
  if (ageMs > maxAgeMs) {
    return { fresh: false, reason: "TOO_OLD", maxAgeMs, ageMs };
  }

  if (
    currentBlockNumber !== null &&
    simulation.blockNumber !== null &&
    BigInt(currentBlockNumber) > BigInt(simulation.blockNumber)
  ) {
    return { fresh: false, reason: "BLOCK_ADVANCED", maxAgeMs, ageMs };
  }

  if (
    currentRpcProviderId !== null &&
    simulation.rpcProviderId !== null &&
    currentRpcProviderId !== simulation.rpcProviderId
  ) {
    return { fresh: false, reason: "RPC_MISMATCH", maxAgeMs, ageMs };
  }

  return { fresh: true, reason: "OK", maxAgeMs, ageMs };
}
