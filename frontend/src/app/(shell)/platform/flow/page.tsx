"use client";

/**
 * 控制流编排器 —— 组件平台核心页面。
 * 概念对齐 ApexMotion：双语义边（控制实线/数据虚线）、端口=参数、
 * 三段式绑定（$变量 / 节点.输出）、仿真执行 + 节点级运行日志。
 *
 * 布局：左侧组件库（分类分组）| 中部 X6 画布 | 右侧参数面板 / 运行日志。
 */
import * as React from "react";
import { toast } from "sonner";
import { Graph } from "@antv/x6";
import type { Edge as X6Edge, Node as X6Node } from "@antv/x6";
import { Snapline } from "@antv/x6-plugin-snapline";
import { MiniMap } from "@antv/x6-plugin-minimap";
import {
  Clock,
  LayoutGrid,
  Loader2,
  Play,
  Plus,
  Save,
  Square,
  Trash2,
} from "lucide-react";

import { api } from "@/lib/api";
import type {
  ComponentDef,
  ComponentRegistry,
  FlowGraph,
  FlowGraphNode,
  MetamodelOption,
} from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const NODE_W = 184;
/** 控制语义端口（决定边的类型与连线规则） */
const CONTROL_PORTS = new Set(["in", "next", "true", "false", "loop", "exit"]);
const isControlPort = (portId?: string) => !!portId && CONTROL_PORTS.has(portId);

interface EditorNodeData extends Record<string, unknown> {
  componentCode: string;
  name: string;
  color: string;
  params: Record<string, unknown>;
  bindings: Record<string, string>;
}

/** 节点高度随端口数自适应（端口标签在节点内部，需要足够行高） */
function nodeHeight(comp: ComponentDef): number {
  const leftCount = (comp.refCode !== "start" ? 1 : 0) + (comp.inputs?.length ?? 0);
  const rightCount =
    (comp.kind === "single" && comp.refCode !== "end" ? 1 : 0) +
    (comp.kind === "condition" ? 2 : 0) +
    (comp.kind === "circulate" ? 2 : 0) +
    (comp.outputs?.length ?? 0);
  return Math.max(58, Math.max(leftCount, rightCount, 2) * 20 + 28);
}

/**
 * 组件 → X6 端口。对齐 ApexMotion：端口=参数，左右两侧分布，
 * 标签置于节点内部（左端口标签在右、右端口标签在左）。
 */
function buildPorts(comp: ComponentDef, height: number) {
  const mk = (id: string, label: string, control: boolean, side: "left" | "right") => ({
    id,
    group: side,
    attrs: {
      circle: control
        ? { stroke: "#0d9488", fill: side === "right" ? "#0d9488" : "#ffffff", r: 5 }
        : { stroke: "#2563eb", fill: side === "right" ? "#2563eb" : "#ffffff", r: 4.5 },
      text: { text: label },
    },
    label: {
      position: side === "left" ? { name: "right", args: { dx: 6 } } : { name: "left", args: { dx: -6 } },
    },
  });

  const items: ReturnType<typeof mk>[] = [];
  if (comp.refCode !== "start") items.push(mk("in", "", true, "left"));
  for (const pin of comp.inputs ?? []) items.push(mk(pin.key, pin.label, false, "left"));
  if (comp.kind === "single" && comp.refCode !== "end") items.push(mk("next", "", true, "right"));
  if (comp.kind === "condition") {
    items.push(mk("true", "真", true, "right"));
    items.push(mk("false", "假", true, "right"));
  }
  if (comp.kind === "circulate") {
    items.push(mk("loop", "循环", true, "right"));
    items.push(mk("exit", "退出", true, "right"));
  }
  for (const o of comp.outputs ?? []) items.push(mk(o.key, o.label, false, "right"));

  return {
    groups: {
      left: {
        position: {
          name: "line",
          args: { start: { x: 0, y: 48 }, end: { x: 0, y: Math.max(60, height - 12) } },
        },
        attrs: {
          circle: { magnet: true, strokeWidth: 1.5 },
          text: { fill: "#64748b", fontSize: 9, textAnchor: "start" },
        },
      },
      right: {
        position: {
          name: "line",
          args: { start: { x: NODE_W, y: 26 }, end: { x: NODE_W, y: Math.max(60, height - 12) } },
        },
        attrs: {
          circle: { magnet: true, strokeWidth: 1.5 },
          text: { fill: "#64748b", fontSize: 9, textAnchor: "end" },
        },
      },
    },
    items,
  };
}

