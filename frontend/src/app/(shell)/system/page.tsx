"use client";

/**
 * 系统管理工作台。
 * 主界面：用户与权限；操作日志 以子窗口弹窗呈现。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ModuleToolbar } from "@/components/layout/ModuleToolbar";

const UsersPage = dynamic(() => import("@/app/(shell)/system/users/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const LogsPage = dynamic(() => import("@/app/(shell)/system/logs/page"), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  return (
    <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
      正在加载…
    </div>
  );
}

export default function SystemHubPage() {
  const [logsOpen, setLogsOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-3">
      <ModuleToolbar
        badge=""
        module="系统管理"
        view="用户与权限"
        actions={
          <Button variant="outline" size="sm" onClick={() => setLogsOpen(true)}>
            <ScrollText className="mr-1 h-3.5 w-3.5" /> 操作日志
          </Button>
        }
      />

      {/* 主工作区：用户与权限 */}
      <UsersPage />

      {/* 操作日志子窗口 */}
      <Sheet open={logsOpen} onOpenChange={setLogsOpen}>
        <SheetContent className="w-[88%] max-w-[1100px] overflow-y-auto scrollbar-thin p-5 sm:max-w-[1100px]">
          <SheetHeader className="px-0">
            <SheetTitle className="text-base">系统管理 · 操作日志</SheetTitle>
          </SheetHeader>
          <div className="px-0 pb-6">
            <LogsPage />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
