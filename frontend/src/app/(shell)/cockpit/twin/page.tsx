"use client";

/**
 * 数字孪生中心 —— 驾驶舱统一孪生入口。
 * 语义分层：① 1号挥发窑 = 生产场景（现场实测数据驱动，平台 C 位）；
 *          ② 行业示范场景（高炉/锌挥发窑/闪速炉/电解槽/裂解炉）= 能力演示（工艺额定值模拟数据）。
 * 通过顶部场景切换在同页加载对应孪生，标题/工具条/右侧面板/数据来源说明随之切换，
 * 与「低碳运行场景」卡片、「场景工作台」形成同一套语义：打开孪生 → 统一入口。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity,
  FlaskConical,
  Loader2,
  Moon,
  RefreshCw,
  RotateCw,
  ScanEye,
  Boxes,
  Tag,
  Layers,
  ExternalLink,
} from "lucide-react";
import { TwinSimulator } from "@/lib/twin-sim";

import { api } from "@/lib/api";
import type { DataPoint } from "@/types/api";
import { Button } from "@/components/ui/button";
import { VIEW_PRESETS, tempColor } from "@/components/cockpit/kiln-twin";
import type {
  KilnTelemetry,
  ViewPreset,
  TwinDeviceInfo,
} from "@/components/cockpit/kiln-twin";
import { SCENES } from "@/mock/cloud-edge";
import type { Scene } from "@/types/cloud-edge";

const KilnTwin = dynamic(() => import("@/components/cockpit/kiln-twin"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在加载三维引擎…
    </div>
  ),
});

const SceneViewer = dynamic(() => import("@/components/scenes/digital-twin-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在加载三维引擎…
    </div>
  ),
});

/** 示范场景短名（切换条用） */
const SCENE_SHORT: Record<string, string> = {
  steel: "高炉炼铁",
  zinc: "锌挥发窑",
  copper: "铜闪速炉",
  aluminum: "铝电解槽",
  chemical: "裂解炉",
};

/** 示范场景右侧面板参数行（按装备类型给出工艺语义标签） */
function sceneParamRows(scene: Scene): { label: string; value: string; unit: string }[] {
  const p = scene.params;
  const t = scene.twinType;
  const rows: { label: string; value: string; unit: string }[] = [];
  if (!p) return rows;
  const add = (label: string, v: number | undefined, unit: string, digits = 1, scale = 1) =>
    rows.push({
      label,
      value: v == null ? "--" : (v * scale).toFixed(digits),
      unit,
    });
  if (t === "blastFurnace") {
    add("炉缸温度", p.kilnTemp, "℃", 0);
    add("富氧率", p.airRatio, "%", 1, 100);
    add("喷煤量", p.fuelFlow, "t/h");
    add("鼓风量", p.speed, "kNm³/h", 0);
    add("炉渣温度", p.slagTemp, "℃", 0);
    add("煤气温度", p.exhaustTemp, "℃", 0);
  } else if (t === "rotaryKiln") {
    add("焙烧带温度", p.kilnTemp, "℃", 0);
    add("窑速", p.speed, "rpm", 0);
    add("给料量", p.inletSpeed, "t/h");
    add("风氧配比", p.airRatio, "%", 1, 100);
    add("渣温", p.slagTemp, "℃", 0);
    add("排烟温度", p.exhaustTemp, "℃", 0);
  } else if (t === "flashFurnace") {
    add("反应塔温度", p.kilnTemp, "℃", 0);
    add("富氧浓度", p.airRatio, "%", 1, 100);
    add("投料量", p.inletSpeed, "t/h");
    add("熔池温度", p.slagTemp, "℃", 0);
    add("工艺风量", p.speed, "kNm³/h", 0);
    add("锅炉入口烟温", p.exhaustTemp, "℃", 0);
  } else if (t === "electrolyticCell") {
    add("电解温度", p.kilnTemp ?? 960, "℃", 0);
    add("系列电流", p.speed ?? 385, "kA", 0);
    add("氧化铝浓度", p.airRatio, "%", 1, 100);
    add("下料速率", p.inletSpeed, "kg/s");
  } else if (t === "crackingFurnace") {
    add("炉膛温度", p.kilnTemp ?? 1010, "℃", 0);
    add("燃料气", p.fuelFlow, "t/h");
    add("进料量", p.inletSpeed, "t/h");
    add("排烟温度", p.exhaustTemp, "℃", 0);
  }
  return rows;
}

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
  { name: "回转窑窑头温度（下）", field: "headTempLower" },
  { name: "挥发窑炉顶料位", field: "roofLevel" },
  { name: "圆盘给料机电流", field: "feedCurrent" },
  { name: "主电机电流信号", field: "motorCurrent" },
  { name: "窑头压缩空气支管压力", field: "airPress" },
  { name: "余热锅炉入口压力", field: "whInPress" },
  { name: "余热锅炉出口压力", field: "whOutPress" },
  { name: "余热锅炉入口温度", field: "whInTemp" },
  { name: "电收尘器入口温度", field: "espInTemp" },
  { name: "风机出口压力", field: "fanOutPress" },
  { name: "风机出口温度", field: "fanOutTemp" },
  { name: "2#锅筒液位", field: "drum2Level" },
  { name: "3#锅筒液位", field: "drum3Level" },
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
  drum2Level: null,
  drum3Level: null,
  headTempLower: null,
  roofLevel: null,
  feedCurrent: null,
  motorCurrent: null,
  airPress: null,
  airFlow: null,
  whInPress: null,
  whOutPress: null,
  whInTemp: null,
  espInTemp: null,
  espOutPress: null,
  fanOutPress: null,
  fanOutTemp: null,
  tempField: null,
};

