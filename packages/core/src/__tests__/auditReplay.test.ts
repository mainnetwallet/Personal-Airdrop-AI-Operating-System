import { describe, expect, it } from "vitest";
import { KernelEventBus } from "../eventBus.js";
import { replay, replayYesterday } from "../auditReplay.js";

describe("auditReplay", () => {
  it("returns only events within the given range", () => {
    const bus = new KernelEventBus();
    bus.emit({ eventType: "TASK_COMPLETED", source: "test", payload: { taskId: "t1" } });

    const result = replay(bus, {
      start: "2000-01-01T00:00:00.000Z",
      end: "2000-01-02T00:00:00.000Z",
    });
    expect(result.totalEvents).toBe(0);
  });

  it("includes events within range and categorizes them", () => {
    const bus = new KernelEventBus();
    bus.emit({ eventType: "TASK_COMPLETED", source: "test", payload: { taskId: "t1" } });
    bus.emit({ eventType: "CAMPAIGN_UPDATED", source: "test", payload: { campaignId: "c1" } });

    const now = new Date();
    const result = replay(bus, {
      start: new Date(now.getTime() - 60_000).toISOString(),
      end: new Date(now.getTime() + 60_000).toISOString(),
    });
    expect(result.totalEvents).toBe(2);
    expect(result.byCategory["Task"]).toBe(1);
    expect(result.byCategory["Campaign update"]).toBe(1);
  });

  it("falls back to Other for unrecognized event types instead of dropping them", () => {
    const bus = new KernelEventBus();
    bus.emit({ eventType: "SOMETHING_WEIRD", source: "test" });
    const now = new Date();
    const result = replay(bus, {
      start: new Date(now.getTime() - 60_000).toISOString(),
      end: new Date(now.getTime() + 60_000).toISOString(),
    });
    expect(result.totalEvents).toBe(1);
    expect(result.byCategory["Other"]).toBe(1);
  });

  it("filters by eventTypes when provided", () => {
    const bus = new KernelEventBus();
    bus.emit({ eventType: "TASK_COMPLETED", source: "test" });
    bus.emit({ eventType: "TASK_FAILED", source: "test" });
    const now = new Date();
    const result = replay(bus, {
      start: new Date(now.getTime() - 60_000).toISOString(),
      end: new Date(now.getTime() + 60_000).toISOString(),
      eventTypes: ["TASK_FAILED"],
    });
    expect(result.totalEvents).toBe(1);
    expect(result.entries[0]?.eventType).toBe("TASK_FAILED");
  });

  it("produces a summary string including payload fields", () => {
    const bus = new KernelEventBus();
    bus.emit({ eventType: "ELIGIBILITY_UPDATED", source: "test", payload: { walletId: "w1", state: "LIKELY" } });
    const now = new Date();
    const result = replay(bus, {
      start: new Date(now.getTime() - 60_000).toISOString(),
      end: new Date(now.getTime() + 60_000).toISOString(),
    });
    expect(result.entries[0]?.summary).toContain("ELIGIBILITY_UPDATED");
    expect(result.entries[0]?.summary).toContain("walletId=w1");
  });

  it("replayYesterday scopes to the previous full UTC calendar day", () => {
    const bus = new KernelEventBus();
    // Fabricate a bus with getLog() overridden isn't available; instead verify
    // range boundaries via a fixed `now` and check no live events leak in.
    const now = new Date("2026-08-22T12:00:00.000Z");
    const result = replayYesterday(bus, now);
    expect(result.rangeStart).toBe("2026-08-21T00:00:00.000Z");
    expect(result.rangeEnd).toBe(new Date(Date.UTC(2026, 7, 21, 23, 59, 59, 999)).toISOString());
    expect(result.totalEvents).toBe(0);
  });
});
