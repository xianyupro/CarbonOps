"use client";

/**
 * SectionDivider — 蓝色发光分隔条。
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  label?: string;
  className?: string;
}

export function SectionDivider({ label, className }: Props) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-primary" />
        <span className="font-cyber text-[10px] uppercase tracking-[0.2em] text-primary text-glow-cyan">
          {label}
        </span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-primary/40 to-primary" />
      </div>
    );
  }
  return (
    <div className={cn("relative h-px w-full", className)}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary animate-glow-blink" />
    </div>
  );
}

export default SectionDivider;