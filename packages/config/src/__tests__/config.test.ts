import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig, __resetConfigCache } from "../index.js";

const validEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
};

beforeEach(() => __resetConfigCache());

describe("loadConfig", () => {
  it("loads valid config with defaults applied", () => {
    const cfg = loadConfig(validEnv as any);
    expect(cfg.API_PORT).toBe(4000);
    expect(cfg.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
  });

  it("fails closed when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = validEnv;
    expect(() => loadConfig(rest as any)).toThrow(/DATABASE_URL/);
  });

  it("fails closed when JWT secret is too short", () => {
    const bad = { ...validEnv, JWT_ACCESS_SECRET: "short" };
    expect(() => loadConfig(bad as any)).toThrow(/JWT_ACCESS_SECRET/);
  });
});
