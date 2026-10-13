"use client";

/**
 * ③ 组件平台工作台。
 * 主界面：控制流编排；组态开发 以全屏子窗口呈现。
 */
import * as React from "react";
import dynamic from "next/dynamic";

import { ModuleToolbar } from "@/components/layout/ModuleToolbar";

const FlowPage = dynamic(() => import("@/app/(shell)/platform/flow/page"), {
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
  return (
    <div className="flex flex-col gap-3">
      <ModuleToolbar
        badge="③"
        module="组件平台"
        view="控制流编排"
      />

      {/* 主工作区：控制流编排 */}
      <FlowPage />

    </div>
  );
}
