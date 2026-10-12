"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { formatDate, formatNumber } from "@/lib/utils";
import {
  MODEL_FUNCTION_BADGE,
  MODEL_STATUS_BADGE,
} from "@/lib/constants";
import type {
  ModelCall,
  ModelInvokeResult,
  ModelRegistryDetail,
  ModelStatus,
} from "@/types/api";

const CALLS_PAGE_SIZE = 10;

interface ModelDetailSheetProps {
  modelId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Notify parent to refresh list after invoke / status change. */
  onChanged?: () => void;
}

export function ModelDetailSheet({
  modelId,
  open,
  onOpenChange,
  onChanged,
}: ModelDetailSheetProps) {
  const hasRead = useAuthStore((s) => s.hasPermission("model:read"));

  const [detail, setDetail] = React.useState<ModelRegistryDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Calls tab state
  const [calls, setCalls] = React.useState<ModelCall[]>([]);
  const [callsTotal, setCallsTotal] = React.useState(0);
  const [callsPage, setCallsPage] = React.useState(1);
  const [callsLoading, setCallsLoading] = React.useState(false);

  // Inline invoke panel
  const [invokeOpen, setInvokeOpen] = React.useState(false);
  const [invokeInput, setInvokeInput] = React.useState(
    JSON.stringify({ sample: "input" }, null, 2)
  );
  const [invokeResult, setInvokeResult] = React.useState<ModelInvokeResult | null>(
    null
  );
  const [invoking, setInvoking] = React.useState(false);

  // Load model detail whenever sheet opens / id changes.
  React.useEffect(() => {
    if (!open || !modelId) {
      setDetail(null);
      setCalls([]);
      setCallsTotal(0);
      setCallsPage(1);
      setInvokeResult(null);
      setInvokeOpen(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await api.models.get(modelId);
        if (active) setDetail(data);
      } catch (err) {
        if (active) {
          toast.error(
            err instanceof ApiError ? err.message : "加载模型详情失败"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, modelId]);

  // Load calls when model id changes.
  const loadCalls = React.useCallback(
    async (targetPage: number) => {
      if (!modelId) return;
      setCallsLoading(true);
      try {
        const res = await api.models.calls(modelId, {
          page: targetPage,
          pageSize: CALLS_PAGE_SIZE,
        });
        setCalls(res.list ?? []);
        setCallsTotal(res.meta?.total ?? 0);
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "加载调用记录失败"
        );
        setCalls([]);
      } finally {
        setCallsLoading(false);
      }
    },
    [modelId]
  );

  React.useEffect(() => {
    if (!open || !modelId) return;
    void loadCalls(1);
  }, [open, modelId, loadCalls]);

  React.useEffect(() => {
    if (!open || !modelId) return;
    void loadCalls(callsPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callsPage]);

  async function handleInvoke() {
    if (!detail) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(invokeInput);
    } catch {
      toast.error("输入不是有效的 JSON");
      return;
    }
    setInvoking(true);
    setInvokeResult(null);
    try {
      const result = await api.models.invoke(detail.id, { input: parsed });
      setInvokeResult(result);
      toast.success(`推理完成（${result.latencyMs} ms）`);
      onChanged?.();
      // Refresh calls list to reflect the new call.
      void loadCalls(1);
      setCallsPage(1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "推理调用失败");
    } finally {
      setInvoking(false);
    }
  }

  const callsTotalPages = Math.max(
    1,
    Math.ceil(callsTotal / CALLS_PAGE_SIZE)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl lg:max-w-2xl">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-lg">
              {loading ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                detail?.name ?? "模型详情"
              )}
            </SheetTitle>
            {detail ? (
              <>
                <Badge variant={MODEL_STATUS_BADGE[detail.status].variant}>
                  {MODEL_STATUS_BADGE[detail.status].label}
                </Badge>
                <Badge variant={MODEL_FUNCTION_BADGE[detail.functionType].variant}>
                  {MODEL_FUNCTION_BADGE[detail.functionType].label}
                </Badge>
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
            title="未加载模型"
            description="请关闭后重试"
          />
        ) : (
          <div className="mt-6 space-y-5">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="编码" value={detail.code} mono />
              <InfoRow label="行业" value={detail.industry || "—"} />
              <InfoRow
                label="工序阶段"
                value={detail.processStage || "—"}
              />
              <InfoRow
                label="准确率"
                value={
                  detail.accuracy > 0
                    ? `${(detail.accuracy * 100).toFixed(1)}%`
                    : "—"
                }
                mono
              />
              <InfoRow
                label="调用次数"
                value={formatNumber(detail.callCount)}
                mono
              />
              <InfoRow
                label="最新版本"
                value={detail.latestVersion || "—"}
                mono
              />
              <InfoRow
                label="版本数量"
                value={String(detail.versionCount)}
                mono
              />
              <InfoRow
                label="创建时间"
                value={formatDate(detail.createdAt) ?? "—"}
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

            {detail.tags && detail.tags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {detail.tags.map((t) => (
                  <Badge key={t} variant="muted" className="font-mono">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : null}

            <Separator />

            {/* Tabs: versions + calls */}
            <Tabs defaultValue="versions" className="w-full">
              <TabsList>
                <TabsTrigger value="versions">版本管理</TabsTrigger>
                <TabsTrigger value="calls">调用记录</TabsTrigger>
              </TabsList>

              {/* Versions */}
              <TabsContent value="versions">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    版本列表
                  </div>
                  <span className="text-xs text-muted-foreground">
                    共 {detail.versions.length} 个
                  </span>
                </div>
                {detail.versions.length === 0 ? (
                  <EmptyState
                    title="暂无版本"
                    description="该模型尚未发布任何版本"
                  />
                ) : (
                  <div className="max-h-[320px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted/50">
                        <TableRow>
                          <TableHead>版本号</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>入口函数</TableHead>
                          <TableHead>更新说明</TableHead>
                          <TableHead>创建时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.versions.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="font-mono">
                                  {v.versionNo}
                                </Badge>
                                {v.isCurrent ? (
                                  <Badge variant="success">当前</Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <VersionStatusBadge status={v.status} />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {v.entryFunction || "—"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {v.changelog || "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(v.createdAt) ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Calls */}
              <TabsContent value="calls">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    调用记录
                  </div>
                  <span className="text-xs text-muted-foreground">
                    共 {callsTotal} 条
                  </span>
                </div>
                {callsLoading && calls.length === 0 ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={`csk-${i}`} className="h-10 w-full" />
                    ))}
                  </div>
                ) : calls.length === 0 ? (
                  <EmptyState
                    title="暂无调用记录"
                    description="该模型尚未被调用"
                  />
                ) : (
                  <div className="max-h-[320px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted/50">
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead className="text-right">延迟</TableHead>
                          <TableHead>输出摘要</TableHead>
                          <TableHead>时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calls.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              #{c.id}
                            </TableCell>
                            <TableCell>
                              <CallStatusBadge status={c.status} />
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {c.latencyMs} ms
                            </TableCell>
                            <TableCell className="max-w-[220px]">
                              <span className="block truncate font-mono text-xs text-muted-foreground">
                                {c.output
                                  ? JSON.stringify(c.output)
                                  : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(c.createdAt) ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Calls pagination */}
                {callsTotal > CALLS_PAGE_SIZE ? (
                  <div className="mt-2 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      disabled={callsPage <= 1 || callsLoading}
                      onClick={() => setCallsPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      上一页
                    </Button>
                    <span className="px-2 font-mono">
                      {callsPage} / {callsTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      disabled={callsPage >= callsTotalPages || callsLoading}
                      onClick={() => setCallsPage((p) => p + 1)}
                    >
                      下一页
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>

            {/* Invoke panel */}
            {hasRead ? (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      推理调用
                    </div>
                    <Button
                      size="sm"
                      variant={invokeOpen ? "outline" : "default"}
                      onClick={() => setInvokeOpen((v) => !v)}
                    >
                      <Play className="h-4 w-4" />
                      {invokeOpen ? "收起" : "调用推理"}
                    </Button>
                  </div>

                  {invokeOpen ? (
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1.5 text-xs text-muted-foreground">
                          输入 JSON
                        </div>
                        <Textarea
                          value={invokeInput}
                          onChange={(e) => setInvokeInput(e.target.value)}
                          rows={6}
                          className="font-mono text-xs"
                          spellCheck={false}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => void handleInvoke()}
                          disabled={invoking}
                        >
                          {invoking ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              推理中…
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              执行推理
                            </>
                          )}
                        </Button>
                      </div>

                      {invokeResult ? (
                        <div className="space-y-2 rounded-md border p-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium">结果</span>
                            <CallStatusBadge status={invokeResult.status} />
                            <span className="font-mono text-muted-foreground">
                              {invokeResult.latencyMs} ms
                            </span>
                          </div>
                          <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto">
                            <code>
                              {JSON.stringify(invokeResult.output, null, 2)}
                            </code>
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
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
          mono ? "font-mono text-sm text-foreground" : "text-sm text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}

function VersionStatusBadge({ status }: { status: ModelStatus | string }) {
  const meta = MODEL_STATUS_BADGE[status as ModelStatus];
  if (!meta) {
    return <Badge variant="muted">{status}</Badge>;
  }
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function CallStatusBadge({ status }: { status: string }) {
  const lower = String(status || "").toLowerCase();
  if (lower === "success" || lower === "ok" || lower === "online") {
    return <Badge variant="success">{status}</Badge>;
  }
  if (lower === "failed" || lower === "error" || lower === "offline") {
    return <Badge variant="destructive">{status}</Badge>;
  }
  if (lower === "running" || lower === "testing") {
    return <Badge variant="warning">{status}</Badge>;
  }
  return <Badge variant="muted">{status || "—"}</Badge>;
}
