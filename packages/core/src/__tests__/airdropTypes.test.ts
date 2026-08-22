import { describe, it, expect } from "vitest";
import { classifyAirdropType, AIRDROP_TYPES } from "../airdropTypes.js";

describe("classifyAirdropType", () => {
  it("classifies an exact known type", () => {
    expect(classifyAirdropType("RETROACTIVE")).toBe("RETROACTIVE");
    expect(classifyAirdropType("DEFI")).toBe("DEFI");
  });

  it("normalizes case and separators before matching", () => {
    expect(classifyAirdropType("retroactive")).toBe("RETROACTIVE");
    expect(classifyAirdropType("nft-holder")).toBe("NFT_HOLDER");
    expect(classifyAirdropType("learn to earn")).toBe("LEARN_TO_EARN");
  });

  it("falls back to UNKNOWN_AIRDROP_TYPE for unrecognized input", () => {
    expect(classifyAirdropType("some-totally-new-mechanism")).toBe("UNKNOWN_AIRDROP_TYPE");
  });

  it("falls back to UNKNOWN_AIRDROP_TYPE for null/undefined/empty input, never throws", () => {
    expect(classifyAirdropType(null)).toBe("UNKNOWN_AIRDROP_TYPE");
    expect(classifyAirdropType(undefined)).toBe("UNKNOWN_AIRDROP_TYPE");
    expect(classifyAirdropType("   ")).toBe("UNKNOWN_AIRDROP_TYPE");
  });

  it("every entry in AIRDROP_TYPES round-trips through classification", () => {
    for (const type of AIRDROP_TYPES) {
      expect(classifyAirdropType(type)).toBe(type);
    }
  });
});
