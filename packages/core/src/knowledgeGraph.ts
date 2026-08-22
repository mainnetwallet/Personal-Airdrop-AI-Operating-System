/**
 * Phase 11: Knowledge Graph (spec section 180) and Knowledge Graph
 * Queries (181).
 *
 * This is a thin, explicit graph over whatever node/edge records the
 * caller adds - it does not infer relationships that weren't
 * explicitly recorded elsewhere (e.g. by ActivityAttribution or
 * EligibilityEngine). It exists so cross-entity questions like "which
 * projects need Base activity?" or "which activities satisfy multiple
 * campaigns?" can be answered by traversal instead of ad-hoc joins
 * scattered across callers.
 */
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "@airdrop-os/types";

export class KnowledgeGraph {
  private readonly nodes = new Map<string, KnowledgeGraphNode>();
  private readonly edges: KnowledgeGraphEdge[] = [];

  addNode(node: KnowledgeGraphNode): void {
    this.nodes.set(node.nodeId, node);
  }

  addEdge(edge: KnowledgeGraphEdge): void {
    if (!this.nodes.has(edge.fromNodeId) || !this.nodes.has(edge.toNodeId)) {
      throw new Error(`Cannot add edge referencing unknown node(s): ${edge.fromNodeId} -> ${edge.toNodeId}`);
    }
    this.edges.push(edge);
  }

  getNode(nodeId: string): KnowledgeGraphNode | null {
    return this.nodes.get(nodeId) ?? null;
  }

  /** Nodes reachable from `nodeId` via edges with the given relation (or any relation if omitted). */
  neighbors(nodeId: string, relation?: string): KnowledgeGraphNode[] {
    return this.edges
      .filter((e) => e.fromNodeId === nodeId && (relation === undefined || e.relation === relation))
      .map((e) => this.nodes.get(e.toNodeId))
      .filter((n): n is KnowledgeGraphNode => n !== undefined);
  }

  /** Nodes that point to `nodeId` via edges with the given relation (or any relation if omitted). */
  incoming(nodeId: string, relation?: string): KnowledgeGraphNode[] {
    return this.edges
      .filter((e) => e.toNodeId === nodeId && (relation === undefined || e.relation === relation))
      .map((e) => this.nodes.get(e.fromNodeId))
      .filter((n): n is KnowledgeGraphNode => n !== undefined);
  }

  /** Section 181: "which activities satisfy multiple campaigns?" - nodes with >1 incoming edge of a relation. */
  nodesWithMultipleIncoming(relation: string, minCount: number = 2): KnowledgeGraphNode[] {
    const counts = new Map<string, number>();
    for (const edge of this.edges) {
      if (edge.relation !== relation) continue;
      counts.set(edge.toNodeId, (counts.get(edge.toNodeId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= minCount)
      .map(([nodeId]) => this.nodes.get(nodeId))
      .filter((n): n is KnowledgeGraphNode => n !== undefined);
  }

  nodesByType(nodeType: string): KnowledgeGraphNode[] {
    return [...this.nodes.values()].filter((n) => n.nodeType === nodeType);
  }
}
