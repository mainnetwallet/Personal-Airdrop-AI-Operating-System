import { describe, it, expect } from "vitest";
import { DeviceRegistry } from "../multidevice/deviceRegistry.js";

describe("DeviceRegistry", () => {
  it("registers a device as STANDBY, never ACTIVE by default", () => {
    const registry = new DeviceRegistry();
    const device = registry.register({ deviceId: "d1", agentId: "a1", kind: "PC" });
    expect(device.role).toBe("STANDBY");
  });

  it("Android/Web/Extension never receive secrets, regardless of kind casing or order", () => {
    const registry = new DeviceRegistry();
    const android = registry.register({ deviceId: "d-android", agentId: "a1", kind: "ANDROID" });
    const web = registry.register({ deviceId: "d-web", agentId: "a1", kind: "WEB" });
    const ext = registry.register({ deviceId: "d-ext", agentId: "a1", kind: "CHROME_EXTENSION" });
    const pc = registry.register({ deviceId: "d-pc", agentId: "a1", kind: "PC" });
    expect(android.receivesSecrets).toBe(false);
    expect(web.receivesSecrets).toBe(false);
    expect(ext.receivesSecrets).toBe(false);
    expect(pc.receivesSecrets).toBe(true);
  });

  it("promoteToActive demotes any previously ACTIVE device under the same agent - never two ACTIVE at once", () => {
    const registry = new DeviceRegistry();
    registry.register({ deviceId: "vps1", agentId: "a1", kind: "VPS" });
    registry.register({ deviceId: "pc1", agentId: "a1", kind: "PC" });

    registry.promoteToActive("vps1");
    expect(registry.get("vps1")!.role).toBe("ACTIVE");
    expect(registry.isSplitBrainFree("a1")).toBe(true);

    const { promoted, demoted } = registry.promoteToActive("pc1");
    expect(promoted.role).toBe("ACTIVE");
    expect(demoted.map((d) => d.deviceId)).toEqual(["vps1"]);
    expect(registry.get("vps1")!.role).toBe("STANDBY");
    expect(registry.isSplitBrainFree("a1")).toBe(true);
    expect(registry.activeDevice("a1")!.deviceId).toBe("pc1");
  });

  it("promoting a device under a different agentId does not affect another agent's ACTIVE device", () => {
    const registry = new DeviceRegistry();
    registry.register({ deviceId: "vps1", agentId: "a1", kind: "VPS" });
    registry.register({ deviceId: "vps2", agentId: "a2", kind: "VPS" });
    registry.promoteToActive("vps1");
    registry.promoteToActive("vps2");
    expect(registry.get("vps1")!.role).toBe("ACTIVE");
    expect(registry.get("vps2")!.role).toBe("ACTIVE");
  });

  it("promoteToActive throws for an unknown device rather than silently registering one", () => {
    const registry = new DeviceRegistry();
    expect(() => registry.promoteToActive("ghost")).toThrow();
  });
});
