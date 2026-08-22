/**
 * Phase 11: Notification Intelligence (section 218), Deduplication
 * (219), and Escalation (220).
 *
 * Dedup key is (fingerprint) - a caller-supplied stable string derived
 * from the underlying event (e.g. `deadline:${projectId}:${deadlineIso}`)
 * so the same underlying condition never re-notifies every polling
 * cycle. Escalation only moves INFO -> WARNING -> URGENT -> CRITICAL,
 * and only for an unresolved (unacknowledged) notification - this
 * module never invents an escalation path backwards.
 */
import { randomUUID } from "node:crypto";
import type {
  NotificationDeliveryMode,
  NotificationRecord,
  NotificationSeverity,
} from "@airdrop-os/types";

const SEVERITY_ORDER: readonly NotificationSeverity[] = ["INFO", "WARNING", "URGENT", "CRITICAL"];

export class UnknownNotificationError extends Error {
  constructor(notificationId: string) {
    super(`Unknown notificationId: ${notificationId}`);
    this.name = "UnknownNotificationError";
  }
}

export interface NotifyInput {
  fingerprint: string;
  eventId?: string | null;
  severity: NotificationSeverity;
  title: string;
  body: string;
  deliveryMode?: NotificationDeliveryMode;
}

export class NotificationEngine {
  private readonly byId = new Map<string, NotificationRecord>();
  private readonly byFingerprint = new Map<string, string>();

  /** Returns the existing notification (deduplicated) or creates a new one. */
  notify(input: NotifyInput): NotificationRecord {
    const existingId = this.byFingerprint.get(input.fingerprint);
    if (existingId) {
      const existing = this.byId.get(existingId)!;
      if (!existing.acknowledgedAt) {
        return existing; // section 219: do not spam an unresolved duplicate
      }
    }
    const record: NotificationRecord = {
      notificationId: randomUUID(),
      fingerprint: input.fingerprint,
      eventId: input.eventId ?? null,
      severity: input.severity,
      title: input.title,
      body: input.body,
      deliveryMode: input.deliveryMode ?? "IMMEDIATE",
      createdAt: new Date().toISOString(),
      sentAt: null,
      acknowledgedAt: null,
      escalatedFrom: null,
    };
    this.byId.set(record.notificationId, record);
    this.byFingerprint.set(input.fingerprint, record.notificationId);
    return record;
  }

  get(notificationId: string): NotificationRecord {
    const record = this.byId.get(notificationId);
    if (!record) throw new UnknownNotificationError(notificationId);
    return record;
  }

  markSent(notificationId: string): NotificationRecord {
    const record = this.get(notificationId);
    const updated = { ...record, sentAt: new Date().toISOString() };
    this.byId.set(notificationId, updated);
    return updated;
  }

  acknowledge(notificationId: string): NotificationRecord {
    const record = this.get(notificationId);
    const updated = { ...record, acknowledgedAt: new Date().toISOString() };
    this.byId.set(notificationId, updated);
    return updated;
  }

  /** Section 220: escalate only an unresolved notification, one step up. */
  escalate(notificationId: string): NotificationRecord {
    const record = this.get(notificationId);
    if (record.acknowledgedAt) {
      throw new Error(`Cannot escalate acknowledged notification ${notificationId}`);
    }
    const currentIndex = SEVERITY_ORDER.indexOf(record.severity);
    if (currentIndex === SEVERITY_ORDER.length - 1) {
      return record; // already CRITICAL
    }
    const updated: NotificationRecord = {
      ...record,
      escalatedFrom: record.severity,
      severity: SEVERITY_ORDER[currentIndex + 1],
    };
    this.byId.set(notificationId, updated);
    return updated;
  }

  listUnacknowledged(): NotificationRecord[] {
    return [...this.byId.values()]
      .filter((n) => !n.acknowledgedAt)
      .sort((a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity));
  }
}
