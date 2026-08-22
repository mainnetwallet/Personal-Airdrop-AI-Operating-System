import { describe, it, expect } from "vitest";
import { PcAgentAuthorizer } from "../agent/pcAgentAuth.js";

describe("PcAgentAuthorizer", () => {
  it("issues an ACTIVE job authorization with an expiry", () => {
    const auth = new PcAgentAuthorizer();
    const job = auth.issue({ jobId: "job-1", deviceId: "dev-1", agentId: "agent-1", scope: ["BROWSER"], ttlMs: 60_000, now: 1_000_000 });
    expect(job.status).toBe("ACTIVE");
    expect(new Date(job.expiresAt).getTime()).toBe(1_060_000);
  });

  it("authorizes when device and scope match", () => {
    const auth = new PcAgentAuthorizer();
    auth.issue({ jobId: "job-1", deviceId: "dev-1", agentId: "agent-1", scope: ["BROWSER", "READ"], ttlMs: 60_000, now: 0 });
    const check = auth.authorize({ jobId: "job-1", deviceId: "dev-1", requiredScope: "BROWSER" }, 1000);
    expect(check.valid).toBe(true);
  });

  it("rejects when device does not match", () => {
    const auth = new PcAgentAuthorizer();
    auth.issue({ jobId: "job-1", deviceId: "dev-1", agentId: "agent-1", scope: ["BROWSER"], ttlMs: 60_000, now: 0 });
    const check = auth.authorize({ jobId: "job-1", deviceId: "dev-2", requiredScope: "BROWSER" }, 1000);
    expect(check).toEqual({ valid: false, reason: "DEVICE_MISMATCH" });
  });

  it("rejects when scope is not granted", () => {
    const auth = new PcAgentAuthorizer();
    auth.issue({ jobId: "job-1", deviceId: "dev-1", agentId: "agent-1", scope: ["READ"], ttlMs: 60_000, now: 0 });
    const check = auth.authorize({ jobId: "job-1", deviceId: "dev-1", requiredScope: "BROWSER" }, 1000);
    expect(check).toEqual({ valid: false, reason: "SCOPE_NOT_GRANTED" });
  });

  it("lazily expires a job once past expiresAt", () => {
    const auth = new PcAgentAuthorizer();
    auth.issue({ jobId: "job-1", deviceId: "dev-1", agentId: "agent-1", scope: ["BROWSER"], ttlMs: 1000, now: 0 });
    const status = auth.getStatus("job-1", 5000);
    expect(status).toEqual({ valid: false, reason: "EXPIRED" });
    expect(auth.get("job-1")!.status).toBe("EXPIRED");
  });

  it("never revives a REVOKED job even before its natural expiry", () => {
    const auth = new PcAgentAuthorizer();
    auth.issue({ jobId: "job-1", deviceId: "dev-1", agentId: "agent-1", scope: ["BROWSER"], ttlMs: 60_000, now: 0 });
    auth.revoke("job-1");
    const check = auth.authorize({ jobId: "job-1", deviceId: "dev-1", requiredScope: "BROWSER" }, 100);
    expect(check).toEqual({ valid: false, reason: "REVOKED" });
  });

  it("rejects unknown jobs", () => {
    const auth = new PcAgentAuthorizer();
    expect(auth.getStatus("nope")).toEqual({ valid: false, reason: "UNKNOWN_JOB" });
  });

  it("marks a job COMPLETED and rejects further authorization", () => {
    const auth = new PcAgentAuthorizer();
    auth.issue({ jobId: "job-1", deviceId: "dev-1", agentId: "agent-1", scope: ["BROWSER"], ttlMs: 60_000, now: 0 });
    auth.complete("job-1");
    const check = auth.authorize({ jobId: "job-1", deviceId: "dev-1", requiredScope: "BROWSER" }, 100);
    expect(check).toEqual({ valid: false, reason: "COMPLETED" });
  });
});
