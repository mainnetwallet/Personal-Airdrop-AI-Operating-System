import { describe, it, expect } from "vitest";
import { checkChainLock, evaluateEip7702 } from "../tx/eip7702.js";
import type { Eip7702Authorization, Eip7702TargetIntelligence } from "@airdrop-os/types";

function authorization(overrides: Partial<Eip7702Authorization> = {}): Eip7702Authorization {
  return {
    chainId: 1,
    authorizationNonce: "1",
    authorityAddress: "0xEOA",
    targetAddress: "0xTarget",
    currentChainId: 1,
    intendedChainId: 1,
    ...overrides,
  };
}

function knownTarget(): Eip7702TargetIntelligence {
  return {
    targetAddress: "0xTarget",
    implementationKnown: true,
    isProxy: false,
    isUpgradeable: false,
    initializationVerified: true,
    storageCompatible: true,
    auditEvidence: ["audit-report-1"],
    sourceStatus: "CONNECTED",
  };
}

describe("checkChainLock", () => {
  it("passes when authorization/current/intended chains all match", () => {
    expect(checkChainLock(authorization())).toBe(true);
  });

  it("fails when the current chain differs from the authorization chain", () => {
    expect(checkChainLock(authorization({ currentChainId: 56 }))).toBe(false);
  });

  it("fails when the intended chain differs from the authorization chain", () => {
    expect(checkChainLock(authorization({ intendedChainId: 137 }))).toBe(false);
  });
});

describe("evaluateEip7702", () => {
  it("blocks by default when the target is unknown, even with confirmed user intent", () => {
    const result = evaluateEip7702({
      authorization: authorization(),
      targetIntelligence: null,
      delegationDiff: null,
      userIntentConfirmed: true,
    });
    expect(result.verdict).toBe("BLOCK");
    expect(result.blockReasons).toContain("EIP7702_UNKNOWN_TARGET");
  });

  it("blocks on chain mismatch even with a known target", () => {
    const result = evaluateEip7702({
      authorization: authorization({ currentChainId: 56 }),
      targetIntelligence: knownTarget(),
      delegationDiff: null,
      userIntentConfirmed: true,
    });
    expect(result.verdict).toBe("BLOCK");
    expect(result.blockReasons).toContain("EIP7702_CHAIN_MISMATCH");
  });

  it("never returns ALLOW - a known-safe target still requires user review, never automated", () => {
    const result = evaluateEip7702({
      authorization: authorization(),
      targetIntelligence: knownTarget(),
      delegationDiff: null,
      userIntentConfirmed: true,
    });
    expect(result.verdict).toBe("NEEDS_USER_REVIEW");
  });

  it("blocks when user intent to delegate was never explicitly confirmed", () => {
    const result = evaluateEip7702({
      authorization: authorization(),
      targetIntelligence: knownTarget(),
      delegationDiff: null,
      userIntentConfirmed: false,
    });
    expect(result.verdict).toBe("BLOCK");
  });
});
