"use client";

/**
 * 控制流编排器 —— 组件平台核心页面。
 * 概念对齐 ApexMotion / 海康 VM：双语义边（控制实线/数据虚线）、端口=参数、
 * 三段式绑定（$变量 / 节点.输出）、仿真执行 + 节点级运行日志。
 *
 * 布局：左侧组件库（分类可折叠）| 中部 画布 + 两段式工具栏 + 底部状态栏 | 右侧参数面板 / 运行日志。
 * 节点卡与端口的视觉绘制统一收敛在 @/components/flow/node-factory。
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
  Map as MapIcon,
  Maximize2,
  Play,
  Save,
  Trash2,
  Workflow,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ComponentLibrary } from "@/components/flow/ComponentLibrary";
import { FlowStatusBar } from "@/components/flow/StatusBar";
import { ParamsEmptyGuide } from "@/components/flow/EmptyGuide";
import {
  applySelectedVisual,
  createFlowNode,
  type EditorNodeData,
  isControlPort,
  NODE_W,
} from "@/components/flow/node-factory";

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
  const [nodeCount, setNodeCount] = React.useState(0);
  const [edgeCount, setEdgeCount] = React.useState(0);
  const [zoomPct, setZoomPct] = React.useState(100);
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
  const [settingsOpen, setSettingsOpen] = React.useState(false);
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
      grid: {
        size: 20,
        visible: true,
        type: "doubleMesh",
        args: [
          { color: "#edf2f8", thickness: 1 },
          { color: "#dbe4ee", thickness: 1 },
        ],
      },
      // 右键拖动画布；滚轮直接缩放（工业编辑器惯例）
      panning: { enabled: true, eventTypes: ["rightMouseDown"] },
      // X6 v2：mousewheel 内置组件必须显式 enabled 才会激活；modifiers=[] 表示无需修饰键
      mousewheel: {
        enabled: true,
        zoomAtMousePosition: true,
        minScale: 0.3,
        maxScale: 2.5,
        modifiers: [],
      },
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowNode: false,
        anchor: "center",
        connectionPoint: "anchor",
        highlight: true,
        connector: { name: "rounded" }, // 直角圆角（X6 内置：jumpover/loop/normal/rounded/smooth）
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
          width: 140,
          height: 90,
          padding: 6,
        })
      );
    }
    graphRef.current = graph;

    // 底部状态栏数据源：节点/连线数量、缩放比例
    const syncCounts = () => {
      setNodeCount(graph.getNodes().length);
      setEdgeCount(graph.getEdges().length);
    };
    const syncZoom = () => setZoomPct(Math.round(graph.zoom() * 100));
    graph.on("cell:added", syncCounts);
    graph.on("cell:removed", syncCounts);
    graph.on("viewport:change", syncZoom);
    syncCounts();
    syncZoom();

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
      edge.attr("line/strokeDasharray", isControl ? "8 4" : "4 3");
      edge.attr("line/class", "flow-line-anim");
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
    graph.on("node:dblclick", ({ node }: { node: X6Node }) => {
      setSelectedNode(node);
      setRightTab("params");
      setSettingsOpen(true);
    });
    graph.on("blank:click", () => setSelectedNode(null));
    graph.on("node:moved", () => setDirty(true));
    graph.on("node:removed", () => {
      setSelectedNode(null);
      setDirty(true);
    });

    return () => {
      // 卸载时清理监听（dispose 亦会随图实例移除全部事件）
      graph.off("cell:added", syncCounts);
      graph.off("cell:removed", syncCounts);
      graph.off("viewport:change", syncZoom);
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

  /** 选中节点视觉：主色描边 + 外圈光晕；上一个选中节点恢复默认（不影响运行回放的临时高亮） */
  const prevSelectedIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const g = graphRef.current;
    const selectedId = (selectedNode?.id as string | undefined) ?? null;
    const prevId = prevSelectedIdRef.current;
    prevSelectedIdRef.current = selectedId;
    if (!g) return;
    if (prevId && prevId !== selectedId) {
      const prev = g.getCellById(prevId);
      if (prev && prev.isNode()) applySelectedVisual(prev as X6Node, false);
    }
    if (selectedId) {
      const cell = g.getCellById(selectedId);
      if (cell && cell.isNode()) applySelectedVisual(cell as X6Node, true);
    }
  }, [selectedNode]);

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
                strokeDasharray: isControl ? "8 4" : "4 3",
                class: "flow-line-anim",
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
            // 宽流程 fit 后过小时，抬升到最低可读倍率并居中（可平移查看）
            if (g.zoom() < 0.55) {
              g.zoomTo(0.55);
              g.centerContent();
            }
          } catch {
            /* 忽略适配竞态 */
          }
        }, 60);
      })
      .catch(() => toast.error("流程加载失败"));
  }

  function addComponentAt(comp: ComponentDef, gx?: number, gy?: number) {
    const g = graphRef.current;
    if (!g) return;
    const count = g.getNodes().length;
    const id = `n${Date.now().toString(36)}${count}`;
    let x: number;
    let y: number;
    if (gx != null && gy != null) {
      ({ x, y } = { x: gx, y: gy });
    } else {
      // 画布内容区中心附近错落放置
      const area = g.getContentArea();
      const center = g.graphToLocal({ x: area.x + area.width / 2, y: area.y + area.height / 2 });
      x = center.x - NODE_W / 2 + (count % 5) * 36;
      y = center.y - 20 + (count % 6) * 30;
    }
    g.addNode(createFlowNode(comp, x, y, id));
    setDirty(true);
  }

  function addComponent(comp: ComponentDef) {
    addComponentAt(comp);
  }

  /** 相对缩放（±10%），比例显示由 viewport:change 事件同步 */
  function zoomBy(delta: number) {
    graphRef.current?.zoom(delta);
  }

  /** 适配视图：内容铺满画布并居中 */
  function fitView() {
    const g = graphRef.current;
    if (!g) return;
    try {
      g.zoomToFit({ padding: 40, maxScale: 1 });
      g.centerContent();
    } catch {
      /* 忽略适配竞态 */
    }
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
      // 列距 = 节点宽 200 + 40 间距；行距适配更高的节点卡
      col.forEach((n, i) => n.setPosition({ x: 48 + (depth.get(n.id as string) ?? 0) * 240, y: 40 + i * 120 }));
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
    const stroke = (nodeId: string, color: string, width = 1.2) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode, compByCode]);

  /** 节点参数配置表单（右侧面板与双击弹窗共用） */
  function renderNodeConfig() {
    if (!selectedNode || !compOfSelected) return null;
    return (
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
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      {/* 画布区局部视觉（hover 上浮 / 小地图视框），不污染全局样式 */}
      <style jsx global>{`
        .flow-editor .flow-node-body {
          transition: filter 0.18s ease;
        }
        .flow-editor g[data-cell-id]:hover .flow-node-body {
          filter: drop-shadow(0 5px 12px rgba(15, 23, 42, 0.22));
        }
        .flow-editor .x6-widget-minimap-viewport {
          border-color: rgba(13, 148, 136, 0.6);
          background-color: rgba(13, 148, 136, 0.08);
        }
      `}</style>

      <div className="flex h-[calc(100vh-96px)] gap-3">
        {/* ===== 左侧：组件库 ===== */}
        <ComponentLibrary registry={registry} onAdd={addComponent} />

        {/* ===== 中部：工具栏 + 画布 + 状态栏 ===== */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {/* 工具栏第一行：全局操作 */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Workflow className="h-4 w-4 shrink-0 text-teal-600" />
              <Select
                value={currentId != null ? String(currentId) : undefined}
                onValueChange={(v) => loadFlow(Number(v))}
              >
                <SelectTrigger className="h-8 w-36 shrink-0 text-xs">
                  <SelectValue placeholder="选择流程" />
                </SelectTrigger>
                <SelectContent>
                  {flows.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div aria-hidden className="h-5 w-px shrink-0 bg-border" />

            {/* 流程标题：内联编辑样式（非重复输入框）+ 未保存圆点指示 */}
            <Input
              className="h-8 w-40 rounded-md border-transparent bg-transparent px-1.5 text-xs font-semibold hover:border-input"
              value={flowName}
              onChange={(e) => { setFlowName(e.target.value); setDirty(true); }}
              aria-label="流程名称"
            />
            {dirty && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.16)]"
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  有未保存的更改
                </TooltipContent>
              </Tooltip>
            )}

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

          {/* 工具栏第二行：画布上下文（统计 + 连线图例 + 缩放控制） */}
          <div className="flex h-9 items-center gap-3 border-b border-border px-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              节点
              <span className="rounded bg-muted px-1 font-mono tabular-nums text-foreground/80">{nodeCount}</span>
            </span>
            <span className="flex items-center gap-1.5">
              连线
              <span className="rounded bg-muted px-1 font-mono tabular-nums text-foreground/80">{edgeCount}</span>
            </span>

            <div aria-hidden className="h-4 w-px bg-border" />

            <span className="flex items-center gap-1.5" title="控制流：实线，决定执行顺序">
              <span aria-hidden className="inline-block w-6 border-t-2 border-teal-600" />
              控制流
            </span>
            <span className="flex items-center gap-1.5" title="数据流：虚线，绑定上游输出到输入参数">
              <span aria-hidden className="inline-block w-6 border-t-2 border-dashed border-blue-500" />
              数据流
            </span>

            <div className="ml-auto flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={() => zoomBy(-0.1)}
                title="缩小"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-11 text-center font-mono text-[11px] tabular-nums">{zoomPct}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={() => zoomBy(0.1)}
                title="放大"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <div aria-hidden className="mx-1 h-4 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={fitView}
                title="适配视图"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 画布 */}
          <div
            className="flow-editor relative min-h-0 flex-1"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const code = e.dataTransfer.getData("application/x-component");
              const comp = compByCode.get(code);
              if (!comp || !graphRef.current) return;
              const local = graphRef.current.clientToLocal(e.clientX, e.clientY);
              addComponentAt(comp, local.x - NODE_W / 2, local.y - 20);
            }}
          >
            <div ref={containerRef} className="h-full" />

            {/* 工业 HMI 角标装饰（纯 CSS，不拦截事件） */}
            <div aria-hidden className="pointer-events-none absolute inset-2 z-[5]">
              <span className="absolute left-0 top-0 h-3.5 w-3.5 border-l-2 border-t-2 border-teal-600/25" />
              <span className="absolute right-0 top-0 h-3.5 w-3.5 border-r-2 border-t-2 border-teal-600/25" />
              <span className="absolute bottom-0 left-0 h-3.5 w-3.5 border-b-2 border-l-2 border-teal-600/25" />
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 border-b-2 border-r-2 border-teal-600/25" />
            </div>

            {/* 导航小地图 */}
            <div className="absolute bottom-3 right-3 z-10 overflow-hidden rounded-md border border-border bg-card shadow-lg">
              <div className="flex h-5 items-center gap-1 border-b border-border bg-muted/70 px-2 text-[10px] font-medium text-muted-foreground">
                <MapIcon className="h-2.5 w-2.5" />
                导航
              </div>
              <div ref={minimapRef} className="[&>svg]:block" />
            </div>
          </div>

          {/* 底部状态栏 */}
          <FlowStatusBar
            running={running}
            flowName={flowName}
            nodeCount={nodeCount}
            edgeCount={edgeCount}
            zoomPct={zoomPct}
          />
        </div>

        {/* ===== 右侧：参数 / 运行 ===== */}
        <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as "params" | "run")}>
            <TabsList className="w-full rounded-none border-b border-border">
              <TabsTrigger value="params" className="flex-1">参数配置</TabsTrigger>
              <TabsTrigger value="run" className="flex-1">运行日志</TabsTrigger>
            </TabsList>
          </Tabs>

          {rightTab === "params" ? (
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
              {!selectedNode || !compOfSelected ? (
                <ParamsEmptyGuide />
              ) : (
                renderNodeConfig()
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

      {/* 双击节点设置弹窗（顶层渲染，任何 Tab 下均可打开；表单与右侧面板共用） */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[82vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedNode && (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: selectedNode.getData<EditorNodeData>()?.color }}
                />
              )}
              节点设置
              {selectedNode ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {selectedNode.getData<EditorNodeData>()?.name}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {selectedNode && compOfSelected ? (
            renderNodeConfig()
          ) : (
            <p className="text-xs text-muted-foreground">请先选择节点</p>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
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
