"use client";

import * as React from "react";
import {
  Database,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Eye,
  Wifi,
  Play,
  Square,
  Trash2,
  CircleDot,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";
import {
  PROTOCOL_OPTIONS,
  SOURCE_STATUS_BADGE,
  protocolLabel,
} from "@/lib/constants";
import { SourceFormDialog } from "@/components/data/source-form";
import { SourceDetailSheet } from "@/components/data/source-detail-sheet";
import type {
  DataSource,
  DataSourceProtocol,
  DataSourceStatus,
} from "@/types/api";

const PAGE_SIZE = 20;

export default function DataSourcesPage() {
  const hasWrite = useAuthStore((s) => s.hasPermission("data:source:write"));
  const hasDelete = useAuthStore((s) => s.hasPermission("data:source:delete"));

  const [items, setItems] = React.useState<DataSource[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [keyword, setKeyword] = React.useState("");
  const [protocol, setProtocol] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("");
  const [page, setPage] = React.useState(1);

  // Dialog state
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DataSource | null>(null);

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetSourceId, setSheetSourceId] = React.useState<number | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<DataSource | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);

  // Row action in-flight marker (id → action).
  const [rowAction, setRowAction] = React.useState<{
    id: number;
    action: "test" | "start" | "stop";
  } | null>(null);

  async function load(targetPage = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.dataSources.list({
        page: targetPage,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        protocol: (protocol || undefined) as DataSourceProtocol | undefined,
        status: (status || undefined) as DataSourceStatus | undefined,
      });
      const list = Array.isArray(res) ? res : (res.list ?? []);
      const nextTotal = Array.isArray(res)
        ? list.length
        : (res.meta?.total ?? list.length);
      setItems(list);
      setTotal(nextTotal);
      // Reset page if we emptied the current page.
      if (targetPage > 1 && list.length === 0 && nextTotal > 0) {
        setPage(Math.max(1, Math.ceil(nextTotal / PAGE_SIZE)));
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "加载数据源失败，请确认后端服务已启动"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  React.useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when filters change
  React.useEffect(() => {
    if (page === 1) {
      void load(1);
    } else {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol, status]);

  React.useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (page === 1) {
      void load(1);
    } else {
      setPage(1);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(ds: DataSource) {
    setEditing(ds);
    setFormOpen(true);
  }

  function openDetail(ds: DataSource) {
    setSheetSourceId(ds.id);
    setSheetOpen(true);
  }

  async function handleRowAction(
    ds: DataSource,
    action: "test" | "start" | "stop"
  ) {
    setRowAction({ id: ds.id, action });
    try {
      if (action === "test") {
        const r = await api.dataSources.test(ds.id);
        toast.success(`${r.message}（延迟 ${r.latencyMs}ms）`);
      } else if (action === "start") {
        await api.dataSources.start(ds.id);
        toast.success(`已启动 ${ds.name}`);
        await load(page);
      } else {
        await api.dataSources.stop(ds.id);
        toast.success(`已停止 ${ds.name}`);
        await load(page);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "操作失败");
    } finally {
      setRowAction(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.dataSources.delete(deleteTarget.id);
      toast.success(`已删除 ${deleteTarget.name}`);
      setDeleteTarget(null);
      await load(page);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPrev = page > 1;
  const showNext = page < totalPages;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="数据管理 · Data Source"
        icon={Database}
        title="数据源"
        description="接入的工业数据源清单与连接状态"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(page)}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
            {hasWrite ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建数据源
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <form
            onSubmit={onSearchSubmit}
            className="relative flex-1"
            role="search"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索名称 / 编码 / 主机…"
              className="pl-9"
              aria-label="搜索数据源"
            />
          </form>
          <div className="flex gap-3">
            <Select
              value={protocol || "ALL"}
              onValueChange={(v) => setProtocol(v === "ALL" ? "" : v)}
            >
              <SelectTrigger className="w-[150px]" aria-label="协议">
                <SelectValue placeholder="协议" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部协议</SelectItem>
                {PROTOCOL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status || "ALL"}
              onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}
            >
              <SelectTrigger className="w-[130px]" aria-label="状态">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="CONNECTED">已连接</SelectItem>
                <SelectItem value="DISCONNECTED">未连接</SelectItem>
                <SelectItem value="ERROR">异常</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">数据源</TableHead>
              <TableHead>行业</TableHead>
              <TableHead>协议</TableHead>
              <TableHead>端点</TableHead>
              <TableHead className="text-right">点位</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最近采集</TableHead>
              <TableHead className="w-[60px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-10" /></TableCell>
              <TableCell><Skeleton className="h-5 w-14" /></TableCell>
              <TableCell><Skeleton className="h-5 w-28" /></TableCell>
              <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-sm text-destructive">
                    <Loader2 className="h-5 w-5" />
                    {error}
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-2">
                  <EmptyState
                    icon={Database}
                    title="暂无数据源"
                    description="可调整筛选条件，或点击右上角新建数据源"
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((ds) => {
                const st = SOURCE_STATUS_BADGE[ds.status] ?? {
                  label: ds.status,
                  variant: "muted" as const,
                };
                const rowAct = rowAction?.id === ds.id ? rowAction.action : null;
                return (
                  <TableRow key={ds.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2.5 text-left"
                        onClick={() => openDetail(ds)}
                      >
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Server className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground hover:text-primary">
                            {ds.name}
                          </div>
                          <div className="truncate font-mono text-xs text-muted-foreground">
                            {ds.code}
                          </div>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ds.industry || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {protocolLabel(ds.protocol)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {ds.host && ds.port
                        ? `${ds.host}:${ds.port}`
                        : ds.host || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <CircleDot className="h-3 w-3 text-muted-foreground" />
                        {ds.pointCount ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(ds.lastCollectedAt) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={rowAct !== null}
                          >
                            {rowAct !== null ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={() => openDetail(ds)}>
                            <Eye className="h-4 w-4" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => handleRowAction(ds, "test")}
                          >
                            <Wifi className="h-4 w-4" />
                            测试连接
                          </DropdownMenuItem>
                          {hasWrite ? (
                            <>
                              <DropdownMenuSeparator />
                              {ds.status === "CONNECTED" ? (
                                <DropdownMenuItem
                                  onSelect={() => handleRowAction(ds, "stop")}
                                >
                                  <Square className="h-4 w-4" />
                                  停止采集
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onSelect={() => handleRowAction(ds, "start")}
                                >
                                  <Play className="h-4 w-4" />
                                  启动采集
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onSelect={() => openEdit(ds)}
                              >
                                <Pencil className="h-4 w-4" />
                                编辑
                              </DropdownMenuItem>
                            </>
                          ) : null}
                          {hasDelete ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setDeleteTarget(ds)}
                              >
                                <Trash2 className="h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            共 <span className="font-medium text-foreground">{total}</span> 条
            {loading ? "（加载中）" : ""}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={!showPrev || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              上一页
            </Button>
            <span className="px-2 font-mono">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={!showNext || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <SourceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => void load(page)}
      />

      <SourceDetailSheet
        sourceId={sheetSourceId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onChanged={() => void load(page)}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>确认删除数据源</DialogTitle>
            <DialogDescription>
              此操作将永久删除数据源「{deleteTarget?.name}」及其所有点位关联，无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  删除中…
                </>
              ) : (
                "确认删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
