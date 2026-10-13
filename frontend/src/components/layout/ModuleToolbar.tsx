"use client";

/** 模块工作台工具条：层级徽标 + 模块名 + 主界面标识 + 二级功能按钮区。 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface ModuleToolbarProps {
  badge: string;
  module: string;
  /** 当前主界面名称（如 数据可视化 / 知识图谱）。 */
  view: string;
  /** 二级功能按钮（子窗口入口）。 */
  actions?: React.ReactNode;
  className?: string;
}

export function ModuleToolbar({
  badge,
  module,
  view,
  actions,
  className,
}: ModuleToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-l-4 border-primary bg-card px-3 py-2",
        className
      )}
    >
      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-primary/15 text-[10px] font-bold leading-none text-primary ring-1 ring-primary/30">
        {badge}
      </span>
      <span className="text-sm font-bold tracking-wide">{module}</span>
      <span className="font-cyber text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
        MAIN · {view}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export default ModuleToolbar;
