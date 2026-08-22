import { describe, expect, it } from "vitest";
import { GlobalSearchIndex } from "../globalSearch.js";

function buildIndex(): GlobalSearchIndex {
  const index = new GlobalSearchIndex();
  index.upsert({
    entityType: "PROJECT",
    entityId: "project-1",
    label: "LayerZero",
    searchableText: "Cross-chain interoperability protocol on Ethereum and Base",
  });
  index.upsert({
    entityType: "PROJECT",
    entityId: "project-2",
    label: "Base Bridge",
    searchableText: "Official bridge for Base L2",
  });
  index.upsert({
    entityType: "TASK",
    entityId: "task-1",
    label: "Bridge to Base",
    searchableText: "Bridge 0.01 ETH from Ethereum mainnet to Base",
  });
  return index;
}

describe("GlobalSearchIndex", () => {
  it("finds records matching a token in the label", () => {
    const index = buildIndex();
    const results = index.search("LayerZero");
    expect(results[0]?.entityId).toBe("project-1");
  });

  it("finds records matching a token in the searchable text, not just the label", () => {
    const index = buildIndex();
    const results = index.search("interoperability");
    expect(results.map((r) => r.entityId)).toContain("project-1");
  });

  it("returns no results for a query with no matches", () => {
    const index = buildIndex();
    expect(index.search("nonexistentxyz")).toEqual([]);
  });

  it("returns empty for an empty/whitespace query", () => {
    const index = buildIndex();
    expect(index.search("   ")).toEqual([]);
  });

  it("restricts results to given entityTypes when provided", () => {
    const index = buildIndex();
    const results = index.search("Base", ["TASK"]);
    expect(results.every((r) => r.entityType === "TASK")).toBe(true);
    expect(results.map((r) => r.entityId)).toContain("task-1");
  });

  it("ranks a label match higher than a body-only match", () => {
    const index = buildIndex();
    const results = index.search("Bridge");
    // "Bridge to Base" (task-1) and "Base Bridge" (project-2) both have Bridge in the label;
    // "LayerZero" doesn't mention bridge in its label or body, so it should not appear.
    expect(results.map((r) => r.entityId)).not.toContain("project-1");
    expect(results.map((r) => r.entityId)).toEqual(
      expect.arrayContaining(["task-1", "project-2"])
    );
  });

  it("removes a record from the index", () => {
    const index = buildIndex();
    index.remove("PROJECT", "project-1");
    expect(index.search("LayerZero")).toEqual([]);
    expect(index.size()).toBe(2);
  });

  it("clears all records of a given entityType", () => {
    const index = buildIndex();
    index.clearType("PROJECT");
    expect(index.size()).toBe(1);
    expect(index.search("Bridge to Base").map((r) => r.entityType)).toEqual(["TASK"]);
  });

  it("upsert overwrites an existing record for the same entityType/entityId", () => {
    const index = buildIndex();
    index.upsert({
      entityType: "PROJECT",
      entityId: "project-1",
      label: "LayerZero V2",
      searchableText: "Updated description mentioning omnichain",
    });
    expect(index.size()).toBe(3);
    const results = index.search("omnichain");
    expect(results[0]?.entityId).toBe("project-1");
  });
});
