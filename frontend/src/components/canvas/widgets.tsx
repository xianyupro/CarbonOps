/**
 * 组态画布 Widget 渲染组件
 * 根据 ComponentInstance 类型渲染不同的可视化控件
 */
"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, Bell, Brain, CheckCircle2, Info, Loader2 } from "lucide-react";
import type { ComponentInstance } from "@/lib/canvas/schema";

// ECharts 动态加载 — 使用 React.lazy + Suspense 而非 next/dynamic，避免
// dev 模式下 ESM-only 包偶发的 chunk path 为 undefined 错误。
const ReactECharts = React.lazy(async () => {
  const mod = await import("echarts-for-react");
  return { default: mod.default };
});

function EChartFallback() {
  return (
    <div className="flex h-full min-h-[80px] items-center justify-center text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

/** 模拟绑定值（编辑模式用，预览模式也可用于无绑定时的占位） */
function useMockValue(binding: ComponentInstance["bindings"][string] | undefined): number {
  return React.useMemo(() => {
    if (!binding) return Math.round(Math.random() * 100 * 10) / 10;
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

function KpiWidget({ component }: { component: ComponentInstance }) {
  const value = useMockValue(component.bindings.value);
  const { unit = "", decimals = 1, color = "#22c55e", showTrend = true } = component.props as Record<string, unknown>;
  const trend = value > 60 ? 1 : value > 30 ? 0 : -1;

  return (
    <div className="flex h-full flex-col justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
      <div className="text-xs text-slate-400">{component.title}</div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: color as string }}
        >
          {Number(value).toFixed(Number(decimals))}
        </span>
        <span className="text-sm text-slate-400">{unit as string}</span>
        {showTrend === true || showTrend === "true" ? (
          <span className={`text-xs ${trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-slate-400"}`}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------- 趋势图表 -------------------------------- */

function ChartWidget({ component }: { component: ComponentInstance }) {
  const { chartType = "line", color = "#3b82f6", showLegend = true } = component.props as Record<string, unknown>;

  // 生成 mock 趋势数据
  const data = React.useMemo(() => {
    const now = Date.now();
    const points = 30;
    return Array.from({ length: points }, (_, i) => {
      const t = now - (points - i) * 2 * 60 * 1000;
      return [t, Math.round((50 + Math.sin(i / 5) * 30 + Math.random() * 10) * 10) / 10];
    });
  }, []);

  const option = React.useMemo(
    () => ({
      grid: { top: showLegend === true || showLegend === "true" ? 35 : 15, right: 15, bottom: 25, left: 40 },
      tooltip: { trigger: "axis", backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#0f172a" } },
      legend: (showLegend === true || showLegend === "true") ? { data: [component.title], textStyle: { color: "#64748b", fontSize: 10 } } : undefined,
      xAxis: {
        type: "time" as const,
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { color: "#64748b", fontSize: 9 },
      },
      yAxis: {
        type: "value" as const,
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { color: "#64748b", fontSize: 9 },
        splitLine: { lineStyle: { color: "#e2e8f0" } },
      },
      series: [{
        name: component.title,
        type: (chartType === "bar" ? "bar" : chartType === "area" ? "line" : "line") as "line" | "bar",
        data,
        smooth: true,
        symbol: "none",
        lineStyle: { color: color as string, width: 2 },
        itemStyle: { color: color as string },
        areaStyle: chartType === "area" ? { color: `${color as string}33` } : undefined,
      }],
    }),
    [data, chartType, color, showLegend, component.title]
  );

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-700 bg-slate-800/50 p-2">
      <div className="mb-1 truncate text-xs font-medium text-slate-300">{component.title}</div>
      <div className="flex-1 overflow-hidden">
        <React.Suspense fallback={<EChartFallback />}>
          <ReactECharts option={option} style={{ height: "100%", minHeight: 80 }} opts={{ renderer: "svg" }} />
        </React.Suspense>
      </div>
    </div>
  );
}

/* --------------------------------- 仪表盘 --------------------------------- */

function GaugeWidget({ component }: { component: ComponentInstance }) {
  const value = useMockValue(component.bindings.value);
  const { min = 0, max = 100, unit = "%", thresholds = "60,85" } = component.props as Record<string, unknown>;
  const thrArr = String(thresholds).split(",").map(Number);

  const option = React.useMemo(
    () => ({
      series: [{
        type: "gauge",
        min: Number(min),
        max: Number(max),
        progress: { show: true, width: 10 },
        axisLine: { lineStyle: { width: 10, color: thrArr.map((t, i) => {
          const colors = ["#22c55e", "#eab308", "#ef4444"];
          return [t / Number(max), colors[i] ?? "#ef4444"];
        }) } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { color: "#94a3b8" } },
        axisLabel: { color: "#64748b", fontSize: 8, distance: 5 },
        pointer: { width: 3, itemStyle: { color: "#0f172a" } },
        detail: {
          valueAnimation: true,
          formatter: `{value}${unit as string}`,
          color: "#0f172a",
          fontSize: 16,
          fontWeight: "bold" as const,
          offsetCenter: [0, "35%"],
        },
        data: [{ value: Math.min(value, Number(max)) }],
      }],
    }),
    [value, min, max, unit, thrArr]
  );

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-700 bg-slate-800/50 p-1">
      <div className="mb-0.5 truncate text-center text-xs text-slate-400">{component.title}</div>
      <div className="flex-1 overflow-hidden">
        <React.Suspense fallback={<EChartFallback />}>
          <ReactECharts option={option} style={{ height: "100%", minHeight: 60 }} opts={{ renderer: "svg" }} />
        </React.Suspense>
      </div>
    </div>
  );
}

/* --------------------------------- 告警列表 -------------------------------- */

const ALARM_MOCK = [
  { level: "CRITICAL", title: "挥发窑温度超阈值", time: "2分钟前", icon: AlertTriangle, color: "#ef4444" },
  { level: "WARN", title: "数据源完整率低于80%", time: "15分钟前", icon: Bell, color: "#eab308" },
  { level: "INFO", title: "优化策略已生效", time: "1小时前", icon: Info, color: "#3b82f6" },
  { level: "RESOLVED", title: "裂解炉温度已恢复", time: "3小时前", icon: CheckCircle2, color: "#22c55e" },
  { level: "CRITICAL", title: "碳排强度接近限值", time: "5小时前", icon: AlertTriangle, color: "#ef4444" },
];

function AlarmWidget({ component }: { component: ComponentInstance }) {
  const { maxItems = 10, filterLevel = "all" } = component.props as Record<string, unknown>;
  const items = ALARM_MOCK.filter(
    (a) => filterLevel === "all" || (filterLevel === "WARN" && a.level !== "INFO") || a.level === filterLevel
  ).slice(0, Number(maxItems));

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-700 bg-slate-800/50">
      <div className="border-b border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300">
        {component.title}
        <span className="ml-2 text-slate-500">({items.length})</span>
      </div>
      <div className="flex-1 overflow-auto">
        {items.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} className="flex items-center gap-2 border-b border-slate-800 px-3 py-1.5 last:border-0">
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: a.color }} />
              <span className="flex-1 truncate text-xs text-slate-300">{a.title}</span>
              <span className="shrink-0 text-[10px] text-slate-500">{a.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- 状态指示灯 ------------------------------- */

function StatusWidget({ component }: { component: ComponentInstance }) {
  const value = useMockValue(component.bindings.value);
  const { onColor = "#22c55e", offColor = "#ef4444", label = "运行状态" } = component.props as Record<string, unknown>;
  const isOn = value > 50;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-2">
      <div
        className="h-8 w-8 rounded-full ring-4 ring-offset-2 ring-offset-slate-800 transition-colors"
        style={{
          backgroundColor: isOn ? (onColor as string) : (offColor as string),
          boxShadow: `0 0 12px ${isOn ? (onColor as string) : (offColor as string)}88`,
          // ring color
          ...(isOn ? { "--tw-ring-color": onColor as string } : { "--tw-ring-color": offColor as string }),
        } as React.CSSProperties}
      />
      <span className="text-xs text-slate-400">{label as string}</span>
    </div>
  );
}

/* --------------------------------- 文本标签 -------------------------------- */

function TextWidget({ component }: { component: ComponentInstance }) {
  const { text = "文本", fontSize = 14, color = "#0f172a", bold = false } = component.props as Record<string, unknown>;
  return (
    <div className="flex h-full items-center justify-center rounded p-1">
      <span
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
  const value = useMockValue(component.bindings.value);
  const { fillColor = "#3b82f6", maxLevel = 100, label = "储罐" } = component.props as Record<string, unknown>;
  const pct = Math.min(100, Math.max(0, (value / Number(maxLevel)) * 100));

  return (
    <div className="flex h-full flex-col items-center justify-end gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-2">
      <span className="text-xs text-slate-400">{label as string}</span>
      <div className="relative flex-1 w-16 min-h-[60px] rounded-md border-2 border-slate-600 bg-slate-900 overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-500"
          style={{
            height: `${pct}%`,
            backgroundColor: fillColor as string,
            opacity: 0.75,
          }}
        >
          {/* 液面波纹效果 */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 rounded-full" />
        </div>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
          {value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

/* --------------------------------- 阀门控件 -------------------------------- */

function ValveWidget({ component }: { component: ComponentInstance }) {
  const value = useMockValue(component.bindings.value);
  const { onColor = "#22c55e", offColor = "#64748b", label = "阀门" } = component.props as Record<string, unknown>;
  const isOpen = value > 50;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-2">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        {/* 管道 */}
        <rect x="0" y="17" width="14" height="6" fill="#94a3b8" />
        <rect x="26" y="17" width="14" height="6" fill="#94a3b8" />
        {/* 阀门体 */}
        <circle cx="20" cy="20" r="10" fill={isOpen ? (onColor as string) : (offColor as string)} stroke="#e2e8f0" strokeWidth="1.5" />
        {/* 阀门手柄 */}
        <rect
          x="18"
          y={isOpen ? "8" : "12"}
          width="4"
          height="12"
          fill="#0f172a"
          rx="1"
          style={{ transition: "all 0.3s" }}
        />
      </svg>
      <span className="text-xs text-slate-400">{label as string}</span>
      <span className="text-[10px]" style={{ color: isOpen ? (onColor as string) : (offColor as string) }}>
        {isOpen ? "开启" : "关闭"}
      </span>
    </div>
  );
}

/* --------------------------------- 管道控件 -------------------------------- */

function PipeWidget({ component }: { component: ComponentInstance }) {
  const { color = "#94a3b8", flowColor = "#06b6d4", animated = true } = component.props as Record<string, unknown>;
  return (
    <div className="flex h-full items-center justify-center">
      <svg width="100%" height="20" viewBox="0 0 200 20" preserveAspectRatio="none">
        <rect x="0" y="4" width="200" height="12" rx="2" fill={color as string} />
        {animated === true || animated === "true" ? (
          <>
            <rect x="0" y="6" width="40" height="8" rx="1" fill={flowColor as string} opacity="0.7">
              <animate attributeName="x" from="-40" to="200" dur="2s" repeatCount="indefinite" />
            </rect>
            <rect x="0" y="6" width="40" height="8" rx="1" fill={flowColor as string} opacity="0.7">
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
  const value = useMockValue(component.bindings.value);
  const { min = 0, max = 100, unit = "", label = "压力" } = component.props as Record<string, unknown>;
  const angle = -120 + (Math.min(value, Number(max)) - Number(min)) / (Number(max) - Number(min)) * 240;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-2">
      <span className="text-xs text-slate-400">{label as string}</span>
      <svg width="60" height="60" viewBox="0 0 60 60">
        {/* 表盘背景 */}
        <circle cx="30" cy="30" r="26" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
        {/* 刻度弧 */}
        <path d="M 12 42 A 22 22 0 1 1 48 42" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        {/* 指针 */}
        <line
          x1="30" y1="30" x2="30" y2="12"
          stroke="#ef4444" strokeWidth="2" strokeLinecap="round"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: "30px 30px", transition: "transform 0.5s" }}
        />
        <circle cx="30" cy="30" r="3" fill="#0f172a" />
        {/* 数值 */}
        <text x="30" y="48" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
          {value.toFixed(0)}{unit as string}
        </text>
      </svg>
    </div>
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
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-800/50 p-3 text-center">
        <Brain className="h-6 w-6 text-slate-500" />
        <span className="text-xs text-slate-400">点击后绑定模型</span>
        <span className="text-[10px] text-slate-600">在右侧属性面板选择模型</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-purple-700/50 bg-slate-800/60">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-700 bg-purple-900/20 px-3 py-1.5">
        <Brain className="h-4 w-4 shrink-0 text-purple-400" />
        <span className="flex-1 truncate text-xs font-medium text-slate-200">{component.title}</span>
        <span className="rounded bg-purple-800/50 px-1.5 py-0.5 text-[9px] font-mono text-purple-300">
          {mb.versionNo ?? "latest"}
        </span>
        <button
          type="button"
          onClick={runModel}
          disabled={running}
          className="rounded bg-purple-600 px-2 py-0.5 text-[10px] text-white hover:bg-purple-500 disabled:opacity-50"
        >
          {running ? "运行中…" : "执行"}
        </button>
      </div>

      {/* Body: input/output */}
      <div className="flex-1 overflow-auto p-2 text-xs">
        {showInput === true || showInput === "true" ? (
          <div className="mb-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">输入参数</div>
            <div className="space-y-0.5">
              {Object.entries(mb.inputMappings).length === 0 ? (
                <span className="text-slate-600">未配置输入映射</span>
              ) : (
                Object.entries(mb.inputMappings).map(([param, mapping]) => (
                  <div key={param} className="flex items-center gap-1 truncate">
                    <span className="font-mono text-blue-300">{param}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-slate-600" />
                    <span className="font-mono text-emerald-300 truncate">
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
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">推理输出</div>
            {running ? (
              <div className="flex items-center gap-1.5 text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                正在推理…
              </div>
            ) : output ? (
              <div className="space-y-1 rounded bg-slate-900/60 p-2">
                {Object.entries(output).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-1">
                    <span className="shrink-0 text-slate-500">{k}:</span>
                    <span className="text-slate-200">{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-slate-600">点击&quot;执行&quot;运行模型</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
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
};

/** Widget 渲染入口 */
export function WidgetRenderer({ component }: { component: ComponentInstance }) {
  // 隐藏的组件不渲染
  if (component.visible === false) return null;

  const Renderer = WIDGET_MAP[component.type] ?? KpiWidget;
  return <Renderer component={component} />;
}
