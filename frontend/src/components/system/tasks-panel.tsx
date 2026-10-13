"use client";

/** 定时任务面板：平台内部周期任务清单（只读）。 */
import * as React from "react";
import { CalendarClock } from "lucide-react";

import { api } from "@/lib/api";
import type { SystemTask } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function TasksPanel() {
  const [tasks, setTasks] = React.useState<SystemTask[] | null>(null);

  React.useEffect(() => {
    api.systemAdmin.tasks().then(setTasks).catch(() => setTasks([]));
  }, []);

  if (!tasks) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div key={t.key} className="flex items-start gap-3 rounded-md border border-border p-3">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{t.name}</p>
              <Badge variant={t.enabled ? "default" : "outline"}>{t.enabled ? "运行中" : "未启用"}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
          </div>
          <span className="font-cyber shrink-0 text-xs text-muted-foreground">{t.cycle}</span>
        </div>
      ))}
      <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
        任务清单由平台启动配置生成（只读）；调整周期需修改后端 .env 配置项后重启服务。
      </p>
    </div>
  );
}

export default TasksPanel;
