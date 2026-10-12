"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { navConfig } from "@/lib/nav";
import { useAuthStore } from "@/stores/auth-store";
import { LogoMark } from "@/components/layout/Topbar";
import { StatusPulse } from "@/components/ui/StatusPulse";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname() || "";
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  const visibleGroups = React.useMemo(
    () =>
      navConfig
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (!item.permission && !item.anyPermission) return true;
            if (item.permission && hasPermission(item.permission)) return true;
            if (item.anyPermission && hasAnyPermission(item.anyPermission))
              return true;
            return false;
          }),
        }))
        .filter((g) => g.items.length > 0),
    [hasPermission, hasAnyPermission]
  );

  return (
    <aside className="relative flex h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar/90 backdrop-blur-xl text-sidebar-foreground shadow-card-lg">
      {/* 网格底纹（局部） */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cyber-grid bg-grid-60 opacity-50"
      />

      {/* 环境光 */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-12 top-0 h-40 w-40 rounded-full bg-primary/15 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-12 h-48 w-48 rounded-full bg-cool/15 blur-3xl"
      />

      {/* 品牌区 */}
      <div className="relative flex h-16 items-center gap-3 border-b border-primary/15 px-5">
        <LogoMark size={36} />
        <div className="leading-tight">
          <div className="text-[14px] font-bold tracking-wide text-primary text-glow-cyan">
            全流程低碳运行
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
            智能监测与调控平台
          </div>
        </div>
      </div>

      {/* 四层递进架构进度条 */}
      <div className="relative flex items-center gap-1 border-b border-primary/10 px-5 py-2 text-[9px] tracking-wide text-sidebar-foreground/50">
        <span className="font-cyber">数据</span>
        <ChevronRight className="h-2.5 w-2.5 text-primary/50" />
        <span className="font-cyber">元模型</span>
        <ChevronRight className="h-2.5 w-2.5 text-primary/50" />
        <span className="font-cyber">组件</span>
        <ChevronRight className="h-2.5 w-2.5 text-primary/50" />
        <span className="font-cyber text-primary/80">驾驶舱</span>
      </div>

      {/* 导航 */}
      <nav className="scrollbar-thin relative flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-5">
          {visibleGroups.map((group, gi) => (
            <li key={gi}>
              {group.title ? (
                <div className="mb-2 flex items-center gap-2 px-1.5">
                  {group.badge ? (
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-primary/15 text-[10px] font-bold leading-none text-primary ring-1 ring-primary/30">
                      {group.badge}
                    </span>
                  ) : null}
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/70">
                    {group.title}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
                </div>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-2.5 overflow-hidden rounded-md px-2.5 py-2 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-gradient-to-r from-primary/25 via-primary/10 to-transparent text-foreground"
                            : "text-sidebar-foreground/75 hover:bg-primary/5 hover:text-foreground hover:translate-x-0.5"
                        )}
                      >
                        {active ? (
                          <>
                            <span
                              aria-hidden
                              className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-gradient-to-b from-primary to-cool shadow-sm"
                            />
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-0 -z-10 animate-neon-pulse rounded-md"
                            />
                          </>
                        ) : null}
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            active
                              ? "text-primary text-glow-cyan"
                              : "text-sidebar-foreground/55 group-hover:text-primary/80"
                          )}
                          strokeWidth={2}
                        />
                        <span className="truncate">{item.label}</span>
                        {active ? (
                          <span
                            aria-hidden
                            className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-glow-blink"
                           
                          />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer 状态条 */}
      <div className="relative border-t border-primary/15 px-5 py-3">
        <div className="flex items-center justify-between text-[10px]">
          <StatusPulse status="online" label="系统在线" />
          <span className="font-cyber rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-primary">
            v0.1.0
          </span>
        </div>
      </div>
    </aside>
  );
}