interface EditorNodeData extends Record<string, unknown> {
  componentCode: string;
  name: string;
  color: string;
  params: Record<string, unknown>;
  bindings: Record<string, string>;
}

function createFlowNode(comp: ComponentDef, x: number, y: number, id: string): X6Node.Metadata {
  const color = comp.uiConfig?.color ?? "#475569";
  const kindLabel =
    comp.kind === "condition" ? "分支" : comp.kind === "circulate" ? "循环" : "单步";
  const height = nodeHeight(comp);
  return {
    id,
    shape: "rect",
    x,
    y,
    width: NODE_W,
    height,
    // 自定义 markup：左侧品牌色条 + 主名称 + 类别副标题（对齐 ApexMotion 节点卡）
    markup: [
      { tagName: "rect", selector: "body" },
      { tagName: "rect", selector: "bar" },
      { tagName: "text", selector: "label" },
      { tagName: "text", selector: "sub" },
    ],
    attrs: {
      body: {
        fill: "#ffffff",
        stroke: color + "77",
        strokeWidth: 1.3,
        rx: 10,
        ry: 10,
        filter: "drop-shadow(0 2px 6px rgba(15,23,42,0.10))",
      },
      bar: {
        // 注意：不能用 refHeight —— X6 把数值解释为参考元素的百分比（132 = 132%），
        // 会导致色条溢出节点。SVG rect 用绝对坐标即可。
        x: 5,
        y: 8,
        width: 3.5,
        height: height - 16,
        rx: 2,
        ry: 2,
        fill: color,
      },
      label: {
        text: comp.name,
        refX: 16,
        refY: 16,
        fill: "#1e293b",
        fontSize: 12,
        fontWeight: 600,
        textAnchor: "start",
        textVerticalAnchor: "middle",
      },
      sub: {
        text: `${comp.category} · ${kindLabel}`,
        refX: 16,
        refY: 34,
        fill: "#94a3b8",
        fontSize: 9,
        textAnchor: "start",
        textVerticalAnchor: "middle",
      },
    },
    // X6 端口类型对 line 策略的 args 标注不全，运行时支持
    ports: buildPorts(comp, height) as never,
    data: {
      componentCode: comp.code,
      name: comp.name,
      color,
      params: Object.fromEntries(
        (comp.paramsSchema ?? []).map((p) => [p.key, p.default ?? null])
      ) as Record<string, unknown>,
      bindings: {} as Record<string, string>,
    } satisfies EditorNodeData,
  };
}

