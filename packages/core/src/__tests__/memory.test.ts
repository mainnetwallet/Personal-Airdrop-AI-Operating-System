import { describe, it, expect } from "vitest";
import { MemoryStore } from "../memory.js";

describe("MemoryStore", () => {
  it("writes an entry with NEW lifecycle and empty correction history", () => {
    const store = new MemoryStore();
    const entry = store.write({
      agentId: "agent-1",
      type: "PROJECT_FACT",
      content: { note: "TGE expected Q3" },
      source: "official-blog",
      confidence: 0.8,
    });
    expect(entry.lifecycle).toBe("NEW");
    expect(entry.correctionHistory).toEqual([]);
    expect(store.get(entry.memoryId)).toEqual(entry);
  });

  it("rejects out-of-range confidence", () => {
    const store = new MemoryStore();
    expect(() =>
      store.write({ agentId: "a", type: "RESEARCH_FACT", content: {}, source: "x", confidence: 1.5 })
    ).toThrow(RangeError);
    expect(() =>
      store.write({ agentId: "a", type: "RESEARCH_FACT", content: {}, source: "x", confidence: -0.1 })
    ).toThrow(RangeError);
  });

  it("redacts secrets from content on write", () => {
    const store = new MemoryStore();
    const entry = store.write({
      agentId: "agent-1",
      type: "PROJECT_FACT",
      content: { password: "hunter2", note: "ok" },
      source: "test",
      confidence: 0.5,
    });
    expect((entry.content as any).password).toBe("[REDACTED]");
    expect((entry.content as any).note).toBe("ok");
  });

  it("advances lifecycle without losing content", () => {
    const store = new MemoryStore();
    const entry = store.write({ agentId: "a", type: "DECISION", content: { x: 1 }, source: "s", confidence: 0.9 });
    const confirmed = store.setLifecycle(entry.memoryId, "CONFIRMED");
    expect(confirmed.lifecycle).toBe("CONFIRMED");
    expect(confirmed.content).toEqual({ x: 1 });
  });

  it("correct() appends prior content to correctionHistory instead of discarding it", () => {
    const store = new MemoryStore();
    const entry = store.write({
      agentId: "a",
      type: "PROJECT_FACT",
      content: { deadline: "2026-01-01" },
      source: "s",
      confidence: 0.6,
    });
    const corrected = store.correct(entry.memoryId, { deadline: "2026-02-01" }, "official update");
    expect(corrected.lifecycle).toBe("CORRECTED");
    expect(corrected.content).toEqual({ deadline: "2026-02-01" });
    expect(corrected.correctionHistory).toHaveLength(1);
    expect(corrected.correctionHistory[0].previousContent).toEqual({ deadline: "2026-01-01" });
    expect(corrected.correctionHistory[0].reason).toBe("official update");

    // A second correction appends, does not overwrite the first record.
    const corrected2 = store.correct(entry.memoryId, { deadline: "2026-03-01" });
    expect(corrected2.correctionHistory).toHaveLength(2);
  });

  it("redacts secrets on correction too", () => {
    const store = new MemoryStore();
    const entry = store.write({ agentId: "a", type: "DECISION", content: { note: "ok" }, source: "s", confidence: 0.5 });
    const corrected = store.correct(entry.memoryId, { apiKey: "abc123" });
    expect((corrected.content as any).apiKey).toBe("[REDACTED]");
  });

  it("throws on unknown memoryId for setLifecycle/correct", () => {
    const store = new MemoryStore();
    expect(() => store.setLifecycle("nope", "STALE")).toThrow();
    expect(() => store.correct("nope", {})).toThrow();
  });

  it("query filters by agentId/type/lifecycle", () => {
    const store = new MemoryStore();
    const a = store.write({ agentId: "agent-1", type: "PROJECT_FACT", content: {}, source: "s", confidence: 0.5 });
    store.write({ agentId: "agent-2", type: "PROJECT_FACT", content: {}, source: "s", confidence: 0.5 });
    store.write({ agentId: "agent-1", type: "DECISION", content: {}, source: "s", confidence: 0.5 });
    store.setLifecycle(a.memoryId, "VERIFIED");

    expect(store.query({ agentId: "agent-1" })).toHaveLength(2);
    expect(store.query({ agentId: "agent-1", type: "PROJECT_FACT" })).toHaveLength(1);
    expect(store.query({ lifecycle: "VERIFIED" })).toHaveLength(1);
  });
});
