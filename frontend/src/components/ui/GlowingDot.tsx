"use client";

/**
 * GlowingDot — 呼吸光点（用于状态指示）。
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  color?: string;
  size?: "sm" | "md" | "lg";
  /** 是否闪烁（默认 true） */
  blink?: boolean;
  className?: string;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-3 w-3",
};

export function GlowingDot({ color = "hsl(150 100% 50%)", size = "md", blink = true, className }: Props) {
  return (
    <span
      className={cn("relative inline-block rounded-full", SIZE[size], className)}
      style={{
        background: color,
        boxShadow: `0 0 4px ${color}`,
      }}
    >
      {blink && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full opacity-70 animate-glow-blink"
          style={{
            background: color,
          }}
        />
      )}
    </span>
  );
}

export default GlowingDot;