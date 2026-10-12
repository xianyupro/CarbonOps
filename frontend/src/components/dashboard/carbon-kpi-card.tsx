"use client";

import React from "react";
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface CarbonKpiCardProps {
  title: string;
  value: number | null;
  unit: string;
  icon: LucideIcon;
  trend?: number | null;
  /** Visual styling for the card accent. */
  accent?:
    | "primary"
    | "success"
    | "warning"
    | "destructive"
    | "cool"
    | "purple"
    | "gradient";
  /** When true, render the card with a brand-tinted gradient background (used for hero KPIs). */
  highlighted?: boolean;
  loading?: boolean;
  hint?: string;
}

const ACCENT_STYLES: Record<string, { iconBg: string; iconText: string; chipText: string }> = {
  primary: { iconBg: "bg-primary/12", iconText: "text-primary", chipText: "text-primary" },
  success: { iconBg: "bg-success/15", iconText: "text-success", chipText: "text-success" },
  warning: { iconBg: "bg-warning/15", iconText: "text-warning", chipText: "text-warning" },
  destructive: { iconBg: "bg-destructive/12", iconText: "text-destructive", chipText: "text-destructive" },
  cool: { iconBg: "bg-blue-500/12", iconText: "text-blue-600 dark:text-blue-300", chipText: "text-blue-600" },
  purple: { iconBg: "bg-purple-500/12", iconText: "text-purple-600 dark:text-purple-300", chipText: "text-purple-600" },
  gradient: { iconBg: "bg-gradient-primary", iconText: "text-white", chipText: "text-primary" },
};

export function CarbonKpiCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  accent = "primary",
  highlighted = false,
  loading = false,
  hint,
}: CarbonKpiCardProps) {
  const style = ACCENT_STYLES[accent];

  return (
    <Card
      variant={highlighted ? "gradient" : "default"}
      className={cn(
        "relative overflow-hidden hover-lift",
        highlighted && "shadow-glow-emerald"
      )}
    >
      {/* Decorative blob in the corner */}
      {highlighted ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/15 blur-2xl"
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-32" />
          ) : (
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-[26px] font-bold leading-none tabular-nums tracking-tight">
                {value === null ? "—" : value.toLocaleString("zh-CN")}
              </span>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
          )}
          {trend !== undefined && trend !== null && !loading && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              {trend < 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-1.5 py-0.5 font-medium text-success">
                  <ArrowDown className="h-3 w-3" />
                  {Math.abs(trend)}%
                </span>
              ) : trend > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
                  <ArrowUp className="h-3 w-3" />
                  {trend}%
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                  <Minus className="h-3 w-3" />
                  持平
                </span>
              )}
              <span className="text-muted-foreground">较上期</span>
            </div>
          )}
          {hint && trend === undefined && !loading && (
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          )}
          {hint && trend !== undefined && !loading && (
            <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
        <div
          className={cn(
            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
            style.iconBg,
            style.iconText
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
      </div>
    </Card>
  );
}
