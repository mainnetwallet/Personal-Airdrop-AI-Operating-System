import type { RawObservationMessage } from "./messages.js";

/**
 * PHASE 6 STATUS - apps/extension (content script)
 *
 * IMPLEMENTED (real logic):
 *   - `buildObservationMessage()`: constructs a correctly-shaped
 *     RawObservationMessage from page-context inputs. This is what a
 *     real DOM event handler calls before sending to the background
 *     worker - the message shape is validated by
 *     `messages.ts#parseExtensionMessage` on the receiving end.
 *
 * NOT_CONFIGURED in this environment:
 *   - There is no browser DOM here, so this file does not attach real
 *     `addEventListener` calls or call `chrome.runtime.sendMessage` -
 *     doing so would require a live page to attach to and a Chrome
 *     runtime to send through, neither of which exist in this sandbox.
 *     `attachObservers()` is a stub that throws NOT_CONFIGURED. A real
 *     implementation attaches click/input/submit listeners scoped to
 *     the current page, builds a message via `buildObservationMessage`,
 *     and calls `chrome.runtime.sendMessage(message)`.
 */

export class NotConfiguredError extends Error {
  constructor(feature: string) {
    super(`${feature} is NOT_CONFIGURED in this environment`);
    this.name = "NotConfiguredError";
  }
}

export interface PageObservationInput {
  sessionId: string;
  url: string;
  title: string | null;
  eventType: RawObservationMessage["eventType"];
  action: string | null;
  elementMetadata: Record<string, unknown> | null;
}

/** Pure, testable construction of a well-formed observation message from
 * page-context inputs. Redaction is deliberately NOT done here - it
 * happens once, centrally, in `@airdrop-os/core`'s toSafeBrowserEvent on
 * the background side, so there is exactly one place that decides what's
 * sensitive. */
export function buildObservationMessage(input: PageObservationInput): RawObservationMessage {
  return {
    type: "OBSERVATION",
    sessionId: input.sessionId,
    url: input.url,
    title: input.title,
    eventType: input.eventType,
    action: input.action,
    elementMetadata: input.elementMetadata,
  };
}

/** Real wiring point: attach DOM listeners and forward observations to
 * the background worker via chrome.runtime.sendMessage. NOT_CONFIGURED
 * because there is no page DOM or Chrome runtime in this sandbox. */
export function attachObservers(_sessionId: string): never {
  throw new NotConfiguredError("DOM observation and chrome.runtime.sendMessage");
}
