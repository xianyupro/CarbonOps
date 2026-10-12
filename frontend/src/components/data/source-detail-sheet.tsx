"use client";

import * as React from "react";
import { Loader2, Play, Square, Wifi } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";
import {
  PROTOCOL_OPTIONS,
  SOURCE_STATUS_BADGE,
  protocolLabel,
} from "@/lib/constants";
import type { DataSourceDetail } from "@/types/api";

interface SourceDetailSheetProps {
  sourceId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Notify parent to refresh list after start/stop. */
  onChanged?: () => void;
}

export function SourceDetailSheet({
  sourceId,
  open,
  onOpenChange,
  onChanged,
}: SourceDetailSheetProps) {
  const hasWrite = useAuthStore((s) => s.hasPermission("data:source:write"));
  const [detail, setDetail] = React.useState<DataSourceDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [acting, setActing] = React.useState<"test" | "start" | "stop" | null>(
    null
  );

  React.useEffect(() => {
    if (!open || !sourceId) {
      setDetail(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await api.dataSources.get(sourceId);
        if (active) setDetail(data);
      } catch (err) {
        if (active) {
          toast.error(
            err instanceof ApiError ? err.message : "加载数据源详情失败"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, sourceId]);

  async function handleAction(action: "test" | "start" | "stop") {
    if (!detail) return;
    setActing(action);
    try {
      if (action === "test") {
        const r = await api.dataSources.test(detail.id);
        toast.success(`${r.message}（延迟 ${r.latencyMs}ms）`);
      } else if (action === "start") {
        const updated = await api.dataSources.start(detail.id);
        setDetail((prev) =>
          prev ? { ...prev, ...updated, points: prev.points } : prev
        );
        toast.success("数据源已启动");
        onChanged?.();
      } else {
        const updated = await api.dataSources.stop(detail.id);
        setDetail((prev) =>
          prev ? { ...prev, ...updated, points: prev.points } : prev
        );
        toast.success("数据源已停止");
        onChanged?.();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "操作失败");
    } finally {
      setActing(null);
    }
  }

  const status = detail?.status;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl lg:max-w-3xl">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="text-lg">
              {loading ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                detail?.name ?? "数据源详情"
              )}
            </SheetTitle>
            {detail ? (
              <>
                <Badge variant="outline" className="font-mono">
                  {protocolLabel(detail.protocol)}
                </Badge>
                {status ? (
                  <Badge variant={SOURCE_STATUS_BADGE[status].variant}>
                    {SOURCE_STATUS_BADGE[status].label}
                  </Badge>
                ) : null}
              </>
            ) : null}
          </div>
          <SheetDescription className="font-mono">
            {detail?.code ?? ""}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !detail ? (
          <EmptyState
            className="mt-10"
            title="未加载数据源"
            description="请关闭后重试"
          />
        ) : (
          <div className="mt-6 space-y-5">
            {/* Action bar */}
            {hasWrite ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("test")}
                  disabled={acting !== null}
                >
                  {acting === "test" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                  测试连接
                </Button>
                {status === "CONNECTED" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction("stop")}
                    disabled={acting !== null}
                  >
                    {acting === "stop" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    停止采集
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleAction("start")}
                    disabled={acting !== null}
                  >
                    {acting === "start" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    启动采集
                  </Button>
                )}
              </div>
            ) : null}

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="编码" value={detail.code} mono />
              <InfoRow
                label="协议"
                value={
                  PROTOCOL_OPTIONS.find((o) => o.value === detail.protocol)
                    ?.label ?? detail.protocol
                }
              />
              <InfoRow label="行业" value={detail.industry} />
              <InfoRow
                label="采集间隔"
                value={`${(detail.collectIntervalMs / 1000).toFixed(
                  detail.collectIntervalMs % 1000 === 0 ? 0 : 2
                )} 秒`}
                mono
              />
              <InfoRow
                label="端点"
                value={
                  detail.host && detail.port
                    ? `${detail.host}:${detail.port}`
                    : (detail.host ?? "—")
                }
                mono
              />
              <InfoRow
                label="点位数"
                value={String(detail.pointCount)}
                mono
              />
              <InfoRow
                label="创建时间"
                value={formatDate(detail.createdAt) ?? "—"}
              />
              <InfoRow
                label="最近采集"
                value={formatDate(detail.lastCollectedAt) ?? "—"}
              />
            </div>

            {detail.description ? (
              <>
                <Separator />
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    描述
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {detail.description}
                  </p>
                </div>
              </>
            ) : null}

            <Separator />

            {/* Points table */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  数据点位
                </div>
                <span className="text-xs text-muted-foreground">
                  共 {detail.points.length} 个
                </span>
              </div>
              {detail.points.length === 0 ? (
                <EmptyState
                  title="暂无点位"
                  description="该数据源未关联任何点位"
                />
              ) : (
                <div className="max-h-[360px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/50">
                      <TableRow>
                        <TableHead>编码</TableHead>
                        <TableHead>名称</TableHead>
                        <TableHead>单位</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>工序</TableHead>
                        <TableHead>设备</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.points.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">
                            {p.code}
                          </TableCell>
                          <TableCell>{p.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.unit ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {p.dataType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.processStage ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.device ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={
          mono
            ? "font-mono text-sm text-foreground"
            : "text-sm text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}
