import type { PromptInjectionFinding, PromptInjectionScanResult, UntrustedContentSource } from "@airdrop-os/types";

/**
 * Phase 7: Prompt-injection defense.
 *
 * Content from web pages, Discord, X, Telegram, GitHub, quest pages, and
 * on-chain/contract metadata is untrusted DATA, never instructions. This
 * scanner flags common injection patterns for the caller's awareness; it
 * never executes, follows, or treats any instruction found in that
 * content as something to act on. `contentTreatedAsData: true` is a
 * fixed literal so this constraint is visible on every result.
 */

const INJECTION_PATTERNS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "IGNORE_PREVIOUS_INSTRUCTIONS", pattern: /ignore (all|any|the)?\s*(previous|prior|above) instructions/i },
  { signal: "SYSTEM_PROMPT_OVERRIDE", pattern: /you are now|new system prompt|act as (system|admin|root)/i },
  { signal: "REQUEST_SECRET_DISCLOSURE", pattern: /(reveal|print|output|send).{0,20}(seed phrase|private key|api key|password)/i },
  { signal: "REQUEST_AUTO_APPROVE", pattern: /auto[-\s]?approve|sign (this|the) transaction automatically|bypass (the )?firewall/i },
  { signal: "REQUEST_DISABLE_SECURITY", pattern: /disable (security|captcha|2fa|verification)|skip simulation/i },
  { signal: "HIDDEN_INSTRUCTION_MARKER", pattern: /\[system\]|<\|.*?\|>|###\s*instruction/i },
];

function redactSnippet(content: string, index: number, length: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(content.length, index + length + 20);
  const snippet = content.slice(start, end);
  return snippet.length < content.length ? `...${snippet}...` : snippet;
}

export function scanForPromptInjection(source: UntrustedContentSource, content: string): PromptInjectionScanResult {
  const findings: PromptInjectionFinding[] = [];

  for (const { signal, pattern } of INJECTION_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
      findings.push({
        source,
        signal,
        snippet: redactSnippet(content, match.index, match[0].length),
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return {
    source,
    contentTreatedAsData: true,
    findings,
    suspicious: findings.length > 0,
    scannedAt: new Date().toISOString(),
  };
}
