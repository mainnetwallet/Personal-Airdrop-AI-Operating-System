import { describe, it, expect, vi } from "vitest";
import { KernelEventBus } from "../eventBus.js";

describe("kernel event bus", () => {
  it("delivers events to subscribers of that event type", async () => {
    const bus = new KernelEventBus();
    const handler = vi.fn();
    bus.subscribe("run.created", handler);
    await bus.publish({ eventType: "run.created", source: "test", payload: { a: 1 } });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].eventType).toBe("run.created");
  });

  it("wildcard subscribers receive every event type", async () => {
    const bus = new KernelEventBus();
    const handler = vi.fn();
    bus.subscribe("*", handler);
    await bus.publish({ eventType: "a", source: "test" });
    await bus.publish({ eventType: "b", source: "test" });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("assigns a correlationId defaulting to the eventId, and preserves an explicit one", async () => {
    const bus = new KernelEventBus();
    const e1 = await bus.publish({ eventType: "a", source: "test" });
    expect(e1.correlationId).toBe(e1.eventId);

    const e2 = await bus.publish({ eventType: "b", source: "test", correlationId: "corr-1", causationId: e1.eventId });
    expect(e2.correlationId).toBe("corr-1");
    expect(e2.causationId).toBe(e1.eventId);
  });

  it("chain() returns all events sharing a correlationId in publish order", async () => {
    const bus = new KernelEventBus();
    await bus.publish({ eventType: "a", source: "test", correlationId: "run-1" });
    await bus.publish({ eventType: "b", source: "test", correlationId: "run-1" });
    await bus.publish({ eventType: "c", source: "test", correlationId: "run-2" });
    expect(bus.chain("run-1").map((e) => e.eventType)).toEqual(["a", "b"]);
  });

  it("publish is idempotent by eventId: duplicate publish does not re-notify subscribers", async () => {
    const bus = new KernelEventBus();
    const handler = vi.fn();
    bus.subscribe("run.created", handler);
    await bus.publish({ eventId: "fixed-1", eventType: "run.created", source: "test" });
    await bus.publish({ eventId: "fixed-1", eventType: "run.created", source: "test" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.history).toHaveLength(1);
  });

  it("a throwing subscriber does not prevent other subscribers from running", async () => {
    const bus = new KernelEventBus();
    const good = vi.fn();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    bus.subscribe("run.created", () => {
      throw new Error("boom");
    });
    bus.subscribe("run.created", good);
    await bus.publish({ eventType: "run.created", source: "test" });
    expect(good).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });
});
