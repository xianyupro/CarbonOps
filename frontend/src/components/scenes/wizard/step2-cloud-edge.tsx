"use client";

/**
 * 新增场景向导 Step2 — 云边端资源协同配置。
 *  - 左侧：云边端拓扑图（云 / 边缘节点 × 3 / 监测终端 × 3 + 连线）
 *  - 右侧：终端与节点管理列表（可添加）
 *  - 底部：数据同步策略
 */
import * as React from "react";
import { Box, Cloud, Cpu, Plus, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { EDGE_NODES_INITIAL, MONITOR_INSTRUMENTS_INITIAL } from "@/mock/cloud-edge";
import type { EdgeNode, MonitorInstrument } from "@/types/cloud-edge";

const STATUS_VARIANT: Record<EdgeNode["status"], "success" | "warning" | "muted"> = {
  online: "success",
  warning: "warning",
  offline: "muted",
};
const STATUS_LABEL = { online: "● 在线", warning: "⚠ 警告", offline: "● 离线" };

const STATUS_VARIANT_M: Record<MonitorInstrument["status"], "success" | "warning" | "muted"> = {
  online: "success",
  warning: "warning",
  offline: "muted",
};

interface Props {
  onGoStep3: () => void;
  onBack: () => void;
}

export function Step2CloudEdge({ onGoStep3, onBack }: Props) {
  const [edges, setEdges] = React.useState<EdgeNode[]>(EDGE_NODES_INITIAL);
  const [terms, setTerms] = React.useState<MonitorInstrument[]>(
    MONITOR_INSTRUMENTS_INITIAL.slice(0, 3)
  );
  /* 添加对话框 */
  const [showAddTerm, setShowAddTerm] = React.useState(false);
  const [showAddEdge, setShowAddEdge] = React.useState(false);
  const [termName, setTermName] = React.useState("");
  const [termType, setTermType] = React.useState("co2");
  const [termLocation, setTermLocation] = React.useState("华北");
  const [edgeName, setEdgeName] = React.useState("");
  const [edgeRegion, setEdgeRegion] = React.useState("华北");
  const [edgeHardware, setEdgeHardware] = React.useState("mlu370");
  /* 同步策略 */
  const [syncMode, setSyncMode] = React.useState("realtime");
  const [deploy, setDeploy] = React.useState("auto");
  const [prio, setPrio] = React.useState("latency");

  const addTerm = () => {
    if (!termName) return;
    setTerms([
      ...terms,
      {
        id: "t-" + Date.now(),
        no: `CM-${(terms.length + 1).toString().padStart(3, "0")}`,
        point:
          termType === "co2"
            ? "CO₂ 监测"
            : termType === "temp"
              ? "温度监测"
              : termType === "flow"
                ? "流量监测"
                : "多参数综合",
        reading: "—" as any,
        status: "online",
      } as any,
      {
        id: "t-card-" + Date.now(),
        no: `CM-${(terms.length + 1).toString().padStart(3, "0")}`,
        point: termName,
        reading: "8.2 t/h",
        status: "online",
      } as MonitorInstrument,
    ]);
    setShowAddTerm(false);
    setTermName("");
  };
  const addEdge = () => {
    if (!edgeName) return;
    setEdges([
      ...edges,
      {
        id: "e-" + Date.now(),
        name: edgeName,
        region: edgeRegion,
        npu:
          edgeHardware === "mlu370"
            ? "MLU370"
            : edgeHardware === "jetson"
              ? "Jetson Orin"
              : edgeHardware === "atlas"
                ? "Atlas 200"
                : "K230",
        latency: "<10ms",
        power: "75W",
        status: "online",
      },
    ]);
    setShowAddEdge(false);
    setEdgeName("");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ===== 拓扑 ===== */}
        <div className="panel-cyber rounded-xl">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <div className="flex items-center justify-between border-b border-primary/15 px-4 py-2.5">
            <h3 className="panel-title-bar flex items-center gap-2 text-sm font-semibold tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Cloud className="h-3.5 w-3.5" />
              </span>
              云边端协同拓扑
            </h3>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddTerm(true)}>
                <Plus className="mr-1 h-3 w-3" /> 监测终端
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddEdge(true)}>
                <Plus className="mr-1 h-3 w-3" /> 边缘节点
              </Button>
            </div>
          </div>
          <div className="p-4">
            <div className="relative h-[320px] overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
              {/* 网格底纹 */}
              <div aria-hidden className="absolute inset-0 bg-cyber-grid-fine bg-grid-20 opacity-40" />
              {/* SVG 连线（云↔边↔终，含 data-flow 动画）*/}
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {/* 云 → 边缘 */}
                <line x1="50%" y1="12%" x2="14%" y2="42%" stroke="#10b981" strokeWidth={1.6} strokeDasharray="6 4" opacity={0.8} className="animate-data-flow" />
                <line x1="50%" y1="12%" x2="50%" y2="42%" stroke="#10b981" strokeWidth={1.6} strokeDasharray="6 4" opacity={0.8} className="animate-data-flow" />
                <line x1="50%" y1="12%" x2="86%" y2="42%" stroke="#10b981" strokeWidth={1.6} strokeDasharray="6 4" opacity={0.8} className="animate-data-flow" />
                {/* 边 → 终 */}
                <line x1="14%" y1="42%" x2="6%" y2="78%" stroke="#22d3ee" strokeWidth={1.4} strokeDasharray="4 4" opacity={0.7} className="animate-data-flow" />
                <line x1="50%" y1="42%" x2="50%" y2="78%" stroke="#22d3ee" strokeWidth={1.4} strokeDasharray="4 4" opacity={0.7} className="animate-data-flow" />
                <line x1="86%" y1="42%" x2="94%" y2="78%" stroke="#22d3ee" strokeWidth={1.4} strokeDasharray="4 4" opacity={0.7} className="animate-data-flow" />
              </svg>
              {/* 云端 */}
              <div className="absolute left-1/2 top-3 -translate-x-1/2">
                <div className="rounded-lg border border-primary/40 bg-primary/15 px-4 py-2 text-center shadow-glow-cyan backdrop-blur">
                  <div className="mb-0.5 text-2xl">☁</div>
                  <div className="text-xs font-semibold text-foreground text-glow-cyan">云端数据中心</div>
                  <div className="text-[10px] text-muted-foreground">GPU 集群 · 模型训练 · 156 个模型</div>
                </div>
              </div>
              {/* 边缘节点 */}
              {edges.slice(0, 3).map((e, i) => {
                const x = [14, 50, 86][i];
                return (
                  <div key={e.id} className="absolute top-[100px]" style={{ left: `${x}%`, transform: "translateX(-50%)" }}>
                    <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-center shadow-[0_0_12px_hsl(220_100%_60%_/_0.25)] backdrop-blur">
                      <div className="text-base">🔷</div>
                      <div className="text-[11px] font-semibold text-foreground">{e.name}</div>
                      <div className="text-[9px] text-muted-foreground">{e.region}</div>
                      <Badge variant={STATUS_VARIANT[e.status]} className="mt-1 text-[9px]">
                        {STATUS_LABEL[e.status]}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {/* 监测终端 */}
              {terms.slice(0, 3).map((t, i) => {
                const x = [6, 50, 94][i];
                return (
                  <div key={t.id} className="absolute top-[220px]" style={{ left: `${x}%`, transform: "translateX(-50%)" }}>
                    <div className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-center backdrop-blur">
                      <div className="text-sm">📡</div>
                      <div className="text-[10px] font-semibold text-foreground">{t.point}</div>
                      <div className="text-[9px] text-muted-foreground">{t.reading}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===== 管理列表 ===== */}
        <div className="panel-cyber rounded-xl">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <div className="border-b border-primary/15 px-4 py-2.5">
            <h3 className="panel-title-bar flex items-center gap-2 text-sm font-semibold tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Box className="h-3.5 w-3.5" />
              </span>
              终端与节点管理
            </h3>
          </div>
          <div className="p-4">
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              <div className="text-[11px] font-semibold text-primary">碳排监测终端</div>
              {terms.map((t) => (
                <div key={t.id} className="rounded border border-border/60 bg-card/60 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">
                      <Radio className="mr-1 inline h-3 w-3 text-cyan-500" /> {t.point}
                    </span>
                    <Badge variant={STATUS_VARIANT_M[t.status]} className="text-[10px]">
                      {t.status === "online" ? "在线" : t.status === "warning" ? "警告" : "离线"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{t.no} · 采样率 1kHz · {t.reading}</div>
                </div>
              ))}
              <div className="mt-3 text-[11px] font-semibold text-primary">边缘计算节点</div>
              {edges.map((e) => (
                <div key={e.id} className="rounded border border-border/60 bg-card/60 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">
                      <Cpu className="mr-1 inline h-3 w-3 text-blue-500" /> {e.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      NPU: {e.npu}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {e.region} · 推理{e.latency} · {e.power}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 同步策略 */}
      <div className="panel-cyber rounded-xl">
        <span className="corner-decor tl" />
        <span className="corner-decor tr" />
        <span className="corner-decor bl" />
        <span className="corner-decor br" />
        <div className="border-b border-primary/15 px-4 py-2.5">
          <h3 className="panel-title-bar flex items-center gap-2 text-sm font-semibold tracking-wider">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-warning/15 text-warning">
              ⚡
            </span>
            数据同步策略
          </h3>
        </div>
        <div className="p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">同步模式</Label>
              <Select value={syncMode} onValueChange={setSyncMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">实时同步 (WebSocket)</SelectItem>
                  <SelectItem value="batch">批量同步 (每5分钟)</SelectItem>
                  <SelectItem value="event">事件驱动同步</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">模型下发策略</Label>
              <Select value={deploy} onValueChange={setDeploy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">自动下发 (精度触发)</SelectItem>
                  <SelectItem value="manual">手动审批下发</SelectItem>
                  <SelectItem value="schedule">定时批量下发</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">边端推理优先级</Label>
              <Select value={prio} onValueChange={setPrio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="latency">低延迟优先</SelectItem>
                  <SelectItem value="accuracy">精度优先</SelectItem>
                  <SelectItem value="energy">能耗优先</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* 上下步按钮 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← 上一步</Button>
        <Button variant="gradient" onClick={onGoStep3}>下一步 · 模型自适应迁移 →</Button>
      </div>

      {/* 添加终端对话框（行内） */}
      {showAddTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg">
            <h3 className="mb-3 text-sm font-semibold">📡 添加碳排监测终端</h3>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">终端名称</Label>
                <Input value={termName} onChange={(e) => setTermName(e.target.value)} placeholder="例如: CO₂监测终端 #4" />
              </div>
              <div>
                <Label className="text-xs">终端类型</Label>
                <Select value={termType} onValueChange={setTermType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="co2">CO₂监测</SelectItem>
                    <SelectItem value="temp">温度监测</SelectItem>
                    <SelectItem value="flow">流量监测</SelectItem>
                    <SelectItem value="multi">多参数综合</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">部署位置</Label>
                <Select value={termLocation} onValueChange={setTermLocation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["华北", "华东", "华南", "西南", "西北"].map((r) => (
                      <SelectItem key={r} value={r}>{r}区域</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddTerm(false)}>取消</Button>
              <Button size="sm" onClick={addTerm}>确认添加</Button>
            </div>
          </div>
        </div>
      )}

      {showAddEdge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg">
            <h3 className="mb-3 text-sm font-semibold">🔷 添加边缘计算节点</h3>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">节点名称</Label>
                <Input value={edgeName} onChange={(e) => setEdgeName(e.target.value)} placeholder="例如: 边缘节点 D" />
              </div>
              <div>
                <Label className="text-xs">部署区域</Label>
                <Select value={edgeRegion} onValueChange={setEdgeRegion}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["华北", "华东", "华南", "西南", "西北"].map((r) => (
                      <SelectItem key={r} value={r}>{r}区域</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">硬件配置</Label>
                <Select value={edgeHardware} onValueChange={setEdgeHardware}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mlu370">寒武纪 MLU370</SelectItem>
                    <SelectItem value="jetson">NVIDIA Jetson Orin</SelectItem>
                    <SelectItem value="atlas">华为 Atlas 200</SelectItem>
                    <SelectItem value="k230">算能 K230</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddEdge(false)}>取消</Button>
              <Button size="sm" onClick={addEdge}>确认添加</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
