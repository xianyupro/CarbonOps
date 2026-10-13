"use client";

/**
 * 系统管理工作台。
 * 视图切换：用户与权限 / 操作日志 / 系统设置 / 数据库与备份 / 定时任务。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import {
  CalendarClock,
  Database,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";

import ModuleToolbar from "@/components/layout/ModuleToolbar";
import { cn } from "@/lib/utils";

const UsersPage = dynamic(() => import("@/app/(shell)/system/users/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const LogsPage = dynamic(() => import("@/app/(shell)/system/logs/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const SettingsPanel = dynamic(() => import("@/components/system/settings-panel"), {
  ssr: false,
  loading: () => <Loading />,
});
const DbPanel = dynamic(() => import("@/components/system/db-panel"), {
  ssr: false,
  loading: () => <Loading />,
});
const TasksPanel = dynamic(() => import("@/components/system/tasks-panel"), {
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

type View = "users" | "logs" | "settings" | "db" | "tasks";

const VIEWS: { key: View; label: string; icon: React.ElementType }[] = [
  { key: "users", label: "用户与权限", icon: Users },
  { key: "logs", label: "操作日志", icon: ScrollText },
  { key: "settings", label: "系统设置", icon: Settings },
  { key: "db", label: "数据库与备份", icon: Database },
  { key: "tasks", label: "定时任务", icon: CalendarClock },
];

export default function SystemHubPage() {
  const [view, setView] = React.useState<View>("users");

  return (
    <div className="flex flex-col gap-3">
      <ModuleToolbar
        badge=""
        module="系统管理"
        view={VIEWS.find((v) => v.key === view)?.label ?? ""}
        actions={
          <div className="flex flex-wrap items-center border border-border bg-card p-0.5">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const active = view === v.key;
              return (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {v.label}
                </button>
              );
            })}
          </div>
        }
      />

      <div className="min-h-0">
        {view === "users" && <UsersPage />}
        {view === "logs" && <LogsPage />}
        {view === "settings" && (
          <div className="border border-border bg-card p-4">
            <SettingsPanel />
          </div>
        )}
        {view === "db" && (
          <div className="border border-border bg-card p-4">
            <DbPanel />
          </div>
        )}
        {view === "tasks" && (
          <div className="border border-border bg-card p-4">
            <TasksPanel />
          </div>
        )}
      </div>
    </div>
  );
}
