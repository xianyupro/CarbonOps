"use client";

import * as React from "react";
import { LineChart } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { ApiError, api } from "@/lib/api";
import { QueryPanel } from "@/components/data/query-panel";
import { SeriesChart } from "@/components/data/series-chart";
import { RealtimePanel } from "@/components/data/realtime-panel";
import type { DataPoint, QueryPayload, TimeSeriesResult } from "@/types/api";

export default function VisualizePage() {
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<TimeSeriesResult[]>([]);
  const [pointNames, setPointNames] = React.useState<Record<number, string>>(
    {}
  );
  const [error, setError] = React.useState<string | null>(null);

  const [realtimeEnabled, setRealtimeEnabled] = React.useState(false);
  const [realtimePointIds, setRealtimePointIds] = React.useState<number[]>([]);
  const [realtimePoints, setRealtimePoints] = React.useState<DataPoint[]>([]);

  async function handleQuery(payload: QueryPayload, points: DataPoint[]) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.data.query(payload);
      setResults(data);
      const next: Record<number, string> = {};
      points.forEach((p) => {
        next[p.id] = `${p.name}${
          p.unit ? ` (${p.unit})` : ""
        }`;
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
      // Pull point metadata for display names / units.
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

  return (
    <div className="flex flex-col gap-6">
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

        <div className="flex flex-col gap-3">
          <SeriesChart
            loading={loading}
            results={results}
            pointNames={pointNames}
            error={error}
          />

          <RealtimePanel
            enabled={realtimeEnabled}
            pointIds={realtimePointIds}
            points={realtimePoints}
          />
        </div>
      </div>
    </div>
  );
}
