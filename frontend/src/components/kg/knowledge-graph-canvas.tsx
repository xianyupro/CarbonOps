"use client";

/**
 * KnowledgeGraphCanvas — react-force-graph-2d 封装（亮色质感版）。
 * 视觉：多层呼吸光晕 + 波纹环 + 标签白描边 + 曲线连线 + 方向箭头 + 路径流动粒子。
 * 交互：邻域聚焦淡化、路径高亮、点击回调、搜索定位。
 */
import * as React from "react";
import dynamic from "next/dynamic";

import type { KgEdge, KgNode } from "@/types/api";
import { categoryColor } from "./category-colors";

// react-force-graph 的官方类型与我们的节点扩展类型不兼容，运行时无碍，统一放宽
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as unknown as React.ComponentType<Record<string, unknown>>;

export interface GraphNode extends KgNode {
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
  highlightNodeIds?: Set<number> | null;
  onNodeClick?: (node: GraphNode) => void;
  width: number;
  height: number;
  focusNodeId?: number | null;
  onFocusHandled?: () => void;
}

/** hex → rgba 字符串 */
function rgba(hex: string, alpha: number): string {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
  const fgRef = React.useRef<{
    centerAt: (x?: number, y?: number) => void;
    zoom: (k?: number, ms?: number) => void;
    zoomToFit: (ms?: number, px?: number) => void;
  } | null>(null);
  const timeRef = React.useRef(0);

  // 呼吸动画时钟：持续重绘（autoPauseRedraw 关闭时按浏览器帧率刷新画布）
  React.useEffect(() => {
    let raf = 0;
    let mounted = true;
    const loop = () => {
      if (!mounted) return;
      timeRef.current = performance.now() / 1000;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, []);

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
      fgRef.current.centerAt(n.x, n.y);
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
  const graphData = React.useMemo(() => ({ nodes, links: edges }), [nodes, edges]);

  // d3 力参数调优：斥力增强拉开簇间距离，连线距离收紧让簇内紧凑 —— 空间层次感
  React.useEffect(() => {
    const fg = fgRef.current as unknown as {
      d3Force: (name: string, force?: unknown) => { strength?: (v: number) => void; distance?: (v: number) => void } | undefined;
    } | null;
    try {
      fg?.d3Force("charge")?.strength?.(-240);
      fg?.d3Force("link")?.distance?.(50);
      fg?.d3Force("center")?.strength?.(0.55);
    } catch {
      /* 引擎未就绪时跳过 */
    }
  }, [graphData]);

  return (
    <ForceGraph2D
      ref={fgRef as never}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      autoPauseRedraw={false}
      cooldownTicks={200}
      warmupTicks={40}
      nodeRelSize={5}
      nodeLabel={(n: GraphNode) =>
        `${n.name}\n${n.category}${n.description ? "\n" + n.description.slice(0, 60) : ""}`
      }
      nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const r = 4 + Math.sqrt(node.val ?? 1) * 1.8;
        const color = node.color ?? categoryColor(node.category);
        const dim = isDimmed(node.id);
        const t = timeRef.current;
        const x = node.x!;
        const y = node.y!;
        // 首帧 d3 尚未给出坐标，跳过绘制
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r)) return;
        const selected = node.id === selectedNodeId;
        const inPath = highlightNodeIds?.has(node.id) ?? false;

        ctx.globalAlpha = dim ? 0.14 : 1;

        // ① 多层呼吸光晕（径向渐变，两层相位不同）
        for (let i = 0; i < 2; i++) {
          const breath = 0.5 + 0.5 * Math.sin(t * 1.4 + node.id * 0.7 + i * 2.1);
          const gr = r * (2.2 + i * 1.1) + breath * r * 0.5;
          const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, gr);
          g.addColorStop(0, rgba(color, 0.2 - i * 0.07));
          g.addColorStop(1, rgba(color, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, gr, 0, Math.PI * 2);
          ctx.fill();
        }

        // ② 呼吸波纹环（两圈相位错开，向外扩散消散）
        for (let i = 0; i < 2; i++) {
          const phase = (t * 0.45 + node.id * 0.11 + i * 0.5) % 1;
          const rr = r + phase * r * 2.6;
          ctx.globalAlpha = (1 - phase) * (dim ? 0.05 : 0.4);
          ctx.beginPath();
          ctx.arc(x, y, rr, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.1 / globalScale;
          ctx.stroke();
        }
        ctx.globalAlpha = dim ? 0.14 : 1;

        // ③ 选中光环（脉动）
        if (selected || inPath) {
          const pulse = 1 + 0.12 * Math.sin(t * 3.2);
          ctx.beginPath();
          ctx.arc(x, y, (r + 4.5) * pulse, 0, Math.PI * 2);
          ctx.fillStyle = rgba(color, 0.16);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, (r + 2.5) * pulse, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6 / globalScale;
          ctx.stroke();
        }

        // ④ 节点主体（微渐变 + 白描边 + 高光点）
        const body = ctx.createRadialGradient(
          x - r * 0.35, y - r * 0.35, r * 0.15, x, y, r
        );
        body.addColorStop(0, rgba("#ffffff", 0.45));
        body.addColorStop(0.35, color);
        body.addColorStop(1, color);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = dim ? "rgba(255,255,255,0.6)" : "#ffffff";
        ctx.lineWidth = 1.4 / globalScale;
        ctx.stroke();

        // ⑤ 枢纽徽章（度数≥6：红色小圆 + 数量）
        const deg = neighborMap.get(node.id)?.size ?? 0;
        if (deg >= 6 && globalScale > 0.7) {
          const br = Math.max(r * 0.5, 3.2);
          const bx = x + r * 0.72;
          const by = y - r * 0.72;
          ctx.beginPath();
          ctx.arc(bx, by, br + 0.8, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fillStyle = "#ef4444";
          ctx.fill();
          if (globalScale > 1.4) {
            ctx.fillStyle = "#ffffff";
            ctx.font = `600 ${br * 1.15}px Inter, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(deg), bx, by + br * 0.08);
          }
        }

        // ⑥ 标签（白描边晕 + 深色字，保证亮底可读）
        if (globalScale > 0.85 || deg >= 4 || selected) {
          const fontSize = Math.max(10 / globalScale, 3);
          const weight = deg >= 6 || selected ? 600 : 400;
          ctx.font = `${weight} ${fontSize}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const ly = y + r + 2.5;
          ctx.lineWidth = fontSize / 3.2;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.strokeText(node.name, x, ly);
          ctx.fillStyle = dim ? "#94a3b8" : "#1e293b";
          ctx.fillText(node.name, x, ly);
        }

        ctx.globalAlpha = 1;
      }}
      linkCurvature={0.18}
      linkColor={(e: GraphEdge) => {
        const s = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
        const t = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
        const inPath = highlightNodeIds?.has(s) && highlightNodeIds?.has(t);
        if (inPath) return "#0d9488";
        if (selectedNodeId != null && (s === selectedNodeId || t === selectedNodeId))
          return "rgba(13,148,136,0.9)";
        if (highlightNodeIds && highlightNodeIds.size > 0 && !(highlightNodeIds.has(s) && highlightNodeIds.has(t)))
          return "rgba(148,163,184,0.1)";
        if (selectedNodeId != null) return "rgba(148,163,184,0.22)";
        return "rgba(100,116,139,0.5)";
      }}
      linkWidth={(e: GraphEdge) => {
        const s = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
        const t = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
        if (highlightNodeIds?.has(s) && highlightNodeIds?.has(t)) return 2.4;
        if (selectedNodeId != null && (s === selectedNodeId || t === selectedNodeId)) return 1.8;
        return 1.2;
      }}
      linkDirectionalArrowLength={(e: GraphEdge) => {
        const s = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
        const t = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
        return highlightNodeIds?.has(s) && highlightNodeIds?.has(t) ? 5 : 3;
      }}
      linkDirectionalArrowRelPos={1}
      linkDirectionalArrowColor={(e: GraphEdge) => {
        const s = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
        const t = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
        if (highlightNodeIds?.has(s) && highlightNodeIds?.has(t)) return "#0d9488";
        return "rgba(100,116,139,0.55)";
      }}
      linkDirectionalParticles={(e: GraphEdge) => {
        const s = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
        const t = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
        if (highlightNodeIds?.has(s) && highlightNodeIds?.has(t)) return 4;
        if (selectedNodeId != null && (s === selectedNodeId || t === selectedNodeId)) return 2;
        return 0;
      }}
      linkDirectionalParticleWidth={2.6}
      linkDirectionalParticleSpeed={4}
      onNodeClick={(n: GraphNode) => onNodeClick?.(n)}
      onEngineStop={() => {
        try {
          fgRef.current?.zoomToFit(500, 50);
        } catch {
          /* 引擎停止竞态：忽略 */
        }
      }}
    />
  );
}

export default KnowledgeGraphCanvas;
