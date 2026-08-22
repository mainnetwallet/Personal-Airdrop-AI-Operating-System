import { describe, expect, it } from "vitest";
import { DistributedLockManager, JobLeaseManager, LockHeldByAnotherOwnerError } from "../multidevice/concurrency.js";

describe("DistributedLockManager", () => {
  it("acquires an unheld lock", () => {
    const mgr = new DistributedLockManager();
    const lock = mgr.acquire("wf:1", "owner-A", "device-1", 30_000, 1_000);
    expect(lock.status).toBe("HELD");
    expect(lock.ownerId).toBe("owner-A");
  });

  it("refuses to acquire a lock held by another non-expired owner", () => {
    const mgr = new DistributedLockManager();
    mgr.acquire("wf:1", "owner-A", null, 30_000, 1_000);
    expect(() => mgr.acquire("wf:1", "owner-B", null, 30_000, 2_000)).toThrow(LockHeldByAnotherOwnerError);
  });

  it("allows re-acquiring after expiration", () => {
    const mgr = new DistributedLockManager();
    mgr.acquire("wf:1", "owner-A", null, 1_000, 0);
    const lock = mgr.acquire("wf:1", "owner-B", null, 1_000, 5_000);
    expect(lock.ownerId).toBe("owner-B");
  });

  it("heartbeat extends expiration for the current owner", () => {
    const mgr = new DistributedLockManager();
    mgr.acquire("wf:1", "owner-A", null, 1_000, 0);
    const extended = mgr.heartbeat("wf:1", "owner-A", 5_000, 500);
    expect(new Date(extended.expiresAt).getTime()).toBe(5_500);
  });

  it("heartbeat from a non-owner fails", () => {
    const mgr = new DistributedLockManager();
    mgr.acquire("wf:1", "owner-A", null, 10_000, 0);
    expect(() => mgr.heartbeat("wf:1", "owner-B", 5_000, 500)).toThrow(LockHeldByAnotherOwnerError);
  });

  it("release frees the lock for the owner", () => {
    const mgr = new DistributedLockManager();
    mgr.acquire("wf:1", "owner-A", null, 10_000, 0);
    const released = mgr.release("wf:1", "owner-A");
    expect(released?.status).toBe("RELEASED");
    expect(mgr.isHeldByOther("wf:1", "owner-B", 100)).toBe(false);
  });

  it("isHeldByOther correctly reports contention", () => {
    const mgr = new DistributedLockManager();
    mgr.acquire("wf:1", "owner-A", null, 10_000, 0);
    expect(mgr.isHeldByOther("wf:1", "owner-B", 100)).toBe(true);
    expect(mgr.isHeldByOther("wf:1", "owner-A", 100)).toBe(false);
  });
});

describe("JobLeaseManager", () => {
  it("starts a lease", () => {
    const mgr = new JobLeaseManager();
    const lease = mgr.start("job-1", "owner-A", null, "worker-1", 30_000, 0);
    expect(lease.status).toBe("ACTIVE");
  });

  it("refuses to start a lease already active for another worker", () => {
    const mgr = new JobLeaseManager();
    mgr.start("job-1", "owner-A", null, "worker-1", 30_000, 0);
    expect(() => mgr.start("job-1", "owner-A", null, "worker-2", 30_000, 1_000)).toThrow(/already leased/);
  });

  it("recovers an expired lease for a new worker", () => {
    const mgr = new JobLeaseManager();
    mgr.start("job-1", "owner-A", null, "worker-1", 1_000, 0);
    const recovered = mgr.recover("job-1", "worker-2", 30_000, 5_000);
    expect(recovered.status).toBe("RECOVERED");
    expect(recovered.workerId).toBe("worker-2");
  });

  it("refuses to recover a still-active non-expired lease", () => {
    const mgr = new JobLeaseManager();
    mgr.start("job-1", "owner-A", null, "worker-1", 30_000, 0);
    expect(() => mgr.recover("job-1", "worker-2", 30_000, 1_000)).toThrow(/still active/);
  });

  it("completes a lease held by the correct worker", () => {
    const mgr = new JobLeaseManager();
    mgr.start("job-1", "owner-A", null, "worker-1", 30_000, 0);
    const completed = mgr.complete("job-1", "worker-1");
    expect(completed.status).toBe("COMPLETED");
  });

  it("heartbeat extends lease expiration", () => {
    const mgr = new JobLeaseManager();
    mgr.start("job-1", "owner-A", null, "worker-1", 1_000, 0);
    const extended = mgr.heartbeat("job-1", "worker-1", 5_000, 500);
    expect(new Date(extended.leaseExpiresAt).getTime()).toBe(5_500);
  });
});
