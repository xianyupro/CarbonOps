"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle, Database, Cpu, Settings, Server, ArrowRight, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AlarmSummary } from "@/types/api";

const CATEGORY_META = [
  { key: "DATA", label: "数据异常", icon: Database, color: "text-blue-400", bg: "bg-blue-500/10", ring: "hover:ring-blue-500/40" },
  { key: "MODEL", label: "模型异常", icon: Cpu, color: "text-purple-400", bg: "bg-purple-500/10", ring: "hover:ring-purple-500/40" },
  { key: "CONTROL", label: "调控异常", icon: Settings, color: "text-orange-400", bg: "bg-orange-500/10", ring: "hover:ring-orange-500/40" },
  { key: "SYSTEM", label: "系统异常", icon: Server, color: "text-gray-400", bg: "bg-gray-500/10", ring: "hover:ring-gray-500/40" },
] as const;

const LEVEL_META = [
  { key: "CRITICAL", label: "严重", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
  { key: "WARN", label: "警告", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  { key: "INFO", label: "提示", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
] as const;

export function AlarmOverviewSection({
  summary,
  loading,
}: {
  summary: AlarmSummary | null;
  loading: boolean;
}) {
  return (
    <Card variant="elevated">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-primary text-white shadow-glow-emerald">
            <ShieldAlert className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span>统一告警总览</span>
          <Badge variant="outline-success" className="ml-1 font-mono">
            {summary?.total ?? 0}
          </Badge>
        </CardTitle>
        <Link
          href="/scenarios?tab=alarms"
          className="group flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary/80"
        >
          查看全部告警
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level badges */}
        <div className="grid grid-cols-3 gap-3">
          {loading ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : summary ? (
            LEVEL_META.map((lv) => (
              <div
                key={lv.key}
                className={`flex flex-col items-center justify-center rounded-xl border ${lv.border} ${lv.bg} py-4 transition-transform hover:-translate-y-0.5 hover:shadow-card-sm`}
              >
                <span className={`text-3xl font-bold tabular-nums ${lv.color}`}>
                  {summary.byLevel[lv.key as keyof typeof summary.byLevel] ?? 0}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">{lv.label}</span>
              </div>
            ))
          ) : null}
        </div>

        {/* Category breakdown */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)
          ) : summary ? (
            CATEGORY_META.map((cat) => {
              const Icon = cat.icon;
              const count = summary.byCategory[cat.key as keyof typeof summary.byCategory] ?? 0;
              return (
                <Link
                  key={cat.key}
                  href={`/scenarios?tab=alarms&category=${cat.key}`}
                  className={`group flex items-center gap-2.5 rounded-xl border border-border/60 ${cat.bg} p-3 transition-all hover:-translate-y-0.5 hover:shadow-card-sm hover:ring-1 ${cat.ring}`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-card/60 ${cat.color}`}>
                    <Icon className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tabular-nums leading-none">{count}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{cat.label}</p>
                  </div>
                </Link>
              );
            })
          ) : null}
        </div>

        {/* Status summary */}
        {!loading && summary && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Bell className="h-3.5 w-3.5 text-destructive" />
              活跃 {summary.active}
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              已确认 {summary.acked}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-success" />
              已解决 {summary.resolved}
            </span>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-mono">
              合计 {summary.total}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
