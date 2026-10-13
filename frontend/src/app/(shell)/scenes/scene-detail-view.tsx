"use client";

/**
 * 场景详情 — 客户端交互组件。
 * 3D 数字孪生 + AI 一键分析 + 实时图表 + 关键参数雷达 + 设备表。
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Bot,
  Box,
  Cpu,
  Factory,
  Gauge,
  Leaf,
  Loader2,
  MapPin,
  PlayCircle,
  TrendingDown,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getSceneById } from "@/mock/cloud-edge";
import { DigitalTwinViewer } from "@/components/scenes/digital-twin-viewer";
import { AIAnalysisPanel } from "@/components/scenes/ai-analysis-panel";
import type { Scene } from "@/types/cloud-edge";

interface Props {
  sceneId: string;
}

/* ================== Recharts/ECharts 折线 + 雷达 ================== */
const ReactECharts = React.lazy(async () => {
  const mod = await import("echarts-for-react");
  return { default: mod.default };
});
function ChartLoading() {
  return (
    <div className="flex h-[260px] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

/* 生成模拟时序数据 */
function generateRealtimeData(seed = 1) {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now - (23 - i) * 3600_000);
    const v = 18 + Math.sin(i / 3 + seed) * 4 + Math.cos(i / 5) * 1.5;
    return [t.toISOString().slice(5, 16).replace("T", " "), Number(v.toFixed(2))] as [string, number];
  });
}

function RealtimeChart({ scene }: { scene: Scene }) {
  const seed = scene.name.length;
  const option = React.useMemo(() => {
    const data = generateRealtimeData(seed);
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 36, right: 16, top: 24, bottom: 28 },
      xAxis: {
        type: "category",
        axisLine: { lineStyle: { color: "#94a3b8" } },
        axisLabel: { color: "#64748b", fontSize: 10 },
        data: data.map((d) => d[0]),
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: "#94a3b8" } },
        axisLabel: { color: "#64748b", fontSize: 10 },
        name: "tCO₂/h",
        nameTextStyle: { color: "#64748b", fontSize: 10 },
      },
      series: [
        {
          name: "瞬时碳排放",
          type: "line",
          data: data.map((d) => d[1]),
          smooth: true,
          symbol: "none",
          lineStyle: { color: "#10b981", width: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(16, 185, 129, 0.3)" },
                { offset: 1, color: "rgba(16, 185, 129, 0)" },
              ],
            },
          },
        },
      ],
    };
  }, [seed]);
  return (
    <React.Suspense fallback={<ChartLoading />}>
      <ReactECharts option={option} theme="cyber" style={{ height: 240 }} />
    </React.Suspense>
  );
}

function ParamRadar({ scene }: { scene: Scene }) {
  const p = scene.params ?? { kilnTemp: 0, inletSpeed: 0, airRatio: 0, speed: 0, slagTemp: 0, exhaustTemp: 0, fuelFlow: 0 };
  const option = React.useMemo(() => {
    const norm = (v: number, max: number) => Math.min(100, (v / max) * 100);
    return {
      tooltip: {},
      radar: {
        indicator: [
          { name: "窑温", max: 100 },
          { name: "进料", max: 100 },
          { name: "风量", max: 100 },
          { name: "转速", max: 100 },
          { name: "渣温", max: 100 },
          { name: "排温", max: 100 },
          { name: "燃料", max: 100 },
        ],
        radius: "62%",
        splitArea: { areaStyle: { color: ["rgba(16,185,129,0.05)", "rgba(16,185,129,0.02)"] } },
        axisLine: { lineStyle: { color: "#94a3b8" } },
        splitLine: { lineStyle: { color: "#cbd5e1" } },
        name: { textStyle: { color: "#64748b", fontSize: 11 } },
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: [
                norm(p.kilnTemp, 1600),
                norm(p.inletSpeed, 8),
                norm(p.airRatio, 1),
                norm(p.speed, 100),
                norm(p.slagTemp, 1500),
                norm(p.exhaustTemp, 800),
                norm(p.fuelFlow, 15),
              ],
              name: "当前",
              areaStyle: { color: "rgba(16,185,129,0.35)" },
              lineStyle: { color: "#10b981", width: 2 },
              itemStyle: { color: "#10b981" },
            },
            {
              value: [80, 75, 80, 70, 80, 75, 75],
              name: "对标",
              areaStyle: { color: "rgba(245,158,11,0.18)" },
              lineStyle: { color: "#f59e0b", width: 1.5, type: "dashed" },
              itemStyle: { color: "#f59e0b" },
            },
          ],
        },
      ],
      legend: { bottom: 0, textStyle: { color: "#64748b", fontSize: 11 } },
    };
  }, [p]);
  return (
    <React.Suspense fallback={<ChartLoading />}>
      <ReactECharts option={option} theme="cyber" style={{ height: 240 }} />
    </React.Suspense>
  );
}

/* ================== 状态徽章 ================== */
const STATUS_BADGE: Record<Scene["status"], { label: string; variant: "success" | "warning" | "muted" }> = {
  running: { label: "● 运行中", variant: "success" },
  developing: { label: "● 建设中", variant: "warning" },
  stopped: { label: "● 已停止", variant: "muted" },
};

/* ================== 详情组件 ================== */

