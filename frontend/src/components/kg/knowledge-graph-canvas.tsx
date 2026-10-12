"use client";

/**
 * KnowledgeGraphCanvas — react-force-graph-2d 的亮色主题封装。
 * 职责：力导向布局、节点绘制（分类配色 + 度数徽章 + 标签）、选中高亮/邻域淡化、
 *       路径高亮、点击/悬停回调。数据过滤由父组件完成。
 */
import * as React from "react";
import dynamic from "next/dynamic";

import type { KgEdge, KgNode } from "@/types/api";
import { categoryColor } from "./category-colors";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      正在加载图谱引擎…
    </div>
  ),
});

export interface GraphNode extends KgNode {
  /** force-graph 渲染字段 */
  val?: number;
  color?: string;
  x?: number;
  y?: number;
}

export interface GraphEdge extends KgEdge {
  source: number | GraphNode;
  target: number | GraphNode;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: number | null;
  /** 路径/搜索高亮集合；非空时其余节点淡化 */
  highlightNodeIds?: Set<number> | null;
  onNodeClick?: (node: GraphNode) => void;
  /** 容器尺寸变化时强制重绘的 key */
  width: number;
  height: number;
  /** 外部需要聚焦的节点（搜索定位） */
  focusNodeId?: number | null;
  /** 聚焦完成后通知父组件清除 */
  onFocusHandled?: () => void;
}

export function KnowledgeGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  highlightNodeIds,
  onNodeClick,
  width,
  height,
  focusNodeId,
  onFocusHandled,
}: Props) {
  const fgRef = React.useRef<{ centerAt: (x?: number, y?: number) => void; zoom: (k?: number, ms?: number) => void } | null>(null);

  const neighborMap = React.useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const e of edges) {
      const s = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
      const t = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t);
      map.get(t)!.add(s);
    }
    return map;
  }, [edges]);

  // 搜索定位
  React.useEffect(() => {
    if (focusNodeId == null) return;
    const n = nodes.find((x) => x.id === focusNodeId);
    if (n && n.x != null && n.y != null && fgRef.current) {
      fgRef.current.centerAt(n.x, n.y, 600);
      fgRef.current.zoom(2.2, 600);
    }
    onFocusHandled?.();
  }, [focusNodeId, nodes, onFocusHandled]);

  const isDimmed = (id: number) => {
    if (highlightNodeIds && highlightNodeIds.size > 0) return !highlightNodeIds.has(id);
    if (selectedNodeId != null) {
      return !(id === selectedNodeId || neighborMap.get(selectedNodeId)?.has(id));
    }
    return false;
  };

  // graphData 身份必须稳定：仅当节点/边数据变化时才更新。
  // 否则父组件因尺寸等 state 重渲染时会触发 kapsule 重新初始化力导向，
  // 撞上已被 d3 变异过的连线对象（"node not found: undefined"）。
  const graphData = React.useMemo(() => ({ nodes, links: edges }), [nodes, edges]);

  return (
    <ForceGraph2D
      ref={fgRef as never}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      cooldownTicks={200}
      warmupTicks={40}
      nodeRelSize={5}
      nodeLabel={(n: GraphNode) => `${n.name}\n${n.category}${n.description ? "\n" + n.description.slice(0, 60) : ""}`}
      nodeCanvasObject={(node: GraphNode, ctx, globalScale) => {
        const r = 4 + Math.sqrt((node.val ?? 1)) * 1.6;
        const dim = isDimmed(node.id);
        const color = node.color ?? categoryColor(node.category);
        ctx.globalAlpha = dim ? 0.16 : 1;

        // 选中光圈
        if (node.id === selectedNodeId) {
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, r + 4, 0, 2 * Math.PI);
          ctx.fillStyle = color + "33";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, r + 1.5, 0, 2 * Math.PI);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5 / globalScale;
          ctx.stroke();
        }

        // 节点主体
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2 / globalScale;
        ctx.stroke();

        // 度数≥6 的枢纽徽章
        const deg = neighborMap.get(node.id)?.size ?? 0;
        if (deg >= 6 && globalScale > 0.8) {
          ctx.beginPath();
          ctx.arc(node.x! + r * 0.75, node.y! - r * 0.75, r * 0.45, 0, 2 * Math.PI);
          ctx.fillStyle = "#ef4444";
          ctx.fill();
        }

        // 标签
        if (globalScale > 0.9 || deg >= 4) {
          const fontSize = Math.max(10 / globalScale, 3);
          ctx.font = `${deg >= 6 ? 600 : 400} ${fontSize}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#334155";
          ctx.fillText(node.name, node.x!, node.y! + r + 2);
        }
        ctx.globalAlpha = 1;
      }}
      linkColor={(e: GraphEdge) => {
        const s = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
        const t = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
        const inPath = highlightNodeIds?.has(s) && highlightNodeIds?.has(t);
        if (inPath) return "#0d9488";
        if (selectedNodeId != null && (s === selectedNodeId || t === selectedNodeId)) return "#0d9488";
        if (highlightNodeIds && highlightNodeIds.size > 0 && !(highlightNodeIds.has(s) && highlightNodeIds.has(t)))
          return "rgba(148,163,184,0.12)";
        if (selectedNodeId != null) return "rgba(148,163,184,0.25)";
        return "rgba(148,163,184,0.45)";
      }}
      linkWidth={(e: GraphEdge) => {
        const s = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
        const t = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
        if (highlightNodeIds?.has(s) && highlightNodeIds?.has(t)) return 2.2;
        if (selectedNodeId != null && (s === selectedNodeId || t === selectedNodeId)) return 1.6;
        return 0.8;
      }}
      linkDirectionalParticles={(e: GraphEdge) => {
        const s = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
        const t = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
        return highlightNodeIds?.has(s) && highlightNodeIds?.has(t) ? 3 : 0;
      }}
      linkDirectionalParticleWidth={2.4}
      onNodeClick={(n: GraphNode) => onNodeClick?.(n)}
      onEngineStop={() => {
        const fg = fgRef.current as { zoomToFit: (ms?: number, px?: number) => void } | null;
        fg?.zoomToFit(400, 40);
      }}
    />
  );
}

export default KnowledgeGraphCanvas;
