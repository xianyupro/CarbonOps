"use client";

/**
 * 云边端 — 模型库管理面板。
 * 含二级子视图：概览 + 详情（按研究方向分类 + 搜索 + 知识图谱）。
 */
import * as React from "react";
import {
  Activity,
  ArrowUpRight,
  Brain,
  Boxes,
  BrainCircuit,
  Compass,
  Eye,
  Gauge,
  Layers,
  Network,
  Search,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ALL_MODELS,
  MODEL_TYPE_COLORS,
  MODEL_TYPE_LABELS,
  MODEL_STATUS_LABELS,
  RESEARCH_DIRECTIONS,
} from "@/mock/cloud-edge";
import type { ModelItem, ResearchDirectionInfo } from "@/types/cloud-edge";

const DIR_ICONS: Record<ResearchDirectionInfo["id"], React.ReactNode> = {
  perception: <Eye className="h-4 w-4" />,
  modeling: <Brain className="h-4 w-4" />,
  control: <Target className="h-4 w-4" />,
  optimization: <Zap className="h-4 w-4" />,
};

const STATUS_VARIANT: Record<ModelItem["status"], "success" | "warning" | "muted"> = {
  active: "success",
  training: "warning",
  inactive: "muted",
};

type SubView = "overview" | "detail";

