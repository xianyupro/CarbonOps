"use client";

/**
 * 新增场景向导 Step1 — 组态化系统开发画布。
 * 三栏布局：
 *  - 左侧：模型库 / 组件库 双 Tab，可拖拽
 *  - 中间：拖拽画布（节点 + 连线）
 *  - 右侧：模型数据迁移配置表单 + 云边端口入口
 *
 * 轻量自绘实现（参照 demo），不依赖 X6/LogicFlow 等重组件，避免开发量。
 */
import * as React from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  COMPOSER_MODEL_LIBRARY,
  COMPOSER_COMPONENT_LIBRARY,
} from "@/mock/cloud-edge";
import type { ComposerNode } from "@/types/cloud-edge";

interface Props {
  sceneName: string;
  industry: string;
  onSceneNameChange: (v: string) => void;
  onIndustryChange: (v: string) => void;
  nodes: ComposerNode[];
  setNodes: (n: ComposerNode[]) => void;
  onGoStep2: () => void;
}

type LibraryItem = { type: string; icon: string; label: string };
type LibraryGroup =
  | { category: string; color: string; nodes: LibraryItem[] }
  | { category: string; key: string; nodes: LibraryItem[] };

export function Step1ConfigDev({
  sceneName,
  industry,
  onSceneNameChange,
  onIndustryChange,
  nodes,
  setNodes,
  onGoStep2,
}: Props) {
  /* —— 左侧 Tab 状态 —— */
  const [leftTab, setLeftTab] = React.useState<"model" | "component">("model");
  /* —— 组件库折叠分类 —— */
  const [openKey, setOpenKey] = React.useState<string>("data-collect");

  /* —— 中间画布 —— */
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState<{ key: string; kind: "model" | "component"; type: string; icon: string; label: string } | null>(null);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  /* —— 右侧迁移配置 —— */
  const [migDataSource, setMigDataSource] = React.useState("");
  const [migDataset, setMigDataset] = React.useState("");
  const [migStrategy, setMigStrategy] = React.useState("");
  const [migThreshold, setMigThreshold] = React.useState(0.95);
  const [migApplied, setMigApplied] = React.useState(false);

  /* —— 画布拖拽落点 —— */
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !dragging) return;
    const x = e.clientX - rect.left - 40;
    const y = e.clientY - rect.top - 20;
    const key = `${dragging.kind}-${dragging.type}-${Date.now()}`;
    setNodes([
      ...nodes,
      {
        key,
        kind: dragging.kind,
        type: dragging.type,
        icon: dragging.icon,
        label: dragging.label,
        category: dragging.kind === "model" ? "模型" : "组件",
        x: Math.max(0, x),
        y: Math.max(0, y),
      },
    ]);
    setDragging(null);
  };

  const handleDragStart = (kind: "model" | "component", item: LibraryItem) => {
    setDragging({ key: item.type, kind, type: item.type, icon: item.icon, label: item.label });
  };

  const removeNode = (key: string) => {
    setNodes(nodes.filter((n) => n.key !== key));
    if (selectedKey === key) setSelectedKey(null);
  };

  const clearCanvas = () => {
    setNodes([]);
    setSelectedKey(null);
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* ===== 左侧：模型库 / 组件库 ===== */}
      <div className="col-span-12 lg:col-span-3">
        <div className="panel-cyber rounded-xl">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <div className="flex border-b border-primary/15">
            <button
              type="button"
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold transition-colors",
                leftTab === "model"
                  ? "border-b-2 border-primary bg-primary/5 text-primary text-glow-cyan"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setLeftTab("model")}
            >
              📦 模型库
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold transition-colors",
                leftTab === "component"
                  ? "border-b-2 border-primary bg-primary/5 text-primary text-glow-cyan"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setLeftTab("component")}
            >
              🧩 组件库
            </button>
          </div>
          <div className="max-h-[460px] overflow-y-auto p-3">
            {leftTab === "model" ? (
              <div className="space-y-3">
                {COMPOSER_MODEL_LIBRARY.map((cat) => {
                  const group = cat as { category: string; color: string; nodes: LibraryItem[] };
                  return (
                    <div key={group.category}>
                      <div
                        className="mb-1.5 text-[10px] font-semibold"
                        style={{ color: group.color }}
                      >
                        {group.category}
                      </div>
                      <div className="space-y-1">
                        {group.nodes.map((item) => (
                          <div
                            key={item.type}
                            draggable
                            onDragStart={() => handleDragStart("model", item)}
                            className="cursor-grab select-none rounded border border-border/60 bg-card px-2 py-1.5 text-xs transition hover:border-primary/40 hover:bg-primary/5 active:cursor-grabbing"
                          >
                            {item.icon} {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="mt-3 border-t border-border/40 pt-3 text-center text-[10px] text-muted-foreground">
                  模型库总计 156 个 · 已开放 13 个核心模型
                </div>
              </div>
            ) : (
              <div>
                {COMPOSER_COMPONENT_LIBRARY.map((cat) => {
                  const group = cat as { category: string; key: string; nodes: LibraryItem[] };
                  const open = openKey === group.key;
                  return (
                    <div key={group.key}>
                      <button
                        type="button"
                        className={cn(
                          "mb-1 w-full rounded px-2 py-1.5 text-left text-xs font-semibold transition",
                          open ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setOpenKey(open ? "" : group.key)}
                      >
                        {open ? "▾" : "▸"} {group.category}
                      </button>
                      {open && (
                        <div className="mb-2 space-y-1">
                          {group.nodes.map((item) => (
                            <div
                              key={item.type}
                              draggable
                              onDragStart={() => handleDragStart("component", item)}
                              className="cursor-grab select-none rounded border border-border/60 bg-card px-2 py-1.5 text-xs transition hover:border-primary/40 hover:bg-primary/5 active:cursor-grabbing"
                            >
                              {item.icon} {item.label}
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
        </div>
      </div>

      {/* ===== 中间：场景配置 + 画布 ===== */}
      <div className="col-span-12 lg:col-span-6">
        <div className="panel-cyber rounded-xl">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 px-4 py-2.5">
            <div className="panel-title-bar flex items-center gap-2 text-sm font-semibold tracking-wider">组态化开发画布</div>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-[11px] text-muted-foreground">场景名:</Label>
              <Input
                value={sceneName}
                onChange={(e) => onSceneNameChange(e.target.value)}
                placeholder="输入场景名称"
                className="h-7 w-32 text-xs"
              />
              <Select value={industry} onValueChange={onIndustryChange}>
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue placeholder="行业" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="钢铁">🏭 钢铁</SelectItem>
                  <SelectItem value="有色">⚡ 有色</SelectItem>
                  <SelectItem value="石化">⚗ 石化</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={clearCanvas}>
                清空
              </Button>
            </div>
          </div>
          <div
            ref={canvasRef}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onClick={() => setSelectedKey(null)}
            className="relative h-[460px] overflow-hidden bg-[radial-gradient(circle_at_center,#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]"
            style={{
              backgroundColor: "#0f172a",
              backgroundImage:
                "radial-gradient(circle at center, #cbd5e1 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          >
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                💡 从左侧拖拽模型或组件到此处
              </div>
            )}
            {/* 连线（SVG）*/}
            {nodes.length >= 2 && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {nodes.slice(0, -1).map((n, i) => {
                  const next = nodes[i + 1];
                  return (
                    <line
                      key={`${n.key}-${next.key}`}
                      x1={n.x + 70}
                      y1={n.y + 20}
                      x2={next.x}
                      y2={next.y + 20}
                      stroke="#10b981"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      opacity={0.7}
                    />
                  );
                })}
              </svg>
            )}
            {nodes.map((n) => (
              <div
                key={n.key}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedKey(n.key);
                }}
                className={cn(
                  "absolute select-none rounded-md border bg-card px-3 py-1.5 text-xs shadow-md transition",
                  selectedKey === n.key
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border/60",
                  n.kind === "model"
                    ? "bg-gradient-to-br from-purple-500/20 to-purple-500/5 text-purple-100"
                    : "bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 text-cyan-100"
                )}
                style={{ left: n.x, top: n.y, minWidth: 80 }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{n.icon}</span>
                  <span>{n.label}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNode(n.key);
                    }}
                    className="ml-1 rounded p-0.5 text-slate-400 hover:bg-destructive/20 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 bg-card px-4 py-2 text-[11px] text-muted-foreground">
            <span>💡 拖拽左侧到画布</span>
            <span>|</span>
            <span>🔗 自动顺序连线</span>
            <span>|</span>
            <span>🗑 点击节点删除</span>
            <span>|</span>
            <span className="text-warning">⚡ 选中模型节点 → 右侧迁移配置</span>
          </div>
        </div>
      </div>

      {/* ===== 右侧：模型数据迁移配置 + 云边端口 ===== */}
      <div className="col-span-12 lg:col-span-3">
        <div className="panel-cyber rounded-xl">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <div className="panel-title-bar border-b border-primary/15 px-4 py-2.5 text-sm font-semibold tracking-wider">
            ⚙ 模型数据迁移配置
          </div>
          <div className="space-y-3 p-4">
            <p className="text-[11px] text-muted-foreground">
              选中画布上的模型节点，配置基于数据的自定义迁移参数
            </p>

            <div className="space-y-1">
              <Label className="text-xs">数据源绑定</Label>
              <Select value={migDataSource} onValueChange={setMigDataSource}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择数据源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rtdb">实时数据库 (RTDB)</SelectItem>
                  <SelectItem value="opc">OPC UA 服务器</SelectItem>
                  <SelectItem value="mqtt">MQTT 数据流</SelectItem>
                  <SelectItem value="hist">历史数据库</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">训练数据集</Label>
              <Select value={migDataset} onValueChange={setMigDataset}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择数据集" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hist-6m">历史运行数据 (6个月)</SelectItem>
                  <SelectItem value="sim-steel">仿真模拟数据 (钢铁)</SelectItem>
                  <SelectItem value="sim-nonferrous">仿真模拟数据 (有色)</SelectItem>
                  <SelectItem value="edge-collect">边缘端采集数据</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">迁移策略</Label>
              <Select value={migStrategy} onValueChange={setMigStrategy}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择策略" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finetune">微调 (Fine-tuning)</SelectItem>
                  <SelectItem value="transfer">迁移学习 (Transfer)</SelectItem>
                  <SelectItem value="retrain">增量重训练</SelectItem>
                  <SelectItem value="adapt">领域自适应</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">目标精度阈值</Label>
              <Input
                type="number"
                step="0.01"
                min={0.5}
                max={1}
                value={migThreshold}
                onChange={(e) => setMigThreshold(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>

            <Button
              className="w-full"
              size="sm"
              onClick={() => {
                setMigApplied(true);
              }}
            >
              ⚡ 应用数据迁移配置
            </Button>

            {migApplied && (
              <div className="rounded border border-primary/30 bg-primary/5 p-2 text-[11px] text-primary">
                ✓ 已应用 — 数据源 <code>{migDataSource || "-"}</code> / 策略 <code>{migStrategy || "-"}</code> / 阈值 {migThreshold}
              </div>
            )}

            <div className="mt-4 border-t border-border/60 pt-3">
              <div className="mb-2 text-[11px] text-muted-foreground">🔌 云边协同端口</div>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    migApplied ? "bg-emerald-500" : "bg-muted-foreground/40"
                  )}
                />
                <span className="text-[11px] text-muted-foreground">
                  {migApplied ? "已连接 · 配置已就绪" : "未连接 · 请先应用迁移配置"}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={!migApplied}
                onClick={onGoStep2}
              >
                🔗 配置云边端资源协同 →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
