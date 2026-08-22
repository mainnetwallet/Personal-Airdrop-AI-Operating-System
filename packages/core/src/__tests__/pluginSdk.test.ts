import { describe, it, expect } from "vitest";
import type { PluginManifest } from "@airdrop-os/types";
import { PluginRegistry } from "../plugins/pluginSdk.js";

const manifest: PluginManifest = {
  pluginId: "plugin-1",
  name: "Example Quest Plugin",
  version: "1.0.0",
  integrityHash: "sha256:abc123",
  requestedPermissions: ["READ_PROJECT", "NETWORK_FETCH"],
  networkAllowlist: ["quests.example.com"],
  maxCallsPerRun: 10,
};

describe("PluginRegistry", () => {
  it("a newly registered plugin is DISABLED, not active", () => {
    const registry = new PluginRegistry();
    const registration = registry.register(manifest);
    expect(registration.status).toBe("DISABLED");
    expect(registration.grantedPermissions).toEqual([]);
  });

  it("an unregistered/unknown plugin resolves to a fixed DISABLED registration", () => {
    const registry = new PluginRegistry();
    const registration = registry.resolve("never-registered");
    expect(registration.status).toBe("DISABLED");
    expect(registration.blockedReason).toBe("UNKNOWN_PLUGIN_NEVER_TRUSTED_BY_DEFAULT");
  });

  it("activate() with the correct integrity hash grants only permissions the plugin requested", () => {
    const registry = new PluginRegistry();
    registry.register(manifest);
    const registration = registry.activate(
      "plugin-1",
      ["READ_PROJECT", "NETWORK_FETCH", "WRITE_TASK"], // WRITE_TASK wasn't requested
      "sha256:abc123",
    );
    expect(registration.status).toBe("SANDBOXED_ACTIVE");
    expect(registration.grantedPermissions.sort()).toEqual(["NETWORK_FETCH", "READ_PROJECT"]);
    expect(registration.grantedPermissions).not.toContain("WRITE_TASK");
  });

  it("activate() with a mismatched integrity hash BLOCKs the plugin instead of activating it", () => {
    const registry = new PluginRegistry();
    registry.register(manifest);
    const registration = registry.activate("plugin-1", ["READ_PROJECT"], "sha256:tampered");
    expect(registration.status).toBe("BLOCKED");
    expect(registration.blockedReason).toBe("INTEGRITY_HASH_MISMATCH");
    expect(registration.grantedPermissions).toEqual([]);
  });

  it("hasPermission() is false unless the plugin is SANDBOXED_ACTIVE with that exact permission granted", () => {
    const registry = new PluginRegistry();
    registry.register(manifest);
    expect(registry.hasPermission("plugin-1", "READ_PROJECT")).toBe(false);
    registry.activate("plugin-1", ["READ_PROJECT"], "sha256:abc123");
    expect(registry.hasPermission("plugin-1", "READ_PROJECT")).toBe(true);
    expect(registry.hasPermission("plugin-1", "WRITE_TASK")).toBe(false);
  });

  it("block() revokes granted permissions immediately", () => {
    const registry = new PluginRegistry();
    registry.register(manifest);
    registry.activate("plugin-1", ["READ_PROJECT"], "sha256:abc123");
    expect(registry.hasPermission("plugin-1", "READ_PROJECT")).toBe(true);
    const registration = registry.block("plugin-1", "manual security review");
    expect(registration.status).toBe("BLOCKED");
    expect(registry.hasPermission("plugin-1", "READ_PROJECT")).toBe(false);
  });
});
