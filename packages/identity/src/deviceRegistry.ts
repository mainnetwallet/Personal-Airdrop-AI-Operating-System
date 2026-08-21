import type { Device, DeviceTrustState, DeviceType } from "@airdrop-os/types";

/**
 * Allowed device trust-state transitions.
 *
 * New devices always start at NEW and default to READ_ONLY capability
 * until a human explicitly promotes them. There is no transition that
 * skips straight from NEW/PENDING to TRUSTED without going through the
 * registration+approval flow, and REVOKED is terminal.
 */
const ALLOWED_TRANSITIONS: Record<DeviceTrustState, DeviceTrustState[]> = {
  NEW: ["PENDING", "REVOKED"],
  PENDING: ["TRUSTED", "LIMITED", "REVOKED"],
  TRUSTED: ["LIMITED", "SUSPENDED", "REVOKED"],
  LIMITED: ["TRUSTED", "SUSPENDED", "REVOKED"],
  SUSPENDED: ["LIMITED", "TRUSTED", "REVOKED"],
  REVOKED: [], // terminal - a revoked device must re-register as a new device
};

export class InvalidDeviceTransitionError extends Error {
  constructor(from: DeviceTrustState, to: DeviceTrustState) {
    super(`Invalid device trust transition: ${from} -> ${to}`);
    this.name = "InvalidDeviceTransitionError";
  }
}

export function canTransitionDeviceState(from: DeviceTrustState, to: DeviceTrustState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidDeviceTransition(from: DeviceTrustState, to: DeviceTrustState): void {
  if (!canTransitionDeviceState(from, to)) {
    throw new InvalidDeviceTransitionError(from, to);
  }
}

/** Default read-only capability/permission set for any newly registered device. */
export const DEFAULT_NEW_DEVICE_SCOPES = ["READ"] as const;

export interface RegisterDeviceInput {
  agentId: string;
  type: DeviceType;
  name: string;
  platform: string;
  version: string;
  publicKey?: string | null;
}

/**
 * Produces the initial device record for a newly-registering device.
 * Status is always NEW and permissions are always the read-only default -
 * this function intentionally has no path to create a pre-trusted device.
 */
export function buildNewDeviceRecord(input: RegisterDeviceInput): Omit<Device, "deviceId"> {
  const now = new Date().toISOString();
  return {
    agentId: input.agentId,
    type: input.type,
    name: input.name,
    platform: input.platform,
    version: input.version,
    status: "NEW",
    capabilities: [],
    permissions: [...DEFAULT_NEW_DEVICE_SCOPES],
    publicKey: input.publicKey ?? null,
    lastSeen: null,
    createdAt: now,
    updatedAt: now,
  };
}
