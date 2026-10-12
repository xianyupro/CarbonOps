"use client";

/**
 * 云边端 — 碳排监测仪表面板。
 * 列表 + 地理分布 + 终端分布柱图。
 */
import * as React from "react";
import { Loader2, MapPin, Plus, Radio, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MONITOR_INSTRUMENTS_INITIAL } from "@/mock/cloud-edge";
import type { MonitorInstrument } from "@/types/cloud-edge";

const STATUS_VARIANT: Record<MonitorInstrument["status"], "success" | "warning" | "muted"> = {
  online: "success",
  warning: "warning",
  offline: "muted",
};

const ReactECharts = React.lazy(async () => {
  const mod = await import("echarts-for-react");
  return { default: mod.default };
});

function ChartLoading() {
  return (
    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

export function MonitorInstrumentPanel() {
  const [instruments, setInstruments] = React.useState<MonitorInstrument[]>(MONITOR_INSTRUMENTS_INITIAL);
  const [search, setSearch] = React.useState("");
  const [showAdd, setShowAdd] = React.useState(false);
  const [newPoint, setNewPoint] = React.useState("");
  const [newReading, setNewReading] = React.useState("");

  const filtered = instruments.filter((m) => !search || m.point.includes(search) || m.no.includes(search));

  /* 区域统计 */
  const byRegion = React.useMemo(() => {
    const map = new Map<string, number>();
    instruments.forEach((m, i) => {
      const regions = ["华北", "华东", "华南", "西南", "西北", "东北"];
      const r = regions[i % regions.length];
      map.set(r, (map.get(r) ?? 0) + 1);
    });
    return Array.from(map.entries());
  }, [instruments]);

  /* 状态分布 */
  const statusOpt = {
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { color: "#64748b", fontSize: 11 } },
    series: [
      {
        type: "pie",
        radius: ["45%", "68%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data: [
          { name: "在线", value: instruments.filter((m) => m.status === "online").length, itemStyle: { color: "#10b981" } },
          { name: "警告", value: instruments.filter((m) => m.status === "warning").length, itemStyle: { color: "#f59e0b" } },
          { name: "离线", value: instruments.filter((m) => m.status === "offline").length, itemStyle: { color: "#64748b" } },
        ],
      },
    ],
  };

  const regionOpt = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 36, right: 16, top: 16, bottom: 28 },
    xAxis: {
      type: "category",
      data: byRegion.map(([r]) => r),
      axisLabel: { color: "#64748b", fontSize: 10 },
      axisLine: { lineStyle: { color: "#94a3b8" } },
    },
    yAxis: { type: "value", axisLabel: { color: "#64748b", fontSize: 10 }, axisLine: { lineStyle: { color: "#94a3b8" } } },
    series: [
      {
        type: "bar",
        data: byRegion.map(([, v]) => v),
        itemStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: "#10b981" },
            { offset: 1, color: "#10b98155" },
          ]},
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: "40%",
      },
    ],
  };

  const addTerm = () => {
    if (!newPoint) return;
    setInstruments([
      {
        id: "t-" + Date.now(),
        no: `CM-${(instruments.length + 1).toString().padStart(3, "0")}`,
        point: newPoint,
        reading: newReading || "0",
        status: "online",
      },
      ...instruments,
    ]);
    setShowAdd(false);
    setNewPoint("");
    setNewReading("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="muted">监测仪表</Badge>
          <span className="text-xs text-muted-foreground">共 {instruments.length} 台 · 在线 {instruments.filter((m) => m.status === "online").length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索仪表号 / 点位…"
              className="h-8 w-56 pl-9 text-xs"
            />
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-3 w-3" /> 添加终端
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Radio className="h-3.5 w-3.5" />
              </span>
              监测仪表列表
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto p-0">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="w-24">仪表编号</TableHead>
                  <TableHead>监测点位</TableHead>
                  <TableHead className="text-right">实时读数</TableHead>
                  <TableHead className="w-24">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-[11px]">{m.no}</TableCell>
                    <TableCell>{m.point}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.reading}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[m.status]} className="text-[10px]">
                        {m.status === "online" ? "在线" : m.status === "warning" ? "警告" : "离线"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/15 text-purple-500">🥧</span>
                仪表状态分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <React.Suspense fallback={<ChartLoading />}>
                <ReactECharts option={statusOpt} theme="cyber" style={{ height: 220 }} />
              </React.Suspense>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-500">
                  <MapPin className="h-3.5 w-3.5" />
                </span>
                仪表地理分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <React.Suspense fallback={<ChartLoading />}>
                <ReactECharts option={regionOpt} theme="cyber" style={{ height: 220 }} />
              </React.Suspense>
            </CardContent>
          </Card>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold">📡 添加碳排监测终端</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs">监测点位</label>
                <Input value={newPoint} onChange={(e) => setNewPoint(e.target.value)} placeholder="如: 焦炉烟气 CO₂" />
              </div>
              <div>
                <label className="text-xs">初始读数</label>
                <Input value={newReading} onChange={(e) => setNewReading(e.target.value)} placeholder="如: 8.2 t/h" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>取消</Button>
              <Button size="sm" onClick={addTerm}>确认添加</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonitorInstrumentPanel;
