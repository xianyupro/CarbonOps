"use client";

/**
 * StatusPulse — 系统状态指示器（点+文字）。
 */
import * as React from "react";
import { GlowingDot } from "./GlowingDot";
import { cn } from "@/lib/utils";

type Status = "online" | "warning" | "offline" | "running";

const COLOR: Record<Status, string> = {
  online: "hsl(150 100% 50%)",
  running: "hsl(150 100% 50%)",
  warning: "hsl(38 95% 60%)",
  offline: "hsl(0 85% 65%)",
};

const LABEL: Record<Status, string> = {
  online: "在线",
  running: "运行中",
  warning: "警告",
  offline: "离线",
};

interface Props {
  status?: Status;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

export function StatusPulse({ status = "online", label, showLabel = true, className }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <GlowingDot color={COLOR[status]} />
      {showLabel && (
        <span className="font-cyber text-[11px] tracking-wider text-foreground/80">
          {label ?? LABEL[status]}
        </span>
      )}
    </span>
  );
}

export default StatusPulse;