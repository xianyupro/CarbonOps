"use client";

/**
 * 自定义大屏 —— 拖拽搭建驾驶舱页面。
 * 组件：碳排 KPI 总览 / 点位实时值 / 点位历史曲线 / 最新报警。
 * 布局持久化到 screen_configs；编辑模式可拖拽/缩放，查看模式锁定。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import ReactGridLayout, { Layout, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  Activity,
  Bell,
  LayoutGrid,
  LineChart,
  Loader2,
  Plus,
  Save,
  Gauge,
} from "lucide-react";
import ReactECharts from "echarts-for-react";

import { api } from "@/lib/api";
import type { Alarm, DashboardOverview, ScreenConfigItem } from "@/types/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RGL = WidthProvider(ReactGridLayout);

const WIDGET_TYPES = [
  { type: "kpi", label: "碳排 KPI 总览", icon: Gauge, w: 6, h: 2 },
  { type: "point", label: "点位实时值", icon: Activity, w: 3, h: 2 },
  { type: "chart", label: "点位历史曲线", icon: LineChart, w: 6, h: 3 },
  { type: "alarms", label: "最新报警", icon: Bell, w: 4, h: 3 },
] as const;

interface WidgetItem extends Layout {
  widget: "kpi" | "point" | "chart" | "alarms";
  /** point/chart 组件的数据点位 */
  pointId?: number;
}

interface ScreenLayout {
  items: WidgetItem[];
}

const DEFAULT_LAYOUT: ScreenLayout = {
  items: [
    { i: "w1", widget: "kpi", x: 0, y: 0, w: 12, h: 3 },
    { i: "w2", widget: "chart", x: 0, y: 3, w: 8, h: 5, pointId: undefined },
    { i: "w3", widget: "alarms", x: 8, y: 3, w: 4, h: 5 },
  ],
};

export default function ScreenBuilderPage() {
  const [screenId, setScreenId] = React.useState<number | null>(null);
  const [name, setName] = React.useState("低碳运行大屏");
  const [items, setItems] = React.useState<WidgetItem[]>(DEFAULT_LAYOUT.items);
  const [editMode, setEditMode] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [pointOpts, setPointOpts] = React.useState<{ id: number; name: string }[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    Promise.all([
      api.screens.list(),
      api.dataPoints.list({ pageSize: 300 }),
    ])
      .then(([screens, pts]) => {
        setPointOpts(pts.list.map((p) => ({ id: p.id, name: p.name })));
        if (screens.length > 0) {
          const s: ScreenConfigItem = screens[0];
          setScreenId(s.id);
          setName(s.name);
          const layout = s.layout as { items?: WidgetItem[] } | null;
          if (layout?.items?.length) setItems(layout.items);
        }
        setReady(true);
      })
      .catch(() => {
        toast.error("大屏配置加载失败");
        setReady(true);
      });
  }, []);

  function addWidget(type: (typeof WIDGET_TYPES)[number]["type"]) {
    const t = WIDGET_TYPES.find((w) => w.type === type)!;
    const id = `w${Date.now().toString(36)}`;
    setItems((prev) => [
      ...prev,
      { i: id, widget: type, x: 0, y: maxY(prev) + 1, w: t.w, h: t.h } as WidgetItem,
    ]);
  }

  function maxY(items: Layout[]): number {
    return items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
  }

  function removeWidget(id: string) {
    setItems((prev) => prev.filter((it) => it.i !== id));
  }

  function setWidgetPoint(id: string, pointId: number) {
    setItems((prev) => prev.map((it) => (it.i === id ? { ...it, pointId } : it)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const layout = { items };
      if (screenId == null) {
        const s = await api.screens.create({ name, layout });
        setScreenId(s.id);
      } else {
        await api.screens.update(screenId, { name, layout });
      }
      toast.success("大屏已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-xl font-semibold">自定义大屏</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            拖拽搭建低碳运行驾驶舱：编辑模式拖动/缩放组件，保存后供大屏展示
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {WIDGET_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <Button key={t.type} variant="outline" size="sm" onClick={() => addWidget(t.type)}>
                <Icon className="mr-1 h-3.5 w-3.5" />
                {t.label}
              </Button>
            );
          })}
          <div className="mx-1 h-5 w-px bg-border" />
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode((v) => !v)}
          >
            <LayoutGrid className="mr-1 h-3.5 w-3.5" />
            {editMode ? "编辑中" : "查看模式"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !editMode}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            保存布局
          </Button>
        </div>
      </div>

      {/* 大屏画布 */}
      <div className="rounded-lg border border-border bg-slate-100 p-3 dark:bg-slate-900/40">
        {ready && (
          <RGL
            layout={items}
            cols={12}
            rowHeight={48}
            margin={[10, 10]}
            isDraggable={editMode}
            isResizable={editMode}
            onLayoutChange={(layout: Layout[]) => {
              setItems((prev) =>
                prev.map((it) => {
                  const l = layout.find((x) => x.i === it.i);
                  return l ? { ...it, x: l.x, y: l.y, w: l.w, h: l.h } : it;
                })
              );
            }}
          >
            {items.map((it) => (
              <div
                key={it.i}
                className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
              >
                <WidgetCard
                  item={it}
                  editMode={editMode}
                  pointOpts={pointOpts}
                  onPointChange={setWidgetPoint}
                  onRemove={removeWidget}
                />
              </div>
            ))}
          </RGL>
        )}
      </div>
    </div>
  );
}

