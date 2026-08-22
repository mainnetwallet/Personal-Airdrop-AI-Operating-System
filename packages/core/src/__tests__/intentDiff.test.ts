import { describe, it, expect } from "vitest";
import { diffIntent } from "../tx/intentDiff.js";
import type { TxIntent } from "@airdrop-os/types";

function baseIntent(overrides: Partial<TxIntent> = {}): TxIntent {
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

describe("diffIntent", () => {
  it("reports no material change when the intents match (case-insensitive addresses)", () => {
    const expected = baseIntent();
    const actual = baseIntent({ walletAddress: "0xWALLET" });
    const result = diffIntent(expected, actual);
    expect(result.hasMaterialChange).toBe(false);
  });

  it("flags a swapped recipient as a material change", () => {
    const expected = baseIntent();
    const actual = baseIntent({ recipient: "0xAttacker" });
    const result = diffIntent(expected, actual);
    expect(result.hasMaterialChange).toBe(true);
    const field = result.fields.find((f) => f.field === "recipient");
    expect(field?.materialChange).toBe(true);
  });

  it("flags a chain switch as a material change", () => {
    const expected = baseIntent({ chainId: 1 });
    const actual = baseIntent({ chainId: 56 });
    const result = diffIntent(expected, actual);
    expect(result.hasMaterialChange).toBe(true);
  });

  it("flags a spender change (approval hijack) as a material change", () => {
    const expected = baseIntent({ action: "APPROVE", spender: "0xLegitSpender" });
    const actual = baseIntent({ action: "APPROVE", spender: "0xMaliciousSpender" });
    const result = diffIntent(expected, actual);
    expect(result.hasMaterialChange).toBe(true);
  });
});
