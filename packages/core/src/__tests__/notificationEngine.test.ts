import { describe, expect, it } from "vitest";
import { NotificationEngine, UnknownNotificationError } from "../notificationEngine.js";

describe("NotificationEngine", () => {
  it("creates a new notification", () => {
    const engine = new NotificationEngine();
    const n = engine.notify({ fingerprint: "deadline:proj1:2026-09-01", severity: "WARNING", title: "Deadline soon", body: "..." });
    expect(n.severity).toBe("WARNING");
    expect(n.acknowledgedAt).toBeNull();
  });

  it("deduplicates by fingerprint while unacknowledged", () => {
    const engine = new NotificationEngine();
    const first = engine.notify({ fingerprint: "fp-1", severity: "INFO", title: "A", body: "..." });
    const second = engine.notify({ fingerprint: "fp-1", severity: "INFO", title: "A again", body: "..." });
    expect(second.notificationId).toBe(first.notificationId);
  });

  it("creates a fresh notification for the same fingerprint after acknowledgement", () => {
    const engine = new NotificationEngine();
    const first = engine.notify({ fingerprint: "fp-2", severity: "INFO", title: "A", body: "..." });
    engine.acknowledge(first.notificationId);
    const second = engine.notify({ fingerprint: "fp-2", severity: "INFO", title: "A", body: "..." });
    expect(second.notificationId).not.toBe(first.notificationId);
  });

  it("throws for unknown notificationId", () => {
    const engine = new NotificationEngine();
    expect(() => engine.get("nope")).toThrow(UnknownNotificationError);
  });

  it("escalates severity by one step for unresolved notifications", () => {
    const engine = new NotificationEngine();
    const n = engine.notify({ fingerprint: "fp-3", severity: "WARNING", title: "A", body: "..." });
    const escalated = engine.escalate(n.notificationId);
    expect(escalated.severity).toBe("URGENT");
    expect(escalated.escalatedFrom).toBe("WARNING");
  });

  it("does not escalate past CRITICAL", () => {
    const engine = new NotificationEngine();
    const n = engine.notify({ fingerprint: "fp-4", severity: "CRITICAL", title: "A", body: "..." });
    const escalated = engine.escalate(n.notificationId);
    expect(escalated.severity).toBe("CRITICAL");
  });

  it("refuses to escalate an acknowledged notification", () => {
    const engine = new NotificationEngine();
    const n = engine.notify({ fingerprint: "fp-5", severity: "INFO", title: "A", body: "..." });
    engine.acknowledge(n.notificationId);
    expect(() => engine.escalate(n.notificationId)).toThrow(/acknowledged/);
  });

  it("lists unacknowledged notifications sorted by severity descending", () => {
    const engine = new NotificationEngine();
    engine.notify({ fingerprint: "a", severity: "INFO", title: "A", body: "..." });
    engine.notify({ fingerprint: "b", severity: "CRITICAL", title: "B", body: "..." });
    const list = engine.listUnacknowledged();
    expect(list[0].severity).toBe("CRITICAL");
  });
});
