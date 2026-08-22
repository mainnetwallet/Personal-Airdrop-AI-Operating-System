import type { DeviceRecord, DeviceKind, CoordinatorRole } from "@airdrop-os/types";

/**
 * VPS, PC, Android, Web, and Chrome Extension all share one Agent
 * Identity - this registry is the single source of truth for which
 * devices exist under that identity and what coordination role each
 * currently holds.
 *
 * Split-brain protection: only one device may ever hold ACTIVE at a
 * time for a given agentId. Registering/promoting a new ACTIVE device
 * demotes the previous holder to STANDBY - there is no path that
 * leaves two devices ACTIVE simultaneously.
 *
 * Android never receives secret material regardless of role -
 * `receivesSecrets` is fixed false for ANDROID/WEB/CHROME_EXTENSION
 * and cannot be overridden by a caller.
 */
const NEVER_RECEIVES_SECRETS: ReadonlySet<DeviceKind> = new Set([
  "ANDROID",
  "WEB",
  "CHROME_EXTENSION",
]);

export class DeviceRegistry {
  private readonly devices = new Map<string, DeviceRecord>();

  register(params: { deviceId: string; agentId: string; kind: DeviceKind; now?: number }): DeviceRecord {
    const now = params.now ?? Date.now();
    const record: DeviceRecord = {
      deviceId: params.deviceId,
      agentId: params.agentId,
      kind: params.kind,
      // A newly registered device never starts ACTIVE - it must be
      // explicitly promoted, which goes through the split-brain-safe path.
      role: "STANDBY",
      registeredAt: new Date(now).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      receivesSecrets: !NEVER_RECEIVES_SECRETS.has(params.kind) && params.kind !== "ANDROID",
    };
    this.devices.set(record.deviceId, record);
    return record;
  }

  get(deviceId: string): DeviceRecord | undefined {
    return this.devices.get(deviceId);
  }

  listByAgent(agentId: string): DeviceRecord[] {
    return [...this.devices.values()].filter((d) => d.agentId === agentId);
  }

  heartbeat(deviceId: string, now?: number): DeviceRecord | undefined {
    const record = this.devices.get(deviceId);
    if (!record) return undefined;
    record.lastSeenAt = new Date(now ?? Date.now()).toISOString();
    return record;
  }

  /**
   * Promotes exactly one device to ACTIVE for its agentId, demoting
   * every other device currently ACTIVE under the same agentId to
   * STANDBY. This is the only path that can create an ACTIVE
   * coordinator - it is structurally impossible to end up with two.
   */
  promoteToActive(deviceId: string, now?: number): { promoted: DeviceRecord; demoted: DeviceRecord[] } {
    const record = this.devices.get(deviceId);
    if (!record) throw new Error(`Unknown device: ${deviceId}`);
    const demoted: DeviceRecord[] = [];
    for (const other of this.devices.values()) {
      if (other.agentId === record.agentId && other.deviceId !== deviceId && other.role === "ACTIVE") {
        other.role = "STANDBY";
        demoted.push(other);
      }
    }
    record.role = "ACTIVE";
    record.lastSeenAt = new Date(now ?? Date.now()).toISOString();
    return { promoted: record, demoted };
  }

  setRole(deviceId: string, role: Exclude<CoordinatorRole, "ACTIVE">): DeviceRecord {
    const record = this.devices.get(deviceId);
    if (!record) throw new Error(`Unknown device: ${deviceId}`);
    record.role = role;
    return record;
  }

  /** True only if there is currently zero or one ACTIVE device per agentId. */
  isSplitBrainFree(agentId: string): boolean {
    const actives = this.listByAgent(agentId).filter((d) => d.role === "ACTIVE");
    return actives.length <= 1;
  }

  activeDevice(agentId: string): DeviceRecord | null {
    const actives = this.listByAgent(agentId).filter((d) => d.role === "ACTIVE");
    return actives[0] ?? null;
  }
}
