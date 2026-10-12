"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CyberBackground } from "@/components/effects/CyberBackground";
import { registerCyberTheme } from "@/components/ui/cyber-echarts-theme";

/**
 * Authenticated application shell: fixed sidebar + top bar + scrollable main
 * content area. Renders inside the `(shell)` route group after the auth guard.
 *
 * 全局挂载赛博科技风背景层（网格 + 粒子 + 扫描线），
 * 由 body aurora 渐变 + 局部 CyberBackground 叠加。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  React.useEffect(() => {
    registerCyberTheme();
  }, []);
  return (
    <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
      {/* 全局背景层 */}
      <CyberBackground showParticles showScanLine showGrid density={50} />

      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar />
        {/* 路由切换重渲染以触发 page-enter 动画 */}
        <main
          key={pathname}
          className="scrollbar-thin relative flex-1 overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-[1600px] animate-page-enter px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}