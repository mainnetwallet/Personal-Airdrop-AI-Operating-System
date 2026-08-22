import { z } from "zod";

/**
 * The local agent's own env schema - deliberately separate from the API's
 * (`@airdrop-os/config`), since a PC agent never needs DATABASE_URL,
 * REDIS_URL, or the API's JWT secrets. It only needs enough to reach the
 * VPS and authenticate as an already-registered PC device (Phase 1
 * device registry). Fails closed: missing required values throw rather
 * than falling back to an insecure default.
 */
const envSchema = z.object({
  VPS_API_URL: z.string().url("VPS_API_URL must be a valid URL"),
  DEVICE_ID: z.string().min(1, "DEVICE_ID is required"),
  DEVICE_REFRESH_TOKEN: z.string().min(1, "DEVICE_REFRESH_TOKEN is required"),
  AGENT_VERSION: z.string().default("0.1.0"),
  // Optional: path to a locally installed Chromium binary (e.g. Termux's
  // `pkg install chromium` on Android, or a system Chromium on Linux).
  // When unset, launchBrowser() stays NOT_CONFIGURED rather than guessing
  // a path, since a wrong guess would silently fail closed in a
  // confusing way.
  CHROMIUM_PATH: z.string().optional(),
});

export type LocalAgentEnv = z.infer<typeof envSchema>;

let cached: LocalAgentEnv | null = null;

export function loadLocalAgentConfig(source: NodeJS.ProcessEnv = process.env): LocalAgentEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid/missing local agent configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function __resetLocalAgentConfigCache(): void {
  cached = null;
}
