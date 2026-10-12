"use client";

import * as React from "react";
import { Loader2, Grid3x3 } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { QualityHeatmapCell } from "@/types/api";

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

interface QualityHeatmapProps {
  loading: boolean;
  data: QualityHeatmapCell[];
  emptyTitle?: string;
}

export function QualityHeatmap({
  loading,
  data,
  emptyTitle = "请选择数据源",
}: QualityHeatmapProps) {
  const hasData = data.length > 0;

  const option = React.useMemo(() => {
    if (!hasData) return null;
    const yLabels = Array.from(new Set(data.map((c) => c.pointName)));
    const xLabels = Array.from({ length: 24 }, (_, i) => i);
    const series = data.map((c) => [
      xLabels.indexOf(c.hour),
      yLabels.indexOf(c.pointName),
      c.rate,
    ]);
    return {
      tooltip: {
        position: "top",
        formatter: (params: {
          value: [number, number, number];
          data: { name?: string };
        }) => {
          const [h, , rate] = params.value;
          return `${yLabels[params.value[1]]}<br/>${String(h).padStart(
            2,
            "0"
          )}:00 · 可达率 <b>${(rate * 100).toFixed(1)}%</b>`;
        },
      },
      grid: { left: 130, right: 24, top: 12, bottom: 36 },
      xAxis: {
        type: "category",
        data: xLabels.map((h) => `${String(h).padStart(2, "0")}时`),
        axisLabel: { fontSize: 10, color: "#64748b" },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category",
        data: yLabels,
        axisLabel: { fontSize: 10, color: "#64748b" },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisTick: { show: false },
      },
      visualMap: {
        min: 0,
        max: 1,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        textStyle: { fontSize: 10, color: "#64748b" },
        inRange: {
          color: [
            "#ef4444",
            "#f59e0b",
            "#facc15",
            "#84cc16",
            "#10b981",
          ],
        },
        text: ["优", "差"],
      },
      series: [
        {
          name: "可达率",
          type: "heatmap",
          data: series,
          emphasis: {
            itemStyle: {
              borderColor: "#0f172a",
              borderWidth: 1,
            },
          },
          progressive: 1000,
          animation: false,
        },
      ],
    };
  }, [hasData, data]);

  return (
    <div
      className="flex w-full items-center justify-center rounded-md border border-border bg-card p-3"
      style={{
        height: hasData && option
          ? `${Math.max(360, 140 + 30 * new Set(data.map((c) => c.pointName)).size)}px`
          : "400px",
      }}
    >
      {loading ? (
        <div className="w-full space-y-3 p-3">
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
          icon={Grid3x3}
          title={emptyTitle}
          description="热力图基于最近 24 小时各点位每小时的可达率"
        />
      )}
    </div>
  );
}
