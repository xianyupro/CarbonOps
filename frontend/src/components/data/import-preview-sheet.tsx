"use client";

import * as React from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { IMPORT_STATUS_BADGE } from "@/lib/constants";
import type { DataImport, DataImportPreview } from "@/types/api";

interface ImportPreviewSheetProps {
  /** The import record (must be provided when open). */
  importRecord: DataImport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportPreviewSheet({
  importRecord,
  open,
  onOpenChange,
}: ImportPreviewSheetProps) {
  const [preview, setPreview] = React.useState<DataImportPreview | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !importRecord) {
      setPreview(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await api.dataImports.preview(importRecord.id);
        if (active) setPreview(data);
      } catch (err) {
        if (active) {
          const msg =
            err instanceof ApiError
              ? err.message
              : "加载预览失败，文件可能已被删除";
          toast.error(msg);
          onOpenChange(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, importRecord?.id]);

  const status = importRecord?.status;
  const statusBadge = status ? IMPORT_STATUS_BADGE[status] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-3xl">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">
              {importRecord?.filename ?? "导入预览"}
            </SheetTitle>
            {statusBadge ? (
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            ) : null}
          </div>
          <SheetDescription>
            {importRecord
              ? `${importRecord.fileType} · ${(importRecord.fileSize / 1024).toFixed(1)} KB`
              : ""}
          </SheetDescription>
        </SheetHeader>

        {importRecord?.status === "FAILED" && importRecord.errorMsg ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <div className="font-medium">解析失败</div>
              <div className="text-xs leading-relaxed">
                {importRecord.errorMsg}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {preview
                ? `展示前 ${Math.min(preview.rows.length, 100)} 行（共 ${
                    preview.total
                  } 行）`
                : ""}
            </span>
            <span className="text-muted-foreground">
              {importRecord
                ? `已导入 ${importRecord.importedRows} / ${importRecord.totalRows} 行`
                : ""}
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !preview ? (
            <EmptyState
              icon={Loader2}
              title="无预览数据"
              description="可能仍在解析中或解析失败"
            />
          ) : preview.columns.length === 0 ? (
            <EmptyState title="文件为空" />
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[40px] text-right">#</TableHead>
                    {preview.columns.map((c, i) => (
                      <TableHead key={i}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={preview.columns.length + 1}
                        className="py-6 text-center text-xs text-muted-foreground"
                      >
                        无数据行
                      </TableCell>
                    </TableRow>
                  ) : (
                    preview.rows.map((row, ri) => (
                      <TableRow key={ri}>
                        <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                          {ri + 1}
                        </TableCell>
                        {preview.columns.map((_, ci) => (
                          <TableCell
                            key={ci}
                            className="font-mono text-xs text-foreground/90"
                          >
                            {formatCell(row[ci])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