type FieldStamps = Partial<Record<keyof KilnTelemetry, string>>;

/** 遥测面板行定义（含小数位与告警阈值），按子系统分组 */
interface PanelRow {
  label: string;
  field: Exclude<keyof KilnTelemetry, "tempField">;
  unit: string;
  digits: number;
  warnAbove?: number;
  warnBelow?: number;
}

const PANEL_GROUPS: { group: string; rows: PanelRow[] }[] = [
  {
    group: "窑体热工",
    rows: [
      { label: "窑尾温度", field: "tailTemp", unit: "℃", digits: 1, warnAbove: 1050 },
      { label: "窑头温度（上）", field: "headTemp", unit: "℃", digits: 1 },
      { label: "窑头温度（下）", field: "headTempLower", unit: "℃", digits: 1 },
      { label: "窑顶料位", field: "roofLevel", unit: "mm", digits: 1 },
    ],
  },
  {
    group: "传动与给料",
    rows: [
      { label: "主电机频率", field: "motorFreq", unit: "Hz", digits: 2 },
      { label: "主电机电流", field: "motorCurrent", unit: "A", digits: 1, warnAbove: 320 },
      { label: "给料频率", field: "feedFreq", unit: "Hz", digits: 2 },
      { label: "给料机电流", field: "feedCurrent", unit: "A", digits: 2 },
    ],
  },
  {
    group: "余热锅炉",
    rows: [
      { label: "锅筒压力", field: "boilerPressure", unit: "MPa", digits: 2, warnAbove: 1.45 },
      { label: "1#锅筒液位", field: "drumLevel", unit: "mm", digits: 1 },
      { label: "2#锅筒液位", field: "drum2Level", unit: "mm", digits: 1 },
      { label: "3#锅筒液位", field: "drum3Level", unit: "mm", digits: 1 },
      { label: "入口温度", field: "whInTemp", unit: "℃", digits: 1 },
    ],
  },
  {
    group: "烟气系统",
    rows: [
      { label: "CO 浓度", field: "co", unit: "%", digits: 3, warnAbove: 0.08 },
      { label: "风机阀开度", field: "fanValve", unit: "%", digits: 1 },
      { label: "电收尘入口温度", field: "espInTemp", unit: "℃", digits: 1 },
      { label: "风机出口温度", field: "fanOutTemp", unit: "℃", digits: 1 },
      { label: "风机出口压力", field: "fanOutPress", unit: "Pa", digits: 0 },
    ],
  },
];

