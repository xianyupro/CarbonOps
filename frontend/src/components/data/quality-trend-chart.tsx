"use client";

import * as React from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { QualityTrendPoint } from "@/types/api";

const ReactECharts = React.lazy(async () => {
  const mod = await import("echarts-for-react");
  return { default: mod.default };
});

function ChartLoading() {
  return (
    <div className="flex h-[360px] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

interface QualityTrendChartProps {
  loading: boolean;
  data: QualityTrendPoint[];
  emptyTitle?: string;
}

export function QualityTrendChart({
  loading,
  data,
  emptyTitle = "请选择数据源",
}: QualityTrendChartProps) {
  const hasData = data.length > 0;

  const option = React.useMemo(() => {
    if (!hasData) return null;
    const series = [
      {
        name: "可达率",
        key: "accessRate" as const,
        color: "#10b981",
      },
      {
        name: "完整率",
        key: "completenessRate" as const,
        color: "#3b82f6",
      },
      {
        name: "异常率",
        key: "anomalyRate" as const,
        color: "#ef4444",
      },
    ];
    return {
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: number) => `${(v * 100).toFixed(1)}%`,
      },
      legend: { top: 0, textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 24, top: 36, bottom: 48 },
      xAxis: {
        type: "time",
        axisLabel: { fontSize: 10, color: "#64748b" },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 1,
        axisLabel: {
          fontSize: 10,
          color: "#64748b",
          formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
        },
        splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
      },
      dataZoom: [
        { type: "inside" },
        {
          type: "slider",
          height: 16,
          bottom: 12,
          borderColor: "#cbd5e1",
          fillerColor: "rgba(16, 185, 129, 0.12)",
        },
      ],
      series: series.map((s) => ({
        name: s.name,
        type: "line",
        smooth: true,
        showSymbol: false,
        sampling: "lttb" as const,
        lineStyle: { width: 1.6, color: s.color },
        itemStyle: { color: s.color },
        areaStyle: {
          opacity: 0.08,
          color: s.color,
        },
        data: data.map((p) => [p.recordedAt, p[s.key]]),
      })),
    };
  }, [hasData, data]);

  return (
    <div className="flex h-[400px] w-full items-center justify-center rounded-md border border-border bg-card p-3">
      {loading ? (
        <div className="w-full space-y-3 p-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : hasData && option ? (
        <React.Suspense fallback={<ChartLoading />}>
          <ReactECharts
            option={option}
            notMerge
            lazyUpdate
            style={{ height: "100%", width: "100%" }}
          />
        </React.Suspense>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title={emptyTitle}
          description="趋势数据来源于数据质量日志（每 5 分钟采样一次）"
        />
      )}
    </div>
  );
}
