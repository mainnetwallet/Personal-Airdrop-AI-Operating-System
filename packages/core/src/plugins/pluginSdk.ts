/**
 * Phase 8: Plugin SDK.
 *
 * Third-party plugins extend coverage (detect/research/verify/
 * requirements/eligibility/cost/time/risk/tasks/mission/monitor/
 * claim/report) but never run trusted-by-default. Every plugin:
 * - starts DISABLED the moment it's registered — an unknown plugin
 *   has no path to run without an explicit activate() call
 * - can only ever be granted a subset of the permissions it declared
 *   in its own manifest (activate() strips anything else out, it
 *   never expands the requested set)
 * - is version-pinned and integrity-checked: a manifest whose
 *   integrity hash doesn't match at activation time is BLOCKED, not
 *   silently downgraded to fewer permissions
 * - has resource limits (maxCallsPerRun, networkAllowlist) recorded
 *   on the manifest for the caller (job/workflow runner) to enforce —
 *   this SDK is the registry/authorization layer, not the sandboxed
 *   execution environment itself
 */
import type { PluginManifest, PluginPermission, PluginRegistration } from "@airdrop-os/types";

function unknownPluginRegistration(pluginId: string): PluginRegistration {
  return {
    manifest: {
      pluginId,
      name: "UNKNOWN",
      version: "0.0.0",
      integrityHash: "",
      requestedPermissions: [],
      networkAllowlist: [],
      maxCallsPerRun: 0,
    },
    status: "DISABLED",
    grantedPermissions: [],
    registeredAt: new Date().toISOString(),
    lastHealthCheckAt: null,
    blockedReason: "UNKNOWN_PLUGIN_NEVER_TRUSTED_BY_DEFAULT",
  };
}

export class PluginRegistry {
  private readonly plugins = new Map<string, PluginRegistration>();

  /** Registering a plugin never activates it — status is always DISABLED. */
  register(manifest: PluginManifest): PluginRegistration {
    const registration: PluginRegistration = {
      manifest,
      status: "DISABLED",
      grantedPermissions: [],
      registeredAt: new Date().toISOString(),
      lastHealthCheckAt: null,
      blockedReason: null,
    };
    this.plugins.set(manifest.pluginId, registration);
    return registration;
  }

  /**
   * Activates a registered plugin into SANDBOXED_ACTIVE, but only if
   * the supplied integrity hash matches the manifest exactly. Granted
   * permissions are always `requestedPermissions ∩ grantPermissions` —
   * this can never grant a permission the plugin didn't itself
   * declare, even if the caller passes it.
   */
  activate(pluginId: string, grantPermissions: PluginPermission[], verifiedIntegrityHash: string): PluginRegistration {
    const registration = this.plugins.get(pluginId);
    if (!registration) return unknownPluginRegistration(pluginId);

    if (verifiedIntegrityHash !== registration.manifest.integrityHash) {
      registration.status = "BLOCKED";
      registration.blockedReason = "INTEGRITY_HASH_MISMATCH";
      registration.grantedPermissions = [];
      return registration;
    }

    const allowed = new Set(registration.manifest.requestedPermissions);
    registration.grantedPermissions = grantPermissions.filter((permission) => allowed.has(permission));
    registration.status = "SANDBOXED_ACTIVE";
    registration.blockedReason = null;
    return registration;
  }

  block(pluginId: string, reason: string): PluginRegistration {
    const registration = this.plugins.get(pluginId);
    if (!registration) return unknownPluginRegistration(pluginId);
    registration.status = "BLOCKED";
    registration.blockedReason = reason;
    registration.grantedPermissions = [];
    return registration;
  }

  recordHealthCheck(pluginId: string): PluginRegistration {
    const registration = this.plugins.get(pluginId);
    if (!registration) return unknownPluginRegistration(pluginId);
    registration.lastHealthCheckAt = new Date().toISOString();
    return registration;
  }

  hasPermission(pluginId: string, permission: PluginPermission): boolean {
    const registration = this.plugins.get(pluginId);
    return !!registration && registration.status === "SANDBOXED_ACTIVE" && registration.grantedPermissions.includes(permission);
  }

  /** Unknown plugin IDs resolve to a fixed DISABLED registration rather than undefined. */
  resolve(pluginId: string): PluginRegistration {
    return this.plugins.get(pluginId) ?? unknownPluginRegistration(pluginId);
  }

  list(): PluginRegistration[] {
    return [...this.plugins.values()];
  }
}
