import { randomUUID } from "node:crypto";
import type { AntiSybilAwarenessReport, AntiSybilSignal, ClaimConfidence } from "@airdrop-os/types";

/**
 * Phase 7: Anti-Sybil awareness.
 *
 * This module only ever surfaces information to the user - it never
 * blocks a transaction, never fabricates multiple accounts, never
 * disguises wallet linkage, and never attempts to defeat a platform's
 * own anti-Sybil checks. `note` is a fixed literal so every report is
 * self-documenting about this constraint even out of context.
 */

export class AntiSybilAwarenessStore {
  private signals: AntiSybilSignal[] = [];

  record(walletAddress: string, code: string, detail: string, confidence: ClaimConfidence): AntiSybilSignal {
    const signal: AntiSybilSignal = {
      signalId: randomUUID(),
      walletAddress,
      code,
      detail,
      confidence,
      detectedAt: new Date().toISOString(),
    };
    this.signals.push(signal);
    return signal;
  }

  report(walletAddress: string): AntiSybilAwarenessReport {
    return {
      walletAddress,
      signals: this.signals.filter((s) => s.walletAddress === walletAddress),
      note: "AWARENESS_ONLY_NEVER_BYPASSES_PLATFORM_PROTECTIONS",
      generatedAt: new Date().toISOString(),
    };
  }
}
