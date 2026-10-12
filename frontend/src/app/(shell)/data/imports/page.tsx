"use client";

import * as React from "react";
import { useDropzone } from "react-dropzone";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  MoreVertical,
  RefreshCw,
  Trash2,
  Upload,
  UploadCloud,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useInterval } from "@/hooks/use-interval";
import { formatDate } from "@/lib/utils";
import {
  ACCEPTED_IMPORT_EXT,
  FILE_TYPE_BADGE,
  IMPORT_STATUS_BADGE,
} from "@/lib/constants";
import { ImportPreviewSheet } from "@/components/data/import-preview-sheet";
import type {
  DataImport,
  DataImportStatus,
} from "@/types/api";

const PAGE_SIZE = 20;

function formatFileSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function DataImportsPage() {
  const hasWrite = useAuthStore((s) => s.hasPermission("data:import:write"));
  const hasDelete = useAuthStore((s) => s.hasPermission("data:import:delete"));

  const [items, setItems] = React.useState<DataImport[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<string>("");
  const [page, setPage] = React.useState(1);

  const [uploading, setUploading] = React.useState(false);
  const [previewTarget, setPreviewTarget] = React.useState<DataImport | null>(
    null
  );
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<DataImport | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);

  async function load(targetPage = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.dataImports.list({
        page: targetPage,
        pageSize: PAGE_SIZE,
        status: (status || undefined) as DataImportStatus | undefined,
      });
      const list = Array.isArray(res) ? res : (res.list ?? []);
      const nextTotal = Array.isArray(res)
        ? list.length
        : (res.meta?.total ?? list.length);
      setItems(list);
      setTotal(nextTotal);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "加载导入记录失败，请确认后端服务已启动"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (page === 1) {
      void load(1);
    } else {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  React.useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Auto-poll while any record is PARSING.
  const hasParsing = items.some((i) => i.status === "PARSING");
  useInterval(
    () => {
      void load(page);
    },
    hasParsing ? 3000 : null
  );

  const onDrop = React.useCallback(
    async (accepted: File[]) => {
      if (!hasWrite) return;
      if (accepted.length === 0) return;
      setUploading(true);
      // Sequential upload — backend parse is async; uploading many in parallel
      // may saturate the single-worker FastAPI process.
      for (const file of accepted) {
        try {
          await api.dataImports.upload(file);
          toast.success(`已上传 ${file.name}`);
        } catch (err) {
          const msg =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : `上传失败 ${file.name}`;
          toast.error(msg);
        }
      }
      setUploading(false);
      await load(page);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasWrite, page]
  );

  const { getRootProps, getInputProps, isDragActive, open: openPicker } =
    useDropzone({
      onDrop,
      disabled: !hasWrite || uploading,
      multiple: true,
      noClick: true,
      noKeyboard: true,
      accept: ACCEPTED_IMPORT_EXT.reduce(
        (acc, ext) => {
          acc[extToMime(ext)] = [];
          return acc;
        },
        {} as Record<string, string[]>
      ),
    });

  function openPreview(rec: DataImport) {
    setPreviewTarget(rec);
    setPreviewOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.dataImports.delete(deleteTarget.id);
      toast.success(`已删除 ${deleteTarget.filename}`);
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
        eyebrow="数据管理 · Offline Import"
        icon={UploadCloud}
        title="离线导入"
        description="上传 CSV / Excel / JSON / XML 文件批量导入历史数据"
        actions={
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
        }
      />

      {hasWrite ? (
        <Card>
          <div
            {...getRootProps()}
            className={`m-3 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-accent/50"
            }`}
          >
            <input {...getInputProps()} aria-label="文件上传" />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <UploadCloud className="h-5 w-5" />
              )}
            </div>
            <div className="text-sm font-medium text-foreground">
              {uploading
                ? "正在上传…"
                : isDragActive
                  ? "释放鼠标即可上传"
                  : "拖拽文件到此处，或点击下方按钮选择"}
            </div>
            <div className="text-xs text-muted-foreground">
              支持 {ACCEPTED_IMPORT_EXT.join(" / ")}，单次可选多个
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-1"
              onClick={openPicker}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" />
              选择文件
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="text-sm text-muted-foreground">
            导入记录
            {hasParsing ? (
              <span className="ml-2 inline-flex items-center gap-1 text-warning">
                <Loader2 className="h-3 w-3 animate-spin" />
                存在解析中任务，每 3 秒自动刷新
              </span>
            ) : null}
          </div>
          <Select
            value={status || "ALL"}
            onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}
          >
            <SelectTrigger className="w-[140px]" aria-label="状态">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部状态</SelectItem>
              <SelectItem value="PARSING">解析中</SelectItem>
              <SelectItem value="COMPLETED">已完成</SelectItem>
              <SelectItem value="FAILED">失败</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">文件名</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>大小</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">行数</TableHead>
              <TableHead>上传者</TableHead>
              <TableHead>上传时间</TableHead>
              <TableHead className="w-[60px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-10" /></TableCell>
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
                    icon={FileText}
                    title="暂无导入记录"
                    description={hasWrite ? "拖拽文件到上方区域开始导入" : "请联系工程师上传数据"}
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((imp) => {
                const sb = IMPORT_STATUS_BADGE[imp.status] ?? {
                  label: imp.status,
                  variant: "muted" as const,
                };
                const ft = FILE_TYPE_BADGE[imp.fileType] ?? {
                  label: imp.fileType,
                  variant: "muted" as const,
                };
                return (
                  <TableRow key={imp.id}>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0">
                          <div
                            className="truncate font-medium text-foreground"
                            title={imp.filename}
                          >
                            {imp.filename}
                          </div>
                          {imp.errorMsg && imp.status === "FAILED" ? (
                            <div className="truncate text-xs text-destructive">
                              {imp.errorMsg}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ft.variant} className="font-mono">
                        {ft.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatFileSize(imp.fileSize)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>
                        {imp.status === "PARSING" ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        {sb.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      <span className="text-foreground">
                        {imp.importedRows}
                      </span>
                      <span className="text-muted-foreground">
                        {" / "}
                        {imp.totalRows || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {imp.uploadedBy ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(imp.createdAt) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onSelect={() => openPreview(imp)}
                          >
                            <Eye className="h-4 w-4" />
                            预览数据
                          </DropdownMenuItem>
                          {hasDelete ? (
                            <>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setDeleteTarget(imp)}
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

      <ImportPreviewSheet
        importRecord={previewTarget}
        open={previewOpen}
        onOpenChange={(o) => {
          setPreviewOpen(o);
          if (!o) setPreviewTarget(null);
        }}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>确认删除导入记录</DialogTitle>
            <DialogDescription>
              将删除文件「{deleteTarget?.filename}」及其解析结果，无法撤销。
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

function extToMime(ext: string): string {
  const map: Record<string, string> = {
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".json": "application/json",
    ".xml": "application/xml",
  };
  return map[ext] ?? "application/octet-stream";
}
