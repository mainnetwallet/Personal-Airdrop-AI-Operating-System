import { describe, it, expect } from "vitest";
import { KernelEventBus } from "../eventBus.js";

describe("KernelEventBus", () => {
  it("assigns increasing sequence numbers in emission order", () => {
    const bus = new KernelEventBus();
    const e1 = bus.emit({ eventType: "a", source: "test" });
    const e2 = bus.emit({ eventType: "b", source: "test" });
    const e3 = bus.emit({ eventType: "c", source: "test" });
    expect(e1.sequence).toBe(1);
    expect(e2.sequence).toBe(2);
    expect(e3.sequence).toBe(3);
  });

  it("generates a correlationId when none is provided, and reuses one when given", () => {
    const bus = new KernelEventBus();
    const auto = bus.emit({ eventType: "a", source: "test" });
    expect(auto.correlationId).toBeTruthy();

    const shared = bus.emit({ eventType: "b", source: "test", correlationId: "run-123" });
    const shared2 = bus.emit({ eventType: "c", source: "test", correlationId: "run-123", causationId: shared.eventId });
    expect(shared.correlationId).toBe("run-123");
    expect(shared2.causationId).toBe(shared.eventId);
    expect(bus.getCorrelated("run-123")).toHaveLength(2);
  });

  it("notifies type-specific listeners only for matching events", () => {
    const bus = new KernelEventBus();
    const seen: string[] = [];
    bus.on("tool.called", (e) => seen.push(e.eventType));
    bus.emit({ eventType: "tool.called", source: "test" });
    bus.emit({ eventType: "run.created", source: "test" });
    expect(seen).toEqual(["tool.called"]);
  });

  it("notifies wildcard listeners for every event", () => {
    const bus = new KernelEventBus();
    const seen: string[] = [];
    bus.onAny((e) => seen.push(e.eventType));
    bus.emit({ eventType: "tool.called", source: "test" });
    bus.emit({ eventType: "run.created", source: "test" });
    expect(seen).toEqual(["tool.called", "run.created"]);
  });

  it("unsubscribe stops future notifications", () => {
    const bus = new KernelEventBus();
    const seen: string[] = [];
    const unsubscribe = bus.on("x", (e) => seen.push(e.eventType));
    bus.emit({ eventType: "x", source: "test" });
    unsubscribe();
    bus.emit({ eventType: "x", source: "test" });
    expect(seen).toHaveLength(1);
  });

  it("preserves full log ordering for later audit reconstruction", () => {
    const bus = new KernelEventBus();
    bus.emit({ eventType: "a", source: "test" });
    bus.emit({ eventType: "b", source: "test" });
    expect(bus.getLog().map((e) => e.eventType)).toEqual(["a", "b"]);
  });
});
