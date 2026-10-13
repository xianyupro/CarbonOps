"use client";

/**
 * ① 数据基座工作台。
 * 主界面：数据可视化分析台；顶部为平台资源统计条；
 * 数据源管理 / 离线导入 / 数据质量 以居中子窗口弹窗呈现。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { Database, Gauge, ShieldCheck, Upload } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModuleToolbar } from "@/components/layout/ModuleToolbar";

const VisualizePage = dynamic(() => import("@/app/(shell)/data/visualize/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const SourcesPage = dynamic(() => import("@/app/(shell)/data/sources/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const ImportsPage = dynamic(() => import("@/app/(shell)/data/imports/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const QualityPage = dynamic(() => import("@/app/(shell)/data/quality/page"), {
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

type SubWindow = "sources" | "imports" | "quality" | null;

const SUB_TITLES: Record<"sources" | "imports" | "quality", string> = {
  sources: "数据源管理",
  imports: "离线导入",
  quality: "数据质量",
};

interface HubStats {
  dataSourceCount: number;
  pointCount: number;
  onlineRate: number;
  completenessRate: number;
}

export default function DataHubPage() {
  const [sub, setSub] = React.useState<SubWindow>(null);
  const [stats, setStats] = React.useState<HubStats | null>(null);

  React.useEffect(() => {
    api.dashboard
      .overview()
      .then((o) =>
        setStats({
          dataSourceCount: o.dataSourceCount,
          pointCount: o.pointCount,
          onlineRate:
            o.dataSourceCount > 0
              ? Math.round((o.onlineSourceCount / o.dataSourceCount) * 100)
              : 0,
          completenessRate: Math.round(o.avgCompletenessRate ?? 0),
        })
      )
      .catch(() => {});
  }, []);

  const counters = stats
    ? [
        { icon: Database, label: "接入数据源", value: String(stats.dataSourceCount).padStart(2, "0"), unit: "个" },
        { icon: Gauge, label: "采集点位", value: String(stats.pointCount).padStart(3, "0"), unit: "个" },
        { icon: Upload, label: "在线率", value: `${stats.onlineRate}`, unit: "%" },
        { icon: ShieldCheck, label: "数据完整率", value: `${stats.completenessRate}`, unit: "%" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <ModuleToolbar
        badge="①"
        module="数据基座"
        view="数据可视化"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setSub("sources")}>
              <Database className="mr-1 h-3.5 w-3.5" /> 数据源管理
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSub("imports")}>
              <Upload className="mr-1 h-3.5 w-3.5" /> 离线导入
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSub("quality")}>
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> 数据质量
            </Button>
          </>
        }
      />

      {/* 资源统计条 */}
      {counters.length > 0 && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {counters.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                className="flex items-center gap-2.5 border border-border bg-card px-3 py-2"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[10px] text-muted-foreground">{c.label}</p>
                  <p className="font-cyber text-base font-bold leading-tight tabular-nums">
                    {c.value}
                    <span className="ml-0.5 text-[10px] font-normal text-slate-400">{c.unit}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 主工作区：数据可视化分析台 */}
      <VisualizePage />

      {/* 二级功能子窗口（居中弹窗） */}
      <Dialog open={sub != null} onOpenChange={(o) => !o && setSub(null)}>
        <DialogContent className="flex h-[86vh] max-w-[min(1100px,94vw)] flex-col p-5">
          <DialogHeader className="px-0">
            <DialogTitle className="text-base">
              ① 数据基座 · {sub ? SUB_TITLES[sub] : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin pr-1">
            {sub === "sources" && <SourcesPage />}
            {sub === "imports" && <ImportsPage />}
            {sub === "quality" && <QualityPage />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
