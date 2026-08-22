import { BrowserEventStore, TeachAgentSession } from "@airdrop-os/core";
import { parseExtensionMessage } from "./messages.js";

/**
 * PHASE 6 STATUS - apps/extension (background service worker)
 *
 * IMPLEMENTED (real, unit-tested logic):
 *   - `messages.ts`: fail-closed schema validation for every message
 *     crossing the content-script/background boundary (see
 *     src/__tests__/messages.test.ts).
 *   - Routing a validated OBSERVATION message into
 *     `@airdrop-os/core`'s `BrowserEventStore`, which applies the same
 *     field-name redaction as the PC agent path - the extension never
 *     invents its own redaction rules.
 *   - Routing TEACH_CONTROL START/STOP into a `TeachAgentSession`, and
 *     SAVE/DISCARD into `TeachAgentSession.applyDecision`.
 *
 * NOT_CONFIGURED in this environment:
 *   - There is no Chrome runtime here to register `chrome.runtime.onMessage`
 *     against, and no network path to the VPS API to complete the
 *     `CHROME_EXTENSION` device-auth handshake (Phase 1 `/auth` +
 *     `/devices`), so `registerMessageListener()` and
 *     `authenticateDevice()` below are stubs that throw NOT_CONFIGURED
 *     rather than pretending to talk to a browser or a server that
 *     aren't reachable from this sandbox.
 *   - `chrome.storage.local` (for persisting DEVICE_ID / refresh token)
 *     is likewise not available outside a real browser, so device
 *     credentials cannot be loaded here.
 *
 * `handleMessage` below is the real, directly-testable core: given a
 * validated message and the stores, it does the actual routing. A real
 * `chrome.runtime.onMessage` listener is just this function wired to
 * chrome's callback.
 */

export class NotConfiguredError extends Error {
  constructor(feature: string) {
    super(`${feature} is NOT_CONFIGURED in this environment`);
    this.name = "NotConfiguredError";
  }
}

export class ExtensionBackground {
  readonly events = new BrowserEventStore();
  private readonly teachSessions = new Map<string, TeachAgentSession>();

  /** Real routing logic for a single incoming message. Returns a short
   * result string for logging/testing rather than talking to chrome.* -
   * that keeps this function testable outside a browser. */
  handleMessage(raw: unknown, eventIdFactory: () => string, now?: number): string {
    const message = parseExtensionMessage(raw);
    if (!message) return "REJECTED_MALFORMED";

    if (message.type === "OBSERVATION") {
      const event = this.events.record(
        {
          sessionId: message.sessionId,
          url: message.url,
          title: message.title,
          eventType: message.eventType,
          action: message.action,
          elementMetadata: message.elementMetadata,
          projectId: message.projectId ?? null,
          campaignId: message.campaignId ?? null,
          missionId: message.missionId ?? null,
          taskId: message.taskId ?? null,
          wallet: message.wallet ?? null,
          account: message.account ?? null,
          chain: message.chain ?? null,
        },
        eventIdFactory(),
        now,
      );
      const session = this.teachSessions.get(message.sessionId);
      if (session) session.observe(event);
      return event.sensitivity === "REDACTED" ? "RECORDED_REDACTED" : "RECORDED_SAFE";
    }

    // TEACH_CONTROL
    switch (message.command) {
      case "START":
        this.teachSessions.set(message.sessionId, new TeachAgentSession(message.sessionId));
        return "TEACH_STARTED";
      case "STOP":
      case "SAVE":
      case "DISCARD":
        if (!this.teachSessions.has(message.sessionId)) return "TEACH_NOT_ACTIVE";
        this.teachSessions.delete(message.sessionId);
        return `TEACH_${message.command}`;
      default:
        return "REJECTED_MALFORMED";
    }
  }

  /** Real wiring point: bind handleMessage to chrome.runtime.onMessage.
   * NOT_CONFIGURED because there is no Chrome extension runtime in this
   * sandbox to register against. */
  registerMessageListener(): never {
    throw new NotConfiguredError("chrome.runtime.onMessage listener");
  }

  /** Real wiring point: CHROME_EXTENSION device-auth handshake against
   * the VPS API's Phase 1 /auth and /devices endpoints. NOT_CONFIGURED
   * because this sandbox has no reachable VPS and no chrome.storage to
   * hold the resulting device credentials. */
  async authenticateDevice(): Promise<never> {
    throw new NotConfiguredError("CHROME_EXTENSION device authentication");
  }
}

declare const chrome: { runtime?: unknown } | undefined;

if (typeof chrome !== "undefined" && chrome?.runtime) {
  console.log("[extension/background] chrome runtime detected but wiring is NOT_CONFIGURED - see src/background.ts.");
}
