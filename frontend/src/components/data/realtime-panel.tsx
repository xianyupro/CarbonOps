"use client";

import * as React from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtime, type WsStatus } from "@/hooks/use-realtime";
import { QUALITY_BADGE } from "@/lib/constants";
import type { DataPoint } from "@/types/api";

interface RealtimePanelProps {
  enabled: boolean;
  pointIds: number[];
  points: DataPoint[];
}

const STATUS_BADGE: Record<
  WsStatus,
  { label: string; variant: "muted" | "success" | "warning" | "destructive" }
> = {
  IDLE: { label: "未启用", variant: "muted" },
  CONNECTING: { label: "连接中", variant: "warning" },
  OPEN: { label: "已连接", variant: "success" },
  CLOSING: { label: "关闭中", variant: "muted" },
  CLOSED: { label: "已关闭", variant: "muted" },
  ERROR: { label: "错误", variant: "destructive" },
};

export function RealtimePanel({
  enabled,
  pointIds,
  points,
}: RealtimePanelProps) {
  const { status, values, error } = useRealtime({
    enabled,
    pointIds,
  });

  const pointMeta = React.useMemo(
    () => new Map(points.map((p) => [p.id, p])),
    [points]
  );

  if (!enabled) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        <WifiOff className="mr-2 h-4 w-4" />
        实时模式未开启
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[status];

  return (
    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/[0.03] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">实时数据</span>
          <Badge variant={statusBadge.variant} className="ml-1">
            <Wifi className="mr-1 h-3 w-3" />
            {statusBadge.label}
          </Badge>
        </div>
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </div>

      {pointIds.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          请先选择点位
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pointIds.map((pid) => {
            const point = pointMeta.get(pid);
            const v = values[pid];
            const quality = v?.quality;
            const qBadge = quality ? QUALITY_BADGE[quality] : null;
            return (
              <div
                key={pid}
                className="rounded-md border border-border bg-card p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">
                      {point?.name ?? `点位 ${pid}`}
                    </div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {point?.code}
                    </div>
                  </div>
                  {qBadge ? (
                    <Badge variant={qBadge.variant} className="shrink-0 text-[10px]">
                      {qBadge.label}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-1.5 flex items-baseline gap-1">
                  {v ? (
                    <>
                      <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                        {v.value === null ? "—" : v.value.toFixed(2)}
                      </span>
                      {point?.unit ? (
                        <span className="text-xs text-muted-foreground">
                          {point.unit}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <Skeleton className="h-6 w-16" />
                  )}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {v?.timestamp
                    ? new Date(v.timestamp).toLocaleTimeString("zh-CN", {
                        hour12: false,
                      })
                    : "等待推送…"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
