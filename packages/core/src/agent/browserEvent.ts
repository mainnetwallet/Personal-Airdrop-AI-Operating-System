import type { BrowserEvent, ClaimConfidence } from "@airdrop-os/types";

// Field-name patterns that must never have their VALUE stored, whether
// they come from the PC agent's DOM observation or the extension's page
// context. This list intentionally matches the security baseline named
// across every phase of this project.
const SENSITIVE_FIELD_PATTERN =
  /pass(word)?|seed( ?phrase)?|mnemonic|private[_ ]?key|secret[_ ]?key|otp|2fa|two[_ ]?factor|recovery[_ ]?code|card[_ ]?number|cvv|payment|session[_ ]?token|auth[_ ]?token|api[_ ]?key/i;

export interface RawBrowserObservation {
  sessionId: string;
  url: string;
  title: string | null;
  eventType: BrowserEvent["eventType"];
  action: string | null;
  elementMetadata: Record<string, unknown> | null;
  projectId?: string | null;
  campaignId?: string | null;
  missionId?: string | null;
  taskId?: string | null;
  wallet?: string | null;
  account?: string | null;
  chain?: string | null;
  confidence?: ClaimConfidence;
}

/**
 * Converts a raw browser observation into a safe BrowserEvent: any
 * element-metadata field whose NAME looks sensitive has its value
 * stripped and is listed in redactedFields, rather than being persisted.
 * This function never inspects field VALUES to decide what's sensitive
 * (a value could legitimately look like anything) - only field names,
 * which is a fail-closed strategy: when in doubt about a field name, it
 * gets redacted.
 */
export function toSafeBrowserEvent(raw: RawBrowserObservation, eventId: string, now: number = Date.now()): BrowserEvent {
  const redactedFields: string[] = [];
  let safeMetadata: BrowserEvent["elementMetadata"] = null;

  if (raw.elementMetadata) {
    const cleaned: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(raw.elementMetadata)) {
      if (SENSITIVE_FIELD_PATTERN.test(key)) {
        redactedFields.push(key);
        continue;
      }
      if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        cleaned[key] = value;
      } else {
        // Non-primitive values are dropped rather than serialized blindly.
        redactedFields.push(key);
      }
    }
    safeMetadata = cleaned;
  }

  return {
    eventId,
    sessionId: raw.sessionId,
    timestamp: new Date(now).toISOString(),
    url: raw.url,
    title: raw.title,
    eventType: raw.eventType,
    elementMetadata: safeMetadata,
    action: raw.action,
    projectId: raw.projectId ?? null,
    campaignId: raw.campaignId ?? null,
    missionId: raw.missionId ?? null,
    taskId: raw.taskId ?? null,
    wallet: raw.wallet ?? null,
    account: raw.account ?? null,
    chain: raw.chain ?? null,
    sensitivity: redactedFields.length > 0 ? "REDACTED" : "SAFE",
    confidence: raw.confidence ?? "LIKELY",
    redactedFields,
  };
}

/** Append-only store of safe browser events, scoped for later attribution
 * (task/mission/campaign/project) and audit. */
export class BrowserEventStore {
  private readonly events: BrowserEvent[] = [];

  record(raw: RawBrowserObservation, eventId: string, now?: number): BrowserEvent {
    const event = toSafeBrowserEvent(raw, eventId, now);
    this.events.push(event);
    return event;
  }

  bySession(sessionId: string): BrowserEvent[] {
    return this.events.filter((e) => e.sessionId === sessionId);
  }

  all(): readonly BrowserEvent[] {
    return this.events;
  }
}
