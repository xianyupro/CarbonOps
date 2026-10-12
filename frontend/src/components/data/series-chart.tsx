"use client";

import * as React from "react";
import { Loader2, LineChart as LineChartIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import type { TimeSeriesResult } from "@/types/api";

// ECharts must be client-only — load with React.lazy + Suspense instead of
// `next/dynamic` to avoid the dev-mode ESM chunk path resolution issue.
const ReactECharts = React.lazy(async () => {
  const mod = await import("echarts-for-react");
  return { default: mod.default };
});

function ChartLoading() {
  return (
    <div className="flex h-[420px] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

interface SeriesChartProps {
  loading: boolean;
  results: TimeSeriesResult[];
  pointNames: Record<number, string>;
  emptyTitle?: string;
  error?: string | null;
}

export function SeriesChart({
  loading,
  results,
  pointNames,
  emptyTitle = "请选择点位并查询",
  error,
}: SeriesChartProps) {
  const hasData =
    !error && results.length > 0 && results.some((r) => r.series.length > 0);

  const option = React.useMemo(() => {
    if (!hasData) return null;
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
      },
      legend: {
        top: 0,
        type: "scroll",
        textStyle: { fontSize: 11 },
      },
      grid: { left: 56, right: 24, top: 36, bottom: 56 },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: "#94a3b8" } },
        axisLabel: { fontSize: 10, color: "#64748b" },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { fontSize: 10, color: "#64748b" },
        splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
      },
      dataZoom: [
        { type: "inside" },
        {
          type: "slider",
          height: 18,
          bottom: 12,
          borderColor: "#cbd5e1",
          fillerColor: "rgba(16, 185, 129, 0.12)",
          handleStyle: { color: "#10b981" },
        },
      ],
      series: results.map((r, i) => ({
        name: pointNames[r.pointId] ?? `点位 ${r.pointId}`,
        type: "line",
        smooth: true,
        showSymbol: false,
        symbol: "circle",
        symbolSize: 5,
        sampling: "lttb" as const,
        lineStyle: { width: 1.6 },
        emphasis: { focus: "series" },
        connectNulls: false,
        data: r.series.map((p) => [p.t, p.v]),
        itemStyle: { opacity: 0 },
      })),
      color: [
        "#10b981",
        "#3b82f6",
        "#f59e0b",
        "#ef4444",
        "#8b5cf6",
        "#06b6d4",
        "#ec4899",
        "#84cc16",
      ],
    };
  }, [hasData, results, pointNames]);

  return (
    <div className="relative flex h-[460px] w-full items-center justify-center rounded-md border border-border bg-card p-3">
      {loading ? (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          查询中…
        </div>
      ) : error ? (
        <EmptyState
          icon={LineChartIcon}
          title="查询失败"
          description={error}
        />
      ) : hasData && option ? (
        <React.Suspense fallback={<ChartLoading />}>
          <ReactECharts
            option={option}
            notMerge
            lazyUpdate
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "canvas" }}
          />
        </React.Suspense>
      ) : (
        <EmptyState
          icon={LineChartIcon}
          title={emptyTitle}
          description="选择左侧点位，设置时间范围与聚合后点击「查询」"
        />
      )}
    </div>
  );
}
