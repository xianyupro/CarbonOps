"use client";

/**
 * 知识图谱 —— 元模型平台的核心展示交互页。
 * 全量拉图 + 前端力导向布局；分类图例过滤、搜索定位、路径查询（高亮）、
 * 节点详情侧栏、AI 三元组提取、导出 PNG。
 */
import * as React from "react";
import { toast } from "sonner";
import {
  Download,
  Maximize,
  Route,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { api } from "@/lib/api";
import type { KgNode, KgPathResult } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  collectCategories,
  categoryColor,
} from "@/components/kg/category-colors";
import KnowledgeGraphCanvas, {
  GraphEdge,
  GraphNode,
} from "@/components/kg/knowledge-graph-canvas";
import NodeDetailPanel from "@/components/kg/node-detail-panel";
import PathQueryDialog from "@/components/kg/path-query-dialog";
import AiExtractDialog from "@/components/kg/ai-extract-dialog";

export default function KnowledgeGraphPage() {
  const [allNodes, setAllNodes] = React.useState<KgNode[]>([]);
  const [allEdges, setAllEdges] = React.useState<KgEdge[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [aiAvailable, setAiAvailable] = React.useState(false);

  // 过滤与选择
  const [activeCategories, setActiveCategories] = React.useState<Set<string>>(new Set());
  const [searchKw, setSearchKw] = React.useState("");
  const [selectedNodeId, setSelectedNodeId] = React.useState<number | null>(null);
  const [focusNodeId, setFocusNodeId] = React.useState<number | null>(null);
  const [pathResult, setPathResult] = React.useState<KgPathResult | null>(null);

  // 弹窗
  const [pathOpen, setPathOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);

  // 容器尺寸（react-force-graph 需要显式宽高）
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 800, height: 600 });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const g = await api.kg.graph();
      setAllNodes(g.nodes);
      setAllEdges(g.edges);
      setActiveCategories(new Set()); // 重置为全选
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "图谱加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    api.kg.aiStatus().then((s) => setAiAvailable(s.available)).catch(() => {});
  }, [load]);

  // 尺寸自适应
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const categories = React.useMemo(() => collectCategories(allNodes), [allNodes]);

  // 过滤后的图数据
  const { nodes, edges } = React.useMemo(() => {
    if (activeCategories.size === 0) {
      return { nodes: allNodes, edges: allEdges };
    }
    const ns = allNodes.filter((n) => activeCategories.has(n.category));
    const ids = new Set(ns.map((n) => n.id));
    const es = allEdges.filter((e) => ids.has(e.sourceNodeId) && ids.has(e.targetNodeId));
    return { nodes: ns, edges: es };
  }, [allNodes, allEdges, activeCategories]);

  // 度数 → 节点大小
  const graphNodes: GraphNode[] = React.useMemo(() => {
    const deg = new Map<number, number>();
    for (const e of edges) {
      deg.set(e.sourceNodeId, (deg.get(e.sourceNodeId) ?? 0) + 1);
      deg.set(e.targetNodeId, (deg.get(e.targetNodeId) ?? 0) + 1);
    }
    return nodes.map((n) => ({ ...n, val: 1 + (deg.get(n.id) ?? 0) * 0.4, color: categoryColor(n.category) }));
  }, [nodes, edges]);

  const graphEdges: GraphEdge[] = React.useMemo(
    () => edges.map((e) => ({ ...e, source: e.sourceNodeId, target: e.targetNodeId })),
    [edges]
  );

  // 搜索候选
  const searchMatches = React.useMemo(() => {
    const kw = searchKw.trim().toLowerCase();
    if (!kw) return [];
    return allNodes.filter((n) => n.name.toLowerCase().includes(kw)).slice(0, 8);
  }, [searchKw, allNodes]);

  // 路径高亮集合
  const highlightIds = React.useMemo(() => {
    if (!pathResult?.found) return null;
    return new Set(pathResult.nodes.map((n) => n.id));
  }, [pathResult]);

  function toggleCategory(c: string) {
    setActiveCategories((prev) => {
      const next = new Set(prev.size === 0 ? categories.map((x) => x.value) : prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      if (next.size === categories.length) return new Set(); // 全选=不过滤
      return next;
    });
  }

  function exportPng() {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = (canvas as HTMLCanvasElement).toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "knowledge-graph.png";
    a.click();
  }

  function toggleFullscreen() {
    const el = containerRef.current?.parentElement;
    if (el?.requestFullscreen) el.requestFullscreen();
  }

  return (
    <div className="space-y-4">
      {/* 页头 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">知识图谱</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            有色冶炼工艺知识与挥发窑平台资产的关联网络
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAiOpen(true)}>
            <Sparkles className="mr-1 h-4 w-4 text-violet-600" />
            AI 提取
            {!aiAvailable && <span className="ml-1 text-xs text-muted-foreground">（未配置）</span>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPathOpen(true)}>
            <Route className="mr-1 h-4 w-4" /> 路径查询
          </Button>
          <Button variant="outline" size="sm" onClick={exportPng}>
            <Download className="mr-1 h-4 w-4" /> 导出 PNG
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            <Maximize className="mr-1 h-4 w-4" /> 全屏
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 刷新
          </Button>
        </div>
      </div>

      {/* 图谱主体 */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-card">
        {/* 顶部工具条 */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <div className="relative">
            <Input
              className="w-56 bg-card"
              placeholder="搜索节点…"
              value={searchKw}
              onChange={(e) => setSearchKw(e.target.value)}
            />
            {searchMatches.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                {searchMatches.map((n) => (
                  <button
                    key={n.id}
                    className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setSelectedNodeId(n.id);
                      setFocusNodeId(n.id);
                      setSearchKw("");
                    }}
                  >
                    {n.name}
                    <span className="ml-2 text-xs text-muted-foreground">{n.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {(pathResult?.found || activeCategories.size > 0 || selectedNodeId != null) && (
            <Button
              variant="outline"
              size="sm"
              className="bg-card"
              onClick={() => {
                setPathResult(null);
                setActiveCategories(new Set());
                setSelectedNodeId(null);
              }}
            >
              重置
            </Button>
          )}
        </div>

        {/* 底部图例 */}
        <div className="absolute bottom-3 left-3 z-10 flex max-w-[80%] flex-wrap gap-1.5">
          {categories.map((c) => {
            const active = activeCategories.size === 0 || activeCategories.has(c.value);
            return (
              <button
                key={c.value}
                onClick={() => toggleCategory(c.value)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity ${
                  active ? "border-border bg-card" : "border-border bg-card opacity-35"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(c.value) }} />
                {c.value}
                <span className="text-muted-foreground">{c.count}</span>
              </button>
            );
          })}
        </div>

        {/* 右下统计 */}
        <div className="absolute bottom-3 right-3 z-10 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur">
          {nodes.length} 节点 · {edges.length} 关系
        </div>

        {/* 画布 */}
        <div ref={containerRef} className="h-[calc(100vh-230px)] min-h-[520px] w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              正在加载图谱…
            </div>
          ) : (
            <KnowledgeGraphCanvas
              key={`kg-${graphNodes.length}-${graphEdges.length}-${[...activeCategories].sort().join(",")}`}
              nodes={graphNodes}
              edges={graphEdges}
              width={size.width}
              height={size.height}
              selectedNodeId={selectedNodeId}
              highlightNodeIds={highlightIds}
              focusNodeId={focusNodeId}
              onFocusHandled={() => setFocusNodeId(null)}
              onNodeClick={(n) => setSelectedNodeId(n.id)}
            />
          )}
        </div>
      </div>

      {/* 节点详情侧栏 */}
      <Sheet open={selectedNodeId != null} onOpenChange={(o) => !o && setSelectedNodeId(null)}>
        <SheetContent className="w-[400px] overflow-hidden p-0 sm:max-w-[400px]">
          {selectedNodeId != null && (
            <NodeDetailPanel
              nodeId={selectedNodeId}
              onClose={() => setSelectedNodeId(null)}
              onNavigate={(id) => setSelectedNodeId(id)}
              onDeleted={load}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* 路径查询 */}
      <PathQueryDialog
        open={pathOpen}
        onOpenChange={setPathOpen}
        nodes={allNodes}
        onResult={setPathResult}
      />

      {/* AI 提取 */}
      <AiExtractDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        aiAvailable={aiAvailable}
        onExtracted={load}
      />
    </div>
  );
}
