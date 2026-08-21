import type { Database } from "@airdrop-os/database";
import type Redis from "ioredis";
import { sql } from "drizzle-orm";

export interface ComponentHealth {
  status: "ok" | "error" | "not_configured";
  detail?: string;
}

export interface HealthReport {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  components: Record<string, ComponentHealth>;
}

/**
 * Liveness check: process is up and can respond. Does NOT touch
 * external dependencies, so it stays fast and fails only if the
 * process itself is broken.
 */
export function checkLiveness(): HealthReport {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    components: { process: { status: "ok" } },
  };
}

/**
 * Readiness check: verifies the app can actually serve traffic -
 * database and redis must both be reachable. Fails closed: any
 * component that can't be verified is reported as an error, never
 * silently assumed healthy.
 */
export async function checkReadiness(db: Database, redis: Redis): Promise<HealthReport> {
  const components: Record<string, ComponentHealth> = {};

  try {
    await db.execute(sql`select 1`);
    components.database = { status: "ok" };
  } catch (err) {
    components.database = { status: "error", detail: (err as Error).message };
  }

  try {
    const pong = await redis.ping();
    components.redis = pong === "PONG" ? { status: "ok" } : { status: "error", detail: `unexpected ping response: ${pong}` };
  } catch (err) {
    components.redis = { status: "error", detail: (err as Error).message };
  }

  const allOk = Object.values(components).every((c) => c.status === "ok");
  return {
    status: allOk ? "ok" : "error",
    timestamp: new Date().toISOString(),
    components,
  };
}
