import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional eyebrow label rendered above the title (eyebrow small · uppercase). */
  eyebrow?: string;
  /** Optional icon shown next to the title. */
  icon?: LucideIcon;
  /** Optional right-aligned actions (buttons, filters, etc.). */
  actions?: React.ReactNode;
  /** Optional small breadcrumb-style chips above the title. */
  meta?: React.ReactNode;
  className?: string;
}

/**
 * 工业风页头：左侧竖向标识条 + 模块编码（等宽）+ 标题；
 * 信息密度高，无营销化装饰。
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  // 从 eyebrow 提取模块编码（如 "数据管理 · Visualization" → VIS），用于右上角系统戳
  const code = eyebrow?.split("·").pop()?.trim().slice(0, 3).toUpperCase() ?? "";

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 border-b-2 border-border pb-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      {/* 竖向标识条 */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />

      <div className="min-w-0 flex-1 pl-3">
        {eyebrow ? (
          <div className="mb-1 flex items-center gap-2">
            <span className="font-cyber text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </span>
            {code ? (
              <span className="font-cyber border border-border bg-muted px-1 py-px text-[9px] leading-none text-muted-foreground">
                {code}
              </span>
            ) : null}
          </div>
        ) : null}
        {meta ? <div className="mb-1.5 flex items-center gap-2">{meta}</div> : null}
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </div>
          ) : null}
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
