import type { CaptchaEvent, CaptchaType, CaptchaStatus } from "@airdrop-os/types";

const VALID_TRANSITIONS: Record<CaptchaStatus, CaptchaStatus[]> = {
  NONE: ["DETECTED"],
  DETECTED: ["PAUSED"],
  PAUSED: ["CHECKPOINTED"],
  CHECKPOINTED: ["AWAITING_USER"],
  AWAITING_USER: ["USER_COMPLETED", "TIMED_OUT"],
  USER_COMPLETED: ["VERIFIED"],
  VERIFIED: ["RESUMED"],
  RESUMED: [],
  TIMED_OUT: ["AWAITING_USER"], // user can still complete after a timeout retry
};

export class InvalidCaptchaTransitionError extends Error {
  constructor(from: CaptchaStatus, to: CaptchaStatus) {
    super(`Invalid CAPTCHA transition: ${from} -> ${to}`);
    this.name = "InvalidCaptchaTransitionError";
  }
}

/** Heuristic, name-only detector for common human-verification challenges.
 * This NEVER attempts to solve or bypass anything it detects - detection
 * exists solely to trigger the pause/handoff flow. */
export function detectCaptchaType(pageSignal: { hasRecaptchaFrame?: boolean; hasHcaptchaFrame?: boolean; hasTurnstileWidget?: boolean; hasCloudflareChallenge?: boolean; hasGenericHumanCheck?: boolean }): CaptchaType | null {
  if (pageSignal.hasRecaptchaFrame) return "RECAPTCHA";
  if (pageSignal.hasHcaptchaFrame) return "HCAPTCHA";
  if (pageSignal.hasTurnstileWidget) return "TURNSTILE";
  if (pageSignal.hasCloudflareChallenge) return "CLOUDFLARE_CHALLENGE";
  if (pageSignal.hasGenericHumanCheck) return "HUMAN_VERIFICATION";
  return null;
}

/**
 * Drives a single CAPTCHA event through the mandatory
 * PAUSE -> CHECKPOINT -> USER COMPLETES -> VERIFY -> RESUME sequence.
 * There is no transition, in this state machine or anywhere else in this
 * module, that represents solving or bypassing a challenge - the only
 * path forward is a human completing it.
 */
export class CaptchaHandoff {
  private event: CaptchaEvent;

  constructor(params: { captchaId: string; sessionId: string; type: CaptchaType; now?: number }) {
    const now = params.now ?? Date.now();
    this.event = {
      captchaId: params.captchaId,
      sessionId: params.sessionId,
      type: params.type,
      status: "DETECTED",
      detectedAt: new Date(now).toISOString(),
      checkpointId: null,
      resolvedAt: null,
    };
  }

  get current(): CaptchaEvent {
    return this.event;
  }

  private transition(to: CaptchaStatus): void {
    const allowed = VALID_TRANSITIONS[this.event.status];
    if (!allowed.includes(to)) throw new InvalidCaptchaTransitionError(this.event.status, to);
    this.event.status = to;
  }

  pause(): CaptchaEvent {
    this.transition("PAUSED");
    return this.event;
  }

  checkpoint(checkpointId: string): CaptchaEvent {
    this.transition("CHECKPOINTED");
    this.event.checkpointId = checkpointId;
    return this.event;
  }

  awaitUser(): CaptchaEvent {
    this.transition("AWAITING_USER");
    return this.event;
  }

  timeOut(): CaptchaEvent {
    this.transition("TIMED_OUT");
    return this.event;
  }

  userCompleted(): CaptchaEvent {
    this.transition("USER_COMPLETED");
    return this.event;
  }

  /** Verification here means "the page state agrees the challenge is
   * cleared" (caller supplies that fact from a real page check) - this
   * module never claims verification on its own authority. */
  verify(pageConfirmsCleared: boolean, now: number = Date.now()): CaptchaEvent {
    if (!pageConfirmsCleared) {
      throw new Error("Cannot verify: page does not confirm the challenge is cleared");
    }
    this.transition("VERIFIED");
    this.event.resolvedAt = new Date(now).toISOString();
    return this.event;
  }

  resume(): CaptchaEvent {
    this.transition("RESUMED");
    return this.event;
  }
}
