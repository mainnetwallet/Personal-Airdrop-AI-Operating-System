import { z } from "zod";

/**
 * Central environment schema. Fails closed: if required secrets are
 * missing, the app must not silently continue with defaults for
 * anything security-relevant (JWT secrets, DB URL).
 *
 * NEVER put real secret values in source control. See ../../.env.example
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Redis / queues
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be >= 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be >= 32 chars"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15 min
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2592000), // 30 days

  // API
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

/**
 * Loads and validates environment configuration.
 * Fail-closed: throws if any required security-relevant variable is
 * missing or malformed, instead of falling back to an insecure default.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid/missing environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper - clears memoized config between test runs. */
export function __resetConfigCache(): void {
  cached = null;
}
