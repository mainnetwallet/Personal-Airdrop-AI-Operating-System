import { describe, it, expect } from "vitest";
import { IdentityGraph, ConflictingIdentityAssociationError, UnknownAssociationError } from "../identityGraph.js";

describe("IdentityGraph", () => {
  it("associates a userId with an account", () => {
    const graph = new IdentityGraph();
    const association = graph.associate({
      userId: "u1",
      accountType: "WALLET",
      accountRef: "0xABC",
      state: "USER_CONFIRMED",
    });
    expect(association.userId).toBe("u1");
    expect(graph.get(association.associationId)).toEqual(association);
  });

  it("re-associating the same user+account upgrades state instead of creating a duplicate", () => {
    const graph = new IdentityGraph();
    graph.associate({ userId: "u1", accountType: "X_ACCOUNT", accountRef: "@alice", state: "OBSERVED" });
    const upgraded = graph.associate({ userId: "u1", accountType: "X_ACCOUNT", accountRef: "@alice", state: "USER_CONFIRMED" });
    expect(upgraded.state).toBe("USER_CONFIRMED");
    expect(graph.accountsFor("u1")).toHaveLength(1);
  });

  it("re-associating with a weaker state does not downgrade an existing stronger association", () => {
    const graph = new IdentityGraph();
    graph.associate({ userId: "u1", accountType: "DISCORD_ACCOUNT", accountRef: "alice#0001", state: "USER_CONFIRMED" });
    const attempted = graph.associate({ userId: "u1", accountType: "DISCORD_ACCOUNT", accountRef: "alice#0001", state: "OBSERVED" });
    expect(attempted.state).toBe("USER_CONFIRMED");
  });

  it("never silently merges: associating an account already owned by a different user throws", () => {
    const graph = new IdentityGraph();
    graph.associate({ userId: "u1", accountType: "WALLET", accountRef: "0xABC", state: "KNOWN" });
    expect(() =>
      graph.associate({ userId: "u2", accountType: "WALLET", accountRef: "0xABC", state: "KNOWN" })
    ).toThrow(ConflictingIdentityAssociationError);
    // u1 still owns it; nothing was reassigned by the failed attempt.
    expect(graph.accountsFor("u1")).toHaveLength(1);
    expect(graph.accountsFor("u2")).toHaveLength(0);
  });

  it("reassociate() requires acknowledging the current owner before reassigning", () => {
    const graph = new IdentityGraph();
    graph.associate({ userId: "u1", accountType: "WALLET", accountRef: "0xABC", state: "KNOWN" });

    expect(() =>
      graph.reassociate("WALLET", "0xABC", "wrong-expected-user", "u2", "USER_CONFIRMED")
    ).toThrow(ConflictingIdentityAssociationError);

    const reassigned = graph.reassociate("WALLET", "0xABC", "u1", "u2", "USER_CONFIRMED");
    expect(reassigned.userId).toBe("u2");
    expect(graph.accountsFor("u1")).toHaveLength(0);
    expect(graph.accountsFor("u2")).toHaveLength(1);
  });

  it("throws UnknownAssociationError for an unregistered associationId", () => {
    const graph = new IdentityGraph();
    expect(() => graph.get("nope")).toThrow(UnknownAssociationError);
  });

  it("accountsFor() returns every account type linked to a user", () => {
    const graph = new IdentityGraph();
    graph.associate({ userId: "u1", accountType: "WALLET", accountRef: "0xABC", state: "USER_CONFIRMED" });
    graph.associate({ userId: "u1", accountType: "GITHUB_ACCOUNT", accountRef: "alice", state: "OBSERVED" });
    expect(graph.accountsFor("u1")).toHaveLength(2);
  });
});
