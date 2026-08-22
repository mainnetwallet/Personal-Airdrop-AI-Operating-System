import type { DeviceJobAuthorization } from "@airdrop-os/types";

/**
 * Authorizes jobs the VPS hands to a PC agent (or extension). A job is
 * only ever valid for a bounded scope, device, and time window. This is
 * pure state management - it never itself performs device auth (that is
 * Phase 1's access/refresh token machinery); it governs whether a given
 * *job* is currently allowed to run on a given *already-authenticated*
 * device connection.
 */
export class PcAgentAuthorizer {
  private readonly jobs = new Map<string, DeviceJobAuthorization>();

  issue(params: { jobId: string; deviceId: string; agentId: string; scope: string[]; ttlMs: number; now?: number }): DeviceJobAuthorization {
    const now = params.now ?? Date.now();
    const record: DeviceJobAuthorization = {
      jobId: params.jobId,
      deviceId: params.deviceId,
      agentId: params.agentId,
      scope: params.scope,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + params.ttlMs).toISOString(),
      status: "ACTIVE",
    };
    this.jobs.set(params.jobId, record);
    return record;
  }

  /** Returns the up-to-date status, lazily transitioning ACTIVE -> EXPIRED
   * once the expiry has passed. Never mutates a REVOKED/COMPLETED job. */
  getStatus(jobId: string, now: number = Date.now()): JobAuthorizationCheck {
    const record = this.jobs.get(jobId);
    if (!record) return { valid: false, reason: "UNKNOWN_JOB" };
    if (record.status === "REVOKED") return { valid: false, reason: "REVOKED" };
    if (record.status === "COMPLETED") return { valid: false, reason: "COMPLETED" };
    if (new Date(record.expiresAt).getTime() <= now) {
      record.status = "EXPIRED";
      return { valid: false, reason: "EXPIRED" };
    }
    return { valid: true, reason: null };
  }

  /** Verifies the job is valid AND bound to the calling device, AND covers
   * the requested scope. A PC agent must call this before executing any
   * step of any job - never assume a previously-valid job is still valid. */
  authorize(params: { jobId: string; deviceId: string; requiredScope: string }, now: number = Date.now()): JobAuthorizationCheck {
    const status = this.getStatus(params.jobId, now);
    if (!status.valid) return status;
    const record = this.jobs.get(params.jobId)!;
    if (record.deviceId !== params.deviceId) return { valid: false, reason: "DEVICE_MISMATCH" };
    if (!record.scope.includes(params.requiredScope)) return { valid: false, reason: "SCOPE_NOT_GRANTED" };
    return { valid: true, reason: null };
  }

  revoke(jobId: string): void {
    const record = this.jobs.get(jobId);
    if (record && record.status === "ACTIVE") record.status = "REVOKED";
  }

  complete(jobId: string): void {
    const record = this.jobs.get(jobId);
    if (record && record.status === "ACTIVE") record.status = "COMPLETED";
  }

  get(jobId: string): DeviceJobAuthorization | undefined {
    return this.jobs.get(jobId);
  }
}

export interface JobAuthorizationCheck {
  valid: boolean;
  reason: "UNKNOWN_JOB" | "REVOKED" | "COMPLETED" | "EXPIRED" | "DEVICE_MISMATCH" | "SCOPE_NOT_GRANTED" | null;
}
