"use client";

/**
 * 数字孪生 —— 1号挥发窑三维仿真驾驶舱（平台 C 位）。
 * 数据：从数据基座按名称取点位 → 5s 轮询最新值（含温度场曲线 valueText）→ 驱动三维场景。
 * 布局：左侧三维画布（竖向温度场图例 / 分段信息卡 / 设备信息卡叠加层）+ 右侧 260px 实时遥测面板。
 * 交互：筒体分段点击 / 窑头罩·给料圆盘·余热锅炉·电收尘·烟囱点击信息卡 / 4 个相机机位预设。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  Activity,
  Loader2,
  Moon,
  RefreshCw,
  RotateCw,
  ScanEye,
  Boxes,
  Tag,
} from "lucide-react";

import { api } from "@/lib/api";
import type { DataPoint } from "@/types/api";
import { Button } from "@/components/ui/button";
import { VIEW_PRESETS, tempColor } from "@/components/cockpit/kiln-twin";
import type {
  KilnTelemetry,
  ViewPreset,
  TwinDeviceInfo,
} from "@/components/cockpit/kiln-twin";

const KilnTwin = dynamic(() => import("@/components/cockpit/kiln-twin"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在加载三维引擎…
    </div>
  ),
});

/** 关键点位名称 → 孪生字段 */
const POINT_BINDING: { name: string; field: keyof KilnTelemetry }[] = [
  { name: "回转窑窑尾温度", field: "tailTemp" },
  { name: "回转窑窑头温度（上）", field: "headTemp" },
  { name: "圆盘给料机控制反馈频率", field: "feedFreq" },
  { name: "主电机频率反馈信号", field: "motorFreq" },
  { name: "CO浓度", field: "co" },
  { name: "Temp_01", field: "tempField" },
  { name: "余热锅炉锅筒压力", field: "boilerPressure" },
  { name: "增压风机进口阀门开度反馈值", field: "fanValve" },
  { name: "1#锅筒液位", field: "drumLevel" },
];

const EMPTY: KilnTelemetry = {
  tailTemp: null,
  headTemp: null,
  feedFreq: null,
  motorFreq: null,
  co: null,
  boilerPressure: null,
  fanValve: null,
  drumLevel: null,
  tempField: null,
};

type FieldStamps = Partial<Record<keyof KilnTelemetry, string>>;

/** 遥测面板行定义（含小数位与告警阈值） */
const PANEL_ROWS: {
  label: string;
  field: Exclude<keyof KilnTelemetry, "tempField">;
  unit: string;
  digits: number;
  warnAbove?: number;
}[] = [
  { label: "窑尾温度", field: "tailTemp", unit: "℃", digits: 1, warnAbove: 1050 },
  { label: "窑头温度（上）", field: "headTemp", unit: "℃", digits: 1 },
  { label: "给料频率", field: "feedFreq", unit: "Hz", digits: 1 },
  { label: "主电机频率", field: "motorFreq", unit: "Hz", digits: 1 },
  { label: "CO 浓度", field: "co", unit: "%", digits: 3 },
  { label: "锅筒压力", field: "boilerPressure", unit: "MPa", digits: 2 },
  { label: "风机阀开度", field: "fanValve", unit: "%", digits: 1 },
  { label: "1#锅筒液位", field: "drumLevel", unit: "mm", digits: 1 },
];

