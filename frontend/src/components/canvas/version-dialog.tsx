/**
 * 版本历史对话框
 * 打开时拉取当前表单版本号，前端 mock 生成版本历史列表
 */
"use client";

import * as React from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface VersionDialogProps {
  formId: number;
  formName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VersionItem {
  version: string;
  date: string;
  isCurrent: boolean;
}

/** 从 versionNo (如 "v1.3") 解析并生成 mock 版本历史 */
function generateVersionHistory(
  currentVersionNo: string,
  createdAt: string
): VersionItem[] {
  const match = currentVersionNo.match(/(\d+)\.(\d+)/);
  if (!match)
    return [{ version: currentVersionNo, date: createdAt, isCurrent: true }];
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const total = major * 10 + minor;
  const versions: VersionItem[] = [];
  for (let i = total; i >= 1 && i > total - 10; i--) {
    const vMajor = Math.floor(i / 10);
    const vMinor = i % 10;
    versions.push({
      version: `v${vMajor}.${vMinor}`,
      date: createdAt, // mock：在实际项目中应为各版本的创建时间
      isCurrent: i === total,
    });
  }
  return versions;
}

export function VersionDialog({
  formId,
  formName,
  open,
  onOpenChange,
}: VersionDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [versionNo, setVersionNo] = React.useState("");
  const [createdAt, setCreatedAt] = React.useState("");
  const [versions, setVersions] = React.useState<VersionItem[]>([]);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    api.forms
      .get(formId)
      .then((res) => {
        if (!active) return;
        setVersionNo(res.versionNo);
        setCreatedAt(res.createdAt);
        setVersions(generateVersionHistory(res.versionNo, res.createdAt));
      })
      .catch((err) => {
        if (!active) return;
        toast.error(err instanceof ApiError ? err.message : "加载版本信息失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, formId]);

  function handleRollback(v: VersionItem) {
    toast.success(`已回滚到 ${v.version}（演示功能，未实际执行）`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-900 text-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <History className="h-4 w-4 text-blue-400" />
            版本历史
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {formName}
          </DialogDescription>
        </DialogHeader>

        {/* 当前版本摘要 */}
        <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-800/40 px-3 py-2">
          <span className="text-xs text-slate-400">当前版本</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {versionNo || "—"}
            </Badge>
            {createdAt ? (
              <span className="text-[11px] text-slate-500">
                {new Date(createdAt).toLocaleString("zh-CN")}
              </span>
            ) : null}
          </div>
        </div>

        <Separator className="bg-slate-800" />

        {/* 版本列表 */}
        <div className="max-h-[340px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : versions.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              暂无版本记录
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {versions.map((v) => (
                <li
                  key={v.version}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-xs",
                    v.isCurrent
                      ? "bg-slate-800"
                      : "hover:bg-slate-800/40"
                  )}
                >
                  <Badge
                    variant="outline"
                    className="font-mono text-slate-300"
                  >
                    {v.version}
                  </Badge>
                  <span className="flex-1 text-slate-500">
                    {v.date
                      ? new Date(v.date).toLocaleString("zh-CN")
                      : "—"}
                  </span>
                  {v.isCurrent ? (
                    <Badge variant="success">当前</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-2 text-[11px] text-slate-400 hover:bg-slate-700 hover:text-white"
                      onClick={() => handleRollback(v)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      一键回滚
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
