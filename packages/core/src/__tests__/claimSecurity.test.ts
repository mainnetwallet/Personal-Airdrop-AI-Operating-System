import { describe, it, expect } from "vitest";
import { verifyClaimSecurity, type ClaimSecurityInput } from "../tx/claimSecurity.js";
import { checkDomain } from "../tx/domainProtection.js";
import { buildContractIntelligenceReport } from "../tx/contractIntelligence.js";

function goodInput(overrides: Partial<ClaimSecurityInput> = {}): ClaimSecurityInput {
  return {
    officialSourceVerified: true,
    domainCheck: checkDomain("official-airdrop.io", ["official-airdrop.io"]),
    contractCheck: buildContractIntelligenceReport({
      chainId: 1,
      address: "0xc",
      sourceConnected: true,
      verifiedSource: true,
      deploymentAgeDays: 400,
    }),
    chainVerified: true,
    functionVerified: true,
    recipientVerified: true,
    tokenVerified: true,
    approvalCheck: { ok: true },
    simulationCheck: { fresh: true, reason: "OK", maxAgeMs: 30_000, ageMs: 10 },
    riskAssessment: { intentHash: "0xhash", level: "LOW", score: 5, factors: [], assessedAt: "" },
    ...overrides,
  };
}

describe("verifyClaimSecurity", () => {
  it("allows a claim where every check passes", () => {
    const result = verifyClaimSecurity(goodInput());
    expect(result.verdict).toBe("ALLOW");
    expect(result.blockReasons).toHaveLength(0);
  });

  it("blocks a claim from an unverified official source (fake claim)", () => {
    const result = verifyClaimSecurity(goodInput({ officialSourceVerified: false }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.blockReasons).toContain("FAKE_CLAIM");
  });

  it("blocks a claim on the wrong chain", () => {
    const result = verifyClaimSecurity(goodInput({ chainVerified: false }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.blockReasons).toContain("WRONG_CHAIN");
  });

  it("blocks a claim with an unverified recipient", () => {
    const result = verifyClaimSecurity(goodInput({ recipientVerified: false }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.blockReasons).toContain("WRONG_RECIPIENT");
  });

  it("does not silently allow when approval check is missing", () => {
    const result = verifyClaimSecurity(goodInput({ approvalCheck: null }));
    expect(result.verdict).not.toBe("ALLOW");
    expect(result.blockReasons).toContain("STALE_APPROVAL");
  });

  it("does not silently allow when simulation is missing/stale", () => {
    const result = verifyClaimSecurity(goodInput({ simulationCheck: { fresh: false, reason: "TOO_OLD", maxAgeMs: 30_000, ageMs: 99_999 } }));
    expect(result.verdict).not.toBe("ALLOW");
    expect(result.blockReasons).toContain("STALE_SIMULATION");
  });

  it("does not silently allow a HIGH/CRITICAL risk assessment", () => {
    const result = verifyClaimSecurity(
      goodInput({ riskAssessment: { intentHash: "0xhash", level: "CRITICAL", score: 95, factors: [], assessedAt: "" } }),
    );
    expect(result.verdict).not.toBe("ALLOW");
  });
});
