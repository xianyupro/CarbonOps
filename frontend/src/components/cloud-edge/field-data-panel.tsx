"use client";

/**
 * 云边端 — 现场实施数据面板。
 * 两级视图：现场站点卡片网格 → 单个现场详情（CO₂/能耗/传感器/采集记录）。
 */
import * as React from "react";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Cpu,
  Database,
  Factory,
  Flame,
  Gauge,
  Loader2,
  MapPin,
  Radio,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { FIELD_SITES } from "@/mock/cloud-edge";
import type { FieldSite } from "@/types/cloud-edge";

const STATUS_VARIANT: Record<FieldSite["status"], "success" | "warning" | "muted"> = {
  online: "success",
  warning: "warning",
  offline: "muted",
};
const STATUS_LABEL = { online: "在线", warning: "警告", offline: "离线" };

const ReactECharts = React.lazy(async () => {
  const mod = await import("echarts-for-react");
  return { default: mod.default };
});

function ChartLoading() {
  return <div className="flex h-[200px] items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
}

/* 单个现场详情 */
function FieldSiteDetail({ site, onBack }: { site: FieldSite; onBack: () => void }) {
  /* 模拟 CO₂ 趋势 */
  const co2Opt = React.useMemo(() => {
    const now = Date.now();
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 36, right: 12, top: 16, bottom: 24 },
      xAxis: {
        type: "category",
        data: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`),
        axisLabel: { color: "#64748b", fontSize: 9 },
        axisLine: { lineStyle: { color: "#94a3b8" } },
      },
      yAxis: { type: "value", axisLabel: { color: "#64748b", fontSize: 9 }, axisLine: { lineStyle: { color: "#94a3b8" } } },
      series: [
        {
          type: "line",
          data: Array.from({ length: 24 }, (_, i) =>
            Number((Number(site.stats.co2Daily) * 0.04 + Math.sin(i / 2) * 0.5 + Math.random()).toFixed(2))
          ),
          smooth: true,
          symbol: "none",
          lineStyle: { color: "#10b981", width: 2 },
          areaStyle: { color: "rgba(16,185,129,0.2)" },
        },
      ],
    };
  }, [site]);

  const paramsOpt = {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, textStyle: { color: "#64748b", fontSize: 10 } },
    grid: { left: 36, right: 12, top: 16, bottom: 28 },
    xAxis: {
      type: "category",
      data: ["温度", "压力", "流量", "O₂", "CO", "NOx", "SO₂"],
      axisLabel: { color: "#64748b", fontSize: 10 },
      axisLine: { lineStyle: { color: "#94a3b8" } },
    },
    yAxis: { type: "value", axisLabel: { color: "#64748b", fontSize: 10 }, axisLine: { lineStyle: { color: "#94a3b8" } } },
    series: [
      {
        name: "当前值",
        type: "bar",
        data: [320, 1.2, 8.2, 8, 0.3, 60, 25],
        itemStyle: { color: "#3b82f6", borderRadius: [4, 4, 0, 0] },
        barWidth: "40%",
      },
    ],
  };

  const energyOpt = {
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        radius: "75%",
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14, color: [[0.6, "#10b981"], [0.9, "#f59e0b"], [1, "#ef4444"]] } },
        axisTick: { show: false },
        splitLine: { length: 6, lineStyle: { width: 2, color: "#94a3b8" } },
        pointer: { width: 4 },
        axisLabel: { distance: 14, color: "#64748b", fontSize: 9 },
        title: { offsetCenter: [0, "70%"], color: "#64748b", fontSize: 11 },
        detail: {
          offsetCenter: [0, "5%"],
          fontSize: 16,
          color: "#10b981",
          formatter: "{value}%",
        },
        data: [{ value: Number(site.stats.energyRate.replace("%", "")), name: site.stats.energyRate }],
      },
    ],
  };

  /* 传感器列表 */
  const sensors = React.useMemo(() => {
    return Array.from({ length: Math.min(site.stats.sensors, 12) }).map((_, i) => ({
      id: `${site.id}-S${i + 1}`,
      name: ["温度", "压力", "流量", "O₂", "CO₂", "CO", "NOx", "SO₂"][i % 8] + `传感器 #${i + 1}`,
      status: (i % 5 === 4 ? "warning" : "online") as "online" | "warning",
      value: ["320 ℃", "1.2 MPa", "8.2 m/s", "8.0%", "8.5 t/h", "0.3 ppm", "60 ppm", "25 ppm"][i % 8],
      lastSeen: `${(i + 1) * 2} 分钟前`,
    }));
  }, [site]);

  return (
    <div className="space-y-4">
      {/* 顶栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-3.5 w-3.5" /> 返回现场列表</Button>
        <span className="text-muted-foreground">|</span>
        <span className="text-base font-semibold tracking-tight">{site.name}</span>
        <Badge variant={STATUS_VARIANT[site.status]} className="text-[10px]">● {STATUS_LABEL[site.status]}</Badge>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {site.location}</span>
          <span>·</span>
          <span>{site.region}</span>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">日碳排放</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-bold tabular-nums">
            <Flame className="h-4 w-4 text-warning" /> {site.stats.co2Daily}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">综合减排率</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-success">{site.stats.reductionRate}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">能耗强度</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{site.stats.energyRate}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">在线传感器</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{site.stats.sensors}</p>
        </Card>
      </div>

      {/* 双图：CO₂ 趋势 + 关键参数 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">📈 CO₂ 排放趋势 (24h)</CardTitle></CardHeader>
          <CardContent>
            <React.Suspense fallback={<ChartLoading />}>
              <ReactECharts option={co2Opt} theme="cyber" style={{ height: 220 }} />
            </React.Suspense>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">🌡 关键参数监测</CardTitle></CardHeader>
          <CardContent>
            <React.Suspense fallback={<ChartLoading />}>
              <ReactECharts option={paramsOpt} theme="cyber" style={{ height: 220 }} />
            </React.Suspense>
          </CardContent>
        </Card>
      </div>

      {/* 三栏：传感器 / 能耗 / 采集记录 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Radio className="h-3.5 w-3.5" />
              </span>
              传感器状态
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[260px] overflow-y-auto p-0">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead className="text-right">值</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sensors.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{s.value}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "warning" ? "warning" : "success"} className="text-[10px]">
                        {s.status === "warning" ? "异常" : "正常"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-500">
                <Zap className="h-3.5 w-3.5" />
              </span>
              能耗统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <React.Suspense fallback={<ChartLoading />}>
              <ReactECharts option={energyOpt} theme="cyber" style={{ height: 220 }} />
            </React.Suspense>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-500">
                <Database className="h-3.5 w-3.5" />
              </span>
              数据采集记录
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p className="flex justify-between"><span>今日采集点位</span><span className="font-mono font-semibold text-foreground">{(site.stats.sensors * 1440).toLocaleString()}</span></p>
            <p className="flex justify-between"><span>采集成功率</span><span className="font-mono font-semibold text-success">99.2%</span></p>
            <p className="flex justify-between"><span>异常值比例</span><span className="font-mono font-semibold text-warning">0.6%</span></p>
            <p className="flex justify-between"><span>存储压缩比</span><span className="font-mono font-semibold text-foreground">3.4×</span></p>
            <p className="flex justify-between"><span>同步延迟</span><span className="font-mono font-semibold text-foreground">2.1 s</span></p>
            <p className="flex justify-between"><span>数据完整率</span><span className="font-mono font-semibold text-success">99.8%</span></p>
            <p className="flex justify-between"><span>最近同步</span><span className="text-foreground">刚刚</span></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* 主组件 */
export function FieldDataPanel() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = FIELD_SITES.find((s) => s.id === selectedId) || null;

  /* 概览统计 */
  const totalSites = FIELD_SITES.length;
  const online = FIELD_SITES.filter((s) => s.status === "online").length;
  const totalCo2 = FIELD_SITES.reduce((s, f) => s + Number(f.stats.co2Daily.replace(/[^\d.]/g, "") || 0), 0).toFixed(1);
  const avgReduction = (
    FIELD_SITES.map((s) => Number(s.stats.reductionRate.replace("%", ""))).reduce((a, b) => a + b, 0) /
    FIELD_SITES.length
  ).toFixed(1);

  if (selected) {
    return <FieldSiteDetail site={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* 概览 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">监测现场</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totalSites}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">在线</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-success">{online}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">日总碳排放</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totalCo2} t</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">平均减排</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-success">{avgReduction}%</p>
        </Card>
      </div>

      {/* 现场列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Factory className="h-3.5 w-3.5" />
            </span>
            📍 监测现场列表
          </CardTitle>
          <Badge variant="success" className="ml-auto text-[10px]">{online} 个在线</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELD_SITES.map((s) => (
              <Card
                key={s.id}
                className="cursor-pointer overflow-hidden border-border/60 transition hover:border-primary/40 hover:shadow-card"
                onClick={() => setSelectedId(s.id)}
              >
                <CardContent className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-xl shadow-sm">
                      {s.icon}
                    </div>
                    <Badge variant={STATUS_VARIANT[s.status]} className="text-[10px]">
                      ● {STATUS_LABEL[s.status]}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-semibold">{s.name}</h4>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    <MapPin className="mr-1 inline h-3 w-3" />
                    {s.location} · {s.region}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.scene}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border/40 pt-2 text-[11px]">
                    <div>
                      <p className="text-muted-foreground">碳排</p>
                      <p className="font-semibold tabular-nums">{s.stats.co2Daily}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">减排</p>
                      <p className="font-semibold tabular-nums text-success">{s.stats.reductionRate}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">传感器</p>
                      <p className="font-semibold tabular-nums">{s.stats.sensors}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end text-[11px] text-primary">
                    查看详情 <ChevronRight className="ml-1 h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FieldDataPanel;
