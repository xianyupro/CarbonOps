"use client";

/**
 * CyberStatCard — 统计卡，含角部 L 装饰 + 大数字 + 渐变数字。
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { NumberRoll } from "./NumberRoll";

interface Props {
  /** 图标 slot */
  icon?: React.ReactNode;
  /** 标题（小字） */
  label: string;
  /** 主数字（支持 NumberRoll 动画） */
  value: string | number;
  /** 单位 */
  unit?: string;
  /** 副描述 */
  description?: React.ReactNode;
  /** 主色（用于图标背景 + 数字渐变） */
  tone?: "primary" | "cool" | "success" | "warning" | "danger" | "purple";
  /** 数字滚动的目标（当 value 是数字时启用） */
  animateTo?: number;
  /** 是否禁用 hover lift（用于网格内紧密排列） */
  noLift?: boolean;
  className?: string;
}

const TONE_BG: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-primary/15 text-primary",
  cool: "bg-cool/15 text-cool",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
  purple: "bg-purple-500/15 text-purple-400",
};

const TONE_GRAD: Record<NonNullable<Props["tone"]>, string> = {
  primary: "text-gradient-primary",
  cool: "text-gradient-cool",
  success: "text-gradient-success",
  warning: "",
  danger: "",
  purple: "text-gradient-cool",
};

export function CyberStatCard({
  icon,
  label,
  value,
  unit,
  description,
  tone = "primary",
  animateTo,
  noLift,
  className,
}: Props) {
  const numericValue = typeof value === "number" ? value : null;
  return (
    <div
      className={cn(
        "panel-cyber group relative cursor-default rounded-xl px-5 py-4",
        !noLift && "hover-lift",
        className
      )}
    >
      <span className="corner-decor tr" />
      <span className="corner-decor bl" />

      <div className="flex items-start justify-between">
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              TONE_BG[tone]
            )}
          >
            {icon}
          </div>
        )}
        {description && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {description}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span
          className={cn(
            "font-cyber text-2xl font-bold tabular-nums leading-none",
            TONE_GRAD[tone]
          )}
        >
          {numericValue != null ? <NumberRoll target={animateTo ?? numericValue} /> : value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>

      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default CyberStatCard;