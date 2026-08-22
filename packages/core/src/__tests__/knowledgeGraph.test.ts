import { describe, expect, it } from "vitest";
import { KnowledgeGraph } from "../knowledgeGraph.js";

function buildGraph(): KnowledgeGraph {
  const graph = new KnowledgeGraph();
  graph.addNode({ nodeId: "activity-1", nodeType: "ACTIVITY", label: "Bridge to Base" });
  graph.addNode({ nodeId: "campaign-1", nodeType: "CAMPAIGN", label: "Season 1" });
  graph.addNode({ nodeId: "campaign-2", nodeType: "CAMPAIGN", label: "Season 2" });
  graph.addNode({ nodeId: "wallet-1", nodeType: "WALLET", label: "0xabc" });
  graph.addEdge({ fromNodeId: "activity-1", toNodeId: "campaign-1", relation: "SATISFIES" });
  graph.addEdge({ fromNodeId: "activity-1", toNodeId: "campaign-2", relation: "SATISFIES" });
  graph.addEdge({ fromNodeId: "wallet-1", toNodeId: "activity-1", relation: "PERFORMED" });
  return graph;
}

describe("KnowledgeGraph", () => {
  it("adds nodes and retrieves them", () => {
    const graph = buildGraph();
    expect(graph.getNode("activity-1")?.label).toBe("Bridge to Base");
  });

  it("refuses to add an edge referencing an unknown node", () => {
    const graph = new KnowledgeGraph();
    graph.addNode({ nodeId: "a", nodeType: "X", label: "A" });
    expect(() => graph.addEdge({ fromNodeId: "a", toNodeId: "missing", relation: "R" })).toThrow(/unknown node/);
  });

  it("returns outgoing neighbors filtered by relation", () => {
    const graph = buildGraph();
    const neighbors = graph.neighbors("activity-1", "SATISFIES");
    expect(neighbors.map((n) => n.nodeId).sort()).toEqual(["campaign-1", "campaign-2"]);
  });

  it("returns incoming nodes filtered by relation", () => {
    const graph = buildGraph();
    const performers = graph.incoming("activity-1", "PERFORMED");
    expect(performers).toHaveLength(1);
    expect(performers[0].nodeId).toBe("wallet-1");
  });

  it("finds nodes with multiple incoming edges of a relation (shared activity across campaigns)", () => {
    const graph = buildGraph();
    const shared = graph.nodesWithMultipleIncoming("SATISFIES", 2);
    expect(shared).toHaveLength(0); // campaigns each have 1 incoming SATISFIES, not the activity
    const multiSatisfying = graph.nodesWithMultipleIncoming("SATISFIES", 1);
    expect(multiSatisfying.map((n) => n.nodeId).sort()).toEqual(["campaign-1", "campaign-2"]);
  });

  it("filters nodes by type", () => {
    const graph = buildGraph();
    const campaigns = graph.nodesByType("CAMPAIGN");
    expect(campaigns).toHaveLength(2);
  });
});