export function SceneDetailView({ sceneId }: Props) {
  const router = useRouter();
  const scene = getSceneById(sceneId);

  if (!scene) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground/50" />
        <div className="text-sm text-muted-foreground">场景不存在或已被删除</div>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          返回场景总览
        </Button>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[scene.status];
  const equipment = scene.equipment ?? [];

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* 顶栏 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="shadow-card-sm"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            返回驾驶舱
          </Button>
          <span className="text-muted-foreground">|</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-primary/5 text-lg shadow-sm">
            {scene.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight">{scene.name}</span>
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {scene.location}
              </span>
              <span>·</span>
              <span>{scene.industry}行业</span>
              <span>·</span>
              <span>{scene.id}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/cockpit/twin?scene=${scene.id}`)}>
            <Box className="mr-1 h-3.5 w-3.5" />
            在孪生中心打开
          </Button>
          <Button variant="outline" size="sm">
            <PlayCircle className="mr-1 h-3.5 w-3.5" />
            启动仿真
          </Button>
          <Button variant="gradient" size="sm">
            <Bot className="mr-1 h-3.5 w-3.5" />
            AI 一键分析
          </Button>
        </div>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <div className="panel-cyber hover-lift relative overflow-hidden rounded-xl p-4">
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">日碳排放</p>
              <p className="mt-1 font-cyber text-xl font-bold tabular-nums text-gradient-cool">{scene.co2Daily}</p>
            </div>
            <Leaf className="h-5 w-5 text-success" />
          </div>
        </div>
        <div className="panel-cyber hover-lift relative overflow-hidden rounded-xl p-4">
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">综合减排率</p>
              <p className="mt-1 font-cyber text-xl font-bold tabular-nums text-success text-glow-success">
                {scene.reduction == null ? "—" : `${scene.reduction}%`}
              </p>
            </div>
            <TrendingDown className="h-5 w-5 text-success" />
          </div>
        </div>
        <div className="panel-cyber hover-lift relative overflow-hidden rounded-xl p-4">
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">能效</p>
              <p className="mt-1 font-cyber text-xl font-bold tabular-nums text-gradient-cool">
                {scene.efficiency == null ? "—" : `${scene.efficiency}%`}
              </p>
            </div>
            <Zap className="h-5 w-5 text-warning" />
          </div>
        </div>
        <div className="panel-cyber hover-lift relative overflow-hidden rounded-xl p-4">
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">在线设备</p>
              <p className="mt-1 font-cyber text-xl font-bold tabular-nums text-gradient-cool">{scene.devices}</p>
            </div>
            <Cpu className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div className="panel-cyber hover-lift relative overflow-hidden rounded-xl p-4">
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">活跃告警</p>
              <p className={cn("mt-1 font-cyber text-xl font-bold tabular-nums", scene.alerts > 0 ? "text-warning text-glow-warning" : "text-muted-foreground")}>
                {scene.alerts}
              </p>
            </div>
            <AlertCircle className={cn("h-5 w-5", scene.alerts > 0 ? "text-warning" : "text-muted-foreground")} />
          </div>
        </div>
        <div className="panel-cyber hover-lift relative overflow-hidden rounded-xl p-4">
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">能耗强度</p>
              <p className="mt-1 font-cyber text-xl font-bold tabular-nums text-gradient-cool">{scene.energyRate}</p>
            </div>
            <Gauge className="h-5 w-5 text-cool" />
          </div>
        </div>
      </div>

      {/* 3D 孪生 + AI 分析 */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="panel-cyber overflow-hidden rounded-xl p-0 lg:col-span-3">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <div className="flex items-center justify-between border-b border-primary/15 px-4 py-2.5">
            <h3 className="panel-title-bar flex items-center gap-2 text-sm font-semibold tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Box className="h-3.5 w-3.5" />
              </span>
              数字孪生模型
            </h3>
            <span className="font-cyber rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
              3D 实时
            </span>
          </div>
          <DigitalTwinViewer scene={scene} />
        </div>
        <div className="lg:col-span-2">
          <AIAnalysisPanel scene={scene} />
        </div>
      </div>

      {/* 双图：实时碳排 + 雷达对标 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel-cyber rounded-xl p-5">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <h3 className="panel-title-bar mb-3 flex items-center gap-2 text-sm font-semibold tracking-wider">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-success/15 text-success">
              <Activity className="h-3.5 w-3.5" />
            </span>
            碳排放实时监测
          </h3>
          <RealtimeChart scene={scene} />
        </div>
        <div className="panel-cyber rounded-xl p-5">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <h3 className="panel-title-bar mb-3 flex items-center gap-2 text-sm font-semibold tracking-wider">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-warning/15 text-warning">
              <Gauge className="h-3.5 w-3.5" />
            </span>
            关键运行参数
          </h3>
          <ParamRadar scene={scene} />
        </div>
      </div>

      {/* 设备运行状态表 */}
      <div className="panel-cyber rounded-xl p-5">
        <span className="corner-decor tl" />
        <span className="corner-decor tr" />
        <span className="corner-decor bl" />
        <span className="corner-decor br" />
        <h3 className="panel-title-bar mb-3 flex items-center gap-2 text-sm font-semibold tracking-wider">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-400">
            <Factory className="h-3.5 w-3.5" />
          </span>
          设备运行状态
        </h3>
        <div className="-mx-5">
          {equipment.length === 0 ? (
            <div className="px-5 pb-4 text-sm text-muted-foreground">
              当前场景尚在建设中，暂无设备数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>设备名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">效率</TableHead>
                  <TableHead className="text-right">碳排放</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.map((eq) => (
                  <TableRow key={eq.name}>
                    <TableCell className="font-medium">{eq.name}</TableCell>
                    <TableCell className="text-muted-foreground">{eq.type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={eq.status === "运行正常" ? "success" : "warning"}
                        className="text-[10px]"
                      >
                        {eq.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-cyber tabular-nums">{eq.efficiency}</TableCell>
                    <TableCell className="text-right font-cyber tabular-nums">{eq.co2}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

export default SceneDetailView;
