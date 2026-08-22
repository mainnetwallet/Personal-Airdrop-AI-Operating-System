/**
 * Phase 11: Distributed Lock Engine (section 134), Job Lease Engine
 * (136), Stale Job Protection (137), and Device/Job Conflict (209, 284).
 *
 * This is pure in-process state management - the real cross-process
 * guarantee (e.g. Postgres advisory locks or a Redis lease) is still
 * NOT_CONFIGURED, exactly like every other multi-device primitive in
 * this repository (see docs/phases/CURRENT_STATE.md). What's tested
 * here is the decision logic: only one owner may hold a lock/lease at
 * a time, expired holders lose it, and a heartbeat is required to keep
 * it alive - any real transport must honor these rules, not bypass them.
 */
import type { DistributedLockRecord, JobLeaseRecord } from "@airdrop-os/types";

export class LockHeldByAnotherOwnerError extends Error {
  constructor(lockKey: string, ownerId: string) {
    super(`Lock "${lockKey}" is held by another owner (requested by ${ownerId})`);
    this.name = "LockHeldByAnotherOwnerError";
  }
}

export class DistributedLockManager {
  private readonly locks = new Map<string, DistributedLockRecord>();

  private isExpired(lock: DistributedLockRecord, now: number): boolean {
    return new Date(lock.expiresAt).getTime() <= now;
  }

  /** Acquire a lock. Throws if another non-expired owner already holds it. */
  acquire(lockKey: string, ownerId: string, deviceId: string | null, ttlMs: number, now: number = Date.now()): DistributedLockRecord {
    const existing = this.locks.get(lockKey);
    if (existing && existing.status === "HELD" && existing.ownerId !== ownerId && !this.isExpired(existing, now)) {
      throw new LockHeldByAnotherOwnerError(lockKey, existing.ownerId);
    }
    const record: DistributedLockRecord = {
      lockKey,
      ownerId,
      deviceId,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      heartbeatAt: new Date(now).toISOString(),
      status: "HELD",
    };
    this.locks.set(lockKey, record);
    return record;
  }

  heartbeat(lockKey: string, ownerId: string, extendMs: number, now: number = Date.now()): DistributedLockRecord {
    const existing = this.locks.get(lockKey);
    if (!existing || existing.ownerId !== ownerId || existing.status !== "HELD" || this.isExpired(existing, now)) {
      throw new LockHeldByAnotherOwnerError(lockKey, ownerId);
    }
    const updated: DistributedLockRecord = {
      ...existing,
      heartbeatAt: new Date(now).toISOString(),
      expiresAt: new Date(now + extendMs).toISOString(),
    };
    this.locks.set(lockKey, updated);
    return updated;
  }

  release(lockKey: string, ownerId: string): DistributedLockRecord | null {
    const existing = this.locks.get(lockKey);
    if (!existing || existing.ownerId !== ownerId) return null;
    const updated: DistributedLockRecord = { ...existing, status: "RELEASED" };
    this.locks.set(lockKey, updated);
    return updated;
  }

  /** Whether lockKey is currently held by anyone other than ownerId (accounting for expiration). */
  isHeldByOther(lockKey: string, ownerId: string, now: number = Date.now()): boolean {
    const existing = this.locks.get(lockKey);
    if (!existing || existing.status !== "HELD") return false;
    if (this.isExpired(existing, now)) return false;
    return existing.ownerId !== ownerId;
  }

  get(lockKey: string): DistributedLockRecord | null {
    return this.locks.get(lockKey) ?? null;
  }
}

export class JobLeaseManager {
  private readonly leases = new Map<string, JobLeaseRecord>();

  private isExpired(lease: JobLeaseRecord, now: number): boolean {
    return new Date(lease.leaseExpiresAt).getTime() <= now;
  }

  start(jobId: string, ownerId: string, deviceId: string | null, workerId: string, ttlMs: number, now: number = Date.now()): JobLeaseRecord {
    const existing = this.leases.get(jobId);
    if (existing && existing.status === "ACTIVE" && !this.isExpired(existing, now) && existing.workerId !== workerId) {
      throw new Error(`Job ${jobId} is already leased to worker ${existing.workerId}`);
    }
    const record: JobLeaseRecord = {
      jobId,
      ownerId,
      deviceId,
      workerId,
      leaseExpiresAt: new Date(now + ttlMs).toISOString(),
      heartbeatAt: new Date(now).toISOString(),
      status: "ACTIVE",
    };
    this.leases.set(jobId, record);
    return record;
  }

  heartbeat(jobId: string, workerId: string, extendMs: number, now: number = Date.now()): JobLeaseRecord {
    const existing = this.leases.get(jobId);
    if (!existing || existing.workerId !== workerId || existing.status !== "ACTIVE") {
      throw new Error(`No active lease for job ${jobId} held by worker ${workerId}`);
    }
    const updated: JobLeaseRecord = {
      ...existing,
      heartbeatAt: new Date(now).toISOString(),
      leaseExpiresAt: new Date(now + extendMs).toISOString(),
    };
    this.leases.set(jobId, updated);
    return updated;
  }

  complete(jobId: string, workerId: string): JobLeaseRecord {
    const existing = this.leases.get(jobId);
    if (!existing || existing.workerId !== workerId) {
      throw new Error(`No lease for job ${jobId} held by worker ${workerId}`);
    }
    const updated: JobLeaseRecord = { ...existing, status: "COMPLETED" };
    this.leases.set(jobId, updated);
    return updated;
  }

  /** Section 136: if a worker dies, another worker may recover the lease once expired. */
  recover(jobId: string, newWorkerId: string, ttlMs: number, now: number = Date.now()): JobLeaseRecord {
    const existing = this.leases.get(jobId);
    if (!existing) throw new Error(`No lease found for job ${jobId}`);
    if (existing.status === "ACTIVE" && !this.isExpired(existing, now)) {
      throw new Error(`Job ${jobId} lease is still active and not expired - cannot recover`);
    }
    const record: JobLeaseRecord = {
      ...existing,
      workerId: newWorkerId,
      status: "RECOVERED",
      heartbeatAt: new Date(now).toISOString(),
      leaseExpiresAt: new Date(now + ttlMs).toISOString(),
    };
    this.leases.set(jobId, record);
    return record;
  }

  get(jobId: string): JobLeaseRecord | null {
    return this.leases.get(jobId) ?? null;
  }
}
