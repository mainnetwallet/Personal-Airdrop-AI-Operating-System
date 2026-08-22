import type { DomainCheckResult, DomainRiskSignal } from "@airdrop-os/types";

/**
 * Phase 7: Domain protection.
 *
 * Pure, deterministic, offline heuristics against a caller-supplied list
 * of official domains. This module never queries DNS, WHOIS, or any live
 * reputation service (NOT_CONFIGURED in this sandbox) - it only reasons
 * about the strings it is given. That is a deliberate limitation, not a
 * hidden assumption: callers must treat "no signal found" as "nothing
 * this offline heuristic could detect", not as a live-verified guarantee.
 */

const KNOWN_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "cutt.ly", "rebrand.ly", "shorturl.at", "rb.gy",
]);

/** Homoglyph map: lookalike Unicode code points -> the ASCII char they mimic. */
const CONFUSABLES: Record<string, string> = {
  "\u0430": "a", // Cyrillic a
  "\u0435": "e", // Cyrillic e
  "\u043e": "o", // Cyrillic o
  "\u0440": "p", // Cyrillic er
  "\u0441": "c", // Cyrillic es
  "\u0443": "y", // Cyrillic u
  "\u0456": "i", // Cyrillic i
  "\u0501": "d",
  "\u0261": "g", // Latin script small letter g
  "\u1e00": "a",
  "\uff41": "a", // fullwidth a
};

function hasNonAscii(domain: string): boolean {
  return /[^\x00-\x7f]/.test(domain);
}

function normalizeConfusables(domain: string): string {
  let out = "";
  for (const ch of domain) {
    out += CONFUSABLES[ch] ?? ch;
  }
  return out;
}

/** Levenshtein distance, small-input only (domain labels). */
function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function extractRegistrableDomain(domain: string): string {
  // No PSL (public suffix list) available offline; this is a best-effort
  // last-two-labels heuristic and is documented as such to callers.
  const parts = domain.toLowerCase().split(".");
  if (parts.length <= 2) return domain.toLowerCase();
  return parts.slice(-2).join(".");
}

export function checkDomain(rawDomain: string, officialDomains: string[]): DomainCheckResult {
  const domain = rawDomain.trim().toLowerCase();
  const signals: DomainRiskSignal[] = [];
  const official = officialDomains.map((d) => d.trim().toLowerCase());
  const registrable = extractRegistrableDomain(domain);

  const isOfficial = official.includes(domain) || official.includes(registrable);

  if (!isOfficial) {
    if (hasNonAscii(domain)) {
      signals.push("UNICODE_LOOKALIKE");
    } else {
      const normalized = normalizeConfusables(domain);
      if (normalized !== domain && official.includes(extractRegistrableDomain(normalized))) {
        signals.push("UNICODE_LOOKALIKE");
      }
    }

    for (const off of official) {
      const offReg = extractRegistrableDomain(off);
      if (registrable === offReg) continue; // exact match already handled above

      // Fake subdomain: official domain appears as a label but is not the
      // registrable (eTLD+1) domain, e.g. "official.com.evil.net" or
      // "official-com.evil.net".
      if (domain.includes(off) || domain.includes(off.replace(/\./g, "-"))) {
        signals.push("FAKE_SUBDOMAIN");
      }

      // Typosquatting: very close edit distance to an official domain's
      // registrable name (excluding TLD) with the same length class.
      const [offName] = offReg.split(".");
      const [thisName] = registrable.split(".");
      if (offName && thisName && offName !== thisName) {
        const dist = editDistance(offName, thisName);
        if (dist > 0 && dist <= 2 && Math.abs(offName.length - thisName.length) <= 2) {
          signals.push("TYPOSQUATTING");
        }
      }
    }
  }

  if (KNOWN_SHORTENERS.has(registrable)) {
    signals.push("URL_SHORTENER");
  }

  if (!isOfficial && signals.length === 0 && official.length > 0) {
    signals.push("UNEXPECTED_DOMAIN");
  }

  const uniqueSignals = Array.from(new Set(signals));

  let verdict: DomainCheckResult["verdict"] = "SAFE";
  if (isOfficial) {
    verdict = "SAFE";
  } else if (
    uniqueSignals.includes("TYPOSQUATTING") ||
    uniqueSignals.includes("UNICODE_LOOKALIKE") ||
    uniqueSignals.includes("FAKE_SUBDOMAIN") ||
    uniqueSignals.includes("KNOWN_PHISHING")
  ) {
    verdict = "BLOCK";
  } else if (uniqueSignals.length > 0) {
    verdict = "SUSPICIOUS";
  }

  return {
    domain,
    officialDomains: official,
    isOfficial,
    signals: uniqueSignals,
    verdict,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Flags a caller-supplied redirect chain as suspicious when the final
 * landing domain differs from the domain the user believes they are on.
 * This never follows redirects itself (no network access here) - the
 * caller must supply the observed chain.
 */
export function checkRedirectChain(
  startDomain: string,
  finalDomain: string,
  officialDomains: string[],
): DomainCheckResult {
  const result = checkDomain(finalDomain, officialDomains);
  if (startDomain.trim().toLowerCase() !== finalDomain.trim().toLowerCase() && !result.isOfficial) {
    return {
      ...result,
      signals: Array.from(new Set([...result.signals, "SUSPICIOUS_REDIRECT" as DomainRiskSignal])),
      verdict: result.verdict === "SAFE" ? "SUSPICIOUS" : result.verdict,
    };
  }
  return result;
}
