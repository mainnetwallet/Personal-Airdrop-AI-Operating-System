import { describe, it, expect } from "vitest";
import { runFirewall, stageOrderIsValid, type FirewallRunInput } from "../tx/firewall.js";
import { EmergencyStopController } from "../tx/emergencyStop.js";
import { checkDomain } from "../tx/domainProtection.js";
import { buildContractIntelligenceReport } from "../tx/contractIntelligence.js";
import type { TxIntent } from "@airdrop-os/types";

function intent(overrides: Partial<TxIntent> = {}): TxIntent {
  return {
    intentHash: "0xhash",
    action: "CLAIM",
    walletAddress: "0xWallet",
    chainId: 1,
    contractAddress: "0xContract",
    recipient: "0xWallet",
    token: "0xToken",
    amount: "100",
    spender: null,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function goodInput(overrides: Partial<FirewallRunInput> = {}): FirewallRunInput {
  return {
    expectedIntent: intent(),
    decodedIntent: intent(),
    validationOk: true,
    validationDetail: "ok",
    estimationOk: true,
    estimationDetail: "ok",
    simulationSucceeded: true,
    simulationFreshness: { fresh: true, reason: "OK", maxAgeMs: 30_000, ageMs: 10 },
    stateAnalysisOk: true,
    stateAnalysisDetail: "ok",
    domainCheck: checkDomain("official-airdrop.io", ["official-airdrop.io"]),
    contractReport: buildContractIntelligenceReport({
      chainId: 1,
      address: "0xContract",
      sourceConnected: true,
      verifiedSource: true,
      deploymentAgeDays: 400,
    }),
    approvalCheck: { ok: true },
    unlimitedApproval: false,
    ...overrides,
  };
}

describe("runFirewall", () => {
  it("walks a clean intent through to SIGN and always requires user review for signing", () => {
    const result = runFirewall(goodInput());
    expect(result.verdict).toBe("NEEDS_USER_REVIEW");
    expect(result.finishedStage).toBe("SIGN");
    const signStage = result.stages.find((s) => s.stage === "SIGN");
    expect(signStage?.status).toBe("NEEDS_USER_REVIEW");
    expect(stageOrderIsValid(result.stages)).toBe(true);
  });

  it("stops at DECODE when nothing was decoded", () => {
    const result = runFirewall(goodInput({ decodedIntent: null }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.finishedStage).toBe("DECODE");
  });

  it("stops at SIMULATE when simulation reverted", () => {
    const result = runFirewall(goodInput({ simulationSucceeded: false }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.finishedStage).toBe("SIMULATE");
  });

  it("stops at SIMULATE when the simulation is stale", () => {
    const result = runFirewall(goodInput({ simulationFreshness: { fresh: false, reason: "TOO_OLD", maxAgeMs: 30_000, ageMs: 99_999 } }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.finishedStage).toBe("SIMULATE");
  });

  it("blocks at POLICY (Security Agent veto) on a phishing domain, and the block is final", () => {
    const result = runFirewall(goodInput({ domainCheck: checkDomain("offical-airdrop.io", ["official-airdrop.io"]) }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.finishedStage).toBe("POLICY");
    expect(result.policyDecision?.blockReasons).toContain("PHISHING");
  });

  it("blocks at INTENT_DIFF when the decoded recipient differs materially from expected", () => {
    const result = runFirewall(
      goodInput({
        decodedIntent: intent({ recipient: "0xAttacker" }),
      }),
    );
    expect(result.verdict).toBe("BLOCK");
    expect(["INTENT_DIFF", "POLICY"]).toContain(result.finishedStage);
    expect(result.intentDiff?.hasMaterialChange).toBe(true);
  });

  it("stops at APPROVAL when the approval check failed", () => {
    const result = runFirewall(goodInput({ approvalCheck: { ok: false, reason: "STALE_APPROVAL", detail: "expired" } }));
    expect(result.verdict).toBe("BLOCK");
  });

  it("hard-blocks at SIGN when an emergency stop is active for the wallet, even if everything else passed", () => {
    const stop = new EmergencyStopController();
    stop.activate("WALLET", "0xWallet", "suspected compromise");
    const result = runFirewall(goodInput({ emergencyStop: stop }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.finishedStage).toBe("SIGN");
  });

  it("does not block an unrelated wallet's emergency stop", () => {
    const stop = new EmergencyStopController();
    stop.activate("WALLET", "0xSomeOtherWallet", "suspected compromise");
    const result = runFirewall(goodInput({ emergencyStop: stop }));
    expect(result.verdict).toBe("NEEDS_USER_REVIEW");
  });
});

describe("stageOrderIsValid", () => {
  it("accepts stages in pipeline order", () => {
    expect(stageOrderIsValid([{ stage: "PREPARE", status: "PASSED", detail: "" }, { stage: "DECODE", status: "PASSED", detail: "" }])).toBe(true);
  });

  it("rejects out-of-order stages", () => {
    expect(stageOrderIsValid([{ stage: "SIGN", status: "PASSED", detail: "" }, { stage: "DECODE", status: "PASSED", detail: "" }])).toBe(false);
  });
});
