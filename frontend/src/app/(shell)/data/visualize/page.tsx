"use client";

/**
 * 数据可视化 —— 数据分析工作台。
 * 默认预载「挥发窑核心工况」分析面板（趋势/直方图/统计摘要），无需选择即有图表；
 * 左侧查询台选择点位后，主图区切换为自定义序列对比。
 */
import * as React from "react";
import ReactECharts from "echarts-for-react";
import { LineChart } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { QueryPanel } from "@/components/data/query-panel";
import { SeriesChart } from "@/components/data/series-chart";
import { RealtimePanel } from "@/components/data/realtime-panel";
import type { DataPoint, QueryPayload, TimeSeriesResult } from "@/types/api";

/** 默认自动分析的核心工况点位（按名称匹配 1 号挥发窑现场数据） */
const AUTO_POINTS = [
  "回转窑窑尾温度",
  "CO浓度",
  "圆盘给料机控制反馈频率",
  "挥发窑炉顶料位",
];

const CHART_BASE = {
  grid: { left: 48, right: 14, top: 26, bottom: 24 },
  tooltip: { trigger: "axis" },
  xAxis: {
    type: "category",
    axisLabel: { fontSize: 9, color: "#64748b" },
    axisLine: { lineStyle: { color: "#cbd5e1" } },
  },
  yAxis: {
    type: "value",
    axisLabel: { fontSize: 9, color: "#64748b" },
    splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
  },
};

