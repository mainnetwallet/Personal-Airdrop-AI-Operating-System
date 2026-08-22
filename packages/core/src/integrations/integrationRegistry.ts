/**
 * Phase 8: Integration status tracking for the external services
 * off-chain adapters read from (Discord, X, Telegram, GitHub, quest
 * platforms, DePIN networks, AI/compute platforms, GameFi platforms,
 * prediction/trading platforms, referral/ambassador platforms,
 * exchanges, waitlist and learn-to-earn platforms).
 *
 * Every provider starts NOT_CONFIGURED and stays that way until the
 * caller explicitly reports a real connection — this registry never
 * fabricates a live status. `getStatus()` on an unregistered/unknown
 * provider also resolves to NOT_CONFIGURED rather than throwing or
 * returning undefined, so callers never have to special-case "missing"
 * versus "explicitly not set up."
 */
import type { IntegrationHealthState, IntegrationProvider, IntegrationState } from "@airdrop-os/types";

const ALL_PROVIDERS: readonly IntegrationProvider[] = [
  "DISCORD", "X", "TELEGRAM", "GITHUB", "QUEST_PLATFORM", "DEPIN_NETWORK",
  "AI_COMPUTE_PLATFORM", "GAMEFI_PLATFORM", "PREDICTION_TRADING_PLATFORM",
  "REFERRAL_PLATFORM", "AMBASSADOR_PLATFORM", "EXCHANGE", "WAITLIST_PLATFORM",
  "LEARN_PLATFORM",
];

function notConfiguredState(provider: IntegrationProvider): IntegrationState {
  return {
    provider,
    status: "NOT_CONFIGURED",
    detail: "No credentials/API keys configured in this environment.",
    lastCheckedAt: new Date().toISOString(),
  };
}

export class IntegrationRegistry {
  private readonly states = new Map<IntegrationProvider, IntegrationState>();

  constructor(providers: readonly IntegrationProvider[] = ALL_PROVIDERS) {
    for (const provider of providers) {
      this.states.set(provider, notConfiguredState(provider));
    }
  }

  getStatus(provider: IntegrationProvider): IntegrationState {
    return this.states.get(provider) ?? notConfiguredState(provider);
  }

  /**
   * Explicitly set a provider's status. There is no code path that
   * infers CONNECTED — a caller must report it, normally after an
   * actual successful auth/health-check against the real service.
   */
  setStatus(provider: IntegrationProvider, status: IntegrationHealthState, detail: string): IntegrationState {
    const state: IntegrationState = { provider, status, detail, lastCheckedAt: new Date().toISOString() };
    this.states.set(provider, state);
    return state;
  }

  isConnected(provider: IntegrationProvider): boolean {
    return this.getStatus(provider).status === "CONNECTED";
  }

  allStates(): IntegrationState[] {
    return [...this.states.values()];
  }

  report(): Record<string, IntegrationHealthState> {
    const out: Record<string, IntegrationHealthState> = {};
    for (const state of this.states.values()) out[state.provider] = state.status;
    return out;
  }
}
