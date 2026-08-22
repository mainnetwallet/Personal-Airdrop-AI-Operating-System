import { describe, it, expect } from "vitest";
import { buildContractIntelligenceReport, hasDangerousCapability, isReportUsable } from "../tx/contractIntelligence.js";

describe("buildContractIntelligenceReport", () => {
  it("returns NOT_CONFIGURED when no live source is connected, never fabricating fields", () => {
    const report = buildContractIntelligenceReport({ chainId: 1, address: "0xabc", sourceConnected: false });
    expect(report.status).toBe("NOT_CONFIGURED");
    expect(report.verifiedSource).toBeNull();
    expect(report.capabilities).toEqual([]);
    expect(isReportUsable(report)).toBe(false);
  });

  it("returns CONNECTED with supplied fields when a source is connected", () => {
    const report = buildContractIntelligenceReport({
      chainId: 1,
      address: "0xabc",
      sourceConnected: true,
      verifiedSource: true,
      isProxy: false,
      capabilities: ["MINT"],
      deploymentAgeDays: 400,
    });
    expect(report.status).toBe("CONNECTED");
    expect(report.verifiedSource).toBe(true);
    expect(isReportUsable(report)).toBe(true);
  });

  it("treats verifiedSource=null as not usable even when CONNECTED", () => {
    const report = buildContractIntelligenceReport({ chainId: 1, address: "0xabc", sourceConnected: true });
    expect(isReportUsable(report)).toBe(false);
  });
});

describe("hasDangerousCapability", () => {
  it("flags SELFDESTRUCT/BLACKLIST/DELEGATECALL as dangerous", () => {
    const report = buildContractIntelligenceReport({
      chainId: 1,
      address: "0xabc",
      sourceConnected: true,
      capabilities: ["BLACKLIST"],
    });
    expect(hasDangerousCapability(report)).toBe(true);
  });

  it("does not flag benign capabilities", () => {
    const report = buildContractIntelligenceReport({
      chainId: 1,
      address: "0xabc",
      sourceConnected: true,
      capabilities: ["PERMIT"],
    });
    expect(hasDangerousCapability(report)).toBe(false);
  });
});
