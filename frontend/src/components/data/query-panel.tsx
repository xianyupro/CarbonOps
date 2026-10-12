"use client";

import * as React from "react";
import { Loader2, Search, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  AGG_OPTIONS,
  INTERVAL_OPTIONS,
  TIME_RANGE_PRESETS,
} from "@/lib/constants";
import { EmptyState } from "@/components/common/empty-state";
import type {
  Aggregation,
  DataPoint,
  DataSource,
  QueryPayload,
  TimeBucket,
} from "@/types/api";

const RECOMMENDED_MAX_POINTS = 5;

export interface QueryPanelProps {
  onQuery: (payload: QueryPayload, points: DataPoint[]) => void;
  loading: boolean;
  onRealtimeChange: (enabled: boolean, pointIds: number[]) => void;
  realtimeEnabled: boolean;
  className?: string;
}

export function QueryPanel({
  onQuery,
  loading,
  onRealtimeChange,
  realtimeEnabled,
  className,
}: QueryPanelProps) {
  const [sources, setSources] = React.useState<DataSource[]>([]);
  const [sourceId, setSourceId] = React.useState<number | "">("");
  const [points, setPoints] = React.useState<DataPoint[]>([]);
  const [pointsLoading, setPointsLoading] = React.useState(false);
  const [pointKeyword, setPointKeyword] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());

  // 默认「全部数据」（ms=0），适配演示数据集的非实时时间轴
  const [rangeMs, setRangeMs] = React.useState<number>(
    TIME_RANGE_PRESETS[0].ms
  );
  const [interval, setInterval] = React.useState<TimeBucket>("1 hour");
  const [agg, setAgg] = React.useState<Aggregation>("AVG");

  // Load sources once
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.dataSources.list({ pageSize: 100 });
        const list = Array.isArray(res) ? res : (res.list ?? []);
        if (active) {
          setSources(list);
          if (list.length > 0) setSourceId(list[0].id);
        }
      } catch {
        // silent — main page error toast handles
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load points when source changes
  React.useEffect(() => {
    if (!sourceId) {
      setPoints([]);
      setSelectedIds(new Set());
      return;
    }
    let active = true;
    setPointsLoading(true);
    setSelectedIds(new Set());
    (async () => {
      try {
        const res = await api.dataPoints.list({
          sourceId: sourceId as number,
          pageSize: 200,
        });
        if (active) setPoints(Array.isArray(res) ? res : (res.list ?? []));
      } catch {
        if (active) setPoints([]);
      } finally {
        if (active) setPointsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sourceId]);

  const filteredPoints = React.useMemo(() => {
    if (!pointKeyword.trim()) return points;
    const k = pointKeyword.trim().toLowerCase();
    return points.filter(
      (p) =>
        p.name.toLowerCase().includes(k) || p.code.toLowerCase().includes(k)
    );
  }, [points, pointKeyword]);

  function togglePoint(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= RECOMMENDED_MAX_POINTS) {
          toast.warning(
            `建议不超过 ${RECOMMENDED_MAX_POINTS} 个点位以保证图表可读性`
          );
        }
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (selectedIds.size === 0) {
      toast.error("请至少选择一个点位");
      return;
    }
    const selectedPoints = points.filter((p) => selectedIds.has(p.id));
    const end = new Date();
    // ms=0 表示「全部数据」：起点取 2026-01-01，覆盖全部导入的历史数据
    const start =
      rangeMs === 0 ? new Date(2026, 0, 1) : new Date(end.getTime() - rangeMs);
    const payload: QueryPayload = {
      pointIds: Array.from(selectedIds),
      start: start.toISOString(),
      end: end.toISOString(),
      interval,
      agg,
    };
    onQuery(payload, selectedPoints);
  }

  const realtimeDisabled = selectedIds.size === 0;

  function handleRealtimeToggle(next: boolean) {
    if (next && selectedIds.size === 0) {
      toast.error("请先选择点位");
      return;
    }
    onRealtimeChange(next, Array.from(selectedIds));
  }

  return (
    <aside
      className={
        "flex w-full flex-col gap-4 rounded-md border border-border bg-card p-4 " +
        (className ?? "")
      }
    >
      {/* Source picker */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="font-cyber text-muted-foreground/70">01</span> 数据源
        </Label>
        <Select
          value={String(sourceId)}
          onValueChange={(v) => setSourceId(v ? Number(v) : "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择数据源" />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Point picker */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="font-cyber text-muted-foreground/70">02</span> 点位
            <span className="font-cyber text-[10px] text-muted-foreground/70">
              {selectedIds.size}/{points.length}
            </span>
          </Label>
          {selectedIds.size > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              清空
            </button>
          ) : null}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={pointKeyword}
            onChange={(e) => setPointKeyword(e.target.value)}
            placeholder="搜索点位编码 / 名称"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="max-h-[280px] overflow-auto rounded-md border">
          {pointsLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : filteredPoints.length === 0 ? (
            <EmptyState
              className="py-6"
              title={sourceId ? "无匹配点位" : "请先选择数据源"}
            />
          ) : (
            filteredPoints.map((p) => {
              const checked = selectedIds.has(p.id);
              return (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 border-b border-border/50 px-2.5 py-1.5 text-xs last:border-b-0 hover:bg-accent/50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => togglePoint(p.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">
                      {p.name}
                    </div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {p.code} · {p.unit ?? "—"}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Time range */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="font-cyber text-muted-foreground/70">03</span> 时间范围
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          {TIME_RANGE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setRangeMs(p.ms)}
              className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                rangeMs === p.ms
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aggregation */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="font-cyber text-muted-foreground/70">04</span> 聚合
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          <Select
            value={interval}
            onValueChange={(v) => setInterval(v as TimeBucket)}
            disabled={realtimeEnabled}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={agg}
            onValueChange={(v) => setAgg(v as Aggregation)}
            disabled={realtimeEnabled}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGG_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {realtimeEnabled ? (
          <p className="text-[11px] text-muted-foreground">
            实时模式只推送原始值，已禁用聚合
          </p>
        ) : null}
      </div>

      {/* Submit */}
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={loading || selectedIds.size === 0 || realtimeEnabled}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            查询中…
          </>
        ) : (
          "查询"
        )}
      </Button>

      {/* Realtime */}
      <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <div className="text-xs font-medium text-foreground">实时模式</div>
            <div className="text-[10px] text-muted-foreground">
              WebSocket 推送最新值
            </div>
          </div>
        </div>
        <Switch
          checked={realtimeEnabled}
          onCheckedChange={handleRealtimeToggle}
          disabled={realtimeDisabled}
          aria-label="启用实时模式"
        />
      </div>
    </aside>
  );
}
