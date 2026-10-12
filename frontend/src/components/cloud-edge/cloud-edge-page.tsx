"use client";

/**
 * 云边端资源协同 — 主页（client）。
 * - 顶部：云-边-端 三层架构拓扑
 * - 子 Tab：模型库管理 / 碳排监测仪表 / 现场实施数据
 *   子 Tab 通过 ?tab= query 同步 URL，刷新保留状态。
 */
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, Building2, ChevronRight, Cloud, Cpu, Radio, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ModelLibraryPanel } from "@/components/cloud-edge/model-library-panel";
import { MonitorInstrumentPanel } from "@/components/cloud-edge/monitor-instrument-panel";
import { FieldDataPanel } from "@/components/cloud-edge/field-data-panel";

type Tab = "models" | "monitor" | "field";
const TAB_META: Record<Tab, { label: string; icon: React.ReactNode; desc: string }> = {
  models: {
    label: "模型库管理",
    icon: <Boxes className="h-4 w-4" />,
    desc: "查看模型研究方向、模型库详情、知识图谱",
  },
  monitor: {
    label: "碳排监测仪表",
    icon: <Radio className="h-4 w-4" />,
    desc: "监测终端仪表列表、状态与地理分布",
  },
  field: {
    label: "现场实施数据",
    icon: <Building2 className="h-4 w-4" />,
    desc: "现场实施现场监测、CO₂/能耗/传感器实时数据",
  },
};

export function CloudEdgePage() {
  const router = useRouter();
  const search = useSearchParams();
  const tab: Tab = ((search.get("tab") as Tab) || "models");

  const setTab = (t: Tab) => {
    const url = t === "models" ? "/cloud-edge" : `/cloud-edge?tab=${t}`;
    router.replace(url, { scroll: false });
  };

  return (
    <div className="space-y-6 pb-10">
      {/* 顶栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-emerald-500 text-white shadow-glow-emerald">
              <Cloud className="h-4 w-4" />
            </span>
            云边端资源协同
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            统一管理云端模型库、边缘计算节点、监测仪表与现场实施数据
          </p>
        </div>
      </div>

      {/* 云边端架构拓扑 */}
      <TopologyCard />

      {/* 子 Tab */}
      <div className="flex flex-wrap items-stretch gap-2 border-b border-border/40">
        {(Object.keys(TAB_META) as Tab[]).map((t) => {
          const meta = TAB_META[t];
          const active = t === tab;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2 text-sm transition",
                active
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {meta.icon}
              <span className="font-medium">{meta.label}</span>
              {active ? <ChevronRight className="h-3 w-3 opacity-50" /> : null}
            </button>
          );
        })}
        <Badge variant="muted" className="ml-auto self-center text-[10px]">
          {TAB_META[tab].desc}
        </Badge>
      </div>

      {/* 子面板 */}
      {tab === "models" && <ModelLibraryPanel />}
      {tab === "monitor" && <MonitorInstrumentPanel />}
      {tab === "field" && <FieldDataPanel />}
    </div>
  );
}