export default function KilnTwinPage() {
  const router = useRouter();
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
  const [demoMode, setDemoMode] = React.useState(
    () => localStorage.getItem("kiln_twin_demo") === "1"
  );
  // 场景切换：null = 1号挥发窑（生产实测）；否则为行业示范场景 id（支持 ?scene= 直达）
  const [sceneId, setSceneId] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("scene");
  });
  const activeScene = sceneId ? SCENES.find((s) => s.id === sceneId) ?? null : null;
  const simRef = React.useRef<TwinSimulator | null>(null);
  const pointIdsRef = React.useRef<Partial<Record<keyof KilnTelemetry, number>>>({});

  function switchScene(id: string | null) {
    setSceneId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("scene", id);
    else url.searchParams.delete("scene");
    window.history.replaceState(null, "", url.toString());
  }

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
    if (loading || demoMode) return;
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
  }, [loading, demoMode]);

  // 2b) 模拟演示：每秒由引擎生成全量遥测（含合成温度场），数据实时跳动
  React.useEffect(() => {
    if (!demoMode || loading) return;
    if (!simRef.current) simRef.current = new TwinSimulator();
    const sim = simRef.current;
    const now = () => new Date().toLocaleTimeString("zh-CN", { hour12: false });
    const tick = () => {
      const values = sim.tick(1);
      const t = now();
      setTelemetry(values);
      const stamps: FieldStamps = {};
      for (const g of PANEL_GROUPS) {
        for (const r of g.rows) stamps[r.field] = t;
      }
      stamps.tempField = t;
      setStamps(stamps);
      setLastSync(`${t} · SIM`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [demoMode, loading]);

  function toggleDemo() {
    const next = !demoMode;
    setDemoMode(next);
    localStorage.setItem("kiln_twin_demo", next ? "1" : "0");
    toast.success(
      next ? "模拟演示已开启：孪生数据按秒实时演化" : "模拟演示已关闭：恢复现场数据轮询"
    );
  }

  // 温度场峰值（曲线最高点）
  const fieldPeak = telemetry.tempField
    ? Math.max(...telemetry.tempField.map((x) => x[1] as number))
    : null;

  // 遥测面板分组数据行（温度场峰值并入第一组末尾）
  const panelGroups = PANEL_GROUPS.map((g, gi) => ({
    group: g.group,
    rows: [
      ...g.rows.map((r) => {
        const raw = telemetry[r.field];
        return {
          key: r.field as string,
          label: r.label,
          value: fmt(raw, r.digits),
          unit: r.unit,
          time: stamps[r.field],
          warn:
            (r.warnAbove != null && raw != null && raw > r.warnAbove) ||
            (r.warnBelow != null && raw != null && raw < r.warnBelow),
        };
      }),
      ...(gi === 0
        ? [
            {
              key: "tempFieldPeak",
              label: "温度场峰值",
              value: fmt(fieldPeak, 1),
              unit: "℃",
              time: stamps.tempField,
              warn: fieldPeak != null && fieldPeak > 1100,
            },
          ]
        : []),
    ],
  }));

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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">
              {activeScene ? activeScene.name : "挥发窑数字孪生"}
            </h1>
            {activeScene ? (
              <span className="rounded bg-amber-600/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                示范场景 · 模拟数据
              </span>
            ) : (
              <span className="rounded bg-teal-600/10 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                1号机组 · 生产实测
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeScene
              ? `${activeScene.desc} · 行业示范场景，展示平台跨行业孪生能力（数据为工艺额定值模拟，不接入数据基座）`
              : "1号回转挥发窑三维仿真 · 全流程设备（上料→给料→焙烧→水淬→余热回收→收尘→脱硫→引风→排放）由现场实时数据驱动 · 10 类关键设备可点击查看工艺详情（5s 刷新）"}
          </p>
        </div>
        {!activeScene && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={demoMode ? "default" : "outline"}
              size="sm"
              onClick={toggleDemo}
              className={demoMode ? "bg-amber-600 hover:bg-amber-700" : ""}
            >
              <FlaskConical className="mr-1 h-4 w-4" />
              模拟演示
              {demoMode ? <span className="ml-1 font-cyber text-[9px]">ON</span> : null}
            </Button>
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
        )}
      </div>

      {/* 场景切换：生产场景 + 行业示范（语义分层：实测 / 示范） */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">场景</span>
        <Button
          size="sm"
          variant={!activeScene ? "default" : "outline"}
          className="h-7 px-2.5 text-xs"
          onClick={() => switchScene(null)}
        >
          1号挥发窑
          <span className={`ml-1 rounded px-1 text-[9px] leading-none ${!activeScene ? "bg-white/20" : "bg-teal-600/10 text-teal-700"}`}>
            实测
          </span>
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        <span className="text-xs text-muted-foreground/70">行业示范</span>
        {SCENES.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={activeScene?.id === s.id ? "default" : "outline"}
            className="h-7 px-2.5 text-xs"
            onClick={() => switchScene(s.id)}
          >
            {SCENE_SHORT[s.id] ?? s.name}
            <span className={`ml-1 rounded px-1 text-[9px] leading-none ${activeScene?.id === s.id ? "bg-white/20" : "bg-amber-600/10 text-amber-700"}`}>
              示范
            </span>
          </Button>
        ))}
        {activeScene && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 px-2 text-xs text-muted-foreground"
            onClick={() => router.push(`/scenarios/${activeScene.id}`)}
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            打开场景工作台
          </Button>
        )}
      </div>

      {/* 挥发窑机位预设（仅生产场景） */}
      {!activeScene && (
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
            点击场景中 上料皮带 / 球团仓 / 给料圆盘 / 窑头罩 / 水淬池 / 余热锅炉 / 电收尘 / 脱硫塔 / 引风机
            / 烟囱 / 筒体分段 查看详情
          </span>
        </div>
      )}

      {/* 三维画布 + 右侧面板（生产场景=挥发窑孪生；示范场景=行业孪生） */}
      <div className="flex items-stretch gap-3">
        <div className="relative h-[calc(100vh-280px)] min-h-[520px] flex-1 overflow-hidden rounded-lg border border-border">
          {activeScene ? (
            <SceneViewer scene={activeScene} fullHeight />
          ) : (
          <>
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
          </>
          )}
        </div>

        {/* 右侧面板：生产场景 = 实时遥测；示范场景 = 工艺参数与设备台账 */}
        {!activeScene ? (
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
            {panelGroups.map((g) => (
              <div key={g.group}>
                <p className="sticky top-0 z-[1] bg-card/95 px-3 py-1 font-cyber text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
                  {g.group}
                </p>
                {g.rows.map((r) => (
                  <div
                    key={r.key}
                    className="flex items-center justify-between gap-2 px-3 py-[7px]"
                  >
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
            ))}
          </div>
          <div className="border-t border-border px-3 py-1.5">
            <p className="text-[9px] text-muted-foreground/70">
              {demoMode
                ? "数据来源：模拟演示引擎（1s 演化，不写回数据基座）"
                : "数据来源：数据基座 /data/latest"}{" "}
              · 窑尾温度 &gt;1050℃ 告警
            </p>
          </div>
        </aside>
        ) : (
        <aside className="flex w-[260px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-semibold">示范参数</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              模拟
            </span>
          </div>
          <div className="flex-1 divide-y divide-border/70 overflow-auto">
            {sceneParamRows(activeScene).length > 0 ? (
              sceneParamRows(activeScene).map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-2 px-3 py-[7px]">
                  <p className="truncate text-xs text-muted-foreground">{r.label}</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-teal-700">
                    {r.value}
                    <span className="ml-0.5 text-[10px] font-normal text-slate-400">{r.unit}</span>
                  </p>
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                场景建设中 · 关键参数未接入
              </div>
            )}
            {activeScene.equipment && activeScene.equipment.length > 0 && (
              <div>
                <p className="sticky top-0 z-[1] bg-card/95 px-3 py-1 font-cyber text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
                  设备台账
                </p>
                {activeScene.equipment.map((eq) => (
                  <div key={eq.name} className="flex items-center justify-between gap-2 px-3 py-[7px]">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          eq.status === "运行正常" ? "bg-teal-500" : "bg-amber-500"
                        }`}
                      />
                      <p className="truncate text-xs text-muted-foreground">{eq.name}</p>
                    </div>
                    <p className="font-mono text-xs font-semibold tabular-nums text-slate-500">
                      {eq.efficiency}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-border px-3 py-1.5">
            <p className="text-[9px] text-muted-foreground/70">
              数据来源：行业示范模拟数据 · 不接入数据基座
            </p>
          </div>
        </aside>
        )}
      </div>

      {activeScene ? (
        <p className="text-xs text-muted-foreground">
          示范场景操作：鼠标左键旋转 / 右键平移 / 滚轮缩放；画布右上角可切换参数标注、设备名称与自动巡游；
          点击场景设备查看工艺详情。行业示范用于展示平台跨行业孪生能力，生产实测请切换回「1号挥发窑」。
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          操作：鼠标左键旋转 / 右键平移 / Ctrl+滚轮缩放。筒体颜色=轴向温度场（暗红→亮黄，右侧色带图例）；
          转速随主电机频率、料流与窑内物料推移速度随给料频率、火焰随窑头温度实时变化；主传动小齿轮与筒体反向联动，
          皮带料流与捞渣机随给料频率、锅炉安全阀蒸汽随锅筒压力、烟囱烟气与烟气流向粒子随风机阀开度；
          电收尘集灰螺旋连续卸灰，烟气经 余热锅炉→电收尘→脱硫塔→引风机→烟囱 全链路呈现；
          开启「窑内透视」可观察物料自窑尾向窑头推移；夜间模式下照明灯塔与烟囱航空障碍灯点亮。
        </p>
      )}
    </div>
  );
}

function fmt(v: number | null, digits = 1): string {
  return v == null ? "--" : v.toFixed(digits);
}
