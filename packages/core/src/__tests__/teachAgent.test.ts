import { describe, it, expect } from "vitest";
import { TeachAgentSession } from "../agent/teachAgent.js";
import { toSafeBrowserEvent } from "../agent/browserEvent.js";

describe("TeachAgentSession", () => {
  it("derives a step per observed event, chained by dependsOn", () => {
    const session = new TeachAgentSession("s1");
    session.observe(toSafeBrowserEvent({ sessionId: "s1", url: "https://x/connect", title: null, eventType: "CLICK", action: "click-connect", elementMetadata: null }, "e1", 0));
    session.observe(toSafeBrowserEvent({ sessionId: "s1", url: "https://x/claim", title: null, eventType: "CLICK", action: "click-claim", elementMetadata: null }, "e2", 5000));

    const draft = session.deriveDraft("draft1", "Claim points");
    expect(draft.steps).toHaveLength(2);
    expect(draft.steps[1].dependsOn).toEqual(["observed-0"]);
    expect(draft.estimatedTimeMs).toBe(5000);
    expect(draft.decision).toBeNull();
  });

  it("rejects observing an event from a different session", () => {
    const session = new TeachAgentSession("s1");
    const foreignEvent = toSafeBrowserEvent({ sessionId: "s2", url: "https://x", title: null, eventType: "CLICK", action: null, elementMetadata: null }, "e1");
    expect(() => session.observe(foreignEvent)).toThrow();
  });

  it("flags manual intervention points for redacted (sensitive) observed fields", () => {
    const session = new TeachAgentSession("s1");
    session.observe(toSafeBrowserEvent({ sessionId: "s1", url: "https://x/login", title: null, eventType: "INPUT", action: "type-password", elementMetadata: { password: "secret" } }, "e1"));
    const draft = session.deriveDraft("draft1", "Log in");
    expect(draft.manualInterventionPoints).toHaveLength(1);
  });

  it("gives LIKELY confidence only with enough clean observations, and low confidence otherwise", () => {
    const session = new TeachAgentSession("s1");
    const draftEmpty = session.deriveDraft("d0", "goal");
    expect(draftEmpty.confidence).toBe("SPECULATIVE");

    const richSession = new TeachAgentSession("s2");
    for (let i = 0; i < 3; i++) {
      richSession.observe(toSafeBrowserEvent({ sessionId: "s2", url: `https://x/${i}`, title: null, eventType: "CLICK", action: `step-${i}`, elementMetadata: null }, `e${i}`));
    }
    expect(richSession.deriveDraft("d1", "goal").confidence).toBe("LIKELY");
  });

  it("applies a user decision without mutating the original draft", () => {
    const session = new TeachAgentSession("s1");
    const draft = session.deriveDraft("draft1", "goal");
    const decided = TeachAgentSession.applyDecision(draft, "SAVE");
    expect(decided.decision).toBe("SAVE");
    expect(draft.decision).toBeNull();
  });
});
