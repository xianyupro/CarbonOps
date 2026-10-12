"use client";

import * as React from "react";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { AuditLog } from "@/types/api";

const PAGE_SIZE = 50;

interface ActionOption {
  value: string;
  label: string;
}

/** Grouped common action categories for the filter dropdown. */
const ACTION_GROUPS: { label: string; options: ActionOption[] }[] = [
  {
    label: "认证",
    options: [
      { value: "LOGIN", label: "登录 · LOGIN" },
      { value: "LOGOUT", label: "登出 · LOGOUT" },
    ],
  },
  {
    label: "资源操作",
    options: [
      { value: "CREATE_*", label: "新建 · CREATE_*" },
      { value: "UPDATE_*", label: "更新 · UPDATE_*" },
      { value: "DELETE_*", label: "删除 · DELETE_*" },
      { value: "RESET_*", label: "重置 · RESET_*" },
    ],
  },
  {
    label: "采集与导入",
    options: [
      { value: "START_*", label: "启动 · START_*" },
      { value: "STOP_*", label: "停止 · STOP_*" },
      { value: "UPLOAD_*", label: "上传 · UPLOAD_*" },
    ],
  },
];

/** Map a raw action string to a badge variant by category. */
function actionBadgeVariant(action: string): BadgeProps["variant"] {
  if (action === "LOGIN" || action === "LOGOUT") return "secondary";
  if (action.startsWith("CREATE_")) return "success";
  if (action === "RESET_PASSWORD" || action.startsWith("UPDATE_"))
    return "warning";
  if (action.startsWith("DELETE_")) return "destructive";
  if (
    action.startsWith("START_") ||
    action.startsWith("STOP_") ||
    action.startsWith("UPLOAD_")
  )
    return "outline";
  return "secondary";
}

export default function SystemLogsPage() {
  const [items, setItems] = React.useState<AuditLog[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const [username, setUsername] = React.useState("");
  const [action, setAction] = React.useState("");
  const [page, setPage] = React.useState(1);

  async function load(targetPage = page) {
    setLoading(true);
    try {
      const res = await api.users.auditLogs({
        page: targetPage,
        pageSize: PAGE_SIZE,
        username: username || undefined,
        action: action || undefined,
      });
      const list = res.list ?? [];
      const nextTotal = res.meta?.total ?? list.length;
      setItems(list);
      setTotal(nextTotal);
      // Reset page if we emptied the current page but total > 0.
      if (targetPage > 1 && list.length === 0 && nextTotal > 0) {
        setPage(Math.max(1, Math.ceil(nextTotal / PAGE_SIZE)));
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "加载操作日志失败，请稍后重试"
      );
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  React.useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when action filter changes (reset to page 1)
  React.useEffect(() => {
    if (page === 1) {
      void load(1);
    } else {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  // Reload when page changes
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPrev = page > 1;
  const showNext = page < totalPages;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="系统管理 · Audit"
        icon={FileText}
        title="操作日志"
        description="用户操作流水、审计追溯"
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
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="搜索操作人用户名…"
              className="pl-9"
              aria-label="搜索操作人"
            />
          </form>
          <div className="flex items-center gap-2">
            <Select
              value={action || "ALL"}
              onValueChange={(v) => setAction(v === "ALL" ? "" : v)}
            >
              <SelectTrigger className="w-[180px]" aria-label="动作类型">
                <SelectValue placeholder="动作类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部动作</SelectItem>
                {ACTION_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px] text-right">ID</TableHead>
              <TableHead className="w-[120px]">操作人</TableHead>
              <TableHead className="w-[150px]">动作</TableHead>
              <TableHead className="w-[140px]">资源</TableHead>
              <TableHead>详情</TableHead>
              <TableHead className="w-[130px]">IP</TableHead>
              <TableHead className="w-[150px] text-right">时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-5 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-52" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-5 w-28" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-2">
                  <EmptyState
                    icon={ScrollText}
                    title="暂无操作日志"
                    description="可调整筛选条件后刷新，或等待新的用户操作记录产生"
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {log.id}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {log.username || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={actionBadgeVariant(log.action)}
                      className="font-mono"
                    >
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.resource || "—"}
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <span
                      className="block truncate text-xs text-muted-foreground"
                      title={log.detail ?? undefined}
                    >
                      {log.detail || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.ip || "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </TableCell>
                </TableRow>
              ))
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
    </div>
  );
}
