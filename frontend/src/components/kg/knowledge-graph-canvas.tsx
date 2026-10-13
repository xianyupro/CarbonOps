"use client";

/**
 * KnowledgeGraphCanvas — react-force-graph-2d 封装（亮色质感版）。
 * 视觉：多层呼吸光晕 + 波纹环 + 高光点 + 标签白描边 + 曲线连线 + 方向箭头 + 路径流动粒子。
 * 交互：邻域聚焦淡化、路径高亮、节点拖拽固定（fx/fy）、右键菜单回调、重置视图、搜索定位。
 */
import * as React from "react";

import type { KgEdge, KgNode } from "@/types/api";
import { categoryColor } from "./category-colors";

// react-force-graph 的官方类型与我们的节点扩展类型不兼容，运行时无碍，统一放宽。
// 必须用 React.lazy 而非 next/dynamic：后者不转发 ref（fgRef 永远为 null），
// d3Force / zoomToFit / centerAt 等引擎方法会全部失效；挂载守卫替代 ssr:false。
const ForceGraph2D = React.lazy(
  () => import("react-force-graph-2d")
) as unknown as React.ComponentType<Record<string, unknown>>;

export interface GraphNode extends KgNode {
  val?: number;
  color?: string;
  x?: number;
  y?: number;
  /** 拖拽固定坐标（d3-force），null/undefined 表示自由 */
  fx?: number | null;
  fy?: number | null;
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
  /** 节点右键（视口坐标） */
  onNodeContextMenu?: (node: GraphNode, screenX: number, screenY: number) => void;
  /** 空白处右键（视口坐标） */
  onBackgroundContextMenu?: (screenX: number, screenY: number) => void;
  /** 数值变化时：解除全部拖拽固定并适配缩放（重置视图） */
  resetSignal?: number;
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

/** tooltip 为 innerHTML 注入，需转义节点文本 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function edgeIds(e: GraphEdge): [number, number] {
  const s = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
  const t = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
  return [s, t];
}

/** d3 自定义力接口（仅用到 initialize/apply） */
type CustomForce = ((alpha: number) => void) & {
  initialize?: (nodes: GraphNode[]) => void;
};

/**
 * 碰撞力：重叠节点两两推开（O(n²)，百级节点无压力），
 * 兜底保证密集簇内节点不叠压 —— d3-force 未直接暴露时自行实现。
 */
function makeCollideForce(radiusOf: (n: GraphNode) => number): CustomForce {
  let ns: GraphNode[] = [];
  const force = (alpha: number) => {
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      for (let j = i + 1; j < ns.length; j++) {
        const b = ns[j];
        let dx = (b.x ?? 0) - (a.x ?? 0);
        let dy = (b.y ?? 0) - (a.y ?? 0);
        const min = radiusOf(a) + radiusOf(b);
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        if (d2 === 0) {
          dx = (Math.random() - 0.5) * 0.5;
          dy = (Math.random() - 0.5) * 0.5;
        }
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = ((min - d) / d) * alpha * 0.5;
        const mx = dx * f;
        const my = dy * f;
        const aFixed = a.fx != null;
        const bFixed = b.fx != null;
        if (!aFixed && !bFixed) {
          a.x = (a.x ?? 0) - mx;
          a.y = (a.y ?? 0) - my;
          b.x = (b.x ?? 0) + mx;
          b.y = (b.y ?? 0) + my;
        } else if (!aFixed) {
          a.x = (a.x ?? 0) - mx * 2;
          a.y = (a.y ?? 0) - my * 2;
        } else if (!bFixed) {
          b.x = (b.x ?? 0) + mx * 2;
          b.y = (b.y ?? 0) + my * 2;
        }
      }
    }
  };
  force.initialize = (initNodes: GraphNode[]) => {
    ns = initNodes;
  };
  return force;
}

