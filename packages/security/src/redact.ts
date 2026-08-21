/**
 * Secret redaction utilities.
 *
 * These patterns exist to keep raw secrets (seed phrases, private keys,
 * passwords, OTP/2FA codes, session tokens, API keys) out of logs, audit
 * entries, and any persisted memory record. This is a defense-in-depth
 * layer, not a substitute for never collecting these values in the first
 * place - the system must never prompt for or store them.
 */

const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /seed.?phrase/i,
  /mnemonic/i,
  /private.?key/i,
  /priv.?key/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /\botp\b/i,
  /2fa/i,
  /totp/i,
  /recovery.?code/i,
  /session.?token/i,
  /access.?token/i,
  /refresh.?token/i,
  /api.?key/i,
  /authorization/i,
  /card.?number/i,
  /cvv/i,
];

const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
}

/**
 * Deeply redacts sensitive fields from an object/array before it is
 * logged, audited, or persisted to memory. Non-sensitive data is
 * passed through unchanged.
 */
export function redactSecrets<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return redactSecretLikeString(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v, seen)) as unknown as T;
  }

  if (typeof value === "object") {
    if (seen.has(value as object)) return value; // avoid cycles
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = redactSecrets(v, seen);
      }
    }
    return out as unknown as T;
  }

  return value;
}

// Loose heuristics for secret-shaped strings even without a labeled key
// (e.g. a 12/24-word phrase or a 0x-prefixed 32-byte hex private key).
const HEX_PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;
const LIKELY_SEED_PHRASE = /^(\s*[a-z]+\s+){11,23}[a-z]+\s*$/i;

function redactSecretLikeString(value: string): string {
  if (HEX_PRIVATE_KEY.test(value)) return REDACTED;
  if (LIKELY_SEED_PHRASE.test(value)) return REDACTED;
  return value;
}