const PALETTE = ["#0d9488", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#059669"];

function fmtTime(t: string): string {
  return t?.slice(5, 16) ?? "";
}

/* ================================ Page ================================ */

export default function VisualizePage() {
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<TimeSeriesResult[]>([]);
  const [pointNames, setPointNames] = React.useState<Record<number, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const [realtimeEnabled, setRealtimeEnabled] = React.useState(false);
  const [realtimePointIds, setRealtimePointIds] = React.useState<number[]>([]);
  const [realtimePoints, setRealtimePoints] = React.useState<DataPoint[]>([]);

  // ===== 自动分析区：核心工况（默认预载） =====
  const [autoSeries, setAutoSeries] = React.useState<
    { id: number; name: string; unit: string; points: { t: string; v: number | null }[] }[]
  >([]);
  const [autoLoading, setAutoLoading] = React.useState(true);
  const [histPointId, setHistPointId] = React.useState<number | null>(null);
  const [allPoints, setAllPoints] = React.useState<DataPoint[]>([]);

  async function handleQuery(payload: QueryPayload, points: DataPoint[]) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.data.query(payload);
      setResults(data);
      const next: Record<number, string> = {};
      points.forEach((p) => {
        next[p.id] = `${p.name}${p.unit ? ` (${p.unit})` : ""}`;
      });
      setPointNames(next);
      if (data.every((r) => r.series.length === 0)) {
        toast.info("查询结果为空，可能范围内无数据");
      } else {
        const total = data.reduce((acc, r) => acc + r.series.length, 0);
        toast.success(`已加载 ${data.length} 条序列，共 ${total} 个点`);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "查询失败";
      setError(msg);
      toast.error(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleRealtimeChange(enabled: boolean, pointIds: number[]) {
    setRealtimeEnabled(enabled);
    setRealtimePointIds(pointIds);
    if (enabled) {
      (async () => {
        try {
          const res = await api.dataPoints.list({ pageSize: 200 });
          const list = Array.isArray(res) ? res : (res.list ?? []);
          setRealtimePoints(list.filter((p) => pointIds.includes(p.id)));
        } catch {
          // silent — names will fall back to IDs
        }
      })();
      toast.success("实时模式已开启");
    } else {
      toast.info("实时模式已关闭");
    }
  }

  // 自动分析：加载点位并预查核心工况（1 小时聚合，全量数据）
  React.useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const res = await api.dataPoints.list({ pageSize: 300 });
        const pts: DataPoint[] = res.list;
        if (stopped) return;
        setAllPoints(pts);
        const auto = AUTO_POINTS.map((n) => pts.find((p) => p.name === n)).filter(
          Boolean
        ) as DataPoint[];
        if (auto.length === 0) {
          setAutoLoading(false);
          return;
        }
        setHistPointId(auto[0].id);
        const data = await api.data.query({
          pointIds: auto.map((p) => p.id),
          start: new Date(2026, 0, 1).toISOString(),
          end: new Date().toISOString(),
          interval: "1 hour",
          agg: "AVG",
        });
        if (stopped) return;
        setAutoSeries(
          data.map((r) => {
            const p = auto.find((x) => x.id === r.pointId)!;
            return { id: r.pointId, name: p.name, unit: p.unit ?? "", points: r.series };
          })
        );
      } catch {
        // 静默——面板显示空态
      } finally {
        if (!stopped) setAutoLoading(false);
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  // ===== 自动分析派生数据 =====
  const statsRows = React.useMemo(() => {
    return autoSeries.map((s) => {
      const vs = s.points.map((p) => p.v).filter((v): v is number => v != null);
      const mean = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0;
      const std = vs.length
        ? Math.sqrt(vs.reduce((a, b) => a + (b - mean) ** 2, 0) / vs.length)
        : 0;
      return {
        id: s.id,
        name: s.name,
        unit: s.unit,
        count: vs.length,
        mean,
        max: vs.length ? Math.max(...vs) : 0,
        min: vs.length ? Math.min(...vs) : 0,
        std,
        last: vs.length ? vs[vs.length - 1] : 0,
      };
    });
  }, [autoSeries]);

  // 直方图：默认核心工况第一项，可切换
  const histOptions = React.useMemo(() => {
    const s = autoSeries.find((x) => x.id === histPointId) ?? autoSeries[0];
    if (!s) return null;
    const vs = s.points.map((p) => p.v).filter((v): v is number => v != null);
    if (vs.length < 5) return null;
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    const bins = 24;
    const w = (max - min) / bins || 1;
    const counts = new Array(bins).fill(0);
    vs.forEach((v) => {
      const i = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / w)));
      counts[i]++;
    });
    return {
      grid: { left: 42, right: 12, top: 24, bottom: 40 },
      tooltip: {
        trigger: "axis",
        formatter: (ps: unknown[]) => {
          const p0 = ps[0] as { dataIndex: number };
          const lo = (min + p0.dataIndex * w).toFixed(2);
          const hi = (min + (p0.dataIndex + 1) * w).toFixed(2);
          return `${lo} ~ ${hi}<br/>频数：${counts[p0.dataIndex]}`;
        },
      },
      xAxis: {
        type: "category",
        data: counts.map((_, i) => (min + i * w).toFixed(1)),
        axisLabel: { fontSize: 9, color: "#64748b", interval: 5 },
        name: s.unit,
        nameTextStyle: { fontSize: 9, color: "#94a3b8" },
      },
      yAxis: {
        type: "value",
        name: "频数",
        nameTextStyle: { fontSize: 9, color: "#94a3b8" },
        axisLabel: { fontSize: 9, color: "#64748b" },
        splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
      },
      series: [
        {
          type: "bar",
          data: counts,
          itemStyle: { color: "#0d9488", opacity: 0.85 },
          barCategoryGap: "12%",
        },
      ],
    };
  }, [autoSeries, histPointId]);

  // 核心工况趋势：多序列
  const trendOption = React.useMemo(() => {
    if (autoSeries.length === 0) return null;
    // 以最长的序列为时间轴基准
    const base = [...autoSeries].sort((a, b) => b.points.length - a.points.length)[0];
    return {
      ...CHART_BASE,
      legend: {
        top: 0,
        left: "center",
        itemWidth: 10,
        itemHeight: 3,
        textStyle: { fontSize: 10, color: "#475569" },
      },
      xAxis: {
        ...CHART_BASE.xAxis,
        data: base.points.map((p) => fmtTime(p.t)),
      },
      series: autoSeries.map((s, i) => ({
        name: s.name,
        type: "line",
        data: s.points.map((p) => p.v),
        showSymbol: false,
        lineStyle: { width: 1.6, color: PALETTE[i % PALETTE.length] },
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
    };
  }, [autoSeries]);

  const timeSpan = React.useMemo(() => {
    if (autoSeries.length === 0) return null;
    const all = autoSeries.flatMap((s) => s.points.map((p) => p.t));
    if (all.length === 0) return null;
    all.sort();
    return { from: all[0], to: all[all.length - 1] };
  }, [autoSeries]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="数据管理 · Visualization"
        icon={LineChart}
        title="数据可视化"
        description="多点位时序对比 · 聚合统计 · 实时推送"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <QueryPanel
          onQuery={handleQuery}
          loading={loading}
          onRealtimeChange={handleRealtimeChange}
          realtimeEnabled={realtimeEnabled}
        />

        <div className="flex flex-col gap-4">
          {/* ===== 05 核心工况趋势（默认视图：自定义查询后切换为序列对比） ===== */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="panel-title-bar text-xs font-semibold">
                <span className="font-cyber text-muted-foreground/70">05</span> 核心工况趋势
                <span className="ml-1 font-cyber text-[10px] font-normal uppercase text-muted-foreground/70">
                  {results.length > 0 ? "custom query" : "kiln auto · 1h avg"}
                </span>
              </h3>
              {results.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setResults([])}
                >
                  返回默认视图
                </Button>
              )}
            </div>
            {results.length > 0 ? (
              <SeriesChart loading={loading} results={results} pointNames={pointNames} error={error} />
            ) : trendOption ? (
              <div className="border border-border bg-card p-2">
                <ReactECharts
                  option={trendOption}
                  style={{ height: 320 }}
                  notMerge
                  lazyUpdate
                />
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                {autoLoading ? "正在加载核心工况…" : "暂无自动分析数据"}
              </div>
            )}
          </section>

          {/* ===== 06 统计摘要 + 直方图 ===== */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="panel-title-bar mb-2 text-xs font-semibold">
                <span className="font-cyber text-muted-foreground/70">06a</span> 统计摘要
                <span className="ml-1 font-cyber text-[10px] font-normal uppercase text-muted-foreground/70">
                  statistics · 1h avg
                </span>
              </h3>
              <div className="overflow-x-auto border border-border bg-card">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2.5 py-2">工况</th>
                      <th className="px-2.5 py-2 text-right">均值</th>
                      <th className="px-2.5 py-2 text-right">最大</th>
                      <th className="px-2.5 py-2 text-right">最小</th>
                      <th className="px-2.5 py-2 text-right">σ</th>
                      <th className="px-2.5 py-2 text-right">末值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsRows.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setHistPointId(r.id)}
                        className={`cursor-pointer border-b border-border/50 transition-colors even:bg-muted/20 hover:bg-accent/60 ${
                          histPointId === r.id ? "bg-accent" : ""
                        }`}
                      >
                        <td className="max-w-[120px] truncate px-2.5 py-1.5 font-medium">
                          {r.name}
                          {r.unit ? <span className="ml-1 text-[9px] text-muted-foreground">{r.unit}</span> : null}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-cyber tabular-nums">{r.mean.toFixed(2)}</td>
                        <td className="px-2.5 py-1.5 text-right font-cyber tabular-nums">{r.max.toFixed(2)}</td>
                        <td className="px-2.5 py-1.5 text-right font-cyber tabular-nums">{r.min.toFixed(2)}</td>
                        <td className="px-2.5 py-1.5 text-right font-cyber tabular-nums">{r.std.toFixed(2)}</td>
                        <td className="px-2.5 py-1.5 text-right font-cyber tabular-nums text-primary">
                          {r.last.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {statsRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2.5 py-6 text-center text-muted-foreground">
                          自动分析加载中…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {timeSpan && (
                <p className="mt-1.5 font-cyber text-[10px] text-muted-foreground">
                  SPAN {timeSpan.from?.slice(0, 10)} → {timeSpan.to?.slice(0, 10)} · AGG 1h AVG · N=
                  {autoSeries.reduce((a, s) => a + s.points.length, 0).toLocaleString()}
                </p>
              )}
              {/* 点击行切换直方图点位 */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {autoSeries.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setHistPointId(s.id)}
                    className={`rounded-sm border px-2 py-0.5 text-[10px] transition-colors ${
                      histPointId === s.id
                        ? "border-primary bg-accent text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    直方图：{s.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="panel-title-bar mb-2 text-xs font-semibold">
                <span className="font-cyber text-muted-foreground/70">06b</span> 分布直方图
                <span className="ml-1 font-cyber text-[10px] font-normal uppercase text-muted-foreground/70">
                  histogram · 24 bins
                </span>
              </h3>
              <div className="border border-border bg-card p-2">
                {histOptions ? (
                  <ReactECharts option={histOptions} style={{ height: 224 }} notMerge lazyUpdate />
                ) : (
                  <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
                    数据加载中…
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ===== 07 实时推送 ===== */}
          <section>
            <h3 className="panel-title-bar mb-2 text-xs font-semibold">
              <span className="font-cyber text-muted-foreground/70">07</span> 实时推送
              <span className="ml-1 font-cyber text-[10px] font-normal uppercase text-muted-foreground/70">
                websocket live
              </span>
            </h3>
            <RealtimePanel
              enabled={realtimeEnabled}
              pointIds={realtimePointIds}
              points={realtimePoints}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
