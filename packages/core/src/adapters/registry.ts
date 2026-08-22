/**
 * Airdrop adapter registry. `resolve()` always returns *some* adapter —
 * a real, registered one if it exists, otherwise a NOT_CONFIGURED stub
 * (see notConfiguredAdapter.ts) — so callers never special-case "no
 * adapter" versus "adapter that explicitly reports it isn't built yet."
 */
import type { AirdropAdapter, AirdropType } from "@airdrop-os/types";
import { createNotConfiguredAdapter } from "./notConfiguredAdapter.js";

export class AirdropAdapterRegistry {
  private readonly adapters = new Map<AirdropType, AirdropAdapter>();

  register(adapter: AirdropAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  resolve(type: AirdropType): AirdropAdapter {
    return this.adapters.get(type) ?? createNotConfiguredAdapter(type);
  }

  isConfigured(type: AirdropType): boolean {
    return this.adapters.get(type)?.status === "IMPLEMENTED";
  }

  registeredTypes(): AirdropType[] {
    return [...this.adapters.keys()];
  }
}
