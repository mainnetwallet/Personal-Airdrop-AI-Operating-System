import { describe, expect, it } from "vitest";
import { buildObservationMessage, attachObservers, NotConfiguredError } from "../content.js";
import { parseExtensionMessage } from "../messages.js";

describe("buildObservationMessage", () => {
  it("builds a message that passes the shared schema validation", () => {
    const message = buildObservationMessage({
      sessionId: "sess-1",
      url: "https://example.com/claim",
      title: "Claim page",
      eventType: "CLICK",
      action: "click-claim-button",
      elementMetadata: { role: "button" },
    });
    expect(parseExtensionMessage(message)).not.toBeNull();
    expect(message.type).toBe("OBSERVATION");
  });
});

describe("attachObservers", () => {
  it("throws NotConfiguredError in this sandbox (no DOM/chrome runtime)", () => {
    expect(() => attachObservers("sess-1")).toThrow(NotConfiguredError);
  });
});
