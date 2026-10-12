"use client";

import * as React from "react";
import { Loader2, Factory, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { rateColorClass } from "@/lib/constants";
import { QualityTrendChart } from "@/components/data/quality-trend-chart";
import { QualityHeatmap } from "@/components/data/quality-heatmap";
import type {
  QualityHeatmapCell,
  QualityOverviewItem,
  QualityTrendPoint,
} from "@/types/api";

interface OverviewState {
  loading: boolean;
  error: string | null;
  items: QualityOverviewItem[];
}

export default function QualityPage() {
  const [overview, setOverview] = React.useState<OverviewState>({
    loading: true,
    error: null,
    items: [],
  });

  const [tab, setTab] = React.useState<"trend" | "heatmap">("trend");
  const [sourceId, setSourceId] = React.useState<number | "">("");
  const [hours, setHours] = React.useState(24);

  const [trendLoading, setTrendLoading] = React.useState(false);
  const [trendData, setTrendData] = React.useState<QualityTrendPoint[]>([]);

  const [heatmapLoading, setHeatmapLoading] = React.useState(false);
  const [heatmapData, setHeatmapData] = React.useState<QualityHeatmapCell[]>([]);

  // Load overview
  React.useEffect(() => {
    let active = true;
    setOverview((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      try {
        const data = await api.quality.overview();
        if (active) {
          setOverview({ loading: false, error: null, items: data });
          if (data.length > 0 && sourceId === "") {
            setSourceId(data[0].sourceId);
          }
        }
      } catch (err) {
        if (active) {
          setOverview({
            loading: false,
            error:
              err instanceof ApiError ? err.message : "加载数据质量概览失败",
            items: [],
          });
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load trend when source/hours change
  React.useEffect(() => {
    if (!sourceId) return;
    let active = true;
    setTrendLoading(true);
    (async () => {
      try {
        const data = await api.quality.trend(sourceId as number, hours);
        if (active) setTrendData(data);
      } catch {
        if (active) setTrendData([]);
      } finally {
        if (active) setTrendLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sourceId, hours]);

  // Load heatmap when source changes
  React.useEffect(() => {
    if (!sourceId) return;
    let active = true;
    setHeatmapLoading(true);
    (async () => {
      try {
        const data = await api.quality.heatmap(sourceId as number);
        if (active) setHeatmapData(data);
      } catch {
        if (active) setHeatmapData([]);
      } finally {
        if (active) setHeatmapLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sourceId]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="数据管理 · Quality"
        icon={ShieldCheck}
        title="数据质量"
        description="采集可达率 · 数据完整率 · 异常率监控"
      />

      {/* Overview cards */}
      {overview.loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : overview.error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <Loader2 className="h-4 w-4" />
            {overview.error}
          </CardContent>
        </Card>
      ) : overview.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="暂无质量数据"
          description="数据源接入后将自动采集质量指标"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {overview.items.map((item) => {
            const isActive = item.sourceId === sourceId;
            return (
              <Card
                key={item.sourceId}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isActive ? "border-primary ring-1 ring-primary/30" : ""
                }`}
                onClick={() => setSourceId(item.sourceId)}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {item.sourceName}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Factory className="h-3 w-3" />
                        {item.industry}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 font-mono">
                      {item.pointCount} 点
                    </Badge>
                  </div>
                  <RateRow label="可达率" rate={item.accessRate} />
                  <RateRow label="完整率" rate={item.completenessRate} />
                  <RateRow label="异常率" rate={item.anomalyRate} inverse />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Trend / heatmap switch */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "trend" | "heatmap")}>
            <TabsList>
              <TabsTrigger value="trend">质量趋势</TabsTrigger>
              <TabsTrigger value="heatmap">异常热力图</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Select
              value={String(sourceId)}
              onValueChange={(v) => setSourceId(v ? Number(v) : "")}
            >
              <SelectTrigger className="w-[220px]" aria-label="数据源">
                <SelectValue placeholder="选择数据源" />
              </SelectTrigger>
              <SelectContent>
                {overview.items.map((s) => (
                  <SelectItem key={s.sourceId} value={String(s.sourceId)}>
                    {s.sourceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {tab === "trend" ? (
              <Select
                value={String(hours)}
                onValueChange={(v) => setHours(Number(v))}
              >
                <SelectTrigger className="w-[120px]" aria-label="时间范围">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">近 6 小时</SelectItem>
                  <SelectItem value="24">近 24 小时</SelectItem>
                  <SelectItem value="72">近 3 天</SelectItem>
                  <SelectItem value="168">近 7 天</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {tab === "trend" ? (
        <QualityTrendChart
          loading={trendLoading}
          data={trendData}
          emptyTitle={sourceId ? "无趋势数据" : "请选择数据源"}
        />
      ) : (
        <QualityHeatmap
          loading={heatmapLoading}
          data={heatmapData}
          emptyTitle={sourceId ? "无热力图数据" : "请选择数据源"}
        />
      )}
    </div>
  );
}

function RateRow({
  label,
  rate,
  inverse,
}: {
  label: string;
  rate: number;
  inverse?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, rate));
  const displayPct = `${(pct * 100).toFixed(1)}%`;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{displayPct}</span>
      </div>
      <Progress
        value={pct * 100}
        className="h-1.5"
        indicatorClassName={rateColorClass(pct, inverse)}
      />
    </div>
  );
}
