/**
 * 子图检测 —— BFS 连通分量（自 knowledgeT 项目移植，字段适配 camelCase）。
 * 返回按节点数降序的连通子图列表，名称取子图内度数最高的节点。
 */
import type { KgEdge, KgNode } from "@/types/api";

export interface KgSubgraph {
  /** 稳定 id（以核心节点 id 命名） */
  id: string;
  /** 展示名：子图1 / 子图2 …（按节点数排序） */
  label: string;
  /** 度数最高成员节点名 */
  coreName: string;
  nodeIds: Set<number>;
  nodeCount: number;
  edgeCount: number;
}

export function detectSubgraphs(
  nodes: Pick<KgNode, "id" | "name">[],
  edges: Pick<KgEdge, "sourceNodeId" | "targetNodeId">[]
): KgSubgraph[] {
  const adj = new Map<number, number[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.sourceNodeId)?.push(e.targetNodeId);
    adj.get(e.targetNodeId)?.push(e.sourceNodeId);
  }

  // BFS 找连通分量
  const visited = new Set<number>();
  const components: number[][] = [];
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    visited.add(n.id);
    const comp: number[] = [n.id];
    const queue = [n.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          comp.push(nb);
          queue.push(nb);
        }
      }
    }
    components.push(comp);
  }

  // 度数表（用于挑选核心节点命名）
  const degree = new Map<number, number>();
  for (const e of edges) {
    degree.set(e.sourceNodeId, (degree.get(e.sourceNodeId) ?? 0) + 1);
    degree.set(e.targetNodeId, (degree.get(e.targetNodeId) ?? 0) + 1);
  }
  const nameOf = new Map(nodes.map((n) => [n.id, n.name] as const));

  return components
    .map((comp) => {
      const set = new Set(comp);
      const innerEdges = edges.filter(
        (e) => set.has(e.sourceNodeId) && set.has(e.targetNodeId)
      ).length;
      const core = comp.reduce((best, id) =>
        (degree.get(id) ?? 0) > (degree.get(best) ?? 0) ? id : best, comp[0]);
      return { set, core, innerEdges };
    })
    .sort((a, b) => b.set.size - a.set.size)
    .map((c, i) => ({
      id: `sub-${c.core}`,
      label: `子图${i + 1}`,
      coreName: nameOf.get(c.core) ?? `#${c.core}`,
      nodeIds: c.set,
      nodeCount: c.set.size,
      edgeCount: c.innerEdges,
    }));
}
