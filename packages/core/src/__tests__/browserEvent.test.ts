import { describe, it, expect } from "vitest";
import { toSafeBrowserEvent, BrowserEventStore } from "../agent/browserEvent.js";

describe("toSafeBrowserEvent", () => {
  it("keeps safe metadata fields intact", () => {
    const event = toSafeBrowserEvent(
      { sessionId: "s1", url: "https://example.xyz/claim", title: "Claim", eventType: "CLICK", action: "click-claim-button", elementMetadata: { buttonText: "Claim", disabled: false } },
      "e1",
      0
    );
    expect(event.elementMetadata).toEqual({ buttonText: "Claim", disabled: false });
    expect(event.sensitivity).toBe("SAFE");
    expect(event.redactedFields).toEqual([]);
  });

  it("redacts fields whose name looks like a password", () => {
    const event = toSafeBrowserEvent(
      { sessionId: "s1", url: "https://example.xyz/login", title: null, eventType: "INPUT", action: "type", elementMetadata: { password: "hunter2", username: "alice" } },
      "e1"
    );
    expect(event.elementMetadata).toEqual({ username: "alice" });
    expect(event.redactedFields).toContain("password");
    expect(event.sensitivity).toBe("REDACTED");
  });

  it("redacts seed phrase, private key, OTP, 2FA, and session token field names", () => {
    const event = toSafeBrowserEvent(
      {
        sessionId: "s1",
        url: "https://example.xyz",
        title: null,
        eventType: "INPUT",
        action: "type",
        elementMetadata: {
          seedPhrase: "x",
          private_key: "y",
          otp: "z",
          two_factor_code: "w",
          sessionToken: "v",
          safeField: "kept",
        },
      },
      "e1"
    );
    expect(event.elementMetadata).toEqual({ safeField: "kept" });
    expect(event.redactedFields.sort()).toEqual(["otp", "private_key", "seedPhrase", "sessionToken", "two_factor_code"].sort());
  });

  it("drops non-primitive metadata values rather than serializing them blindly", () => {
    const event = toSafeBrowserEvent(
      { sessionId: "s1", url: "https://example.xyz", title: null, eventType: "OBSERVATION", action: null, elementMetadata: { nested: { a: 1 } as any } },
      "e1"
    );
    expect(event.elementMetadata).toEqual({});
    expect(event.redactedFields).toContain("nested");
  });

  it("defaults confidence to LIKELY when not supplied", () => {
    const event = toSafeBrowserEvent({ sessionId: "s1", url: "https://x", title: null, eventType: "NAVIGATION", action: null, elementMetadata: null }, "e1");
    expect(event.confidence).toBe("LIKELY");
  });
});

describe("BrowserEventStore", () => {
  it("records events and filters by session", () => {
    const store = new BrowserEventStore();
    store.record({ sessionId: "s1", url: "https://x", title: null, eventType: "NAVIGATION", action: null, elementMetadata: null }, "e1");
    store.record({ sessionId: "s2", url: "https://y", title: null, eventType: "NAVIGATION", action: null, elementMetadata: null }, "e2");
    expect(store.bySession("s1")).toHaveLength(1);
    expect(store.all()).toHaveLength(2);
  });
});
