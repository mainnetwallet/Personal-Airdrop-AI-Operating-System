import { describe, it, expect } from "vitest";
import { MemoryStore, InvalidMemoryTransitionError, canTransitionMemoryLifecycle } from "../memory.js";

describe("memory store", () => {
  it("adds a memory entry with lifecycle NEW and empty correction history", () => {
    const store = new MemoryStore();
    const entry = store.add({
      agentId: "agent-1",
      type: "RESEARCH_FACT",
      content: { note: "project X launched testnet" },
      source: "official-docs",
      confidence: 0.9,
    });
    expect(entry.lifecycle).toBe("NEW");
    expect(entry.correctionHistory).toEqual([]);
    expect(store.get(entry.memoryId)).toEqual(entry);
  });

  it("rejects out-of-range confidence", () => {
    const store = new MemoryStore();
    expect(() =>
      store.add({ agentId: "a", type: "DECISION", content: {}, source: "s", confidence: 1.5 })
    ).toThrow(RangeError);
  });

  it("redacts secret-shaped content before storing", () => {
    const store = new MemoryStore();
    const entry = store.add({
      agentId: "agent-1",
      type: "USER_PREFERENCE",
      content: { apiKey: "sk-abc123", note: "keep this" },
      source: "user",
      confidence: 1,
    });
    expect((entry.content as any).apiKey).toBe("[REDACTED]");
    expect((entry.content as any).note).toBe("keep this");
  });

  it("correct() preserves prior content in correctionHistory and marks CORRECTED", () => {
    const store = new MemoryStore();
    const entry = store.add({
      agentId: "agent-1",
      type: "PROJECT_FACT",
      content: { status: "ACTIVE" },
      source: "research",
      confidence: 0.7,
    });
    const corrected = store.correct(entry.memoryId, { status: "EXPIRED" }, "campaign ended");
    expect(corrected.lifecycle).toBe("CORRECTED");
    expect(corrected.correctionHistory).toHaveLength(1);
    expect(corrected.correctionHistory[0].previousContent).toEqual({ status: "ACTIVE" });
    expect(corrected.content).toEqual({ status: "EXPIRED" });
  });

  it("ARCHIVED is a terminal lifecycle state", () => {
    const store = new MemoryStore();
    const entry = store.add({
      agentId: "agent-1",
      type: "DECISION",
      content: {},
      source: "s",
      confidence: 0.5,
    });
    store.archive(entry.memoryId);
    expect(canTransitionMemoryLifecycle("ARCHIVED", "VERIFIED")).toBe(false);
    expect(() => store.transitionLifecycle(entry.memoryId, "VERIFIED")).toThrow(
      InvalidMemoryTransitionError
    );
  });

  it("list() filters by agentId", () => {
    const store = new MemoryStore();
    store.add({ agentId: "agent-1", type: "DECISION", content: {}, source: "s", confidence: 0.5 });
    store.add({ agentId: "agent-2", type: "DECISION", content: {}, source: "s", confidence: 0.5 });
    expect(store.list("agent-1")).toHaveLength(1);
  });
});
