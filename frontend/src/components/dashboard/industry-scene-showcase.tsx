"use client";

/**
 * 驾驶舱 — 行业分类场景展示区（深色赛博版）。
 * 按钢铁/有色/石化三大行业分组渲染场景卡片，
 * 点击卡片进入 /scenarios/[id] 场景详情（含 3D 数字孪生）。
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CircleCheck,
  Cpu,
  Flame,
  Leaf,
  PlusCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NeonBadge, type NeonTone } from "@/components/ui/NeonBadge";
import { cn } from "@/lib/utils";
import { INDUSTRY_GROUPS, SCENES } from "@/mock/cloud-edge";
import type { Scene } from "@/types/cloud-edge";

const INDUSTRY_THEMES: Record<string, { color: string; icon: React.ReactNode; tone: NeonTone }> = {
  钢铁: { color: "from-warning/25 to-warning/5", icon: <Flame className="h-4 w-4" />, tone: "warning" },
  有色: { color: "from-amber-400/25 to-amber-400/5", icon: <Zap className="h-4 w-4" />, tone: "warning" },
  石化: { color: "from-primary/25 to-primary/5", icon: <Building2 className="h-4 w-4" />, tone: "primary" },
};

const STATUS_BADGE: Record<Scene["status"], { label: string; tone: NeonTone }> = {
  running: { label: "● 运行中", tone: "success" },
  developing: { label: "● 建设中", tone: "warning" },
  stopped: { label: "● 已停止", tone: "primary" },
};

function SceneCard({ scene }: { scene: Scene }) {
  const router = useRouter();
  const statusBadge = STATUS_BADGE[scene.status];

  return (
    <div
      onClick={() => router.push(`/scenarios/${scene.id}`)}
      className="panel-cyber hover-lift group relative cursor-pointer overflow-hidden rounded-xl p-5"
    >
      <span className="corner-decor tr" />
      <span className="corner-decor bl" />
      <div className="mb-3 flex items-start justify-between">
        <div className="relative">
          <span aria-hidden className="absolute -inset-1 rounded-xl bg-primary/20 blur-md animate-logo-pulse" />
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-xl shadow-sm">
            {scene.icon}
          </div>
        </div>
        <NeonBadge tone={statusBadge.tone} dot>
          {statusBadge.label}
        </NeonBadge>
      </div>
      <h3 className="line-clamp-1 flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
        {scene.name}
        <span className="shrink-0 rounded bg-amber-600/10 px-1.5 py-0.5 text-[9px] font-normal text-amber-700">
          示范
        </span>
      </h3>
      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">
        {scene.desc}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-primary/15 pt-3 text-xs">
        <div>
          <p className="text-muted-foreground">减排</p>
          <p className="mt-0.5 font-cyber font-semibold tabular-nums text-success text-glow-success">
            {scene.reduction == null ? "—" : `${scene.reduction}%`}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">设备</p>
          <p className="mt-0.5 font-cyber font-semibold tabular-nums text-foreground">
            {scene.devices}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">告警</p>
          <p
            className={cn(
              "mt-0.5 font-cyber font-semibold tabular-nums",
              scene.alerts > 0 ? "text-warning text-glow-warning" : "text-muted-foreground"
            )}
          >
            {scene.alerts}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-glow-blink"

          />
          {scene.location}
        </span>
        <span className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/cockpit/twin?scene=${scene.id}`);
            }}
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:border-teal-600/40 hover:text-teal-700"
          >
            打开孪生
          </button>
          <span className="flex items-center gap-0.5 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
            详情
            <ArrowRight className="h-3 w-3" />
          </span>
        </span>
      </div>
    </div>
  );
}

export function IndustrySceneShowcase() {
  const router = useRouter();
  const runningCount = SCENES.filter((s) => s.status === "running").length;
  const totalReduction =
    SCENES.filter((s) => s.reduction != null).reduce((a, b) => a + (b.reduction ?? 0), 0) /
    Math.max(1, SCENES.filter((s) => s.reduction != null).length);

  return (
    <div>
      {/* 标题栏 */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow-cyan">
            <Cpu className="h-4 w-4" strokeWidth={2.2} />
            <span aria-hidden className="absolute -inset-1 rounded-lg bg-primary/30 blur-md animate-logo-pulse" />
          </span>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            低碳运行场景
          </h2>
          <span className="text-xs text-muted-foreground">
            1 个生产场景（实测数据）· {SCENES.length} 个行业示范场景（模拟数据）
          </span>
          <span className="font-cyber rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
            Industry Scenes
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success animate-glow-blink" />
            <span className="font-cyber">运行中 {runningCount} / {SCENES.length}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Leaf className="h-3.5 w-3.5 text-success" />
            <span className="font-cyber">均减排 {totalReduction.toFixed(1)}%</span>
          </span>
          <Button
            variant="gradient"
            size="sm"
            onClick={() => router.push("/scenarios/new")}
            className="ml-2"
          >
            <PlusCircle className="mr-1 h-3.5 w-3.5" />
            新增场景
          </Button>
        </div>
      </div>

      {/* 按行业分组 */}
      <div className="space-y-5">
        {/* 生产场景主卡：1号挥发窑（实测数据 · 数字孪生中心主场景） */}
        <div className="flex flex-col gap-4 rounded-xl border border-teal-600/30 bg-gradient-to-r from-teal-600/10 via-teal-600/5 to-transparent p-5 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-600/15 text-xl font-semibold text-teal-700">
            窑
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                1号挥发窑 · 生产实测
              </h3>
              <span className="rounded bg-teal-600/10 px-1.5 py-0.5 text-[9px] font-medium text-teal-700">
                实时数据 · 5s 刷新
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                数字孪生中心主场景
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              上料→给料→焙烧→水淬→余热回收→收尘→脱硫→引风→排放 全流程三维孪生，10 类关键设备可点击，
              数据来自数据基座现场点位
            </p>
          </div>
          <Button size="sm" onClick={() => router.push("/cockpit/twin")}>
            打开数字孪生
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>

        {INDUSTRY_GROUPS.map((group) => {
          const groupScenes = SCENES.filter((s) => group.sceneIds.includes(s.id));
          const theme = INDUSTRY_THEMES[group.name];
          return (
            <div key={group.name} className="panel-cyber overflow-hidden rounded-xl">
              <span className="corner-decor tl" />
              <span className="corner-decor tr" />
              <span className="corner-decor bl" />
              <span className="corner-decor br" />
              <div className="flex items-center gap-2 border-b border-primary/15 px-5 py-3">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br text-foreground shadow-sm",
                    theme.color
                  )}
                >
                  {theme.icon}
                </span>
                <span className="panel-title-bar text-sm font-semibold tracking-wider text-foreground">
                  {group.label}
                </span>
                <span className="font-cyber rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                  {groupScenes.length} 个场景
                </span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {groupScenes.map((scene) => (
                    <SceneCard key={scene.id} scene={scene} />
                  ))}
                </div>
                {groupScenes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
                    <AlertTriangle className="mb-2 h-6 w-6 text-muted-foreground/50" />
                    该行业暂无场景
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default IndustrySceneShowcase;