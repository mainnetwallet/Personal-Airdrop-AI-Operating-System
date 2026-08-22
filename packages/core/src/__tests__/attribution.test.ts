import { describe, it, expect } from "vitest";
import { buildAttribution } from "../chain/attribution.js";

describe("buildAttribution", () => {
  it("assigns VERIFIED confidence when we directly observed the browser action", () => {
    const attr = buildAttribution({
      transactionHash: "0xabc",
      browserContextId: "ctx-1",
      taskId: "task-1",
      contractAddress: "0xcontract",
    });
    expect(attr.confidence).toBe("VERIFIED");
  });

  it("assigns SPECULATIVE confidence with no chain links populated", () => {
    const attr = buildAttribution({ transactionHash: "0xabc" });
    expect(attr.confidence).toBe("SPECULATIVE");
  });

  it("assigns UNCERTAIN confidence with only a couple of links and no direct observation", () => {
    const attr = buildAttribution({ transactionHash: "0xabc", contractAddress: "0xc" });
    expect(attr.confidence).toBe("UNCERTAIN");
  });

  it("preserves every link passed through unchanged", () => {
    const attr = buildAttribution({
      transactionHash: "0xabc",
      protocolId: "aave",
      projectId: "project-1",
    });
    expect(attr.protocolId).toBe("aave");
    expect(attr.projectId).toBe("project-1");
    expect(attr.traceId).toBeNull();
  });
});
