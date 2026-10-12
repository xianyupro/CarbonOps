"use client";

/**
 * NeonBadge — 替换 shadcn Badge 的发光徽标。
 * 支持 success/warning/danger/info/primary 多色调。
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type NeonTone = "success" | "warning" | "danger" | "primary" | "info" | "purple";

const TONE: Record<NeonTone, string> = {
  success:
    "bg-success/10 text-success border border-success/40 shadow-[0_0_10px_hsl(150_100%_50%_/_0.25)]",
  warning:
    "bg-warning/10 text-warning border border-warning/40 shadow-[0_0_10px_hsl(38_95%_60%_/_0.25)]",
  danger:
    "bg-destructive/10 text-destructive border border-destructive/40 shadow-[0_0_10px_hsl(0_85%_65%_/_0.25)]",
  primary:
    "bg-primary/10 text-primary border border-primary/40 shadow-[0_0_10px_hsl(195_100%_50%_/_0.25)]",
  info: "bg-cool/10 text-cool border border-cool/40 shadow-[0_0_10px_hsl(220_100%_60%_/_0.25)]",
  purple:
    "bg-purple-500/10 text-purple-300 border border-purple-400/40 shadow-[0_0_10px_hsl(265_80%_60%_/_0.25)]",
};

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: NeonTone;
  /** 前缀小圆点（呼吸光） */
  dot?: boolean;
}

export function NeonBadge({ tone = "primary", dot, className, children, ...rest }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        TONE[tone],
        className
      )}
      {...rest}
    >
      {dot && <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-glow-blink" />}
      {children}
    </span>
  );
}

export default NeonBadge;