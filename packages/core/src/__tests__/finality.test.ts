import { describe, it, expect } from "vitest";
import { canTransitionFinality, assertValidFinalityTransition, InvalidFinalityTransitionError, isFinalitySafeForEligibility } from "../chain/finality.js";

describe("finality state machine", () => {
  it("allows the normal happy path PENDING -> INCLUDED -> CONFIRMED -> FINALIZED", () => {
    expect(canTransitionFinality("PENDING", "INCLUDED")).toBe(true);
    expect(canTransitionFinality("INCLUDED", "CONFIRMED")).toBe(true);
    expect(canTransitionFinality("CONFIRMED", "FINALIZED")).toBe(true);
  });

  it("allows a reorg even from FINALIZED", () => {
    expect(canTransitionFinality("FINALIZED", "REORGED")).toBe(true);
  });

  it("rejects skipping straight from PENDING to FINALIZED", () => {
    expect(canTransitionFinality("PENDING", "FINALIZED")).toBe(false);
    expect(() => assertValidFinalityTransition("PENDING", "FINALIZED")).toThrow(InvalidFinalityTransitionError);
  });

  it("DROPPED and REPLACED are terminal", () => {
    expect(canTransitionFinality("DROPPED", "PENDING")).toBe(false);
    expect(canTransitionFinality("REPLACED", "INCLUDED")).toBe(false);
  });

  it("only CONFIRMED/FINALIZED are safe for eligibility calculations", () => {
    expect(isFinalitySafeForEligibility("CONFIRMED")).toBe(true);
    expect(isFinalitySafeForEligibility("FINALIZED")).toBe(true);
    expect(isFinalitySafeForEligibility("INCLUDED")).toBe(false);
    expect(isFinalitySafeForEligibility("PENDING")).toBe(false);
  });
});
