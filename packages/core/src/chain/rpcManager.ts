import type { RpcProviderConfig, RpcProviderState, RpcProviderRole, ChainId } from "@airdrop-os/types";

const ROLE_ORDER: RpcProviderRole[] = ["PRIMARY", "BACKUP", "BACKUP2", "BACKUP3"];

const CIRCUIT_BREAKER_THRESHOLD = 5; // consecutive failures before opening
const CIRCUIT_RESET_MS = 60_000;

export interface RpcCallResult {
  providerId: string;
  latencyMs: number;
}

export interface RpcCallFailure {
  providerId: string;
  error: string;
  rateLimited?: boolean;
}

/**
 * Manages a set of RPC providers per chain with explicit
 * primary/backup/backup2/backup3 failover, latency tracking, and a
 * circuit breaker per provider. NEVER calls a real network endpoint
 * itself - this is pure state management the API/worker layer drives
 * with real call outcomes. A provider with `url: null` is reported as
 * NOT_CONFIGURED rather than silently skipped or fabricated as healthy.
 */
export class RpcManager {
  private readonly configs = new Map<string, RpcProviderConfig>();
  private readonly states = new Map<string, RpcProviderState>();
  private readonly byChain = new Map<ChainId, string[]>(); // providerIds in role order

  registerProvider(config: RpcProviderConfig): void {
    this.configs.set(config.providerId, config);
    this.states.set(config.providerId, {
      providerId: config.providerId,
      health: config.url ? "HEALTHY" : "NOT_CONFIGURED",
      consecutiveFailures: 0,
      lastLatencyMs: null,
      lastError: null,
      lastCheckedAt: null,
      circuitOpenedAt: null,
      rateLimitedUntil: null,
    });
    const list = this.byChain.get(config.chain) ?? [];
    list.push(config.providerId);
    list.sort((a, b) => ROLE_ORDER.indexOf(this.configs.get(a)!.role) - ROLE_ORDER.indexOf(this.configs.get(b)!.role));
    this.byChain.set(config.chain, list);
  }

  getState(providerId: string): RpcProviderState {
    const state = this.states.get(providerId);
    if (!state) throw new Error(`Unknown RPC provider: ${providerId}`);
    return state;
  }

  /**
   * Returns the provider to use for a chain right now: the highest-role
   * provider that is not NOT_CONFIGURED, not CIRCUIT_OPEN (unless the
   * reset window has elapsed), and not currently rate-limited. Returns
   * null if every provider for the chain is unusable - callers must
   * treat that as "chain temporarily unavailable", never fall back to
   * fabricated data.
   */
  selectProvider(chain: ChainId, now: number = Date.now()): string | null {
    const candidates = this.byChain.get(chain) ?? [];
    for (const providerId of candidates) {
      const state = this.states.get(providerId)!;
      if (state.health === "NOT_CONFIGURED") continue;
      if (state.rateLimitedUntil && new Date(state.rateLimitedUntil).getTime() > now) continue;
      if (state.health === "CIRCUIT_OPEN") {
        if (state.circuitOpenedAt && now - new Date(state.circuitOpenedAt).getTime() >= CIRCUIT_RESET_MS) {
          // Half-open: allow one trial call by treating it as selectable again.
          state.health = "DEGRADED";
        } else {
          continue;
        }
      }
      return providerId;
    }
    return null;
  }

  recordSuccess(result: RpcCallResult, now: number = Date.now()): void {
    const state = this.getState(result.providerId);
    state.consecutiveFailures = 0;
    state.lastLatencyMs = result.latencyMs;
    state.lastError = null;
    state.lastCheckedAt = new Date(now).toISOString();
    state.circuitOpenedAt = null;
    state.health = result.latencyMs > 3000 ? "DEGRADED" : "HEALTHY";
  }

  /**
   * Records a failed call. Opens the circuit breaker once
   * CIRCUIT_BREAKER_THRESHOLD consecutive failures accumulate - once
   * open, selectProvider() skips this provider until CIRCUIT_RESET_MS
   * has elapsed, at which point it goes DEGRADED (half-open) for one
   * trial call rather than immediately HEALTHY.
   */
  recordFailure(failure: RpcCallFailure, now: number = Date.now()): void {
    const state = this.getState(failure.providerId);
    state.consecutiveFailures += 1;
    state.lastError = failure.error;
    state.lastCheckedAt = new Date(now).toISOString();

    if (failure.rateLimited) {
      state.rateLimitedUntil = new Date(now + 10_000).toISOString();
    }

    if (state.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      state.health = "CIRCUIT_OPEN";
      state.circuitOpenedAt = new Date(now).toISOString();
    } else {
      state.health = "DEGRADED";
    }
  }

  listProvidersForChain(chain: ChainId): RpcProviderState[] {
    return (this.byChain.get(chain) ?? []).map((id) => this.getState(id));
  }
}