export function KnowledgeGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  highlightNodeIds,
  onNodeClick,
  onNodeContextMenu,
  onBackgroundContextMenu,
  resetSignal,
  width,
  height,
  focusNodeId,
  onFocusHandled,
}: Props) {
  const fgRef = React.useRef<{
    centerAt: (x?: number, y?: number) => void;
    zoom: (k?: number, ms?: number) => void;
    zoomToFit: (ms?: number, px?: number) => void;
    getGraphBbox?: () => { x: [number, number]; y: [number, number] } | null;
    d3ReheatSimulation: () => void;
    d3Force: (name: string, force?: unknown) => unknown;
  } | null>(null);
  const timeRef = React.useRef(0);
  // 用户手动拖拽固定的节点（仅这些节点显示锚点标记；全局冻结不显示）
  const pinnedIdsRef = React.useRef<Set<number>>(new Set());
  // 收敛定时器（力配置 / 拖拽重排 / 重置视图共用）
  const settleTimersRef = React.useRef<number[]>([]);

  const clearSettleTimers = React.useCallback(() => {
    for (const t of settleTimersRef.current) clearTimeout(t);
    settleTimersRef.current = [];
  }, []);

  /**
   * 布局演化 ms 毫秒后冻结全部节点（fx/fy 钉死）并适配取景。
   * 引擎冷却/停机时机不可靠、布局会长期缓慢漂移，冻结是唯一稳定的收敛手段；
   * 期间在 1s/3s/6s 做三次跟踪适配，避免演化过程大幅出画。
   */
  const settleAndFreeze = React.useCallback(
    (ms: number) => {
      clearSettleTimers();
      const fit = () => {
        try {
          fgRef.current?.zoomToFit(600, 60);
        } catch {
          /* 引擎未就绪时跳过 */
        }
      };
      for (const t of [1000, 3000, 6000]) {
        if (t < ms) settleTimersRef.current.push(window.setTimeout(fit, t));
      }
      settleTimersRef.current.push(
        window.setTimeout(() => {
          for (const n of nodesRef.current) {
            if (n.fx == null && Number.isFinite(n.x)) n.fx = n.x;
            if (n.fy == null && Number.isFinite(n.y)) n.fy = n.y;
          }
          fit();
        }, ms)
      );
    },
    [clearSettleTimers]
  );
  // 纯客户端挂载守卫（替代原 next/dynamic 的 ssr:false）
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  // 节点对象镜像：冻结时需要写入仿真实际使用的同一批对象
  const nodesRef = React.useRef<GraphNode[]>(nodes);
  nodesRef.current = nodes;

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
      const [s, t] = edgeIds(e);
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

  // 重置视图：解除全部拖拽固定 + 解冻重排 + 适配缩放
  React.useEffect(() => {
    if (!resetSignal) return;
    pinnedIdsRef.current.clear();
    for (const n of nodesRef.current) {
      n.fx = null;
      n.fy = null;
    }
    try {
      fgRef.current?.d3ReheatSimulation();
      settleAndFreeze(8000);
    } catch {
      /* 引擎未就绪时跳过 */
    }
    // 仅由 resetSignal 触发，nodes 取当前闭包即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const isDimmed = (id: number) => {
    if (highlightNodeIds && highlightNodeIds.size > 0) return !highlightNodeIds.has(id);
    if (selectedNodeId != null) {
      return !(id === selectedNodeId || neighborMap.get(selectedNodeId)?.has(id));
    }
    return false;
  };

  // graphData 身份必须稳定：仅当节点/边数据变化时才更新。
  const graphData = React.useMemo(() => ({ nodes, links: edges }), [nodes, edges]);

  // d3 力参数调优：斥力按度数缩放（枢纽强斥力把叶节点摊开，消除「枢纽小球」），
  // 连线距离适度收紧维持簇内层次，中心力调弱避免整体向心挤压，
  // 碰撞力兜底防叠压 —— 整体疏密均匀后 zoomToFit 也能铺满画布。
  // 注意：ForceGraph2D 经 next/dynamic 异步加载，挂载晚于本组件的 effect，
  // 必须轮询到引擎就绪再配置，否则 d3Force 全部静默落空（从未生效）。
  React.useEffect(() => {
    let disposed = false;
    let tries = 0;
    const timer = setInterval(() => {
      if (disposed || tries++ > 200) {
        clearInterval(timer);
        return;
      }
      const fg = fgRef.current as unknown as {
        d3Force: (
          name: string,
          force?: unknown
        ) =>
          | {
              strength?: (v: unknown) => void;
              distance?: (v: number) => void;
            }
          | undefined;
        d3ReheatSimulation: () => void;
        zoomToFit: (ms?: number, px?: number) => void;
        getGraphBbox?: () => { x: [number, number]; y: [number, number] } | null;
      } | null;
      if (!fg || typeof fg.d3Force !== "function") return;
      clearInterval(timer);
      try {
        fg.d3Force("charge")?.strength?.((n: GraphNode) => {
          const deg = neighborMap.get(n.id)?.size ?? 0;
          return -(150 + deg * 14);
        });
        // 弹簧强度 1/max(度数)：d3 默认 1/min(度数) 会让叶节点被「枢纽-叶子」硬弹簧
        // 钉死在枢纽周围形成密球，软化枢纽连线后斥力才能把叶簇摊开
        fg.d3Force("link")
          ?.strength?.((e: GraphEdge) => {
            const s = neighborMap.get(e.sourceNodeId)?.size ?? 1;
            const t = neighborMap.get(e.targetNodeId)?.size ?? 1;
            return 1 / Math.max(s, t);
          });
        fg.d3Force("link")?.distance?.(50);
        fg.d3Force("center")?.strength?.(0.18);
        fg.d3Force(
          "collide",
          makeCollideForce((n) => 5 + Math.sqrt(n.val ?? 1) * 2.4 + 5)
        );
        // 挂载到引擎就绪之间已用默认力跑了若干 tick，重置后让新参数完整接管布局
        fg.d3ReheatSimulation();
        // 布局演化 8 秒后冻结并适配取景（期间 1s/3s/6s 三次跟踪适配）
        settleAndFreeze(8000);
      } catch {
        /* 引擎未就绪时跳过 */
      }
    }, 50);
    return () => {
      disposed = true;
      clearInterval(timer);
      clearSettleTimers();
    };
  }, [graphData, neighborMap, settleAndFreeze, clearSettleTimers]);

  const edgeInPath = (e: GraphEdge) => {
    const [s, t] = edgeIds(e);
    return (highlightNodeIds?.has(s) && highlightNodeIds?.has(t)) ?? false;
  };

  if (!mounted) return null;

  return (
    <React.Suspense fallback={null}>
      <ForceGraph2D
      ref={fgRef as never}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      autoPauseRedraw={false}
      cooldownTicks={280}
      warmupTicks={60}
      enableNodeDrag
      nodeRelSize={5}
      nodeLabel={(n: GraphNode) => {
        const color = n.color ?? categoryColor(n.category);
        const desc = n.description ? escapeHtml(String(n.description).slice(0, 90)) : "";
        return (
          `<div style="max-width:280px;text-align:left;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;` +
          `padding:8px 10px;color:#0f172a;font-family:Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(15,23,42,0.14);">` +
          `<div style="font-size:13px;font-weight:600;line-height:1.4;">${escapeHtml(n.name)}</div>` +
          `<div style="margin-top:3px;font-size:11px;color:${color};">&#9679; ${escapeHtml(n.category)}</div>` +
          (desc
            ? `<div style="margin-top:4px;font-size:11px;line-height:1.5;color:#475569;">${desc}</div>`
            : "") +
          `</div>`
        );
      }}
      nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const r = 5 + Math.sqrt(node.val ?? 1) * 2.4;
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

        // ③ 选中/路径光环（脉动）
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

        // ④ 节点主体（微渐变 + 白描边）
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

        // ⑤ 镜面高光点（knowledgeT 质感：左上亮斑）
        if (r > 2.5) {
          ctx.beginPath();
          ctx.arc(x - r * 0.32, y - r * 0.32, Math.max(r * 0.18, 1), 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.fill();
        }

        ctx.strokeStyle = dim ? "rgba(255,255,255,0.6)" : "#ffffff";
        ctx.lineWidth = 1.4 / globalScale;
        ctx.stroke();

        // ⑥ 拖拽固定标记（左下小锚点，仅用户手动固定的节点）
        if (pinnedIdsRef.current.has(node.id)) {
          ctx.beginPath();
          ctx.arc(x - r * 0.75, y + r * 0.75, Math.max(r * 0.2, 1.6), 0, Math.PI * 2);
          ctx.fillStyle = "rgba(71,85,105,0.9)";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
        }

        // ⑦ 枢纽徽章（度数≥6：红色小圆 + 数量）
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

        // ⑧ 标签（白描边晕 + 深色字；长名截断，奇偶上下交替减少密集区碰撞）
        if (globalScale > 0.55 || deg >= 4 || selected) {
          const fontSize = Math.max(10 / globalScale, 3);
          const weight = deg >= 6 || selected ? 600 : 400;
          ctx.font = `${weight} ${fontSize}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          const label =
            node.name.length > 14 ? `${node.name.slice(0, 13)}…` : node.name;
          const above = node.id % 2 === 1;
          ctx.textBaseline = above ? "bottom" : "top";
          const ly = above ? y - r - 2.5 : y + r + 2.5;
          ctx.lineWidth = fontSize / 3.2;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.strokeText(label, x, ly);
          ctx.fillStyle = dim ? "#94a3b8" : "#1e293b";
          ctx.fillText(label, x, ly);
        }

        ctx.globalAlpha = 1;
      }}
      linkCurvature={0.18}
      linkColor={(e: GraphEdge) => {
        const [s, t] = edgeIds(e);
        const inPath = (highlightNodeIds?.has(s) && highlightNodeIds?.has(t)) ?? false;
        if (inPath) return "#0d9488";
        if (selectedNodeId != null && (s === selectedNodeId || t === selectedNodeId))
          return "rgba(13,148,136,0.9)";
        if (highlightNodeIds && highlightNodeIds.size > 0 && !(highlightNodeIds.has(s) && highlightNodeIds.has(t)))
          return "rgba(148,163,184,0.1)";
        if (selectedNodeId != null) return "rgba(148,163,184,0.22)";
        return "rgba(100,116,139,0.5)";
      }}
      linkWidth={(e: GraphEdge) => {
        const [s, t] = edgeIds(e);
        if (highlightNodeIds?.has(s) && highlightNodeIds?.has(t)) return 3;
        if (selectedNodeId != null && (s === selectedNodeId || t === selectedNodeId)) return 1.8;
        return 1.2;
      }}
      linkDirectionalArrowLength={(e: GraphEdge) => (edgeInPath(e) ? 6 : 3)}
      linkDirectionalArrowRelPos={1}
      linkDirectionalArrowColor={(e: GraphEdge) => {
        const [s, t] = edgeIds(e);
        if (highlightNodeIds?.has(s) && highlightNodeIds?.has(t)) return "#0d9488";
        return "rgba(100,116,139,0.55)";
      }}
      linkDirectionalParticles={(e: GraphEdge) => {
        const [s, t] = edgeIds(e);
        if (highlightNodeIds?.has(s) && highlightNodeIds?.has(t)) return 5;
        if (selectedNodeId != null && (s === selectedNodeId || t === selectedNodeId)) return 2;
        return 0;
      }}
      linkDirectionalParticleWidth={(e: GraphEdge) => (edgeInPath(e) ? 3.2 : 2.2)}
      linkDirectionalParticleSpeed={4}
      onNodeClick={(n: GraphNode) => onNodeClick?.(n)}
      onNodeRightClick={(n: GraphNode, ev: MouseEvent) => {
        ev.preventDefault();
        onNodeContextMenu?.(n, ev.clientX, ev.clientY);
      }}
      onBackgroundRightClick={(ev: MouseEvent) => {
        ev.preventDefault();
        onBackgroundContextMenu?.(ev.clientX, ev.clientY);
      }}
      onNodeDragEnd={(n: GraphNode) => {
        // 拖拽后固定该节点（d3 fx/fy），其余节点解冻参与重排，数秒后重新冻结
        n.fx = Number.isFinite(n.x) ? n.x : null;
        n.fy = Number.isFinite(n.y) ? n.y : null;
        if (n.fx != null && n.fy != null) pinnedIdsRef.current.add(n.id);
        for (const o of nodesRef.current) {
          if (o.id !== n.id) {
            o.fx = null;
            o.fy = null;
          }
        }
        try {
          fgRef.current?.d3ReheatSimulation();
        } catch {
          /* 引擎未就绪时跳过 */
        }
        settleAndFreeze(3500);
      }}
      onEngineStop={() => {
        try {
          fgRef.current?.zoomToFit(500, 50);
        } catch {
          /* 引擎停止竞态：忽略 */
        }
      }}
      />
    </React.Suspense>
  );
}

export default KnowledgeGraphCanvas;
