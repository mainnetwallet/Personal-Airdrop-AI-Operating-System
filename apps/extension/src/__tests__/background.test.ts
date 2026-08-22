import { describe, expect, it } from "vitest";
import { ExtensionBackground } from "../background.js";

let counter = 0;
const nextId = () => `evt-${++counter}`;

describe("ExtensionBackground.handleMessage", () => {
  it("rejects malformed input without recording anything", () => {
    const bg = new ExtensionBackground();
    const result = bg.handleMessage({ type: "NOT_A_REAL_TYPE" }, nextId);
    expect(result).toBe("REJECTED_MALFORMED");
    expect(bg.events.all()).toHaveLength(0);
  });

  it("records a safe OBSERVATION message", () => {
    const bg = new ExtensionBackground();
    const result = bg.handleMessage(
      {
        type: "OBSERVATION",
        sessionId: "sess-1",
        url: "https://example.com/claim",
        title: "Claim",
        eventType: "CLICK",
        action: "click-claim",
        elementMetadata: { role: "button" },
      },
      nextId,
    );
    expect(result).toBe("RECORDED_SAFE");
    expect(bg.events.bySession("sess-1")).toHaveLength(1);
  });

  it("redacts sensitive-looking metadata fields via core's shared redaction rules", () => {
    const bg = new ExtensionBackground();
    const result = bg.handleMessage(
      {
        type: "OBSERVATION",
        sessionId: "sess-1",
        url: "https://example.com/import",
        title: "Import wallet",
        eventType: "INPUT",
        action: "type-seed-phrase",
        elementMetadata: { seed_phrase: "should never be stored", role: "textbox" },
      },
      nextId,
    );
    expect(result).toBe("RECORDED_REDACTED");
    const [event] = bg.events.bySession("sess-1");
    expect(event.redactedFields).toContain("seed_phrase");
    expect(event.elementMetadata).not.toHaveProperty("seed_phrase");
  });

  it("feeds recorded events into an active teach session", () => {
    const bg = new ExtensionBackground();
    bg.handleMessage({ type: "TEACH_CONTROL", sessionId: "sess-1", command: "START" }, nextId);
    bg.handleMessage(
      {
        type: "OBSERVATION",
        sessionId: "sess-1",
        url: "https://example.com",
        title: null,
        eventType: "CLICK",
        action: "click-a",
        elementMetadata: null,
      },
      nextId,
    );
    const stopResult = bg.handleMessage({ type: "TEACH_CONTROL", sessionId: "sess-1", command: "STOP" }, nextId);
    expect(stopResult).toBe("TEACH_STOP");
  });

  it("reports TEACH_NOT_ACTIVE for control commands on an unknown session", () => {
    const bg = new ExtensionBackground();
    const result = bg.handleMessage({ type: "TEACH_CONTROL", sessionId: "ghost", command: "SAVE" }, nextId);
    expect(result).toBe("TEACH_NOT_ACTIVE");
  });
});
