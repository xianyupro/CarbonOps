"use client";

/**
 * ④ 驾驶舱中心工作台。
 * 三个同级全屏视图切换：运行总览 / 数字孪生 / 自定义大屏。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { AreaChart, Boxes, LayoutGrid } from "lucide-react";

import ModuleToolbar from "@/components/layout/ModuleToolbar";
import { cn } from "@/lib/utils";

const DashboardPage = dynamic(() => import("@/app/(shell)/dashboard/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const TwinPage = dynamic(() => import("@/app/(shell)/cockpit/twin/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const ScreenPage = dynamic(() => import("@/app/(shell)/cockpit/screen/page"), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  return (
    <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
      正在加载…
    </div>
  );
}

type View = "overview" | "twin" | "screen";

const VIEWS: { key: View; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "运行总览", icon: AreaChart },
  { key: "twin", label: "数字孪生", icon: Boxes },
  { key: "screen", label: "自定义大屏", icon: LayoutGrid },
];

export default function CockpitHubPage() {
  const [view, setView] = React.useState<View>("overview");

  return (
    <div className="flex flex-col gap-3">
      <ModuleToolbar
        badge="④"
        module="驾驶舱中心"
        view={VIEWS.find((v) => v.key === view)?.label ?? ""}
        actions={
          <div className="flex items-center border border-border bg-card p-0.5">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const active = view === v.key;
              return (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {v.label}
                </button>
              );
            })}
          </div>
        }
      />

      {/* 视图区：切换渲染，保留各视图自身状态由组件内部管理 */}
      {view === "overview" && <DashboardPage />}
      {view === "twin" && <TwinPage />}
      {view === "screen" && <ScreenPage />}
    </div>
  );
}
