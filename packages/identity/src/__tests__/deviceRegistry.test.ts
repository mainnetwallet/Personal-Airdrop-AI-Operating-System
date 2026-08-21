import { describe, it, expect } from "vitest";
import {
  buildNewDeviceRecord,
  canTransitionDeviceState,
  assertValidDeviceTransition,
  InvalidDeviceTransitionError,
} from "../deviceRegistry.js";

describe("device registry", () => {
  it("new devices default to NEW status and READ_ONLY permission", () => {
    const device = buildNewDeviceRecord({
      agentId: "agent-1",
      type: "PC",
      name: "My Laptop",
      platform: "linux",
      version: "1.0.0",
    });
    expect(device.status).toBe("NEW");
    expect(device.permissions).toEqual(["READ"]);
  });

  it("allows NEW -> PENDING -> TRUSTED", () => {
    expect(canTransitionDeviceState("NEW", "PENDING")).toBe(true);
    expect(canTransitionDeviceState("PENDING", "TRUSTED")).toBe(true);
  });

  it("rejects skipping straight from NEW to TRUSTED", () => {
    expect(canTransitionDeviceState("NEW", "TRUSTED")).toBe(false);
    expect(() => assertValidDeviceTransition("NEW", "TRUSTED")).toThrow(
      InvalidDeviceTransitionError
    );
  });

  it("REVOKED is terminal", () => {
    expect(canTransitionDeviceState("REVOKED", "TRUSTED")).toBe(false);
    expect(canTransitionDeviceState("REVOKED", "PENDING")).toBe(false);
  });
});