export default function KilnTwinPage() {
  const [telemetry, setTelemetry] = React.useState<KilnTelemetry>(EMPTY);
  const [stamps, setStamps] = React.useState<FieldStamps>({});
  const [lastSync, setLastSync] = React.useState<string>("--:--:--");
  const [loading, setLoading] = React.useState(true);
  const [showLabels, setShowLabels] = React.useState(true);
  const [showDevices, setShowDevices] = React.useState(true);
  const [night, setNight] = React.useState(false);
  const [xray, setXray] = React.useState(false);
  const [autoRotate, setAutoRotate] = React.useState(false);
  const [view, setView] = React.useState<{ key: number; preset: ViewPreset } | null>(null);
  const [segment, setSegment] = React.useState<{ index: number; temp: number } | null>(null);
  const [device, setDevice] = React.useState<TwinDeviceInfo | null>(null);
  const pointIdsRef = React.useRef<Partial<Record<keyof KilnTelemetry, number>>>({});

  // 1) 解析点位 ID
  React.useEffect(() => {
    api.dataPoints
      .list({ pageSize: 300 })
      .then((res) => {
        const all: DataPoint[] = res.list;
        for (const b of POINT_BINDING) {
          const p = all.find((x) => x.name === b.name || x.code.endsWith(`.${b.name}`));
          if (p) pointIdsRef.current[b.field] = p.id;
        }
        if (Object.keys(pointIdsRef.current).length === 0) {
          toast.error("未找到挥发窑数据点位，请先导入现场数据");
        }
        setLoading(false);
      })
      .catch(() => {
        toast.error("点位加载失败");
        setLoading(false);
      });
  }, []);

  // 2) 轮询最新值（每轮记录各字段更新时间）
  React.useEffect(() => {
    if (loading) return;
    let stopped = false;

    async function poll() {
      const ids = Object.values(pointIdsRef.current).filter(Boolean) as number[];
      if (ids.length === 0 || stopped) return;
      try {
        const rows = await api.data.latest(ids);
        const next: KilnTelemetry = { ...EMPTY };
        const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
        const nextStamps: FieldStamps = {};
        for (const [field, pid] of Object.entries(pointIdsRef.current) as [
          keyof KilnTelemetry,
          number,
        ][]) {
          const r = rows.find((x) => x.pointId === pid);
          if (!r) continue;
          nextStamps[field] = now;
          if (field === "tempField") {
            if (r.valueText) {
              try {
                const arr = JSON.parse(r.valueText);
                if (Array.isArray(arr) && arr.length > 1) next.tempField = arr;
              } catch {
                /* 非法曲线忽略 */
              }
            }
          } else {
            next[field] = r.value;
          }
        }
        setTelemetry(next);
        setStamps(nextStamps);
        setLastSync(now);
      } catch {
        /* 轮询失败静默重试 */
      }
    }

    poll();
    const timer = setInterval(poll, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [loading]);

  // 温度场峰值（曲线最高点）
  const fieldPeak = telemetry.tempField
    ? Math.max(...telemetry.tempField.map((x) => x[1] as number))
    : null;

  // 遥测面板数据行（温度场峰值并入展示）
  const panelRows = [
    ...PANEL_ROWS.map((r) => {
      const raw = telemetry[r.field];
      return {
        key: r.field as string,
        label: r.label,
        value: fmt(raw, r.digits),
        unit: r.unit,
        time: stamps[r.field],
        warn: r.warnAbove != null && raw != null && raw > r.warnAbove,
      };
    }),
    {
      key: "tempFieldPeak",
      label: "温度场峰值",
      value: fmt(fieldPeak, 1),
      unit: "℃",
      time: stamps.tempField,
      warn: fieldPeak != null && fieldPeak > 1100,
    },
  ];

  // 温度场图例渐变（与筒体着色同一映射：500℃ 暗红 → 1200℃ 亮黄，高温在上）
  const legendGradient = React.useMemo(() => {
    const stops: string[] = [];
    for (let t = 1200; t >= 500; t -= 35) stops.push(tempColor(t));
    return `linear-gradient(180deg, ${stops.join(",")})`;
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">挥发窑数字孪生</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            1号回转挥发窑三维仿真 · 全流程设备（给料→焙烧→水淬→余热回收→收尘→脱硫→引风→排放）
            由现场实时数据驱动 · 点击设备查看工艺详情（5s 刷新）
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={showLabels ? "default" : "outline"} size="sm" onClick={() => setShowLabels((v) => !v)}>
            <Tag className="mr-1 h-4 w-4" /> 数据标签
          </Button>
          <Button variant={showDevices ? "default" : "outline"} size="sm" onClick={() => setShowDevices((v) => !v)}>
            <Boxes className="mr-1 h-4 w-4" /> 设备标签
          </Button>
          <Button variant={autoRotate ? "default" : "outline"} size="sm" onClick={() => setAutoRotate((v) => !v)}>
            <RotateCw className="mr-1 h-4 w-4" /> 自动巡游
          </Button>
          <Button variant={night ? "default" : "outline"} size="sm" onClick={() => setNight((v) => !v)}>
            <Moon className="mr-1 h-4 w-4" /> 夜间模式
          </Button>
          <Button variant={xray ? "default" : "outline"} size="sm" onClick={() => setXray((v) => !v)}>
            <ScanEye className="mr-1 h-4 w-4" /> 窑内透视
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1 h-4 w-4" /> 刷新
          </Button>
        </div>
      </div>

      {/* 相机机位预设：全景 / 窑头特写 / 窑尾特写 / 烟气处理 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">机位</span>
        {Object.entries(VIEW_PRESETS).map(([k, p]) => (
          <Button
            key={k}
            size="sm"
            variant={view?.preset === p ? "default" : "outline"}
            className="h-7 px-2.5 text-xs"
            onClick={() => setView({ key: Date.now(), preset: p })}
          >
            {p.name}
          </Button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground/70">
          点击场景中 窑头罩 / 给料圆盘 / 余热锅炉 / 电收尘 / 烟囱 / 筒体分段 查看详情
        </span>
      </div>

      {/* 三维画布 + 实时遥测面板 */}
      <div className="flex items-stretch gap-3">
        <div className="relative h-[calc(100vh-280px)] min-h-[520px] flex-1 overflow-hidden rounded-lg border border-border">
          <KilnTwin
            telemetry={telemetry}
            showLabels={showLabels}
            showDevices={showDevices}
            night={night}
            xray={xray}
            autoRotate={autoRotate}
            view={view}
            onSegmentClick={(index, temp) => setSegment({ index, temp })}
            onDeviceClick={setDevice}
          />

          {/* 温度场图例（右侧竖向色带：500℃ 暗红 → 1200℃ 亮黄） */}
          <div className="absolute right-3 top-3 z-10 rounded-md border border-border bg-card/90 px-2 py-2 shadow-sm backdrop-blur">
            <p className="text-[10px] text-muted-foreground">筒体温度场 ℃</p>
            <div className="mt-1.5 flex gap-1.5">
              <div
                className="h-48 w-3 rounded-sm border border-border/60"
                style={{ background: legendGradient }}
              />
              <div className="flex h-48 flex-col justify-between py-px font-mono text-[9px] tabular-nums text-muted-foreground">
                {[1200, 1100, 1000, 900, 800, 700, 600, 500].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
            <p className="mt-1 text-[9px] text-muted-foreground/70">&gt;1050℃ 红环告警</p>
          </div>

          {/* 窑体分段信息卡 */}
          {segment && (
            <div className="absolute left-3 top-3 z-10 w-56 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">窑体分段 #{segment.index + 1}</p>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSegment(null)}
                >
                  ✕
                </button>
              </div>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-teal-700">
                {segment.temp}
                <span className="ml-0.5 text-xs font-normal text-slate-400">℃</span>
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                轴向位置约 {Math.round(((segment.index + 0.5) / 12) * 100)}% 窑长 · 数据源 温度场曲线
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                {segment.temp > 1100
                  ? "高温段：有价金属剧烈挥发区，注意结圈风险"
                  : segment.temp > 900
                    ? "中温段：主流焙烧反应区"
                    : "低温段：预热/尾段，关注料层均匀性"}
              </p>
            </div>
          )}

          {/* 设备信息卡（点击场景设备弹出） */}
          {device && (
            <div className="absolute bottom-3 left-3 z-10 w-72 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold">{device.name}</p>
                  <span className="rounded bg-teal-600/10 px-1.5 py-0.5 text-[9px] text-teal-700">
                    {device.role}
                  </span>
                </div>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setDevice(null)}
                >
                  ✕
                </button>
              </div>
              {device.metrics.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {device.metrics.map((m) => (
                    <div
                      key={m.label}
                      className="flex-1 rounded-md border border-border bg-muted/40 px-2 py-1.5"
                    >
                      <p className="text-[9px] text-muted-foreground">{m.label}</p>
                      <p className="font-mono text-sm font-semibold tabular-nums text-teal-700">
                        {m.value}
                        <span className="ml-0.5 text-[9px] font-normal text-slate-400">{m.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                {device.description}
              </p>
            </div>
          )}
        </div>

        {/* 实时遥测面板（260px，等宽字体，与三维场景共用同一份轮询数据） */}
        <aside className="flex w-[260px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-teal-600" />
              <span className="text-xs font-semibold">实时遥测</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
              5s · {lastSync}
            </span>
          </div>
          <div className="flex-1 divide-y divide-border/70 overflow-auto">
            {panelRows.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-2 px-3 py-[7px]">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{r.label}</p>
                  <p className="font-mono text-[9px] tabular-nums text-muted-foreground/60">
                    {r.time ?? "--:--:--"}
                  </p>
                </div>
                <p
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    r.warn ? "text-red-600" : "text-teal-700"
                  }`}
                >
                  {r.value}
                  <span className="ml-0.5 text-[10px] font-normal text-slate-400">{r.unit}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-3 py-1.5">
            <p className="text-[9px] text-muted-foreground/70">
              数据来源：数据基座 /data/latest · 窑尾温度 &gt;1050℃ 告警
            </p>
          </div>
        </aside>
      </div>

      <p className="text-xs text-muted-foreground">
        操作：鼠标左键旋转 / 右键平移 / Ctrl+滚轮缩放。筒体颜色=轴向温度场（暗红→亮黄，右侧色带图例）；
        转速随主电机频率、料流与窑内物料推移速度随给料频率、火焰随窑头温度实时变化；主传动小齿轮与筒体反向联动，
        水淬池蒸汽速率随给料频率，引风机叶轮常转，烟气经 余热锅炉→电收尘→脱硫塔→引风机→烟囱 全链路呈现；
        开启「窑内透视」可观察物料自窑尾向窑头推移。
      </p>
    </div>
  );
}

function fmt(v: number | null, digits = 1): string {
  return v == null ? "--" : v.toFixed(digits);
}
