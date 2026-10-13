"use client";

/** 数据库管理面板：库统计 + 备份创建/下载/删除。 */
import * as React from "react";
import { toast } from "sonner";
import { Download, HardDriveDownload, Loader2, Plus, Trash2 } from "lucide-react";

import { api } from "@/lib/api";
import type { DbBackup, DbStats } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function fmtSize(n: number): string {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n > 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export function DbPanel() {
  const [stats, setStats] = React.useState<DbStats | null>(null);
  const [backups, setBackups] = React.useState<DbBackup[]>([]);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api.systemAdmin.dbStats().then(setStats).catch(() => {});
    api.systemAdmin.backups().then(setBackups).catch(() => {});
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function createBackup() {
    setBusy(true);
    try {
      const r = await api.systemAdmin.createBackup();
      toast.success(`备份完成：${r.name}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "备份失败");
    } finally {
      setBusy(false);
    }
  }

  async function removeBackup(name: string) {
    if (!window.confirm(`确认删除备份 ${name}？`)) return;
    try {
      await api.systemAdmin.deleteBackup(name);
      toast.success("已删除");
      load();
    } catch {
      toast.error("删除失败");
    }
  }

  async function downloadBackup(name: string) {
    try {
      const token = localStorage.getItem("carbonops_access_token") ?? "";
      const res = await fetch(api.systemAdmin.backupDownloadUrl(name), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("下载失败");
    }
  }

  return (
    <div className="space-y-5">
      {/* 库概况 */}
      <section>
        <h3 className="panel-title-bar mb-2 text-xs font-semibold text-muted-foreground">数据库概况</h3>
        {!stats ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <p className="mb-2 font-cyber text-xs text-muted-foreground">
              carbonops.db · {fmtSize(stats.fileSize)} · {stats.tables.length} 张表
            </p>
            <div className="grid max-h-52 grid-cols-2 gap-1 overflow-y-auto scrollbar-thin rounded-md border border-border p-2 sm:grid-cols-3">
              {stats.tables.map((t) => (
                <div key={t.table} className="flex items-center justify-between px-1.5 text-xs">
                  <span className="truncate font-cyber text-muted-foreground">{t.table}</span>
                  <span className="tabular-nums">{t.rows.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 备份 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="panel-title-bar text-xs font-semibold text-muted-foreground">备份管理</h3>
          <Button size="sm" onClick={createBackup} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
            立即备份
          </Button>
        </div>
        {backups.length === 0 ? (
          <p className="rounded-md bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
            暂无备份，点击「立即备份」生成在线备份（不锁库）
          </p>
        ) : (
          <div className="space-y-1.5">
            {backups.map((b) => (
              <div key={b.name} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
                <HardDriveDownload className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate font-cyber">{b.name}</span>
                <span className="text-muted-foreground">{fmtSize(b.size)}</span>
                <span className="ml-auto text-muted-foreground">{b.modifiedAt.slice(0, 16).replace("T", " ")}</span>
                <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => downloadBackup(b.name)}>
                  <Download className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-destructive" onClick={() => removeBackup(b.name)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default DbPanel;