export function ModelLibraryPanel() {
  const [subView, setSubView] = React.useState<SubView>("overview");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [selectedDir, setSelectedDir] = React.useState<ResearchDirectionInfo["id"] | "all">("all");

  const total = ALL_MODELS.length;
  const active = ALL_MODELS.filter((m) => m.status === "active").length;
  const training = ALL_MODELS.filter((m) => m.status === "training").length;
  const avgAcc =
    ALL_MODELS.reduce((s, m) => s + m.accuracy, 0) / Math.max(1, ALL_MODELS.length);

  const filtered = ALL_MODELS.filter((m) => {
    if (selectedDir !== "all" && m.researchDirection !== selectedDir) return false;
    if (category !== "all" && m.category !== category) return false;
    if (search && !m.name.includes(search) && !m.id.includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* 二级 Tab */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-sm">
        <button
          type="button"
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition",
            subView === "overview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setSubView("overview")}
        >
          📊 模型概览
        </button>
        <button
          type="button"
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition",
            subView === "detail" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setSubView("detail")}
        >
          📋 模型详情
        </button>
      </div>

      {subView === "overview" ? (
        <>
          {/* 概览统计卡 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">模型总数</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{total}</p>
                </div>
                <Boxes className="h-5 w-5 text-primary" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">已上线</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-success">{active}</p>
                </div>
                <Activity className="h-5 w-5 text-success" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">训练中</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-warning">{training}</p>
                </div>
                <Gauge className="h-5 w-5 text-warning" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">平均精度</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{avgAcc.toFixed(1)}%</p>
                </div>
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
            </Card>
          </div>

          {/* 4 个研究方向 */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {RESEARCH_DIRECTIONS.map((d) => (
              <Card key={d.id} className="overflow-hidden">
                <div className="h-1" style={{ background: d.color }} />
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${d.color}1a`, color: d.color }}>
                      {DIR_ICONS[d.id]}
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{d.shortName}</div>
                      <div className="text-[11px] text-muted-foreground">{d.name}</div>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{d.description}</p>
                  <div className="mt-3 flex justify-between text-xs">
                    <span>模型数</span>
                    <span className="font-semibold tabular-nums" style={{ color: d.color }}>{d.count}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs">
                    <span>平均精度</span>
                    <span className="font-semibold tabular-nums">{d.accuracy}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 最近更新 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Layers className="h-3.5 w-3.5" />
                </span>
                最近更新
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {ALL_MODELS.slice(0, 6).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 border-b border-border/30 pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">{m.id}</Badge>
                      <span className="line-clamp-1">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span style={{ color: MODEL_TYPE_COLORS[m.type] }}>{MODEL_TYPE_LABELS[m.type]}</span>
                      <Badge variant={STATUS_VARIANT[m.status]} className="text-[10px]">
                        {MODEL_STATUS_LABELS[m.status]}
                      </Badge>
                      <span className="font-mono text-muted-foreground">{m.version}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* 筛选 + 搜索 */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={selectedDir === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDir("all")}
            >
              全部方向
            </Button>
            {RESEARCH_DIRECTIONS.map((d) => (
              <Button
                key={d.id}
                variant={selectedDir === d.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDir(d.id)}
                style={{
                  background: selectedDir === d.id ? d.color : undefined,
                  borderColor: selectedDir === d.id ? d.color : undefined,
                }}
              >
                {d.shortName}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索模型名 / ID…"
                className="pl-9 text-sm"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                <SelectItem value="钢铁冶炼">钢铁冶炼</SelectItem>
                <SelectItem value="有色冶金">有色冶金</SelectItem>
                <SelectItem value="石化">石化</SelectItem>
                <SelectItem value="通用">通用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
            {/* 模型网格 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((m) => (
                <Card key={m.id} className="overflow-hidden transition hover:border-primary/50">
                  <div className="h-1" style={{ background: MODEL_TYPE_COLORS[m.type] }} />
                  <CardContent className="p-3.5">
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground">{m.id} · {m.version}</span>
                      <Badge variant={STATUS_VARIANT[m.status]} className="text-[10px]">
                        {MODEL_STATUS_LABELS[m.status]}
                      </Badge>
                    </div>
                    <h4 className="mt-1 line-clamp-1 text-sm font-semibold">{m.name}</h4>
                    <p className="line-clamp-2 min-h-[2.5em] text-xs text-muted-foreground">{m.description}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="font-mono font-semibold text-foreground">{m.accuracy}%</span>
                        <span>精度</span>
                      </span>
                      <span>延迟 {m.latency}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">{m.category}</Badge>
                      <Button variant="link" size="sm" className="h-6 px-1 text-[11px]">
                        查看 <ArrowUpRight className="ml-0.5 h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full flex h-40 items-center justify-center text-sm text-muted-foreground">
                  没有匹配模型
                </div>
              )}
            </div>

            {/* 侧栏 */}
            <div className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    <Compass className="h-4 w-4 text-primary" />
                    研究方向
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {selectedDir === "all"
                    ? "请选择研究方向查看详情"
                    : RESEARCH_DIRECTIONS.find((d) => d.id === selectedDir)?.description}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">⚡ 快速操作</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full" size="sm">📤 上传新模型</Button>
                  <Button variant="outline" className="w-full" size="sm">🔗 模型组合配置</Button>
                  <Button variant="outline" className="w-full" size="sm">🧠 知识图谱更新</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    <Network className="h-4 w-4" /> 模型知识图谱
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-[200px] overflow-hidden rounded-lg border border-border/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                    <svg viewBox="0 0 220 200" className="h-full w-full">
                      {/* 节点 + 连线 */}
                      <g stroke="#10b981" strokeWidth="1" opacity="0.5">
                        <line x1="110" y1="100" x2="50" y2="50" />
                        <line x1="110" y1="100" x2="170" y2="50" />
                        <line x1="110" y1="100" x2="50" y2="150" />
                        <line x1="110" y1="100" x2="170" y2="150" />
                        <line x1="50" y1="50" x2="170" y2="50" strokeDasharray="3 3" />
                        <line x1="50" y1="150" x2="170" y2="150" strokeDasharray="3 3" />
                      </g>
                      <g>
                        {[
                          { x: 110, y: 100, r: 22, fill: "#10b981", label: "中" },
                          { x: 50, y: 50, r: 14, fill: "#3b82f6", label: "感" },
                          { x: 170, y: 50, r: 14, fill: "#7c3aed", label: "建" },
                          { x: 50, y: 150, r: 14, fill: "#f59e0b", label: "控" },
                          { x: 170, y: 150, r: 14, fill: "#22c55e", label: "优" },
                        ].map((n) => (
                          <g key={n.label}>
                            <circle cx={n.x} cy={n.y} r={n.r} fill={n.fill} opacity="0.85" />
                            <text x={n.x} y={n.y + 3} textAnchor="middle" fill="white" fontSize="12" fontWeight="600">{n.label}</text>
                          </g>
                        ))}
                      </g>
                    </svg>
                    <div className="absolute bottom-1 left-2 text-[10px] text-slate-400">基于 4 个研究方向关联</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ModelLibraryPanel;
