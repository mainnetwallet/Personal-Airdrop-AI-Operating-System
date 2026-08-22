import { describe, expect, it } from "vitest";
import { parseExtensionMessage } from "../messages.js";

describe("parseExtensionMessage", () => {
  it("accepts a well-formed OBSERVATION message", () => {
    const msg = parseExtensionMessage({
      type: "OBSERVATION",
      sessionId: "sess-1",
      url: "https://example.com/claim",
      title: "Claim page",
      eventType: "CLICK",
      action: "click-claim-button",
      elementMetadata: { role: "button" },
    });
    expect(msg).not.toBeNull();
    expect(msg?.type).toBe("OBSERVATION");
  });

  it("accepts a well-formed TEACH_CONTROL message", () => {
    const msg = parseExtensionMessage({
      type: "TEACH_CONTROL",
      sessionId: "sess-1",
      command: "START",
    });
    expect(msg).not.toBeNull();
    expect(msg?.type).toBe("TEACH_CONTROL");
  });

  it("rejects a message with an unknown type (fail-closed)", () => {
    const msg = parseExtensionMessage({ type: "SOMETHING_ELSE", sessionId: "sess-1" });
    expect(msg).toBeNull();
  });

  it("rejects an OBSERVATION with an invalid URL", () => {
    const msg = parseExtensionMessage({
      type: "OBSERVATION",
      sessionId: "sess-1",
      url: "not-a-url",
      title: null,
      eventType: "CLICK",
      action: null,
      elementMetadata: null,
    });
    expect(msg).toBeNull();
  });

  it("rejects an OBSERVATION with an invalid eventType", () => {
    const msg = parseExtensionMessage({
      type: "OBSERVATION",
      sessionId: "sess-1",
      url: "https://example.com",
      title: null,
      eventType: "WALLET_INTERACTION",
      action: null,
      elementMetadata: null,
    });
    expect(msg).toBeNull();
  });

  it("rejects a TEACH_CONTROL with an invalid command", () => {
    const msg = parseExtensionMessage({
      type: "TEACH_CONTROL",
      sessionId: "sess-1",
      command: "PAUSE",
    });
    expect(msg).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(parseExtensionMessage(null)).toBeNull();
    expect(parseExtensionMessage("hello")).toBeNull();
    expect(parseExtensionMessage(42)).toBeNull();
  });
});
