import { describe, it, expect } from "vitest";
import { ProjectStore, InvalidProjectTransitionError, DuplicateProjectSlugError, ProjectNotFoundError } from "../project.js";

describe("ProjectStore", () => {
  it("creates a project with DISCOVERED status and sane defaults", () => {
    const store = new ProjectStore();
    const project = store.create({ name: "Example Chain", slug: "example-chain" });
    expect(project.status).toBe("DISCOVERED");
    expect(project.confidence).toBe("UNCERTAIN");
    expect(project.officialSources).toEqual([]);
    expect(store.get(project.projectId)).toEqual(project);
  });

  it("rejects duplicate slugs", () => {
    const store = new ProjectStore();
    store.create({ name: "A", slug: "dup" });
    expect(() => store.create({ name: "B", slug: "dup" })).toThrow(DuplicateProjectSlugError);
  });

  it("throws on unknown projectId", () => {
    const store = new ProjectStore();
    expect(() => store.get("nope")).toThrow(ProjectNotFoundError);
  });

  it("walks the happy-path lifecycle DISCOVERED -> RESEARCHING -> VERIFIED -> ACTIVE -> CLAIMABLE -> CLAIMED -> COMPLETED", () => {
    const store = new ProjectStore();
    const project = store.create({ name: "A", slug: "a" });
    store.transition(project.projectId, "RESEARCHING");
    const verified = store.transition(project.projectId, "VERIFIED");
    expect(verified.lastVerified).not.toBeNull();
    store.transition(project.projectId, "ACTIVE");
    store.transition(project.projectId, "CLAIMABLE");
    store.transition(project.projectId, "CLAIMED");
    const completed = store.transition(project.projectId, "COMPLETED");
    expect(completed.status).toBe("COMPLETED");
  });

  it("rejects skipping straight from DISCOVERED to CLAIMED", () => {
    const store = new ProjectStore();
    const project = store.create({ name: "A", slug: "a" });
    expect(() => store.transition(project.projectId, "CLAIMED")).toThrow(InvalidProjectTransitionError);
  });

  it("rejects any transition out of a terminal state", () => {
    const store = new ProjectStore();
    const project = store.create({ name: "A", slug: "a" });
    store.transition(project.projectId, "RESEARCHING");
    store.transition(project.projectId, "REJECTED");
    expect(() => store.transition(project.projectId, "RESEARCHING")).toThrow(InvalidProjectTransitionError);
  });

  it("allows RISKY to be reached from RESEARCHING and recovered back to WATCHING", () => {
    const store = new ProjectStore();
    const project = store.create({ name: "A", slug: "a" });
    store.transition(project.projectId, "RESEARCHING");
    store.transition(project.projectId, "RISKY");
    const recovered = store.transition(project.projectId, "WATCHING");
    expect(recovered.status).toBe("WATCHING");
  });

  it("update() patches fields and bumps updatedAt without touching projectId/createdAt", () => {
    const store = new ProjectStore();
    const project = store.create({ name: "A", slug: "a" });
    const updated = store.update(project.projectId, { opportunityScore: 82, riskScore: 10 });
    expect(updated.opportunityScore).toBe(82);
    expect(updated.projectId).toBe(project.projectId);
    expect(updated.createdAt).toBe(project.createdAt);
  });

  it("list() filters by status", () => {
    const store = new ProjectStore();
    const a = store.create({ name: "A", slug: "a" });
    store.create({ name: "B", slug: "b" });
    store.transition(a.projectId, "RESEARCHING");
    expect(store.list({ status: "DISCOVERED" })).toHaveLength(1);
    expect(store.list({ status: "RESEARCHING" })).toHaveLength(1);
    expect(store.list()).toHaveLength(2);
  });
});
