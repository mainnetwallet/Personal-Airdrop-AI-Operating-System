import { describe, it, expect } from "vitest";
import { formatAgentLabel } from "../agentIdentity.js";

describe("agent identity label", () => {
  it("formats sequence 1 as AIRDROP-USER-001", () => {
    expect(formatAgentLabel(1)).toBe("AIRDROP-USER-001");
  });
  it("rejects non-positive sequence", () => {
    expect(() => formatAgentLabel(0)).toThrow();
  });
});
