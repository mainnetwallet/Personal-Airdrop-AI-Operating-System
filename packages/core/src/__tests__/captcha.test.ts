import { describe, it, expect } from "vitest";
import { CaptchaHandoff, detectCaptchaType, InvalidCaptchaTransitionError } from "../agent/captcha.js";

describe("detectCaptchaType", () => {
  it("detects reCAPTCHA", () => {
    expect(detectCaptchaType({ hasRecaptchaFrame: true })).toBe("RECAPTCHA");
  });
  it("detects Cloudflare challenge", () => {
    expect(detectCaptchaType({ hasCloudflareChallenge: true })).toBe("CLOUDFLARE_CHALLENGE");
  });
  it("returns null when nothing is detected", () => {
    expect(detectCaptchaType({})).toBeNull();
  });
});

describe("CaptchaHandoff", () => {
  it("walks the full PAUSE -> CHECKPOINT -> USER COMPLETES -> VERIFY -> RESUME sequence", () => {
    const handoff = new CaptchaHandoff({ captchaId: "c1", sessionId: "s1", type: "RECAPTCHA", now: 0 });
    handoff.pause();
    handoff.checkpoint("cp1");
    handoff.awaitUser();
    handoff.userCompleted();
    handoff.verify(true, 5000);
    handoff.resume();
    expect(handoff.current.status).toBe("RESUMED");
    expect(handoff.current.checkpointId).toBe("cp1");
    expect(handoff.current.resolvedAt).toBe(new Date(5000).toISOString());
  });

  it("refuses to verify when the page does not confirm clearance", () => {
    const handoff = new CaptchaHandoff({ captchaId: "c1", sessionId: "s1", type: "HCAPTCHA" });
    handoff.pause();
    handoff.checkpoint("cp1");
    handoff.awaitUser();
    handoff.userCompleted();
    expect(() => handoff.verify(false)).toThrow();
  });

  it("rejects skipping a step in the sequence (e.g. resume before verify)", () => {
    const handoff = new CaptchaHandoff({ captchaId: "c1", sessionId: "s1", type: "TURNSTILE" });
    handoff.pause();
    expect(() => handoff.resume()).toThrow(InvalidCaptchaTransitionError);
  });

  it("allows retrying after a TIMED_OUT back to AWAITING_USER", () => {
    const handoff = new CaptchaHandoff({ captchaId: "c1", sessionId: "s1", type: "HUMAN_VERIFICATION" });
    handoff.pause();
    handoff.checkpoint("cp1");
    handoff.awaitUser();
    handoff.timeOut();
    expect(() => handoff.awaitUser()).not.toThrow();
  });

  it("has no transition out of RESUMED - it is terminal", () => {
    const handoff = new CaptchaHandoff({ captchaId: "c1", sessionId: "s1", type: "RECAPTCHA" });
    handoff.pause();
    handoff.checkpoint("cp1");
    handoff.awaitUser();
    handoff.userCompleted();
    handoff.verify(true);
    handoff.resume();
    expect(() => handoff.pause()).toThrow(InvalidCaptchaTransitionError);
  });
});
