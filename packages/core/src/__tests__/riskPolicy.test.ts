import { describe, it, expect } from "vitest";
import { assessRisk, decidePolicy } from "../tx/riskPolicy.js";
import { buildContractIntelligenceReport } from "../tx/contractIntelligence.js";
import { checkDomain } from "../tx/domainProtection.js";

describe("assessRisk / decidePolicy", () => {
  it("allows a clean, fully-verified, low-risk intent", () => {
    const contractReport = buildContractIntelligenceReport({
      chainId: 1,
      address: "0xc",
      sourceConnected: true,
      verifiedSource: true,
      isUpgradeable: false,
      deploymentAgeDays: 400,
      capabilities: [],
    });
    const domainCheck = checkDomain("official-airdrop.io", ["official-airdrop.io"]);

    const assessment = assessRisk({
      intentHash: "0xhash",
      domainCheck,
      contractReport,
      intentDiff: { intentHash: "0xhash", fields: [], hasMaterialChange: false, evaluatedAt: "" },
      approvalOk: true,
      simulationFreshness: { fresh: true, reason: "OK", maxAgeMs: 30_000, ageMs: 100 },
      simulationSucceeded: true,
      unlimitedApproval: false,
    });
    expect(assessment.level).toBe("LOW");

    const policy = decidePolicy(assessment);
    expect(policy.verdict).toBe("ALLOW");
  });

  it("blocks when the domain is flagged as phishing", () => {
    const domainCheck = checkDomain("offical-airdrop.io", ["official-airdrop.io"]);
    const assessment = assessRisk({
      intentHash: "0xhash",
      domainCheck,
      contractReport: null,
      intentDiff: null,
      approvalOk: null,
      simulationFreshness: null,
      simulationSucceeded: null,
      unlimitedApproval: false,
    });
    const policy = decidePolicy(assessment);
    expect(policy.verdict).toBe("BLOCK");
    expect(policy.blockReasons).toContain("PHISHING");
  });

  it("blocks on a material intent change regardless of everything else looking fine", () => {
    const assessment = assessRisk({
      intentHash: "0xhash",
      domainCheck: checkDomain("official-airdrop.io", ["official-airdrop.io"]),
      contractReport: buildContractIntelligenceReport({ chainId: 1, address: "0xc", sourceConnected: true, verifiedSource: true }),
      intentDiff: { intentHash: "0xhash", fields: [], hasMaterialChange: true, evaluatedAt: "" },
      approvalOk: true,
      simulationFreshness: { fresh: true, reason: "OK", maxAgeMs: 30_000, ageMs: 10 },
      simulationSucceeded: true,
      unlimitedApproval: false,
    });
    const policy = decidePolicy(assessment);
    expect(policy.verdict).toBe("BLOCK");
    expect(policy.blockReasons).toContain("MATERIAL_INTENT_CHANGE");
  });

  it("treats an unknown/NOT_CONFIGURED contract as risk-positive, never a free pass", () => {
    const assessment = assessRisk({
      intentHash: "0xhash",
      domainCheck: checkDomain("official-airdrop.io", ["official-airdrop.io"]),
      contractReport: buildContractIntelligenceReport({ chainId: 1, address: "0xc", sourceConnected: false }),
      intentDiff: null,
      approvalOk: true,
      simulationFreshness: { fresh: true, reason: "OK", maxAgeMs: 30_000, ageMs: 10 },
      simulationSucceeded: true,
      unlimitedApproval: false,
    });
    expect(assessment.factors.some((f) => f.code === "UNKNOWN_CONTRACT")).toBe(true);
    expect(assessment.level).not.toBe("LOW");
  });

  it("requires user review (not a silent allow) for a stale simulation alone", () => {
    const assessment = assessRisk({
      intentHash: "0xhash",
      domainCheck: checkDomain("official-airdrop.io", ["official-airdrop.io"]),
      contractReport: buildContractIntelligenceReport({ chainId: 1, address: "0xc", sourceConnected: true, verifiedSource: true, deploymentAgeDays: 400 }),
      intentDiff: { intentHash: "0xhash", fields: [], hasMaterialChange: false, evaluatedAt: "" },
      approvalOk: true,
      simulationFreshness: { fresh: false, reason: "TOO_OLD", maxAgeMs: 30_000, ageMs: 99_999 },
      simulationSucceeded: true,
      unlimitedApproval: false,
    });
    const policy = decidePolicy(assessment);
    expect(policy.verdict).not.toBe("ALLOW");
  });
});
