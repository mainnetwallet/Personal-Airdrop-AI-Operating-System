import { describe, it, expect, vi } from "vitest";
import { checkLiveness, checkReadiness } from "../health.js";

describe("checkLiveness", () => {
  it("always reports ok without touching dependencies", () => {
    const report = checkLiveness();
    expect(report.status).toBe("ok");
    expect(report.components.process.status).toBe("ok");
  });
});

describe("checkReadiness", () => {
  it("reports ok when db and redis both respond", async () => {
    const db = { execute: vi.fn().mockResolvedValue(undefined) } as any;
    const redis = { ping: vi.fn().mockResolvedValue("PONG") } as any;
    const report = await checkReadiness(db, redis);
    expect(report.status).toBe("ok");
    expect(report.components.database.status).toBe("ok");
    expect(report.components.redis.status).toBe("ok");
  });

  it("fails closed when database throws", async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error("connection refused")) } as any;
    const redis = { ping: vi.fn().mockResolvedValue("PONG") } as any;
    const report = await checkReadiness(db, redis);
    expect(report.status).toBe("error");
    expect(report.components.database.status).toBe("error");
  });

  it("fails closed when redis is unreachable", async () => {
    const db = { execute: vi.fn().mockResolvedValue(undefined) } as any;
    const redis = { ping: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) } as any;
    const report = await checkReadiness(db, redis);
    expect(report.status).toBe("error");
    expect(report.components.redis.status).toBe("error");
  });
});
