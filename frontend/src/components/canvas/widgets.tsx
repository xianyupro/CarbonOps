/**
 * 组态画布 Widget 渲染组件
 * 根据 ComponentInstance 类型渲染不同的可视化控件
 *
 * 视觉规范：大屏深色原生 —— 半透明玻璃面板（白 4% 底 + 白 10% 描边）、
 * 浅色文字层级（slate-300/400/500）、数据 font-cyber 等宽、
 * ECharts 深色轴线/暗色 tooltip、告警按级别着色。
 */
"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, Bell, Brain, CheckCircle2, Info, Loader2, Radio } from "lucide-react";
import type { ComponentInstance } from "@/lib/canvas/schema";
import { api } from "@/lib/api";
import type { Alarm, DashboardOverview, TimeBucket } from "@/types/api";

// ECharts 动态加载 — 使用 React.lazy + Suspense 而非 next/dynamic，避免
// dev 模式下 ESM-only 包偶发的 chunk path 为 undefined 错误。
const ReactECharts = React.lazy(async () => {
  const mod = await import("echarts-for-react");
  return { default: mod.default };
});

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** 大屏面板通用外壳 */
function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-lg border border-white/10 bg-slate-900/50 ${className}`}
    >
      {children}
    </div>
  );
}

/** 面板标题行：强调竖条 + 标题 */
function PanelTitle({ title, extra }: { title: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-2">
      <span className="h-3 w-0.5 shrink-0 rounded bg-cyan-400" />
      <span className="truncate text-[11px] font-medium tracking-wide text-slate-300">{title}</span>
      {extra}
    </div>
  );
}

function EChartFallback() {
  return (
    <div className="flex h-full min-h-[80px] items-center justify-center text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

/* ---------- 点位实时数据共享订阅层（多组件共用一次轮询） ---------- */

type PointSample = {
  value: number | null;
  ts: string | null;
  /** 数组型点位（如温度场曲线）解析出的统计 */
  curve?: { count: number; peak: number } | null;
};
type PointListener = (s: PointSample) => void;

const pointIndex = new Map<string, number>(); // 小写(name|code) → pointId
let pointIndexPromise: Promise<Map<string, number>> | null = null;

function ensurePointIndex(): Promise<Map<string, number>> {
  if (pointIndex.size > 0) return Promise.resolve(pointIndex);
  pointIndexPromise ??= api.dataPoints
    .list({ pageSize: 1000 })
    .then((res) => {
      for (const p of res.list) {
        pointIndex.set(p.name.toLowerCase(), p.id);
        pointIndex.set((p.code ?? "").toLowerCase(), p.id);
      }
      return pointIndex;
    })
    .catch(() => pointIndex);
  return pointIndexPromise;
}

const pointSamples = new Map<number, PointSample>();
const pointSubs = new Map<number, Set<PointListener>>();
let pointTimer: ReturnType<typeof setInterval> | null = null;

async function pollSubscribedPoints() {
  const ids = [...pointSubs.keys()];
  if (ids.length === 0) return;
  try {
    const rows = await api.data.latest(ids);
    for (const r of rows) {
      let value = typeof r.value === "number" && Number.isFinite(r.value) ? r.value : null;
      let curve: { count: number; peak: number } | undefined;
      if (value == null && r.valueText) {
        // 数组型点位（曲线）→ 取峰值
        try {
          const arr = JSON.parse(r.valueText) as [number, number][];
          if (Array.isArray(arr) && arr.length > 0) {
            curve = { count: arr.length, peak: Math.max(...arr.map((x) => Number(x[1]) || 0)) };
            value = curve.peak;
          }
        } catch {
          /* 非法曲线忽略 */
        }
      }
      const sample: PointSample = { value, ts: r.timestamp, curve };
      pointSamples.set(r.pointId, sample);
      pointSubs.get(r.pointId)?.forEach((cb) => cb(sample));
    }
  } catch {
    /* 静默重试 */
  }
}

function subscribePointValue(pointId: number, cb: PointListener): () => void {
  let set = pointSubs.get(pointId);
  if (!set) {
    set = new Set();
    pointSubs.set(pointId, set);
    if (pointTimer == null) pointTimer = setInterval(pollSubscribedPoints, 5000);
    void pollSubscribedPoints();
  }
  set.add(cb);
  const cached = pointSamples.get(pointId);
  if (cached) cb(cached);
  return () => {
    set.delete(cb);
    if (set.size === 0) {
      pointSubs.delete(pointId);
      if (pointSubs.size === 0 && pointTimer != null) {
        clearInterval(pointTimer);
        pointTimer = null;
      }
    }
  };
}

/** point 绑定 → 解析点位（name/code→id）并订阅实时值 */
function usePointBinding(binding?: ComponentInstance["bindings"][string]) {
  const pointName = binding?.kind === "point" ? binding.point : undefined;
  const [state, setState] = React.useState<{
    resolved: boolean;
    name: string;
    sample: PointSample | null;
  }>({ resolved: false, name: pointName ?? "", sample: null });

  React.useEffect(() => {
    if (!pointName) {
      setState({ resolved: false, name: "", sample: null });
      return;
    }
    let alive = true;
    let unsub: (() => void) | null = null;
    ensurePointIndex().then((index) => {
      if (!alive) return;
      const pid = index.get(pointName.toLowerCase());
      if (pid == null) {
        setState({ resolved: false, name: pointName, sample: null });
        return;
      }
      setState((s) => ({ ...s, resolved: true, name: pointName }));
      unsub = subscribePointValue(pid, (sample) => {
        if (alive) setState({ resolved: true, name: pointName, sample });
      });
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, [pointName]);

  return state;
}

/** 组件取值：point 绑定 → 真实轮询值（首帧前以 mock 兜底）；static → 静态值；无绑定 → mock */
function useBoundValue(component: ComponentInstance, key = "value"): number {
  const binding = component.bindings[key];
  const pb = usePointBinding(binding);
  const mock = useMockValue(binding);
  if (pb.resolved && pb.sample?.value != null) return pb.sample.value;
  return mock;
}

/** 模拟绑定值（编辑模式用，预览模式也可用于无绑定时的占位） */
function useMockValue(binding: ComponentInstance["bindings"][string] | undefined): number {
  return React.useMemo(() => {
    // 无绑定时给确定的演示值（落在正常量程中段偏上，避免状态灯类控件随机翻转）
    if (!binding) return 68;
    if (binding.kind === "static" && binding.value != null) {
      return Number(binding.value) || 0;
    }
    if (binding.kind === "point") {
      // 基于点位名 hash 生成稳定的 mock 值
      const hash = (binding.point ?? "x")
        .split("")
        .reduce((a, c) => a + c.charCodeAt(0), 0);
      return Math.round((40 + (hash % 50) + Math.random() * 10) * 10) / 10;
    }
    return Math.round(Math.random() * 100 * 10) / 10;
  }, [binding]);
}

/* --------------------------------- KPI 卡片 -------------------------------- */

/** 碳排总览（4 格真实 KPI，api.dashboard.overview 15s 轮询；旧大屏 kpi 组件迁移用） */
function CarbonKpiOverview() {
  const [data, setData] = React.useState<DashboardOverview | null>(null);
  React.useEffect(() => {
    const load = () => api.dashboard.overview().then(setData).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  const k = data.carbonKpi;
  const kpis = [
    { label: "总碳排放量", value: (k.totalEmissions ?? 0).toLocaleString("zh-CN", { maximumFractionDigits: 1 }), unit: "tCO₂e" },
    { label: "碳减排量", value: (k.totalReduction ?? 0).toLocaleString("zh-CN", { maximumFractionDigits: 1 }), unit: "tCO₂e" },
    { label: "能耗总量", value: (k.totalEnergy ?? 0).toLocaleString("zh-CN", { maximumFractionDigits: 1 }), unit: "tce" },
    { label: "排放强度", value: (k.emissionIntensity ?? 0).toLocaleString("zh-CN", { maximumFractionDigits: 1 }), unit: "tCO₂e" },
  ];
  return (
    <div className="grid h-full grid-cols-4 gap-1.5">
      {kpis.map((it) => (
        <div
          key={it.label}
          className="flex h-full flex-col justify-center rounded-md border border-white/10 bg-white/[0.05] px-2.5"
        >
          <p className="truncate text-[10px] uppercase tracking-[0.12em] text-slate-400">{it.label}</p>
          <p className="mt-0.5 truncate font-cyber text-lg font-bold tabular-nums text-white">
            {it.value}
            <span className="ml-1 text-[10px] font-normal text-slate-400">{it.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function KpiWidget({ component }: { component: ComponentInstance }) {
  const { unit = "", decimals = 1, color = "#22d3ee", showTrend = true, overview = false } =
    component.props as Record<string, unknown>;
  const value = useBoundValue(component);
  const trend = value > 60 ? 1 : value > 30 ? 0 : -1;

  // 碳排总览模式：4 格真实 KPI（api.dashboard.overview，15s 轮询；旧大屏迁移用）
  if (overview === true || overview === "true") {
    return <CarbonKpiOverview />;
  }

  return (
    <Panel className="justify-center px-3 py-2">
      <div className="truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {component.title}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span
          className="font-cyber text-[26px] font-bold leading-none tabular-nums"
          style={{ color: color as string, textShadow: `0 0 14px ${color as string}55` }}
        >
          {Number(value).toFixed(Number(decimals))}
        </span>
        <span className="text-xs text-slate-500">{unit as string}</span>
        {showTrend === true || showTrend === "true" ? (
          <span
            className={`ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none ${
              trend > 0
                ? "bg-emerald-400/10 text-emerald-300"
                : trend < 0
                  ? "bg-red-400/10 text-red-300"
                  : "bg-slate-400/10 text-slate-400"
            }`}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}
          </span>
        ) : null}
      </div>
    </Panel>
  );
}

/* --------------------------------- 趋势图表 -------------------------------- */

function ChartWidget({ component }: { component: ComponentInstance }) {
  const {
    chartType = "line",
    timeWindow = "1h",
    color = "#38bdf8",
    showLegend = true,
  } = component.props as Record<string, unknown>;

  // 生成 mock 趋势数据（无绑定时兜底）
  const data = React.useMemo(() => {
    const now = Date.now();
    const points = 30;
    return Array.from({ length: points }, (_, i) => {
      const t = now - (points - i) * 2 * 60 * 1000;
      return [t, Math.round((50 + Math.sin(i / 5) * 30 + Math.random() * 10) * 10) / 10];
    });
  }, []);

  // point 绑定 → 真实历史序列（api.data.query，30s 刷新）
  const seriesPoint =
    component.bindings.series?.kind === "point" ? component.bindings.series.point : undefined;
  const [liveData, setLiveData] = React.useState<[number, number][] | null>(null);
  React.useEffect(() => {
    if (!seriesPoint) {
      setLiveData(null);
      return;
    }
    let alive = true;
    async function load() {
      try {
        const index = await ensurePointIndex();
        const pid = index.get(seriesPoint!.toLowerCase());
        if (pid == null) return;
        const windows: Record<string, { ms: number; interval: TimeBucket }> = {
          "1h": { ms: 3600_000, interval: "minute" },
          "6h": { ms: 6 * 3600_000, interval: "5 minute" },
          "24h": { ms: 86_400_000, interval: "hour" },
          "7d": { ms: 7 * 86_400_000, interval: "1 hour" },
        };
        const w = windows[String(timeWindow)] ?? windows["1h"];
        const res = await api.data.query({
          pointIds: [pid],
          start: new Date(Date.now() - w.ms).toISOString(),
          end: new Date().toISOString(),
          interval: w.interval,
          agg: "AVG",
        });
        const points = res[0]?.series ?? [];
        if (alive && points.length > 0) {
          setLiveData(points.map((p) => [new Date(p.t).getTime(), Number(p.v)] as [number, number]));
        }
      } catch {
        /* 静默重试 */
      }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [seriesPoint, timeWindow]);

  const option = React.useMemo(
    () => ({
      backgroundColor: "transparent",
      grid: { top: showLegend === true || showLegend === "true" ? 30 : 14, right: 16, bottom: 24, left: 42 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15,23,42,0.94)",
        borderColor: "#334155",
        textStyle: { color: "#e2e8f0", fontSize: 11 },
      },
      legend: (showLegend === true || showLegend === "true")
        ? { data: [component.title], textStyle: { color: "#7c8ba1", fontSize: 10 }, itemWidth: 14, itemHeight: 8, icon: "roundRect" }
        : undefined,
      xAxis: {
        type: "time" as const,
        axisLine: { lineStyle: { color: "rgba(148,163,184,0.3)" } },
        axisTick: { show: false },
        axisLabel: { color: "#64748b", fontSize: 9 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value" as const,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#64748b", fontSize: 9 },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.12)" } },
      },
      series: [{
        name: component.title,
        type: (chartType === "bar" ? "bar" : "line") as "line" | "bar",
        data: liveData ?? data,
        smooth: true,
        symbol: "none",
        barWidth: "45%",
        lineStyle: { color: color as string, width: 2 },
        itemStyle: { color: color as string, borderRadius: chartType === "bar" ? 2 : 0 },
        areaStyle: chartType === "area"
          ? {
              color: {
                type: "linear", x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: `${color as string}44` },
                  { offset: 1, color: `${color as string}00` },
                ],
              },
            }
          : undefined,
      }],
    }),
    [liveData, data, chartType, color, showLegend, component.title]
  );

  return (
    <Panel>
      <PanelTitle title={component.title} />
      <div className="min-h-0 flex-1 px-1 pb-1">
        <React.Suspense fallback={<EChartFallback />}>
          <ReactECharts option={option} style={{ height: "100%", minHeight: 80 }} opts={{ renderer: "svg" }} />
        </React.Suspense>
      </div>
    </Panel>
  );
}

/* --------------------------------- 仪表盘 --------------------------------- */

function GaugeWidget({ component }: { component: ComponentInstance }) {
  const value = useBoundValue(component);
  const { min = 0, max = 100, unit = "%", thresholds = "60,85" } = component.props as Record<string, unknown>;
  const thrArr = String(thresholds).split(",").map(Number);

  const option = React.useMemo(
    () => ({
      backgroundColor: "transparent",
      series: [{
        type: "gauge",
        min: Number(min),
        max: Number(max),
        startAngle: 210,
        endAngle: -30,
        progress: { show: true, width: 10, roundCap: true },
        axisLine: { lineStyle: { width: 10, color: thrArr.map((t, i) => {
          const colors = ["#22c55e", "#eab308", "#ef4444"];
          return [t / Number(max), colors[i] ?? "#ef4444"];
        }) } },
        axisTick: { show: false },
        splitLine: { length: 6, distance: 4, lineStyle: { color: "rgba(148,163,184,0.4)", width: 1 } },
        axisLabel: { color: "#64748b", fontSize: 8, distance: 8 },
        pointer: { width: 3, length: "58%", itemStyle: { color: "#e2e8f0" } },
        anchor: { show: true, size: 6, itemStyle: { color: "#e2e8f0" } },
        detail: {
          valueAnimation: true,
          formatter: `{value}${unit as string}`,
          color: "#f1f5f9",
          fontSize: 15,
          fontWeight: "bold" as const,
          fontFamily: MONO,
          offsetCenter: [0, "38%"],
        },
        data: [{ value: Math.min(value, Number(max)) }],
      }],
    }),
    [value, min, max, unit, thrArr]
  );

  return (
    <Panel>
      <PanelTitle title={component.title} />
      <div className="min-h-0 flex-1 px-1 pb-1">
        <React.Suspense fallback={<EChartFallback />}>
          <ReactECharts option={option} style={{ height: "100%", minHeight: 60 }} opts={{ renderer: "svg" }} />
        </React.Suspense>
      </div>
    </Panel>
  );
}

/* --------------------------------- 告警列表 -------------------------------- */

/** 告警级别样式映射 */
const ALARM_LEVEL_STYLE: Record<string, { color: string; chip: string; icon: React.ElementType }> = {
  CRITICAL: { color: "#ef4444", chip: "bg-red-600/10 text-red-600", icon: AlertTriangle },
  WARN: { color: "#d97706", chip: "bg-amber-600/10 text-amber-600", icon: Bell },
  INFO: { color: "#3b82f6", chip: "bg-blue-600/10 text-blue-600", icon: Info },
  RESOLVED: { color: "#059669", chip: "bg-emerald-600/10 text-emerald-600", icon: CheckCircle2 },
};

function AlarmWidget({ component }: { component: ComponentInstance }) {
  const { maxItems = 10, filterLevel = "all" } = component.props as Record<string, unknown>;
  const [rows, setRows] = React.useState<Alarm[] | null>(null);

  // 真实告警（api.alarms.list，15s 轮询）
  React.useEffect(() => {
    let alive = true;
    const load = () =>
      api.alarms
        .list({ pageSize: 50 })
        .then((res) => {
          if (alive) setRows(res.list);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const items = (rows ?? [])
    .filter((a) => filterLevel === "all" || a.level === filterLevel)
    .slice(0, Number(maxItems));

  return (
    <Panel>
      <PanelTitle
        title={component.title}
        extra={
          <span className="ml-auto rounded bg-red-600/10 px-1.5 py-0.5 font-cyber text-[9px] leading-none text-red-600">
            {items.length}
          </span>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto">
        {rows == null ? (
          <div className="flex h-20 items-center justify-center text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">
            暂无告警记录
          </div>
        ) : (
          items.map((a) => {
            const st =
              a.status === "RESOLVED"
                ? ALARM_LEVEL_STYLE.RESOLVED
                : ALARM_LEVEL_STYLE[a.level] ?? {
                    color: "#64748b",
                    chip: "bg-slate-400/10 text-slate-500",
                    icon: Info,
                  };
            const Icon = st.icon;
            return (
              <div
                key={a.id}
                className="flex items-center gap-2 border-b border-white/5 px-2.5 py-1.5 last:border-0 transition-colors hover:bg-white/5"
              >
                <span className="h-3.5 w-0.5 shrink-0 rounded" style={{ background: st.color }} />
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: st.color }} />
                <span className="flex-1 truncate text-xs text-slate-300">{a.title}</span>
                <span
                  className={`hidden shrink-0 rounded px-1 py-0.5 text-[8px] leading-none sm:inline ${st.chip}`}
                >
                  {a.level}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                  {a.createdAt?.slice(5, 16) ?? ""}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}

/** 开关量判定：0/1 布尔语义（≥0.5 为开）与 0~100 百分比语义（>50 为开）自适应 */
function isSwitchOn(value: number): boolean {
  return value <= 1 ? value >= 0.5 : value > 50;
}

/* --------------------------------- 状态指示灯 ------------------------------- */

function StatusWidget({ component }: { component: ComponentInstance }) {
  const value = useBoundValue(component);
  const { onColor = "#34d399", offColor = "#f87171", label = "运行状态" } = component.props as Record<string, unknown>;
  const isOn = isSwitchOn(value);
  const c = isOn ? (onColor as string) : (offColor as string);

  return (
    <Panel className="items-center justify-center gap-2 py-2">
      <div className="relative flex items-center justify-center">
        <span
          aria-hidden
          className="absolute h-10 w-10 animate-pulse rounded-full"
          style={{ background: `${c}22` }}
        />
        <div
          className="relative h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 transition-colors"
          style={{
            backgroundColor: c,
            boxShadow: `0 0 14px ${c}99`,
            "--tw-ring-color": `${c}55`,
          } as React.CSSProperties}
        />
      </div>
      <span className="text-[11px] tracking-wide text-slate-400">{label as string}</span>
      <span className="font-cyber text-[10px] tabular-nums" style={{ color: c }}>
        {isOn ? "RUNNING" : "STOPPED"}
      </span>
    </Panel>
  );
}

/* --------------------------------- 文本标签 -------------------------------- */

function TextWidget({ component }: { component: ComponentInstance }) {
  const { text = "文本", fontSize = 14, color = "#e2e8f0", bold = false } = component.props as Record<string, unknown>;
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] px-2 text-center">
      <span
        className="leading-relaxed"
        style={{
          fontSize: `${Number(fontSize)}px`,
          color: color as string,
          fontWeight: bold === true || bold === "true" ? "bold" : "normal",
        }}
      >
        {text as string}
      </span>
    </div>
  );
}

/* --------------------------------- 储罐控件 -------------------------------- */

function TankWidget({ component }: { component: ComponentInstance }) {
  const value = useBoundValue(component);
  const { fillColor = "#38bdf8", maxLevel = 100, label = "储罐" } = component.props as Record<string, unknown>;
  const pct = Math.min(100, Math.max(0, (value / Number(maxLevel)) * 100));

  return (
    <Panel className="items-center justify-end gap-1 p-2">
      <div className="w-full truncate text-left text-[10px] tracking-wide text-slate-500">{label as string}</div>
      <div className="relative min-h-[60px] w-14 flex-1 overflow-hidden rounded-md border border-slate-600 bg-slate-950/60">
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-500"
          style={{
            height: `${pct}%`,
            backgroundColor: fillColor as string,
            opacity: 0.7,
          }}
        >
          {/* 液面波纹效果 */}
          <div className="absolute left-0 right-0 top-0 h-1 rounded-full bg-white/25" />
        </div>
        {/* 刻度线 */}
        {[25, 50, 75].map((m) => (
          <div key={m} className="absolute left-0 right-0 border-t border-dashed border-white/10" style={{ bottom: `${m}%` }} />
        ))}
        <span className="absolute inset-0 flex items-center justify-center font-cyber text-xs font-bold tabular-nums text-slate-100">
          {value.toFixed(1)}%
        </span>
      </div>
    </Panel>
  );
}

/* --------------------------------- 阀门控件 -------------------------------- */

function ValveWidget({ component }: { component: ComponentInstance }) {
  const value = useBoundValue(component);
  const { onColor = "#34d399", offColor = "#64748b", label = "阀门" } = component.props as Record<string, unknown>;
  const isOpen = isSwitchOn(value);
  const c = isOpen ? (onColor as string) : (offColor as string);

  return (
    <Panel className="items-center justify-center gap-1 p-2">
      <svg width="44" height="40" viewBox="0 0 40 40" fill="none">
        {/* 管道 */}
        <rect x="0" y="17" width="14" height="6" fill="#475569" />
        <rect x="26" y="17" width="14" height="6" fill="#475569" />
        {/* 阀门体 */}
        <circle cx="20" cy="20" r="10" fill={c} fillOpacity="0.9" stroke="#64748b" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="10" fill="none" stroke={c} strokeWidth="1" opacity="0.5" />
        {/* 阀门手柄 */}
        <rect
          x="18"
          y={isOpen ? "8" : "12"}
          width="4"
          height="12"
          fill="#e2e8f0"
          rx="1"
          style={{ transition: "all 0.3s" }}
        />
      </svg>
      <span className="text-[11px] tracking-wide text-slate-400">{label as string}</span>
      <span className="font-cyber text-[10px] tabular-nums" style={{ color: c }}>
        {isOpen ? "开启" : "关闭"}
      </span>
    </Panel>
  );
}

/* --------------------------------- 管道控件 -------------------------------- */

function PipeWidget({ component }: { component: ComponentInstance }) {
  const { color = "#475569", flowColor = "#22d3ee", animated = true } = component.props as Record<string, unknown>;
  return (
    <div className="flex h-full items-center justify-center">
      <svg width="100%" height="20" viewBox="0 0 200 20" preserveAspectRatio="none">
        <rect x="0" y="4" width="200" height="12" rx="2" fill={color as string} />
        <rect x="0" y="4" width="200" height="12" rx="2" fill="none" stroke="rgba(226,232,240,0.12)" />
        {animated === true || animated === "true" ? (
          <>
            <rect x="0" y="6" width="40" height="8" rx="1" fill={flowColor as string} opacity="0.75">
              <animate attributeName="x" from="-40" to="200" dur="2s" repeatCount="indefinite" />
            </rect>
            <rect x="0" y="6" width="40" height="8" rx="1" fill={flowColor as string} opacity="0.75">
              <animate attributeName="x" from="-40" to="200" dur="2s" begin="1s" repeatCount="indefinite" />
            </rect>
          </>
        ) : (
          <rect x="0" y="6" width="200" height="8" rx="1" fill={`${flowColor as string}44`} />
        )}
      </svg>
    </div>
  );
}

/* --------------------------------- 工业仪表 -------------------------------- */

function MeterWidget({ component }: { component: ComponentInstance }) {
  const value = useBoundValue(component);
  const { min = 0, max = 100, unit = "", label = "压力" } = component.props as Record<string, unknown>;
  const angle = -120 + (Math.min(value, Number(max)) - Number(min)) / (Number(max) - Number(min)) * 240;

  return (
    <Panel className="items-center justify-center gap-1 p-2">
      <span className="text-[10px] tracking-wide text-slate-500">{label as string}</span>
      <svg width="62" height="62" viewBox="0 0 60 60">
        {/* 表盘背景 */}
        <circle cx="30" cy="30" r="26" fill="#0f1a2b" stroke="#334155" strokeWidth="1.5" />
        {/* 刻度弧 */}
        <path d="M 12 42 A 22 22 0 1 1 48 42" fill="none" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
        {/* 进度弧（值到指针位置） */}
        <path
          d="M 12 42 A 22 22 0 1 1 48 42"
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="69"
          strokeDashoffset={69 - (69 * (value - Number(min))) / (Number(max) - Number(min))}
          style={{ transition: "stroke-dashoffset 0.5s" }}
        />
        {/* 指针 */}
        <line
          x1="30" y1="30" x2="30" y2="12"
          stroke="#f87171" strokeWidth="2" strokeLinecap="round"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: "30px 30px", transition: "transform 0.5s" }}
        />
        <circle cx="30" cy="30" r="3" fill="#e2e8f0" />
        {/* 数值 */}
        <text x="30" y="50" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="bold" fontFamily={MONO}>
          {value.toFixed(0)}{unit as string}
        </text>
      </svg>
    </Panel>
  );
}

/* --------------------------------- 模型组件 -------------------------------- */

function ModelWidget({ component }: { component: ComponentInstance }) {
  const { showInput = true, showOutput = true, autoRun = true } = component.props as Record<string, unknown>;
  const mb = component.modelBinding;
  const [running, setRunning] = React.useState(false);
  const [output, setOutput] = React.useState<Record<string, unknown> | null>(null);

  function runModel() {
    setRunning(true);
    // Mock 推理
    setTimeout(() => {
      setOutput({
        recommendation: "建议将风量提高 8%，煤比降低 3%",
        confidence: 0.87,
        savings: "预计可降低碳排 12.5 kg/h",
      });
      setRunning(false);
    }, 1200);
  }

  // 自动运行首次
  React.useEffect(() => {
    if (autoRun === true || autoRun === "true") {
      runModel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mb) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-900/40 p-3 text-center">
        <Brain className="h-6 w-6 text-slate-500" />
        <span className="text-xs text-slate-400">点击后绑定模型</span>
        <span className="text-[10px] text-slate-500">在右侧属性面板选择模型</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-purple-500/30 bg-purple-500/[0.06]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-purple-500/20 bg-purple-500/10 px-3 py-1.5">
        <Brain className="h-4 w-4 shrink-0 text-purple-300" />
        <span className="flex-1 truncate text-xs font-medium text-slate-200">{component.title}</span>
        <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-mono text-purple-300">
          {mb.versionNo ?? "latest"}
        </span>
        <button
          type="button"
          onClick={runModel}
          disabled={running}
          className="rounded bg-purple-600 px-2 py-0.5 text-[10px] text-white transition hover:bg-purple-500 disabled:opacity-50"
        >
          {running ? "运行中…" : "执行"}
        </button>
      </div>

      {/* Body: input/output */}
      <div className="min-h-0 flex-1 overflow-auto p-2 text-xs">
        {showInput === true || showInput === "true" ? (
          <div className="mb-2">
            <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-slate-500">输入参数</div>
            <div className="space-y-0.5">
              {Object.entries(mb.inputMappings).length === 0 ? (
                <span className="text-slate-500">未配置输入映射</span>
              ) : (
                Object.entries(mb.inputMappings).map(([param, mapping]) => (
                  <div key={param} className="flex items-center gap-1 truncate">
                    <span className="font-mono text-blue-300">{param}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-slate-600" />
                    <span className="truncate font-mono text-emerald-300">
                      {mapping.sourceCode}/{mapping.point}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {showOutput === true || showOutput === "true" ? (
          <div>
            <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-slate-500">推理输出</div>
            {running ? (
              <div className="flex items-center gap-1.5 text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                正在推理…
              </div>
            ) : output ? (
              <div className="space-y-1 rounded border border-purple-500/15 bg-slate-950/40 p-2">
                {Object.entries(output).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-1">
                    <span className="shrink-0 text-slate-500">{k}:</span>
                    <span className="text-slate-200">{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-slate-500">点击&quot;执行&quot;运行模型</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------- 点位实时值 -------------------------------- */

/** 点位实时值（真实数据，5s 轮询；需在属性面板绑定 point） */
function PointValueWidget({ component }: { component: ComponentInstance }) {
  const { unit = "", decimals = 1, color = "#0d9488" } = component.props as Record<string, unknown>;
  const pb = usePointBinding(component.bindings.value);

  return (
    <Panel className="justify-center px-3 py-2">
      <div className="flex items-center gap-1.5 truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">
        <Radio className="h-3 w-3 shrink-0 text-teal-500" />
        <span className="truncate">{pb.name || component.title}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span
          className="font-cyber text-[26px] font-bold leading-none tabular-nums"
          style={{ color: color as string, textShadow: `0 0 14px ${color as string}55` }}
        >
          {pb.sample?.value != null ? Number(pb.sample.value).toFixed(Number(decimals)) : "--"}
        </span>
        <span className="text-xs text-slate-500">
          {pb.sample?.curve ? `℃ 峰值 · ${pb.sample.curve.count} 点` : (unit as string)}
        </span>
        {pb.sample?.ts ? (
          <span className="ml-auto font-mono text-[9px] tabular-nums text-slate-500">
            {pb.sample.ts.slice(5, 16)}
          </span>
        ) : null}
      </div>
      {!pb.resolved && pb.name ? (
        <p className="mt-0.5 text-[9px] text-slate-500">点位未找到，请检查绑定</p>
      ) : null}
    </Panel>
  );
}

/* --------------------------------- 渲染分发器 ------------------------------- */

const WIDGET_MAP: Record<string, React.FC<{ component: ComponentInstance }>> = {
  kpi: KpiWidget,
  chart: ChartWidget,
  gauge: GaugeWidget,
  alarm: AlarmWidget,
  status: StatusWidget,
  text: TextWidget,
  tank: TankWidget,
  valve: ValveWidget,
  pipe: PipeWidget,
  meter: MeterWidget,
  model: ModelWidget,
  point: PointValueWidget,
};

/** Widget 渲染入口 */
export function WidgetRenderer({ component }: { component: ComponentInstance }) {
  // 隐藏的组件不渲染
  if (component.visible === false) return null;

  const Renderer = WIDGET_MAP[component.type] ?? KpiWidget;
  return <Renderer component={component} />;
}
