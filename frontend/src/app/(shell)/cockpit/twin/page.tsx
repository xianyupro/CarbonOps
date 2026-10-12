"use client";

/**
 * 数字孪生 —— 1号挥发窑三维仿真驾驶舱。
 * 数据：从数据基座按名称取点位 → 5s 轮询最新值（含温度场曲线 valueText）→ 驱动三维场景。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Loader2, Moon, RefreshCw, ScanEye, Tag } from "lucide-react";

import { api } from "@/lib/api";
import type { DataPoint } from "@/types/api";
import { Button } from "@/components/ui/button";
import type { KilnTelemetry } from "@/components/cockpit/kiln-twin";

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
];

const EMPTY: KilnTelemetry = {
  tailTemp: null,
  headTemp: null,
  feedFreq: null,
  motorFreq: null,
  co: null,
  tempField: null,
};

export default function KilnTwinPage() {
  const [telemetry, setTelemetry] = React.useState<KilnTelemetry>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [showLabels, setShowLabels] = React.useState(true);
  const [night, setNight] = React.useState(false);
  const [xray, setXray] = React.useState(false);
  const [segment, setSegment] = React.useState<{ index: number; temp: number } | null>(null);
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

  // 2) 轮询最新值
  React.useEffect(() => {
    if (loading) return;
    let stopped = false;

    async function poll() {
      const ids = Object.values(pointIdsRef.current).filter(Boolean) as number[];
      if (ids.length === 0 || stopped) return;
      try {
        const rows = await api.data.latest(ids);
        const next: KilnTelemetry = { ...EMPTY };
        for (const [field, pid] of Object.entries(pointIdsRef.current) as [keyof KilnTelemetry, number][]) {
          const r = rows.find((x) => x.pointId === pid);
          if (!r) continue;
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

  const kpis: { label: string; value: string; unit: string }[] = [
    { label: "窑尾温度", value: fmt(telemetry.tailTemp), unit: "℃" },
    { label: "窑头温度", value: fmt(telemetry.headTemp), unit: "℃" },
    { label: "给料频率", value: fmt(telemetry.feedFreq), unit: "Hz" },
    { label: "主电机频率", value: fmt(telemetry.motorFreq), unit: "Hz" },
    { label: "CO 浓度", value: fmt(telemetry.co, 3), unit: "%" },
    {
      label: "温度场峰值",
      value: fmt(
        telemetry.tempField ? Math.max(...telemetry.tempField.map((x) => x[1] as number)) : null
      ),
      unit: "℃",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">挥发窑数字孪生</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            1号回转挥发窑三维仿真 · 转速/料流/温度场由现场实时数据驱动（5s 刷新）
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={showLabels ? "default" : "outline"} size="sm" onClick={() => setShowLabels((v) => !v)}>
            <Tag className="mr-1 h-4 w-4" /> 数据标签
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

      {/* 关键指标条 */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-teal-700">
              {k.value}
              <span className="ml-0.5 text-xs font-normal text-slate-400">{k.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 三维画布 */}
      <div className="relative h-[calc(100vh-330px)] min-h-[480px] overflow-hidden rounded-lg border border-border">
        <KilnTwin
          telemetry={telemetry}
          showLabels={showLabels}
          night={night}
          xray={xray}
          onSegmentClick={(index, temp) => setSegment({ index, temp })}
        />
        {segment && (
          <div className="absolute right-3 top-3 w-56 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">窑体分段 #{segment.index + 1}</p>
              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSegment(null)}>
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
      </div>
      <p className="text-xs text-muted-foreground">
        操作：鼠标左键旋转 / 右键平移 / Ctrl+滚轮缩放。筒体颜色=轴向温度场（暗红→亮黄）；
        转速随主电机频率、料流速度随给料频率、火焰随窑头温度实时变化。
      </p>
    </div>
  );
}

function fmt(v: number | null, digits = 1): string {
  return v == null ? "--" : v.toFixed(digits);
}
