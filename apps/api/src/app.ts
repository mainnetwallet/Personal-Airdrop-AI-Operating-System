import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import Redis from "ioredis";
import { createDatabase, type Database } from "@airdrop-os/database";
import { loadConfig, type AppEnv } from "@airdrop-os/config";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/devices.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    redis: Redis;
    config: AppEnv;
  }
}

export interface BuildAppOptions {
  config?: AppEnv;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = opts.config ?? loadConfig();
  const app = Fastify({ logger: true });

  const { db } = createDatabase(config.DATABASE_URL);
  const redis = new Redis(config.REDIS_URL, { lazyConnect: true });

  app.decorate("db", db);
  app.decorate("redis", redis);
  app.decorate("config", config);

  // Basic rate limiting - a foundation control; per-route tuning and
  // replay protection for auth endpoints specifically can be layered on
  // in later phases.
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(deviceRoutes);

  app.addHook("onClose", async () => {
    await redis.quit().catch(() => undefined);
  });

  return app;
}
