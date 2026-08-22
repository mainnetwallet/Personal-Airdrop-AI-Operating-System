import type { EmergencyStopScope, EmergencyStopState } from "@airdrop-os/types";

/**
 * Phase 7: Emergency stop.
 *
 * When active, every sensitive operation (sign/submit/approve/delegate)
 * must be refused by the firewall regardless of what the risk/policy
 * steps decided - this is a hard override, not a risk factor that can be
 * outweighed. Read-only investigation (viewing state, running the
 * read-only parts of the pipeline for review) is always still allowed.
 */
export class EmergencyStopController {
  private state: EmergencyStopState = {
    active: false,
    scope: null,
    targetId: null,
    reason: null,
    activatedAt: null,
    deactivatedAt: null,
    readOnlyInvestigationAllowed: true,
  };

  activate(scope: EmergencyStopScope, targetId: string | null, reason: string): EmergencyStopState {
    this.state = {
      active: true,
      scope,
      targetId,
      reason,
      activatedAt: new Date().toISOString(),
      deactivatedAt: null,
      readOnlyInvestigationAllowed: true,
    };
    return this.state;
  }

  deactivate(): EmergencyStopState {
    this.state = { ...this.state, active: false, deactivatedAt: new Date().toISOString() };
    return this.state;
  }

  get(): EmergencyStopState {
    return this.state;
  }

  /** Whether a sensitive (signing/submitting/approving/delegating) op is blocked for this target. */
  blocksSensitiveOp(scope: EmergencyStopScope, targetId: string | null): boolean {
    if (!this.state.active) return false;
    if (this.state.scope === "ALL_SENSITIVE_OPERATIONS") return true;
    return this.state.scope === scope && this.state.targetId === targetId;
  }
}
