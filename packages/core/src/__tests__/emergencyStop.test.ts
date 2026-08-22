import { describe, it, expect } from "vitest";
import { EmergencyStopController } from "../tx/emergencyStop.js";

describe("EmergencyStopController", () => {
  it("does not block anything before activation", () => {
    const controller = new EmergencyStopController();
    expect(controller.blocksSensitiveOp("WALLET", "0xW")).toBe(false);
    expect(controller.get().readOnlyInvestigationAllowed).toBe(true);
  });

  it("blocks the targeted scope after activation", () => {
    const controller = new EmergencyStopController();
    controller.activate("WALLET", "0xW", "suspected compromise");
    expect(controller.blocksSensitiveOp("WALLET", "0xW")).toBe(true);
    expect(controller.blocksSensitiveOp("WALLET", "0xOther")).toBe(false);
  });

  it("ALL_SENSITIVE_OPERATIONS scope blocks every target", () => {
    const controller = new EmergencyStopController();
    controller.activate("ALL_SENSITIVE_OPERATIONS", null, "global freeze");
    expect(controller.blocksSensitiveOp("WALLET", "0xAnyWallet")).toBe(true);
    expect(controller.blocksSensitiveOp("PROJECT", "any-project")).toBe(true);
  });

  it("always keeps read-only investigation allowed even while active", () => {
    const controller = new EmergencyStopController();
    controller.activate("ALL_SENSITIVE_OPERATIONS", null, "global freeze");
    expect(controller.get().readOnlyInvestigationAllowed).toBe(true);
  });

  it("stops blocking after deactivation", () => {
    const controller = new EmergencyStopController();
    controller.activate("WALLET", "0xW", "reason");
    controller.deactivate();
    expect(controller.blocksSensitiveOp("WALLET", "0xW")).toBe(false);
  });
});
