"use client";

/**
 * ① 数据基座工作台。
 * 主界面：数据可视化分析台；数据源管理 / 离线导入 / 数据质量 以子窗口弹窗呈现。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { Database, ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export default function DataHubPage() {
  const [sub, setSub] = React.useState<SubWindow>(null);

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

      {/* 主工作区：数据可视化分析台 */}
      <VisualizePage />

      {/* 二级功能子窗口 */}
      <Sheet open={sub != null} onOpenChange={(o) => !o && setSub(null)}>
        <SheetContent className="w-[88%] max-w-[1100px] overflow-y-auto scrollbar-thin p-5 sm:max-w-[1100px]">
          <SheetHeader className="px-0">
            <SheetTitle className="text-base">
              ① 数据基座 · {sub ? SUB_TITLES[sub] : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="px-0 pb-6">
            {sub === "sources" && <SourcesPage />}
            {sub === "imports" && <ImportsPage />}
            {sub === "quality" && <QualityPage />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