/* ---------- 组件卡片 ---------- */

function WidgetCard({
  item,
  editMode,
  pointOpts,
  onPointChange,
  onRemove,
}: {
  item: WidgetItem;
  editMode: boolean;
  pointOpts: { id: number; name: string }[];
  onPointChange: (id: string, pointId: number) => void;
  onRemove: (id: string) => void;
}) {
  const header = (
    <div className="flex items-center justify-between border-b border-border/60 px-2.5 py-1">
      <span className="text-[11px] font-semibold text-muted-foreground">
        {WIDGET_TYPES.find((t) => t.type === item.widget)?.label}
      </span>
      <div className="flex items-center gap-1">
        {item.widget !== "kpi" && item.widget !== "alarms" && (
          <Select
            value={item.pointId != null ? String(item.pointId) : undefined}
            onValueChange={(v) => onPointChange(item.i, Number(v))}
          >
            <SelectTrigger className="h-5 w-32 border-none px-1 text-[10px] shadow-none">
              <SelectValue placeholder="选择点位" />
            </SelectTrigger>
            <SelectContent className="max-h-56">
              {pointOpts.map((p) => (
                <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {editMode && (
          <button
            className="rounded px-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(item.i)}
            title="删除组件"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {header}
      <div className="min-h-0 flex-1 overflow-hidden p-2">
        {item.widget === "kpi" && <KpiWidget />}
        {item.widget === "point" && <PointWidget pointId={item.pointId} />}
        {item.widget === "chart" && <ChartWidget pointId={item.pointId} />}
        {item.widget === "alarms" && <AlarmWidget />}
      </div>
    </div>
  );
}

/** 碳排 KPI（来自驾驶舱聚合接口） */
function KpiWidget() {
  const [data, setData] = React.useState<DashboardOverview | null>(null);
  React.useEffect(() => {
    api.dashboard.overview().then(setData).catch(() => {});
    const t = setInterval(() => api.dashboard.overview().then(setData).catch(() => {}), 15000);
    return () => clearInterval(t);
  }, []);
  if (!data) return <Skeleton />;
  const k = data.carbonKpi;
  const kpis = [
    { label: "总碳排放量", value: fmtNum(k.totalEmissions), unit: "tCO₂e", delta: "-3.2%", up: false },
    { label: "碳减排量", value: fmtNum(k.totalReduction), unit: "tCO₂e", delta: "+5.8%", up: true },
    { label: "能耗总量", value: fmtNum(k.totalEnergy), unit: "tce", delta: "-1.5%", up: false },
    { label: "排放强度", value: fmtNum(k.emissionIntensity), unit: "tCO₂e", delta: "-2.1%", up: false },
  ];
  return (
    <div className="grid h-full grid-cols-4 gap-2">
      {kpis.map((it) => (
        <div key={it.label} className="flex h-full flex-col justify-center rounded-md bg-muted/40 px-2.5">
          <p className="truncate text-[10px] text-muted-foreground">{it.label}</p>
          <p className="text-base font-semibold tabular-nums">
            {it.value}
            <span className="ml-0.5 text-[10px] font-normal text-slate-400">{it.unit}</span>
          </p>
          <p className={`text-[10px] ${it.up ? "text-emerald-600" : "text-red-500"}`}>{it.delta} 较上期</p>
        </div>
      ))}
    </div>
  );
}

/** 点位实时值（数组型点位显示曲线统计） */
function PointWidget({ pointId }: { pointId?: number }) {
  const [state, setState] = React.useState<{
    value: number | null;
    ts: string | null;
    curve?: { count: number; peak: number } | null;
  } | null>(null);
  const [name, setName] = React.useState("");
  React.useEffect(() => {
    if (!pointId) return;
    async function poll() {
      try {
        const rows = await api.data.latest([pointId!]);
        const r = rows[0];
        let curve: { count: number; peak: number } | null = null;
        if (r?.valueText) {
          try {
            const arr = JSON.parse(r.valueText) as [number, number][];
            if (Array.isArray(arr) && arr.length > 0) {
              curve = {
                count: arr.length,
                peak: Math.max(...arr.map((x) => Number(x[1]) || 0)),
              };
            }
          } catch {
            /* 非法曲线忽略 */
          }
        }
        if (r) setState({ value: r.value, ts: r.timestamp, curve });
        api.dataPoints.list({ pageSize: 300 }).then((res) => {
          const p = res.list.find((x) => x.id === pointId);
          if (p) setName(p.name);
        });
      } catch {
        /* 静默 */
      }
    }
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [pointId]);
  if (!pointId) return <Hint text="请在右上角选择点位" />;
  if (state?.curve) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="truncate text-[11px] text-muted-foreground">{name || `点位 #${pointId}`}</p>
        <p className="font-cyber text-2xl font-semibold tabular-nums text-teal-700">
          {state.curve.peak.toFixed(1)}
          <span className="ml-0.5 text-[10px] font-normal text-slate-400">℃ 峰值</span>
        </p>
        <p className="font-cyber text-[10px] text-muted-foreground">
          温度场曲线 · {state.curve.count} 点 · {state.ts?.slice(5, 16) ?? ""}
        </p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <p className="truncate text-[11px] text-muted-foreground">{name || `点位 #${pointId}`}</p>
      <p className="font-cyber text-3xl font-semibold tabular-nums text-teal-700">
        {state?.value != null ? state.value.toFixed(2) : "--"}
      </p>
      <p className="font-cyber text-[10px] text-muted-foreground">{state?.ts ?? ""}</p>
    </div>
  );
}

/** 点位历史曲线 */
function ChartWidget({ pointId }: { pointId?: number }) {
  const [option, setOption] = React.useState<Record<string, unknown> | null>(null);
  React.useEffect(() => {
    if (!pointId) return;
    async function load() {
      try {
        const res = await api.data.query({
          pointIds: [pointId!],
          start: new Date(Date.now() - 86400_000 * 365).toISOString(),
          end: new Date().toISOString(),
          interval: "1 hour",
          agg: "AVG",
        });
        const points = res[0]?.series ?? [];
        setOption({
          grid: { left: 42, right: 12, top: 16, bottom: 22 },
          tooltip: { trigger: "axis" },
          xAxis: { type: "category", data: points.map((p) => p.t?.slice(5, 16) ?? ""), axisLabel: { fontSize: 9, color: "#64748b" } },
          yAxis: { type: "value", axisLabel: { fontSize: 9, color: "#64748b" }, splitLine: { lineStyle: { color: "#e2e8f0" } } },
          series: [{
            type: "line", data: points.map((p) => p.v), smooth: true, showSymbol: false,
            lineStyle: { width: 2, color: "#0d9488" }, areaStyle: { color: "rgba(13,148,136,0.08)" },
          }],
        });
      } catch {
        /* 静默 */
      }
    }
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [pointId]);
  if (!pointId) return <Hint text="请在右上角选择点位" />;
  if (!option) return <Skeleton />;
  return (
    <ReactECharts option={option} style={{ height: "100%", minHeight: 80 }} notMerge lazyUpdate />
  );
}

/** 最新报警 */
function AlarmWidget() {
  const [alarms, setAlarms] = React.useState<Alarm[]>([]);
  React.useEffect(() => {
    api.alarms.list({ pageSize: 10 }).then((res) => setAlarms(res.list)).catch(() => {});
    const t = setInterval(() => api.alarms.list({ pageSize: 10 }).then((res) => setAlarms(res.list)).catch(() => {}), 15000);
    return () => clearInterval(t);
  }, []);
  if (alarms.length === 0) return <Hint text="暂无报警记录" />;
  return (
    <div className="h-full space-y-1 overflow-y-auto scrollbar-thin">
      {alarms.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-accent/60">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.level === "CRITICAL" ? "bg-red-600" : a.level === "WARN" ? "bg-amber-500" : "bg-sky-500"}`} />
          <span className="truncate">{a.title}</span>
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{a.createdAt?.slice(5, 16) ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{text}</div>
  );
}

function fmtNum(v: number | null | undefined): string {
  return v == null ? "--" : v.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}
