"use client";

/**
 * ③ 组件平台工作台。
 * 主界面：控制流编排；组态开发 以全屏子窗口呈现。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { PenTool, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModuleToolbar } from "@/components/layout/ModuleToolbar";

const FlowPage = dynamic(() => import("@/app/(shell)/platform/flow/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const StudioPage = dynamic(() => import("@/app/(shell)/studio/page"), {
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

export default function PlatformHubPage() {
  const [studioOpen, setStudioOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-3">
      <ModuleToolbar
        badge="③"
        module="组件平台"
        view="控制流编排"
        actions={
          <Button variant="outline" size="sm" onClick={() => setStudioOpen(true)}>
            <PenTool className="mr-1 h-3.5 w-3.5" /> 组态开发
          </Button>
        }
      />

      {/* 主工作区：控制流编排 */}
      <FlowPage />

      {/* 组态开发全屏子窗口 */}
      {studioOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-card px-4">
            <p className="text-sm font-semibold">
              ③ 组件平台 · <span className="text-primary">组态开发</span>
            </p>
            <Button variant="outline" size="sm" onClick={() => setStudioOpen(false)}>
              <X className="mr-1 h-3.5 w-3.5" /> 关闭组态
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <StudioPage />
          </div>
        </div>
      )}
    </div>
  );
}