/* ====== 架构拓扑卡片 ====== */
function TopologyCard() {
  return (
    <Card>
      <span className="corner-decor tl" />
      <span className="corner-decor tr" />
      <span className="corner-decor bl" />
      <span className="corner-decor br" />
      <CardHeader>
        <CardTitle className="text-sm">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Cloud className="h-3.5 w-3.5" />
          </span>
          云边端协同架构拓扑
        </CardTitle>
        <span className="font-cyber ml-auto rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
          156 模型 · 3 边缘节点 · 48 监测终端
        </span>
      </CardHeader>
      <CardContent>
        <div className="relative h-[280px] overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
          {/* 网格底纹 */}
          <div aria-hidden className="absolute inset-0 bg-cyber-grid-fine bg-grid-20 opacity-40" />
          {/* 连线 */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {/* 云 → 边 */}
            <path d="M 50% 30 Q 50% 50, 18% 50" stroke="#10b981" strokeWidth={1.6} strokeDasharray="6 4" fill="none" opacity={0.85} className="animate-data-flow" />
            <path d="M 50% 30 Q 50% 50, 50% 50" stroke="#10b981" strokeWidth={1.6} strokeDasharray="6 4" fill="none" opacity={0.85} className="animate-data-flow" />
            <path d="M 50% 30 Q 50% 50, 82% 50" stroke="#10b981" strokeWidth={1.6} strokeDasharray="6 4" fill="none" opacity={0.85} className="animate-data-flow" />
            {/* 边 → 终 */}
            <path d="M 18% 50 Q 18% 75, 8% 75" stroke="#0891b2" strokeWidth={1.4} strokeDasharray="4 4" fill="none" opacity={0.7} className="animate-data-flow" />
            <path d="M 18% 50 Q 18% 75, 28% 75" stroke="#0891b2" strokeWidth={1.4} strokeDasharray="4 4" fill="none" opacity={0.7} className="animate-data-flow" />
            <path d="M 50% 50 Q 50% 75, 50% 75" stroke="#0891b2" strokeWidth={1.4} strokeDasharray="4 4" fill="none" opacity={0.7} className="animate-data-flow" />
            <path d="M 50% 50 Q 50% 75, 60% 75" stroke="#0891b2" strokeWidth={1.4} strokeDasharray="4 4" fill="none" opacity={0.7} className="animate-data-flow" />
            <path d="M 82% 50 Q 82% 75, 80% 75" stroke="#0891b2" strokeWidth={1.4} strokeDasharray="4 4" fill="none" opacity={0.7} className="animate-data-flow" />
            <path d="M 82% 50 Q 82% 75, 92% 75" stroke="#0891b2" strokeWidth={1.4} strokeDasharray="4 4" fill="none" opacity={0.7} className="animate-data-flow" />
          </svg>
          {/* 云端 */}
          <div className="absolute left-1/2 top-3 -translate-x-1/2">
            <div className="rounded-lg border border-primary/40 bg-primary/15 px-5 py-3 text-center shadow-glow-cyan backdrop-blur">
              <div className="mb-1 text-2xl">☁</div>
              <div className="text-sm font-semibold text-foreground text-glow-cyan">云端数据中心</div>
              <div className="text-[10px] text-muted-foreground">GPU 集群 · 模型训练 · 模型库 156 个</div>
            </div>
          </div>
          {/* 边缘 */}
          {[
            { x: "18%", label: "边缘节点 A", spec: "西南 · MLU370", status: "online" },
            { x: "50%", label: "边缘节点 B", spec: "华东 · MLU370", status: "online" },
            { x: "82%", label: "边缘节点 C", spec: "西北 · MLU370", status: "warning" },
          ].map((e) => (
            <div key={e.label} className="absolute top-[100px]" style={{ left: e.x, transform: "translateX(-50%)" }}>
              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-center shadow backdrop-blur">
                <Cpu className="mx-auto h-4 w-4 text-blue-300" />
                <div className="mt-0.5 text-[11px] font-semibold text-foreground">{e.label}</div>
                <div className="text-[9px] text-muted-foreground">{e.spec}</div>
                <Badge variant={e.status === "online" ? "success" : "warning"} className="mt-1 text-[9px]">
                  {e.status === "online" ? "● 在线" : "⚠ 警告"}
                </Badge>
              </div>
            </div>
          ))}
          {/* 终端 */}
          {[
            { x: "8%", label: "终端 #1", spec: "CO₂/温度/流量", status: "online" },
            { x: "28%", label: "终端 #2", spec: "CO₂/压力/流速", status: "online" },
            { x: "50%", label: "终端 #3", spec: "CO₂/温度/能效", status: "warning" },
            { x: "68%", label: "终端 #4", spec: "O₂/NOx/SO₂", status: "online" },
            { x: "92%", label: "终端 #5", spec: "窑尾烟气", status: "online" },
          ].map((t) => (
            <div key={t.label} className="absolute top-[200px]" style={{ left: t.x, transform: "translateX(-50%)" }}>
              <div className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-center backdrop-blur">
                <Radio className="mx-auto h-3 w-3 text-cyan-300" />
                <div className="text-[10px] font-semibold text-foreground">{t.label}</div>
                <div className="text-[9px] text-muted-foreground">{t.spec}</div>
                <Badge variant={t.status === "online" ? "success" : "warning"} className="mt-0.5 text-[9px]">
                  {t.status === "online" ? "在线" : "警告"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default CloudEdgePage;
