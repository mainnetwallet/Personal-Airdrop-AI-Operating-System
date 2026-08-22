import { describe, it, expect } from "vitest";
import { checkSimulationFreshness } from "../tx/simulation.js";
import type { SimulationFingerprint } from "@airdrop-os/types";

function sim(overrides: Partial<SimulationFingerprint> = {}): SimulationFingerprint {
  return {
    simulationId: "sim1",
    intentHash: "0xhash",
    blockNumber: "100",
    timestamp: new Date(0).toISOString(),
    rpcProviderId: "provider-a",
    stateFingerprint: "fp1",
    succeeded: true,
    revertReason: null,
    ...overrides,
  };
}

describe("checkSimulationFreshness", () => {
  it("requires re-simulation when there is no simulation at all", () => {
    const result = checkSimulationFreshness({
      simulation: null,
      currentBlockNumber: "100",
      currentRpcProviderId: "provider-a",
      maxAgeMs: 30_000,
    });
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("NO_SIMULATION");
  });

  it("is fresh when within maxAge, same block, same provider", () => {
    const result = checkSimulationFreshness({
      simulation: sim(),
      currentBlockNumber: "100",
      currentRpcProviderId: "provider-a",
      maxAgeMs: 30_000,
      now: new Date(1000),
    });
    expect(result.fresh).toBe(true);
  });

  it("is stale when older than maxAge", () => {
    const result = checkSimulationFreshness({
      simulation: sim(),
      currentBlockNumber: "100",
      currentRpcProviderId: "provider-a",
      maxAgeMs: 30_000,
      now: new Date(60_000),
    });
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("TOO_OLD");
  });

  it("is stale when the chain has advanced past the simulated block", () => {
    const result = checkSimulationFreshness({
      simulation: sim({ blockNumber: "100" }),
      currentBlockNumber: "105",
      currentRpcProviderId: "provider-a",
      maxAgeMs: 30_000,
      now: new Date(1000),
    });
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("BLOCK_ADVANCED");
  });

  it("is stale when the RPC provider used for simulation differs from the current one", () => {
    const result = checkSimulationFreshness({
      simulation: sim({ rpcProviderId: "provider-a" }),
      currentBlockNumber: "100",
      currentRpcProviderId: "provider-b",
      maxAgeMs: 30_000,
      now: new Date(1000),
    });
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("RPC_MISMATCH");
  });
});
