"use client";

import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ElementType;
  className?: string;
  children?: React.ReactNode;
  /** Use a softer, decorative brand-tinted background (default true). */
  decorative?: boolean;
}

/**
 * Lightweight "no data" placeholder. Use inside cards, tables, sheets.
 */
export function EmptyState({
  title = "暂无数据",
  description,
  icon: Icon = Inbox,
  className,
  children,
  decorative = true,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className
      )}
    >
      <div
        className={cn(
          "relative flex h-16 w-16 items-center justify-center rounded-2xl",
          decorative &&
            "bg-gradient-to-br from-primary/15 via-primary/8 to-card text-primary ring-1 ring-primary/20 shadow-glow-emerald"
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={1.8} />
        {decorative ? (
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary/20 blur-md"
          />
        ) : null}
      </div>
      <div>
        <div className="text-base font-medium text-foreground/85">{title}</div>
        {description ? (
          <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