export default function FlowEditorPage() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const minimapRef = React.useRef<HTMLDivElement>(null);
  const graphRef = React.useRef<Graph | null>(null);
  const [registry, setRegistry] = React.useState<ComponentRegistry | null>(null);
  const [metamodels, setMetamodels] = React.useState<MetamodelOption[]>([]);
  const [flows, setFlows] = React.useState<{ id: number; name: string }[]>([]);
  const [currentId, setCurrentId] = React.useState<number | null>(null);
  const [flowName, setFlowName] = React.useState("未命名流程");
  const [selectedNode, setSelectedNode] = React.useState<X6Node | null>(null);
  const [running, setRunning] = React.useState(false);
  const [runResult, setRunResult] = React.useState<{
    state: string;
    durationMs: number;
    error?: string | null;
    logs: {
      nodeId: string;
      name: string;
      state: string;
      durationMs: number;
      inputs: Record<string, { value: unknown; source: string }>;
      outputs: Record<string, unknown>;
      error?: string | null;
    }[];
  } | null>(null);
  const [rightTab, setRightTab] = React.useState<"params" | "run">("params");
  const [dirty, setDirty] = React.useState(false);
  const [activeLog, setActiveLog] = React.useState<string | null>(null);
  const [, force] = React.useState(0);

  const compByCode = React.useMemo(() => {
    const map = new Map<string, ComponentDef>();
    for (const group of Object.values(registry?.groups ?? {}))
      for (const c of group) map.set(c.code, c);
    return map;
  }, [registry]);

  /** 加载或初始化画布 */
  React.useEffect(() => {
    if (!containerRef.current || graphRef.current) return;

    const graph: Graph = new Graph({
      container: containerRef.current,
      background: { color: "#f8fafc" },
      grid: { size: 20, type: "dot", args: { color: "#cbd5e1", thickness: 1 } },
      panning: true,
      mousewheel: { zoomAtMousePosition: true, minScale: 0.4, maxScale: 2, modifiers: ["ctrl"] },
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowNode: false,
        anchor: "center",
        connectionPoint: "anchor",
        highlight: true,
        connector: { name: "rounded" },  // 直角圆角（X6 内置：jumpover/loop/normal/rounded/smooth）
        createEdge() {
          return graph.createEdge({
            shape: "edge",
            attrs: {
              line: { stroke: "#94a3b8", strokeWidth: 1.6, targetMarker: null },
            },
          });
        },
        validateConnection({ sourcePort, targetPort }) {
          if (!sourcePort || !targetPort) return false;
          // 规则：控制口 → 控制入口(in)；数据口 → 数据输入口
          if (isControlPort(sourcePort)) return targetPort === "in";
          return !isControlPort(targetPort);
        },
      },
    });
    // 对齐线 + 小地图（编辑体验对齐 ApexMotion）
    graph.use(new Snapline({ enabled: true }));
    if (minimapRef.current) {
      graph.use(
        new MiniMap({
          container: minimapRef.current,
          width: 168,
          height: 104,
          padding: 8,
        })
      );
    }
    graphRef.current = graph;

    graph.on("edge:connected", ({ isNew, edge }: { isNew: boolean; edge: X6Edge }) => {
      if (!isNew) return;
      const sourcePort = edge.getSourcePortId() ?? "";
      const targetPort = edge.getTargetPortId() ?? "";
      const isControl = isControlPort(sourcePort);
      // 数据边单绑定：目标输入口已有连线时替换旧线（ApexMotion 语义）
      if (!isControl) {
        const incoming = graph.getIncomingEdges(edge.getTargetCellId()) ?? [];
        for (const old of incoming) {
          if (old.id !== edge.id && old.getTargetPortId() === targetPort) {
            graph.removeCell(old);
          }
        }
      }
      edge.attr("line/stroke", isControl ? "#0d9488" : "#2563eb");
      edge.attr("line/strokeDasharray", isControl ? null : "5 3");
      edge.attr("line/targetMarker", isControl
        ? { name: "block", width: 8, height: 6 }
        : { name: "circle", r: 2.5 });
      edge.setData({ kind: isControl ? "control" : "data", sourcePort, targetPort });
      setDirty(true);
    });

    graph.on("node:click", ({ node }: { node: X6Node }) => {
      setSelectedNode(node);
      setRightTab("params");
    });
    graph.on("blank:click", () => setSelectedNode(null));
    graph.on("node:moved", () => setDirty(true));
    graph.on("node:removed", () => {
      setSelectedNode(null);
      setDirty(true);
    });

    return () => {
      graph.dispose();
      graphRef.current = null;
    };
  }, []);

  /** 数据加载 */
  React.useEffect(() => {
    api.flows.components().then(setRegistry).catch(() => toast.error("组件库加载失败"));
    api.flows.metamodelOptions().then(setMetamodels).catch(() => {});
    api.flows
      .list()
      .then((fs) => setFlows(fs.map((f) => ({ id: f.id, name: f.name }))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 组件注册表 + 流程列表都就绪后才自动加载第一个流程（否则 compByCode 为空会丢节点）
  const autoLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoLoadedRef.current || !registry || flows.length === 0) return;
    autoLoadedRef.current = true;
    loadFlow(flows[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, flows]);

  function loadFlow(id: number) {
    api.flows
      .get(id)
      .then((f) => {
        setCurrentId(f.id);
        setFlowName(f.name);
        const g = graphRef.current;
        if (!g) return;
        g.clearCells();
        for (const n of f.graph?.nodes ?? []) {
          const comp = compByCode.get(n.componentCode);
          if (!comp) continue;
          g.addNode({
            ...createFlowNode(comp, n.x, n.y, n.id),
            data: { componentCode: n.componentCode, name: n.name ?? comp.name, color: comp.uiConfig?.color ?? "#475569", params: n.params ?? {}, bindings: n.bindings ?? {} },
          });
        }
        for (const e of f.graph?.edges ?? []) {
          const isControl = e.kind === "control";
          g.addEdge({
            id: e.id,
            shape: "edge",
            source: { cell: e.source, port: e.sourcePort },
            target: { cell: e.target, port: e.targetPort },
            attrs: {
              line: {
                stroke: isControl ? "#0d9488" : "#2563eb",
                strokeDasharray: isControl ? null : "5 3",
                strokeWidth: 1.6,
                targetMarker: isControl
                  ? { name: "block", width: 8, height: 6 }
                  : { name: "circle", r: 2.5 },
              },
            },
            data: { kind: e.kind, sourcePort: e.sourcePort, targetPort: e.targetPort },
          });
        }
        setDirty(false);
        // 视野适配（延后一帧等布局生效）
        setTimeout(() => {
          try {
            g.zoomToFit({ padding: 40, maxScale: 1 });
            g.centerContent();
          } catch {
            /* 忽略适配竞态 */
          }
        }, 60);
      })
      .catch(() => toast.error("流程加载失败"));
  }

  function addComponent(comp: ComponentDef) {
    const g = graphRef.current;
    if (!g) return;
    const count = g.getNodes().length;
    const id = `n${Date.now().toString(36)}${count}`;
    const pos = g.graphToLocal({ x: 120 + (count % 5) * 40, y: 60 + (count % 6) * 36 });
    g.addNode(createFlowNode(comp, pos.x, pos.y, id));
    setDirty(true);
  }

  function exportGraph(): FlowGraph {
    const g = graphRef.current;
    const nodes: FlowGraphNode[] = (g?.getNodes() ?? []).map((n: X6Node) => {
      const d = n.getData<EditorNodeData>();
      return {
        id: n.id as string,
        componentCode: d.componentCode,
        name: d.name,
        x: Math.round(n.getPosition().x),
        y: Math.round(n.getPosition().y),
        params: d.params ?? {},
        bindings: d.bindings ?? {},
      };
    });
    const edges = (g?.getEdges() ?? []).map((e: X6Edge) => {
      const d = e.getData<{ kind: "control" | "data"; sourcePort: string; targetPort: string }>();
      return {
        id: e.id as string,
        source: e.getSourceCellId(),
        target: e.getTargetCellId(),
        kind: d?.kind ?? "control",
        sourcePort: d?.sourcePort ?? e.getSourcePortId(),
        targetPort: d?.targetPort ?? e.getTargetPortId(),
      };
    });
    return { nodes, edges };
  }

  async function handleSave() {
    const g = exportGraph();
    try {
      if (currentId == null) {
        const f = await api.flows.create({ name: flowName, graph: g });
        setCurrentId(f.id);
        setFlows((prev) => [...prev, { id: f.id, name: f.name }]);
      } else {
        await api.flows.update(currentId, { name: flowName, graph: g });
      }
      setDirty(false);
      toast.success("流程已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  }

  async function handleRun() {
    if (currentId == null) {
      toast.error("请先保存流程");
      return;
    }
    // 保存最新画布再运行
    await handleSave();
    setRunning(true);
    setRightTab("run");
    try {
      const r = await api.flows.run(currentId!);
      setRunResult({
        state: r.state,
        durationMs: r.durationMs,
        error: r.error,
        logs: r.nodeLogs ?? [],
      });
      if (r.state === "SUCCESS") toast.success(`执行成功（${r.durationMs}ms）`);
      else toast.error(`执行失败：${r.error ?? "未知错误"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "运行失败");
    } finally {
      setRunning(false);
    }
  }

  /** 自动整理布局：按拓扑深度分列，列内按现有 y 排序 */
  function tidyLayout() {
    const g = graphRef.current;
    if (!g) return;
    const nodes = g.getNodes();
    const edges = g.getEdges();
    const depth = new Map<string, number>();
    nodes.forEach((n) => depth.set(n.id as string, 0));
    for (let round = 0; round < nodes.length; round++) {
      let changed = false;
      for (const e of edges) {
        const sId = e.getSourceCellId();
        const tId = e.getTargetCellId();
        if ((depth.get(tId) ?? 0) < (depth.get(sId) ?? 0) + 1) {
          depth.set(tId, (depth.get(sId) ?? 0) + 1);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const cols = new Map<number, X6Node[]>();
    for (const n of nodes) {
      const d = Math.min(depth.get(n.id as string) ?? 0, 12);
      if (!cols.has(d)) cols.set(d, []);
      cols.get(d)!.push(n);
    }
    for (const [, col] of cols) {
      col.sort((a, b) => a.getPosition().y - b.getPosition().y);
      col.forEach((n, i) => n.setPosition({ x: 48 + (depth.get(n.id as string) ?? 0) * 230, y: 40 + i * 110 }));
    }
    setTimeout(() => {
      try {
        g.zoomToFit({ padding: 40, maxScale: 1 });
        g.centerContent();
      } catch {
        /* 忽略 */
      }
    }, 80);
    setDirty(true);
  }

  /** 执行回放：按真实日志顺序在画布上高亮节点（绿=成功，红=失败） */
  async function replayRun() {
    if (!runResult || !graphRef.current) return;
    const g = graphRef.current;
    const stroke = (nodeId: string, color: string, width = 1.3) => {
      const cell = g.getCellById(nodeId);
      cell?.setAttrByPath("body/stroke", color);
      cell?.setAttrByPath("body/strokeWidth", width);
    };
    for (const log of runResult.logs) stroke(log.nodeId, "#94a3b8");
    setActiveLog(null);
    for (const log of runResult.logs) {
      setActiveLog(log.nodeId);
      stroke(log.nodeId, log.state === "SUCCESS" ? "#10b981" : "#ef4444", 2.6);
      await new Promise((r) => setTimeout(r, Math.min(180 + log.durationMs, 520)));
      stroke(log.nodeId, "#94a3b8");
    }
    setActiveLog(null);
  }

  function updateSelectedParam(key: string, value: unknown) {
    const node = selectedNode;
    if (!node) return;
    const d = node.getData<EditorNodeData>();
    node.setData({ ...d, params: { ...d.params, [key]: value } } as EditorNodeData);
    setDirty(true);
    force((x) => x + 1);
  }

  function clearBinding(key: string) {
    const node = selectedNode;
    if (!node) return;
    const d = node.getData<EditorNodeData>();
    node.setData({ ...d, bindings: { ...d.bindings, [key]: "" } } as EditorNodeData);
    setDirty(true);
    force((x) => x + 1);
  }

  function removeSelectedNode() {
    const node = selectedNode;
    if (!node) return;
    graphRef.current?.removeCell(node);
  }

  const compOfSelected = selectedNode
    ? compByCode.get(selectedNode.getData<EditorNodeData>()?.componentCode ?? "")
    : null;

  /** 可绑定源：当前节点的上游节点及其输出 */
  const bindingCandidates = React.useMemo(() => {
    if (!selectedNode || !graphRef.current) return [] as { nodeId: string; nodeName: string; outputs: { key: string; label: string }[] }[];
    const incoming = (graphRef.current.getNeighbors(selectedNode, { incoming: true }) ?? []) as X6Node[];
    return incoming.map((n: X6Node) => {
      const d = n.getData<EditorNodeData>();
      const comp = compByCode.get(d?.componentCode ?? "");
      return {
        nodeId: n.id as string,
        nodeName: d?.name ?? "",
        outputs: (comp?.outputs ?? []).map((o) => ({ key: o.key, label: o.label })),
      };
    });
  }, [selectedNode, compByCode, registry]);

  return (
    <div className="flex h-[calc(100vh-96px)] gap-3">
      {/* ===== 左侧：组件库 ===== */}
      <div className="flex w-56 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
          组件库
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          {Object.entries(registry?.groups ?? {}).map(([cat, comps]) => (
            <div key={cat} className="mb-3">
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </p>
              <div className="space-y-1">
                {comps.map((c) => (
                  <button
                    key={c.code}
                    title={c.description ?? ""}
                    onClick={() => addComponent(c)}
                    className="group flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs hover:border-border hover:bg-accent"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: c.uiConfig?.color ?? "#64748b" }}
                    />
                    <span className="truncate font-medium">{c.name}</span>
                    <Plus className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-2 text-[10px] leading-relaxed text-muted-foreground">
          点击组件添加到画布；从端口拖出连线（纵向=控制流，横向=数据流）
        </div>
      </div>

      {/* ===== 中部：画布 + 工具栏 ===== */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Select
            value={currentId != null ? String(currentId) : undefined}
            onValueChange={(v) => loadFlow(Number(v))}
          >
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="选择流程" />
            </SelectTrigger>
            <SelectContent>
              {flows.map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 w-40 text-xs"
            value={flowName}
            onChange={(e) => { setFlowName(e.target.value); setDirty(true); }}
          />
          {dirty && <span className="text-xs text-amber-600">未保存</span>}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={tidyLayout} title="按执行顺序自动排列节点">
              <LayoutGrid className="mr-1 h-3.5 w-3.5" /> 整理布局
            </Button>
            <Button size="sm" variant="outline" onClick={handleSave}>
              <Save className="mr-1 h-3.5 w-3.5" /> 保存
            </Button>
            <Button size="sm" onClick={handleRun} disabled={running}>
              {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
              运行（仿真）
            </Button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="h-full" />
          <div
            ref={minimapRef}
            className="absolute bottom-2.5 right-2.5 z-10 overflow-hidden rounded-md border border-border bg-white/95 shadow-md"
          />
        </div>
      </div>

      {/* ===== 右侧：参数 / 运行 ===== */}
      <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as "params" | "run")}>
          <TabsList className="w-full rounded-none border-b border-border">
            <TabsTrigger value="params" className="flex-1">参数配置</TabsTrigger>
            <TabsTrigger value="run" className="flex-1">运行日志</TabsTrigger>
          </TabsList>
        </Tabs>

        {rightTab === "params" ? (
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
            {!selectedNode || !compOfSelected ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <Square className="h-6 w-6 opacity-30" />
                点击画布中的节点编辑参数
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: selectedNode.getData<EditorNodeData>().color }} />
                    <span className="text-sm font-semibold">{selectedNode.getData<EditorNodeData>().name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={removeSelectedNode}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{compOfSelected.description}</p>

                {(compOfSelected.paramsSchema ?? []).map((p) => {
                  const nodeData = selectedNode.getData<EditorNodeData>();
                  const value = nodeData.params?.[p.key];
                  const binding = nodeData.bindings?.[p.key];
                  return (
                    <div key={p.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium">
                          {p.label}
                          {p.required && <span className="text-destructive"> *</span>}
                        </label>
                        {binding && (
                          <button className="text-[10px] text-primary hover:underline" onClick={() => clearBinding(p.key)}>
                            解除绑定
                          </button>
                        )}
                      </div>
                      {binding ? (
                        <div className="rounded-md border border-primary/40 bg-accent px-2 py-1.5 font-mono text-xs">
                          {binding}
                        </div>
                      ) : p.dtype === "select" ? (
                        <Select value={String(value ?? "")} onValueChange={(v) => updateSelectedParam(p.key, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(p.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : p.dtype === "point" ? (
                        <PointPicker value={value as number | null} onChange={(v) => updateSelectedParam(p.key, v)} />
                      ) : p.dtype === "metamodel" ? (
                        <MetamodelPicker
                          options={metamodels}
                          value={value as number | null}
                          onChange={(v) => updateSelectedParam(p.key, v)}
                        />
                      ) : (
                        <Input
                          className="h-8 text-xs"
                          type={p.dtype === "int" || p.dtype === "number" ? "number" : "text"}
                          value={value != null ? String(value) : ""}
                          onChange={(e) =>
                            updateSelectedParam(
                              p.key,
                              p.dtype === "int" || p.dtype === "number"
                                ? Number(e.target.value)
                                : e.target.value
                            )
                          }
                        />
                      )}
                      {p.description && <p className="text-[10px] text-muted-foreground">{p.description}</p>}
                    </div>
                  );
                })}

                {/* 绑定区：数据输入引脚 */}
                {(compOfSelected.inputs ?? []).length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-semibold text-muted-foreground">数据输入绑定</p>
                    {(compOfSelected.inputs ?? []).map((pin) => {
                      const nodeData = selectedNode.getData<EditorNodeData>();
                      const binding = nodeData.bindings?.[pin.key];
                      return (
                        <div key={pin.key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-xs">{pin.label} <span className="font-mono text-[10px] text-muted-foreground">{pin.dtype}</span></label>
                            {binding && (
                              <button className="text-[10px] text-primary hover:underline" onClick={() => clearBinding(pin.key)}>
                                解除
                              </button>
                            )}
                          </div>
                          {binding ? (
                            <div className="rounded-md border border-blue-500/40 bg-blue-50 px-2 py-1.5 font-mono text-xs dark:bg-blue-950/30">
                              {binding}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {bindingCandidates.length === 0 && (
                                <p className="text-[10px] text-muted-foreground">无上游节点；也可从画布拖数据线自动绑定</p>
                              )}
                              {bindingCandidates.map((cand) => (
                                <div key={cand.nodeId} className="rounded border border-border">
                                  <p className="border-b border-border/60 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                                    {cand.nodeName}
                                  </p>
                                  {cand.outputs.map((o) => (
                                    <button
                                      key={o.key}
                                      className="block w-full px-2 py-1 text-left text-xs hover:bg-accent"
                                      onClick={() => {
                                        const d = selectedNode.getData<EditorNodeData>();
                                        selectedNode.setData({
                                          ...d,
                                          bindings: { ...d.bindings, [pin.key]: `${cand.nodeId}.${o.key}` },
                                        } as EditorNodeData);
                                        setDirty(true);
                                        force((x) => x + 1);
                                      }}
                                    >
                                      {o.label} <span className="font-mono text-[10px] text-muted-foreground">{o.key}</span>
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin p-3">
            {!runResult ? (
              <p className="pt-8 text-center text-xs text-muted-foreground">尚未运行；点击「运行（仿真）」执行当前流程</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant={runResult.state === "SUCCESS" ? "default" : "destructive"}>
                    {runResult.state === "SUCCESS" ? "执行成功" : "执行失败"}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {runResult.durationMs}ms
                  </span>
                  <Button variant="outline" size="sm" className="ml-auto h-6 px-2 text-[10px]" onClick={replayRun}>
                    <Play className="mr-1 h-3 w-3" /> 画布回放
                  </Button>
                </div>
                {runResult.error && (
                  <p className="rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">{runResult.error}</p>
                )}
                {runResult.logs.map((log, i) => (
                  <div
                    key={`${log.nodeId}-${i}`}
                    className={`rounded-md border p-2.5 text-xs transition-colors ${
                      activeLog === log.nodeId
                        ? "border-primary bg-accent"
                        : log.state === "SUCCESS"
                          ? "border-border"
                          : "border-destructive/50 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{log.name}</span>
                      <span className="text-muted-foreground">{log.durationMs}ms</span>
                    </div>
                    {Object.entries(log.inputs).map(([k, v]) => (
                      <p key={k} className="mt-1 text-muted-foreground">
                        <span className="font-mono">{k}</span> = {fmtValue(v.value)}
                        <span className="ml-1 opacity-70">（{v.source}）</span>
                      </p>
                    ))}
                    {Object.entries(log.outputs).map(([k, v]) => (
                      <p key={k} className="mt-0.5 text-foreground/80">
                        → <span className="font-mono">{k}</span> = {fmtValue(v)}
                      </p>
                    ))}
                    {log.error && <p className="mt-1 text-destructive">{log.error}</p>}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- 小组件 ---------- */

function fmtValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") {
    const obj = v as { _type?: string; length?: number; preview?: unknown[] };
    if (obj._type === "array") return `[数组·${obj.length}条 ${JSON.stringify(obj.preview).slice(0, 60)}…]`;
    return JSON.stringify(v).slice(0, 90);
  }
  if (typeof v === "number") return String(Math.round(v * 10000) / 10000);
  return String(v).slice(0, 80);
}

function PointPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [opts, setOpts] = React.useState<{ id: number; name: string; sourceName?: string }[]>([]);
  React.useEffect(() => {
    api.dataPoints
      .list({ pageSize: 200 })
      .then((res) => setOpts(res.list.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Select value={value != null ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="选择点位" /></SelectTrigger>
      <SelectContent className="max-h-64">
        {opts.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function MetamodelPicker({
  options,
  value,
  onChange,
}: {
  options: MetamodelOption[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <Select value={value != null ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="选择元模型" /></SelectTrigger>
      <SelectContent className="max-h-64">
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
