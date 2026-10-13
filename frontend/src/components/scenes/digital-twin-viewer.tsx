"use client";

/**
 * 场景详情 — 3D 数字孪生查看器（行业示范场景版 · 浅色统一主题）。
 *
 * 与主挥发窑孪生（components/cockpit/kiln-twin.tsx）同一视觉语言：
 * 浅色画布（#eef4f4）+ 浅色网格 + 深灰工业设备 + 白底标注卡 + 青色强调。
 *
 * 按 5 类装备分别建模：
 * - 高炉炼铁：炉缸/炉身/炉喉 + 热风围管风口 + 热风炉×2（蓄热交替辉光）+ 喷煤罐管路 +
 *   斜桥料车往复 + 重力除尘器 + 出铁沟铁水流珠（∝喷煤量）+ 铁水罐
 * - 回转挥发窑：倾斜筒体轴向温度场着色（峰值∝窑温参数）+ 滚圈/托轮/基础墩 + 大齿圈与主传动反向联动 +
 *   窑头罩燃烧器火焰（∝燃料流量）+ 窑尾料仓/圆盘给料（∝进料）+ 鼓风管系统 + 窑渣水淬蒸汽 + 尾部烟囱
 * - 闪速炉：反应塔精矿喷嘴料流（∝进料）+ 塔内反应辉光（∝塔温）+ 沉淀池熔池辉光（∝渣温）+
 *   富氧系统管路（∝富氧浓度）+ 冰铜/渣放出流珠 + 余热锅炉 + 烟囱烟气
 * - 铝电解槽：槽列×5（槽壳/槽罩/阳极炭块/铝导杆）+ 立柱母线与横向铝母线 + 电流辉光珠沿母线流动 +
 *   电解质辉光脉动 + 打壳锤头周期动作 + 集气总管→净化塔
 * - 裂解炉：辐射段烧嘴火焰阵列（闪烁∝燃料）+ 炉管温度辉光渐变 + 对流段翅片管 + 急冷锅炉汽包蒸汽 +
 *   引风机烟囱烟气（∝排温）
 *
 * 交互：设备点击信息卡（工艺说明 + 实时参数）/ 悬停指针 / 热点标注（scene.params 驱动，1s 抖动模拟实时）/
 *      设备名称标签开关 / 自动巡游 / 视角重置 / 活跃告警红色脉冲环（scene.alerts>0 时定位到告警设备）。
 * 数据：全部由 scene.params 驱动（无 params 的场景使用工艺额定值），与设备表/统计卡同源。
 *
 * 客户端 only：three.js 依赖浏览器环境。
 */
import * as React from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  Activity,
  Box,
  Loader2,
  RotateCw,
  RotateCcw,
  Tag,
  TriangleAlert,
} from "lucide-react";
import type { Scene, TwinType } from "@/types/cloud-edge";

interface Props {
  scene: Scene;
  /** 填满父容器高度（孪生中心嵌入用）；默认固定 460px */
  fullHeight?: boolean;
}

/* ================= 实时参数视图（scene.params 驱动 + 1s 抖动） ================= */

interface TwinTelemetry {
  mainTemp: number; // 主工艺温度 ℃（炉温/窑温/塔温）
  feedRate: number; // 进料 t/h
  airPct: number; // 风比/富氧浓度 %
  speed: number; // 转速 rpm（电解槽场景复用为系列电流 kA）
  slagTemp: number; // 渣温 ℃
  exhaustTemp: number; // 排烟温度 ℃
  fuelFlow: number; // 燃料流量 t/h
  alerts: number;
  running: boolean;
  live: number; // 抖动时钟（秒，1Hz）
}

/** 无 params 场景（建设中）的工艺额定值 */
const NOMINAL: Record<TwinType, { mainTemp: number; feedRate: number; airPct: number; speed: number; slagTemp: number; exhaustTemp: number; fuelFlow: number }> = {
  blastFurnace: { mainTemp: 1550, feedRate: 12.5, airPct: 78, speed: 65, slagTemp: 1400, exhaustTemp: 620, fuelFlow: 12.5 },
  rotaryKiln: { mainTemp: 1250, feedRate: 3.2, airPct: 85, speed: 82, slagTemp: 980, exhaustTemp: 420, fuelFlow: 2.4 },
  flashFurnace: { mainTemp: 1350, feedRate: 4.5, airPct: 92, speed: 75, slagTemp: 1150, exhaustTemp: 520, fuelFlow: 3.8 },
  electrolyticCell: { mainTemp: 960, feedRate: 2.0, airPct: 60, speed: 385, slagTemp: 955, exhaustTemp: 120, fuelFlow: 0 },
  crackingFurnace: { mainTemp: 1010, feedRate: 24.0, airPct: 65, speed: 0, slagTemp: 0, exhaustTemp: 320, fuelFlow: 6.5 },
};

function telemetryFor(scene: Scene, live: number): TwinTelemetry {
  const n = NOMINAL[scene.twinType];
  const p = scene.params;
  return {
    mainTemp: p?.kilnTemp ?? n.mainTemp,
    feedRate: p?.inletSpeed ?? n.feedRate,
    airPct: Math.round((p?.airRatio ?? n.airPct / 100) * 100),
    speed: p?.speed ?? n.speed,
    slagTemp: p?.slagTemp ?? n.slagTemp,
    exhaustTemp: p?.exhaustTemp ?? n.exhaustTemp,
    fuelFlow: p?.fuelFlow ?? n.fuelFlow,
    alerts: scene.alerts,
    running: scene.status === "running",
    live,
  };
}

/** 实时感抖动（确定性，1s 刷新） */
function j(base: number, amp: number, t: TwinTelemetry, seed = 0): number {
  return base + amp * Math.sin(t.live * 0.9 + seed * 1.7);
}
const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);
const f0 = (v: number) => Math.round(v).toString();

/** 温度 → 颜色（650℃ 暗红 → 1300℃ 亮黄），导出供温度场着色复用 */
function tempColor(temp: number): string {
  const t = THREE.MathUtils.clamp((temp - 650) / 650, 0, 1);
  const c = new THREE.Color();
  c.setHSL(THREE.MathUtils.lerp(0.02, 0.13, t), 0.92, THREE.MathUtils.lerp(0.18, 0.6, t));
  return `#${c.getHexString()}`;
}

/* ================= 设备点击信息卡注册表 ================= */

interface DeviceMeta {
  name: string;
  role: string;
  desc: string;
  metrics: { label: string; value: (t: TwinTelemetry) => string }[];
}

const DEVICE_META: Record<TwinType, Record<string, DeviceMeta>> = {
  blastFurnace: {
    body: {
      name: "高炉本体",
      role: "还原冶炼核心",
      desc: "炉料（烧结矿/球团/焦炭）自炉顶分批装入，热风自围管风口鼓入使焦炭燃烧，炉料下降途中被还原成铁水与炉渣；炉身温度与炉腹 CO₂ 反映煤气流分布与还原效率。",
      metrics: [
        { label: "炉缸温度", value: (t) => `${f0(j(t.mainTemp, 6, t))} ℃` },
        { label: "炉腹 CO₂", value: (t) => `${f1(j(t.airPct * 0.287, 0.4, t, 3))} %` },
      ],
    },
    stove: {
      name: "热风炉",
      role: "蓄热式鼓风预热",
      desc: "两座热风炉交替「燃烧蓄热 / 送风放热」，将冷风预热至 1100℃ 以上经围管送入高炉；蓄热体温度不足会直接拉低炉温并推高焦比。",
      metrics: [{ label: "热风温度", value: () => "1120 ℃" }],
    },
    coal: {
      name: "喷煤系统",
      role: "煤粉替代焦炭喷吹",
      desc: "制粉后的煤粉经喷煤罐载气输送，由风口喷入炉缸替代部分焦炭，是降焦比与降碳的核心手段；喷煤量波动直接影响炉温稳定性。",
      metrics: [{ label: "喷煤量", value: (t) => `${f1(j(t.fuelFlow, 0.3, t, 1))} t/h` }],
    },
    taphole: {
      name: "出铁口 / 铁水罐",
      role: "铁水排放与转运",
      desc: "周期性打开出铁口，铁水沿主沟流入铁水罐送炼钢；出铁温度是炉缸热状态最直接的表征，铁水流股不均需关注炉缸侵蚀与泥包。",
      metrics: [{ label: "出铁温度", value: (t) => `${f0(j(t.mainTemp - 70, 5, t, 2))} ℃` }],
    },
    dust: {
      name: "重力除尘器",
      role: "粗煤气除尘",
      desc: "炉顶煤气经上升管进入重力除尘器，依靠流速骤降使大颗粒炉尘沉降回收；除尘后煤气含尘达标方可供热风炉燃烧或 TRT 发电。",
      metrics: [{ label: "煤气温度", value: (t) => `${f0(j(260, 5, t, 4))} ℃` }],
    },
  },
  rotaryKiln: {
    body: {
      name: "回转窑主体",
      role: "挥发焙烧核心",
      desc: "倾斜旋转的筒体使锌挥发窑内球团自窑尾向窑头推移，焙烧带有价金属锌挥发进入烟气经收尘回收；窑温、转速与给料量共同决定焙烧质量与结圈风险。",
      metrics: [
        { label: "焙烧带温度", value: (t) => `${f0(j(t.mainTemp, 8, t))} ℃` },
        { label: "窑速", value: (t) => `${f0(j(t.speed, 1.5, t, 1))} rpm` },
      ],
    },
    feeder: {
      name: "下料装置",
      role: "入窑物料计量给料",
      desc: "浸出渣球团经料仓与圆盘给料机计量后溜入窑尾，给料量须与窑速、温度场匹配；频率反馈剧烈波动时需关注下料口堵塞与棚料。",
      metrics: [{ label: "给料量", value: (t) => `${f1(j(t.feedRate, 0.15, t, 2))} t/h` }],
    },
    blower: {
      name: "鼓风管系统",
      role: "焙烧供风",
      desc: "罗茨风机经风管向窑头供入助燃风与氧化风，风量与燃料量配比决定窑内气氛（氧化/还原）与锌挥发效率。",
      metrics: [{ label: "风氧配比", value: (t) => `${f0(j(t.airPct, 1.5, t, 3))} %` }],
    },
    slag: {
      name: "窑渣出口",
      role: "窑渣水淬排放",
      desc: "挥发后的窑渣自窑头排出经水淬溜槽急冷成粒，由渣口连续外运；渣温与水淬蒸汽量反映排渣的连续与稳定。",
      metrics: [{ label: "渣温", value: (t) => `${f0(j(t.slagTemp, 6, t, 4))} ℃` }],
    },
  },
  flashFurnace: {
    body: {
      name: "闪速炉主体",
      role: "悬浮熔炼核心",
      desc: "干燥铜精矿粉与富氧热风自反应塔顶喷入，悬浮态氧化熔炼放热完成熔炼，熔体落入沉淀池分离铜锍与炉渣；塔体温度反映反应强度与炉衬侵蚀。",
      metrics: [
        { label: "反应塔温度", value: (t) => `${f0(j(t.mainTemp, 8, t))} ℃` },
        { label: "熔池温度", value: (t) => `${f0(j(t.slagTemp, 6, t, 2))} ℃` },
      ],
    },
    burner: {
      name: "精矿喷嘴",
      role: "精矿分散与反应控制",
      desc: "精矿经喷嘴与分散风、富氧风混合呈伞状喷入反应塔，分散度决定反应完全程度；喷嘴结堵会引起加料波动与塔温异常。",
      metrics: [{ label: "投料量", value: (t) => `${f1(j(t.feedRate, 0.2, t, 1))} t/h` }],
    },
    oxygen: {
      name: "富氧系统",
      role: "富氧浓度优化",
      desc: "制氧机组产出高浓度氧气配入工艺风，提高反应塔氧势与熔炼强度、降低吨铜能耗；富氧浓度是闪速熔炼最关键的操作参数之一。",
      metrics: [{ label: "富氧浓度", value: (t) => `${f0(j(t.airPct, 1.2, t, 3))} %` }],
    },
    boiler: {
      name: "余热锅炉",
      role: "烟气余热回收",
      desc: "上升烟道引入的高温烟气经余热锅炉降温并产饱和蒸汽，抑制烟气中熔融烟尘粘结，是闪速炉能耗回收的关键环节。",
      metrics: [{ label: "锅炉入口烟温", value: (t) => `${f0(j(820, 6, t, 4))} ℃` }],
    },
    matte: {
      name: "铜锍 / 渣放出口",
      role: "熔体分层排放",
      desc: "沉淀池内铜锍与炉渣按密度分层，分别经铜锍口、渣口周期性放出送吹炼与渣处理；放出口流量与温度反映熔池分层状态。",
      metrics: [{ label: "铜锍温度", value: (t) => `${f0(j(1210, 6, t, 5))} ℃` }],
    },
  },
  electrolyticCell: {
    cell: {
      name: "电解槽",
      role: "熔盐电解核心",
      desc: "冰晶石-氧化铝熔盐在 950℃ 左右电解，阳极炭块持续消耗、阴极析出铝水；槽电压是判断电解质状态与阳极效应的核心参数。",
      metrics: [
        { label: "槽电压", value: (t) => `${f2(j(4.08, 0.03, t))} V` },
        { label: "电解温度", value: (t) => `${f0(j(t.mainTemp, 4, t, 2))} ℃` },
      ],
    },
    busbar: {
      name: "阳极母线系统",
      role: "系列电流分配",
      desc: "立柱母线与横向铝母线将系列电流均匀分配至各槽阳极；导杆压接压降异常会导致局部槽电压升高、电流偏流。",
      metrics: [{ label: "系列电流", value: (t) => `${f0(j(t.speed, 1.2, t, 1))} kA` }],
    },
    crust: {
      name: "打壳下料装置",
      role: "氧化铝定时投料",
      desc: "打壳锤头周期击穿槽面结壳，将氧化铝定频投入电解质；下料不足引发阳极效应（电压骤升），过量则沉槽。",
      metrics: [{ label: "下料周期", value: () => "180 s" }],
    },
    gas: {
      name: "烟气净化系统",
      role: "含氟烟气干法净化",
      desc: "各槽集气罩汇入总管后送干法净化塔，氧化铝吸附 HF 后循环回电解使用，净化效率直接关联氟排放与单耗。",
      metrics: [{ label: "总管负压", value: () => "-350 Pa" }],
    },
  },
  crackingFurnace: {
    body: {
      name: "裂解炉主体",
      role: "蒸汽裂解核心",
      desc: "石脑油/乙烷与稀释蒸汽混合后在辐射段炉管内高温（约 850℃）裂解生成乙烯丙烯；炉膛烧嘴燃烧供热，炉温分布决定转化率与结焦速率。",
      metrics: [
        { label: "炉膛温度", value: (t) => `${f0(j(t.mainTemp, 7, t))} ℃` },
        { label: "燃料气", value: (t) => `${f1(j(t.fuelFlow, 0.2, t, 1))} t/h` },
      ],
    },
    coil: {
      name: "裂解炉管",
      role: "反应承压部件",
      desc: "离心浇铸合金炉管竖排于辐射段，管壁温度决定运行周期；管壁结焦增厚需周期清焦，超温运行显著缩短炉管寿命。",
      metrics: [{ label: "管壁温度", value: (t) => `${f0(j(t.mainTemp - 25, 6, t, 2))} ℃` }],
    },
    tlx: {
      name: "急冷锅炉",
      role: "急冷终止反应",
      desc: "裂解气在急冷锅炉中被毫秒级冷却至 400℃ 以下终止二次反应并副产高压蒸汽，急冷效率直接决定乙烯收率。",
      metrics: [{ label: "急冷出口", value: () => "395 ℃" }],
    },
    fan: {
      name: "引风机 / 烟囱",
      role: "炉膛负压与排放",
      desc: "引风机维持炉膛微负压并将烟气送烟囱排放；排烟温度反映对流段热量回收水平，过高代表余热损失。",
      metrics: [{ label: "排烟温度", value: (t) => `${f0(j(t.exhaustTemp, 4, t, 3))} ℃` }],
    },
  },
};

/* ================= 热点标注（数据驱动） ================= */

interface Hotspot {
  position: [number, number, number];
  label: string;
  value: (t: TwinTelemetry) => string;
  color: string;
}

const HOTSPOTS_BY_TYPE: Record<TwinType, Hotspot[]> = {
  blastFurnace: [
    { position: [0, 3.9, 0], label: "炉顶温度", value: (t) => `${f0(j(285, 4, t, 1))} ℃`, color: "#ef4444" },
    { position: [0, 1.35, 1.35], label: "炉腹 CO₂", value: (t) => `${f1(j(t.airPct * 0.287, 0.4, t, 3))} %`, color: "#f59e0b" },
    { position: [1.35, 0.75, 1.2], label: "出铁温度", value: (t) => `${f0(j(t.mainTemp - 70, 5, t, 2))} ℃`, color: "#facc15" },
    { position: [-2.3, 1.35, 0.95], label: "喷煤量", value: (t) => `${f1(j(t.fuelFlow, 0.3, t, 1))} t/h`, color: "#10b981" },
  ],
  rotaryKiln: [
    { position: [0.2, 3.1, 0], label: "窑中温度", value: (t) => `${f0(j(t.mainTemp, 8, t))} ℃`, color: "#ef4444" },
    { position: [-2.3, 2.6, 0], label: "窑尾 O₂", value: (t) => `${f1(j((100 - t.airPct) * 0.153, 0.15, t, 2))} %`, color: "#f59e0b" },
    { position: [2.5, 2.2, 0], label: "窑头 CO", value: (t) => `${f1(j(1.8, 0.1, t, 3))} %`, color: "#10b981" },
    { position: [0, 0.55, 1.3], label: "窑速", value: (t) => `${f0(j(t.speed, 1.5, t, 1))} rpm`, color: "#3b82f6" },
  ],
  flashFurnace: [
    { position: [0, 3.65, 0], label: "反应塔顶", value: (t) => `${f0(j(t.mainTemp, 8, t))} ℃`, color: "#ef4444" },
    { position: [0.7, 2.6, 0.75], label: "富氧浓度", value: (t) => `${f0(j(t.airPct, 1.2, t, 3))} %`, color: "#f59e0b" },
    { position: [-1.7, 1.9, 0], label: "烟气 SO₂", value: (t) => `${f0(j((100 - t.airPct) * 115, 12, t, 4))} ppm`, color: "#10b981" },
    { position: [0, 0.5, 1.2], label: "熔池", value: (t) => `${f0(j(t.slagTemp, 6, t, 2))} ℃`, color: "#3b82f6" },
  ],
  electrolyticCell: [
    { position: [-1.7, 1.9, 0.6], label: "1#槽电压", value: (t) => `${f2(j(4.05, 0.02, t, 1))} V`, color: "#ef4444" },
    { position: [0, 1.9, 0.6], label: "3#槽电压", value: (t) => `${f2(j(4.08, 0.02, t, 2))} V`, color: "#f59e0b" },
    { position: [1.7, 1.9, 0.6], label: "5#槽电压", value: (t) => `${f2(j(4.11, 0.02, t, 3))} V`, color: "#10b981" },
    { position: [0, 0.4, 1.2], label: "系列电流", value: (t) => `${f0(j(t.speed, 1.2, t, 1))} kA`, color: "#3b82f6" },
  ],
  crackingFurnace: [
    { position: [-0.9, 1.5, 0.85], label: "1#炉管", value: (t) => `${f0(j(985, 6, t, 1))} ℃`, color: "#ef4444" },
    { position: [0.3, 1.5, 0.85], label: "3#炉管", value: (t) => `${f0(j(1010, 6, t, 2))} ℃`, color: "#f59e0b" },
    { position: [3.4, 2.6, 0], label: "烟气出口", value: (t) => `${f0(j(t.exhaustTemp, 4, t, 3))} ℃`, color: "#10b981" },
    { position: [0, 0.35, 1.2], label: "进料", value: (t) => `${f1(j(t.feedRate, 0.4, t, 4))} t/h`, color: "#3b82f6" },
  ],
};

/** 告警定位点（scene.alerts>0 时红色脉冲环） */
const ALERT_MARK: Partial<Record<TwinType, { position: [number, number, number]; radius: number }>> = {
  blastFurnace: { position: [-2.3, 0.55, 0.9], radius: 0.62 }, // 热风炉（设备表「需关注」）
  rotaryKiln: { position: [-2.6, 2.05, 0], radius: 0.55 }, // 下料装置（设备表「需关注」）
};

/* ================= 设备名称标签 ================= */

const LABELS_BY_TYPE: Record<TwinType, { pos: [number, number, number]; name: string }[]> = {
  blastFurnace: [
    { pos: [0, 4.35, 0], name: "高炉" },
    { pos: [-2.3, 2.7, 0.9], name: "热风炉" },
    { pos: [-2.3, 0.55, 1.55], name: "喷煤罐" },
    { pos: [0.9, 1.15, 1.7], name: "铁水罐" },
    { pos: [2.35, 2.15, -0.85], name: "重力除尘" },
    { pos: [0.8, 4.4, 0.7], name: "上料斜桥" },
  ],
  rotaryKiln: [
    { pos: [-2.8, 3.9, 0], name: "球团仓" },
    { pos: [0.2, 3.65, 0], name: "回转窑" },
    { pos: [3.2, 2.7, 0], name: "窑头罩" },
    { pos: [1.9, 1.05, 0.4], name: "鼓风机" },
    { pos: [4.4, 0.85, 1.1], name: "水淬池" },
    { pos: [-3.6, 1.6, -0.7], name: "烟囱" },
  ],
  flashFurnace: [
    { pos: [0, 4.2, 0], name: "反应塔" },
    { pos: [0, 0.55, 1.75], name: "沉淀池" },
    { pos: [-1.9, 3.4, 0.5], name: "精矿仓" },
    { pos: [-2.4, 1.1, 1.1], name: "制氧机组" },
    { pos: [2.7, 3.0, -0.3], name: "余热锅炉" },
    { pos: [3.9, 2.6, 0], name: "烟囱" },
  ],
  electrolyticCell: [
    { pos: [-1.7, 1.5, 0], name: "1#槽" },
    { pos: [0, 1.5, 0], name: "3#槽" },
    { pos: [1.7, 1.5, 0], name: "5#槽" },
    { pos: [0, 2.5, -0.75], name: "铝母线" },
    { pos: [3.2, 2.3, 0], name: "净化塔" },
  ],
  crackingFurnace: [
    { pos: [0, 2.6, 0], name: "裂解炉" },
    { pos: [0, 3.35, 0], name: "对流段" },
    { pos: [2.3, 2.35, -0.3], name: "急冷锅炉" },
    { pos: [3.5, 2.9, 0], name: "烟囱" },
  ],
};

/* ================= 通用动效组件 ================= */

/** 设备 mesh 交互：点击弹信息卡 + 悬停指针 */
function deviceHandlers(
  openCard: (type: TwinType, id: string) => void,
  type: TwinType,
  id: string
): {
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
} {
  return {
    onClick: (e) => {
      e.stopPropagation();
      openCard(type, id);
    },
    onPointerOver: (e) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "default";
    },
  };
}

/** 燃烧火焰：闪烁 + 缩放∝强度 */
function Flame({
  position,
  scale = 1,
  intensity = 1,
  color = "#f59e0b",
}: {
  position: [number, number, number];
  scale?: number;
  intensity?: number;
  color?: string;
}) {
  const ref = React.useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const flicker = 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 11 + position[0] * 7);
    ref.current.scale.set(1, scale * intensity * flicker, 1);
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4 * intensity * flicker;
  });
  return (
    <mesh ref={ref} position={position}>
      <coneGeometry args={[0.1 * scale, 0.42 * scale, 10]} />
      <meshStandardMaterial color={color} emissive="#f97316" emissiveIntensity={1.2} transparent opacity={0.85} />
    </mesh>
  );
}

/** 上升烟羽：位置处一组渐隐小球 */
function Smoke({
  position,
  count = 5,
  rise = 1.4,
  rate = 0.5,
  color = "#94a3b8",
  opacity = 0.4,
}: {
  position: [number, number, number];
  count?: number;
  rise?: number;
  rate?: number;
  color?: string;
  opacity?: number;
}) {
  const ref = React.useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * rate;
    ref.current.children.forEach((p, i) => {
      const phase = (t + i / count) % 1;
      p.position.set(
        Math.sin(phase * 5 + i * 2) * 0.14,
        phase * rise,
        Math.cos(phase * 4 + i) * 0.14
      );
      p.scale.setScalar(0.5 + phase * 1.4);
      const m = (p as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.opacity = opacity * (1 - phase) * Math.min(1, phase * 5);
      p.visible = phase < 0.92;
    });
  });
  return (
    <group ref={ref} position={position}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** 告警脉冲环（红色，呼吸式） */
function AlertRing({ position, radius }: { position: [number, number, number]; radius: number }) {
  const ref = React.useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshBasicMaterial).opacity =
      0.4 + 0.45 * Math.abs(Math.sin(state.clock.elapsedTime * 3.2));
  });
  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.035, 8, 32]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.7} />
    </mesh>
  );
}

/* ================= 模型 1：钢铁高炉炼铁 ================= */

function BlastFurnaceModel({
  telemetry,
  openCard,
}: {
  telemetry: TwinTelemetry;
  openCard: (type: TwinType, id: string) => void;
}) {
  const carRef = React.useRef<THREE.Group>(null);
  const beadsRef = React.useRef<THREE.Group>(null);
  const stoveGlowRef = React.useRef<THREE.MeshStandardMaterial>(null);
  const shellGlowRef = React.useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    // 料车沿斜桥往复（上料周期）：地面(1.5,0.1) → 炉顶(0.15,3.7)
    if (carRef.current) {
      const phase = (state.clock.elapsedTime * 0.22) % 1;
      const up = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      carRef.current.position.set(1.5 - 1.35 * up, 0.1 + 3.6 * up, 0.31);
    }
    // 铁水流珠（出铁口 → 铁水罐）
    if (beadsRef.current) {
      const t = state.clock.elapsedTime * (0.4 + telemetry.fuelFlow * 0.04);
      beadsRef.current.children.forEach((b, i) => {
        const phase = (t + i / 6) % 1;
        b.position.set(0.12 + phase * 1.3, 0.52 - phase * 0.16 + Math.sin(phase * Math.PI) * 0.1, 0.92 + phase * 0.22);
        b.scale.setScalar(0.85 - phase * 0.15);
      });
    }
    // 两座热风炉蓄热交替辉光
    if (stoveGlowRef.current) {
      const swap = Math.sin(state.clock.elapsedTime * 0.8);
      stoveGlowRef.current.emissiveIntensity = 0.35 + 0.45 * Math.abs(swap);
    }
    // 炉身辉光随炉温脉动
    if (shellGlowRef.current) {
      shellGlowRef.current.emissiveIntensity = 0.12 + 0.1 * Math.sin(state.clock.elapsedTime * 1.6);
    }
  });

  const h = (id: string) => deviceHandlers(openCard, "blastFurnace", id);
  const alert = ALERT_MARK.blastFurnace;

  return (
    <group>
      {/* 炉缸 */}
      <mesh position={[0, 0.95, 0]} castShadow {...h("body")}>
        <cylinderGeometry args={[0.85, 0.95, 1.1, 28]} />
        <meshStandardMaterial color="#8f3a2b" roughness={0.45} metalness={0.35} />
      </mesh>
      {/* 炉腰 */}
      <mesh position={[0, 1.62, 0]} castShadow {...h("body")}>
        <cylinderGeometry args={[0.72, 0.85, 0.22, 28]} />
        <meshStandardMaterial color="#7a2f22" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* 炉身（收腰向上） */}
      <mesh position={[0, 2.55, 0]} castShadow {...h("body")}>
        <cylinderGeometry args={[0.62, 1.0, 1.75, 28]} />
        <meshStandardMaterial
          ref={shellGlowRef}
          color="#a8422f"
          roughness={0.42}
          metalness={0.35}
          emissive="#f97316"
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* 炉喉 + 顶盖 + 受料漏斗 */}
      <mesh position={[0, 3.58, 0]} castShadow {...h("body")}>
        <cylinderGeometry args={[0.62, 0.62, 0.3, 24]} />
        <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.82, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 24]} />
        <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 4.02, 0]}>
        <cylinderGeometry args={[0.22, 0.4, 0.3, 20]} />
        <meshStandardMaterial color="#64748b" metalness={0.55} roughness={0.4} />
      </mesh>
      {/* 热风围管 + 风口 ×8 */}
      <mesh position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.16, 0.09, 10, 36]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.35} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const x = Math.cos(a) * 1.16;
        const z = Math.sin(a) * 1.16;
        return (
          <mesh key={i} position={[x * 0.92, 1.35, z * 0.92]} rotation={[0, a + Math.PI, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
          </mesh>
        );
      })}
      {/* 热风炉 ×2（蓄热交替辉光） */}
      {[-0.6, 0.9].map((z, zi) => (
        <group key={z} position={[-2.3, 0, z]}>
          <mesh position={[0, 1.1, 0]} castShadow {...h("stove")}>
            <cylinderGeometry args={[0.42, 0.45, 2.2, 20]} />
            <meshStandardMaterial
              color="#54627a"
              metalness={0.55}
              roughness={0.45}
              emissive="#f97316"
              emissiveIntensity={zi === 0 ? 0.35 : 0.1}
              ref={zi === 0 ? stoveGlowRef : undefined}
            />
          </mesh>
          <mesh position={[0, 2.4, 0]}>
            <sphereGeometry args={[0.42, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#475a72" metalness={0.55} roughness={0.45} />
          </mesh>
          <mesh position={[0.42, 1.9, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.9, 12]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* 燃烧口小火焰 */}
          <Flame position={[0.62, 0.35, 0]} scale={0.5} intensity={zi === 0 ? 1.2 : 0.35} />
        </group>
      ))}
      {/* 喷煤罐 + 喷煤管 */}
      <group position={[-2.3, 0, 1.55]}>
        <mesh position={[0, 0.55, 0]} castShadow {...h("coal")}>
          <cylinderGeometry args={[0.26, 0.26, 0.75, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <coneGeometry args={[0.26, 0.24, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[0.95, 0.55, -0.32]} rotation={[0, 0.35, Math.PI / 2 - 0.25]}>
          <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      {/* 上料斜桥（双轨 + 踏步）+ 料车 */}
      <group>
        {[0.24, 0.38].map((z) => (
          <mesh key={z} position={[0.825, 1.9, z]} rotation={[0, 0, 0.357]}>
            <boxGeometry args={[0.05, 3.85, 0.05]} />
            <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh
            key={`rung-${i}`}
            position={[0.825 - (i / 6) * 1.35, 0.1 + (i / 6) * 3.6, 0.31]}
          >
            <boxGeometry args={[0.04, 0.04, 0.28]} />
            <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        <group ref={carRef}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.2, 0.24]} />
            <meshStandardMaterial color="#1d4ed8" metalness={0.5} roughness={0.45} />
          </mesh>
        </group>
      </group>
      {/* 重力除尘器 + 煤气管 */}
      <group position={[2.35, 0, -0.85]}>
        <mesh position={[0, 1.0, 0]} castShadow {...h("dust")}>
          <cylinderGeometry args={[0.5, 0.5, 1.7, 20]} />
          <meshStandardMaterial color="#54627a" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.14, 0.5, 0.45, 20]} />
          <meshStandardMaterial color="#475a72" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[0, 2.0, 0]}>
          <coneGeometry args={[0.5, 0.35, 20]} />
          <meshStandardMaterial color="#54627a" metalness={0.55} roughness={0.45} />
        </mesh>
        {/* 炉顶 → 除尘器 上升管 */}
        <mesh position={[1.15, 2.9, -0.45]} rotation={[0, 0, Math.PI / 2 - 0.62]}>
          <cylinderGeometry args={[0.11, 0.11, 2.6, 10]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* 除尘器 → 热风炉净煤气管（绕行炉体后方，避免穿模） */}
        <mesh position={[-1.15, 1.35, -0.45]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.09, 0.09, 2.1, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
      {/* 出铁口 + 主沟 + 铁水流珠 + 铁水罐 */}
      <mesh position={[0, 0.52, 0.88]} {...h("taphole")}>
        <boxGeometry args={[0.24, 0.2, 0.2]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.9} />
      </mesh>
      <pointLight position={[0.3, 0.7, 1.0]} color="#fb923c" intensity={5} distance={4} />
      <mesh position={[0.75, 0.42, 1.05]} rotation={[0, 0, 0.05]}>
        <boxGeometry args={[1.5, 0.08, 0.42]} />
        <meshStandardMaterial color="#5b6774" metalness={0.4} roughness={0.6} />
      </mesh>
      <group ref={beadsRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={1.1} roughness={0.6} />
          </mesh>
        ))}
      </group>
      <group position={[1.65, 0, 1.18]} {...h("taphole")}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.3, 0.6, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.66, 0]}>
          <cylinderGeometry args={[0.26, 0.28, 0.1, 16]} />
          <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.9} />
        </mesh>
      </group>
      {/* 炉基 */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.65, 0.16, 28]} />
        <meshStandardMaterial color="#b9c3cb" roughness={0.9} />
      </mesh>
      {/* 告警脉冲（热风炉「需关注」） */}
      {alert && telemetry.alerts > 0 && <AlertRing position={alert.position} radius={alert.radius} />}
    </group>
  );
}

/* ================= 模型 2：锌冶炼回转挥发窑 ================= */

/** 轴向温度分布（尾部 750 → 焙烧带峰值 kilnTemp → 窑头 950） */
function kilnAxialTemp(u: number, mainTemp: number): number {
  const peak = mainTemp;
  const bump = Math.exp(-Math.pow((u - 0.55) / 0.3, 2));
  return 750 + (peak - 750) * bump + (950 - 750) * (1 - bump) * u;
}

function RotaryKilnModel({
  telemetry,
  openCard,
}: {
  telemetry: TwinTelemetry;
  openCard: (type: TwinType, id: string) => void;
}) {
  const spinRef = React.useRef<THREE.Group>(null);
  const driveRef = React.useRef<THREE.Group>(null);
  const discRef = React.useRef<THREE.Mesh>(null);
  const beadsRef = React.useRef<THREE.Group>(null);
  const slagRef = React.useRef<THREE.Group>(null);
  const flameRef = React.useRef<THREE.Mesh>(null);

  useFrame((state, dt) => {
    const spin = 0.15 + telemetry.speed * 0.004;
    if (spinRef.current) spinRef.current.rotation.x += dt * spin;
    if (driveRef.current) driveRef.current.rotation.x -= dt * spin * 2.4;
    if (discRef.current) discRef.current.rotation.y += dt * (0.6 + telemetry.feedRate * 0.5);
    if (beadsRef.current) {
      const t = state.clock.elapsedTime * (0.4 + telemetry.feedRate * 0.35);
      beadsRef.current.children.forEach((b, i) => {
        const phase = (t + i / 6) % 1;
        b.position.set(-2.6 + phase * 1.15, 2.32 - phase * 0.32, 0);
        b.scale.setScalar(0.9 - phase * 0.2);
      });
    }
    if (slagRef.current) {
      const t = state.clock.elapsedTime * (0.4 + telemetry.slagTemp * 0.0006);
      slagRef.current.children.forEach((b, i) => {
        const phase = (t + i / 6) % 1;
        b.position.set(2.85 + phase * 0.85, 1.55 - phase * 0.75, 0.35 + phase * 0.3);
        b.scale.setScalar(0.9 - phase * 0.25);
      });
    }
    if (flameRef.current) {
      const heat = THREE.MathUtils.clamp(telemetry.fuelFlow / 3, 0.35, 1.4);
      const flicker = 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 11);
      flameRef.current.scale.set(1, heat * flicker * 1.5, 1);
      (flameRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4 * heat * flicker;
    }
  });

  const h = (id: string) => deviceHandlers(openCard, "rotaryKiln", id);
  const KILN_Y = 2.1;
  const TILT = -0.075;
  const SEG = 10;
  const LEN = 3.6;
  const R = 0.5;
  const alert = ALERT_MARK.rotaryKiln;

  return (
    <group>
      <group position={[0, 0, 0]}>
        {/* 倾斜窑筒体（轴向温度场着色 + 旋转） */}
        <group position={[0, KILN_Y, 0]} rotation={[0, 0, TILT]}>
          <group ref={spinRef}>
            {Array.from({ length: SEG }).map((_, i) => {
              const u = (i + 0.5) / SEG;
              const temp = kilnAxialTemp(u, telemetry.mainTemp);
              const x = -LEN / 2 + (LEN / SEG) * (i + 0.5);
              return (
                <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} {...h("body")}>
                  <cylinderGeometry args={[R, R, LEN / SEG + 0.01, 22]} />
                  <meshStandardMaterial
                    color={tempColor(temp)}
                    emissive={tempColor(temp)}
                    emissiveIntensity={0.7}
                    metalness={0.5}
                    roughness={0.45}
                  />
                </mesh>
              );
            })}
            {/* 滚圈 ×2 + 大齿圈 */}
            {[-1.15, 1.15].map((x) => (
              <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[R + 0.08, 0.06, 10, 30]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.35} />
              </mesh>
            ))}
            <mesh position={[1.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[R + 0.14, 0.08, 10, 32]} />
              <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.3} />
            </mesh>
          </group>
          {/* 托轮 ×4 + 基础墩 ×2 */}
          {[-1.15, 1.15].flatMap((x) =>
            [-1, 1].map((s) => (
              <mesh key={`${x}-${s}`} position={[x, -(R + 0.2), s * (R + 0.26)]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.17, 0.17, 0.35, 14]} />
                <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
              </mesh>
            ))
          )}
          {[-1.15, 1.15].map((x) => {
            const top = KILN_Y + TILT * x - R - 0.42; // 基础墩顶面 ≈ 托轮底
            return (
              <mesh key={`pier-${x}`} position={[x, top / 2, 0]}>
                <boxGeometry args={[0.9, top, 1.6]} />
                <meshStandardMaterial color="#a8aeb8" roughness={0.9} />
              </mesh>
            );
          })}
          {/* 窑内透视料床微光 */}
          <mesh position={[0, -R * 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[R * 0.5, R * 0.5, LEN * 0.9, 14]} />
            <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.9} transparent opacity={0.25} />
          </mesh>
        </group>

        {/* 主传动：小齿轮反向联动 + 减速机 + 电机 */}
        <group position={[1.55, KILN_Y + TILT * 1.55, R + 0.42]}>
          <group ref={driveRef}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.16, 0.16, 0.2, 12]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
          <mesh position={[0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0.68, 0, 0]}>
            <boxGeometry args={[0.45, 0.45, 0.42]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[1.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.55, 14]} />
            <meshStandardMaterial color="#1d4ed8" metalness={0.55} roughness={0.45} />
          </mesh>
          <mesh position={[0.85, -0.42, 0]}>
            <boxGeometry args={[2.1, 0.12, 0.6]} />
            <meshStandardMaterial color="#64748b" metalness={0.25} roughness={0.75} />
          </mesh>
        </group>

        {/* 窑头罩 + 燃烧器火焰（∝燃料流量） */}
        <group position={[2.35, KILN_Y + TILT * 2.35, 0]}>
          <mesh position={[0.25, 0.15, 0]} castShadow {...h("body")}>
            <boxGeometry args={[1.1, 1.5, 1.5]} />
            <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.55} />
          </mesh>
          <mesh position={[0.85, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 1.1, 8]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh ref={flameRef} position={[-0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.16, 0.8, 10]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f97316" emissiveIntensity={1.3} transparent opacity={0.85} />
          </mesh>
          <pointLight position={[0, 0.2, 0]} color="#fb923c" intensity={7} distance={6} />
        </group>

        {/* 鼓风管系统：罗茨风机 + 风管 → 窑头 */}
        <group position={[1.9, 0, 1.1]} {...h("blower")}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[0.55, 0.55, 0.5]} />
            <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.35, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.3, 14]} />
            <meshStandardMaterial color="#1d4ed8" metalness={0.55} roughness={0.45} />
          </mesh>
          <mesh position={[0.35, 0.85, -0.35]} rotation={[0, -0.6, Math.PI / 2 - 0.5]}>
            <cylinderGeometry args={[0.06, 0.06, 2.2, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>

        {/* 窑尾下料装置：球团仓 + 圆盘给料（∝进料）+ 落料珠 */}
        <group position={[-2.6, 0, 0]}>
          <mesh position={[0, 3.15, 0]} castShadow {...h("feeder")}>
            <cylinderGeometry args={[0.42, 0.42, 0.55, 16]} />
            <meshStandardMaterial color="#57534e" metalness={0.4} roughness={0.6} />
          </mesh>
          <mesh position={[0, 2.75, 0]}>
            <cylinderGeometry args={[0.12, 0.42, 0.35, 16]} />
            <meshStandardMaterial color="#57534e" metalness={0.4} roughness={0.6} />
          </mesh>
          {[-0.32, 0.32].flatMap((dx) =>
            [-0.32, 0.32].map((dz) => (
              <mesh key={`${dx}-${dz}`} position={[dx, 1.3, dz]}>
                <boxGeometry args={[0.05, 2.5, 0.05]} />
                <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
              </mesh>
            ))
          )}
          <mesh ref={discRef} position={[0, 2.35, 0]} {...h("feeder")}>
            <cylinderGeometry args={[0.48, 0.48, 0.07, 20]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0.55, 2.55, 0]} rotation={[0, 0, -0.7]}>
            <boxGeometry args={[1.3, 0.05, 0.4]} />
            <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.5} />
          </mesh>
        </group>
        <group ref={beadsRef}>
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial color="#a8a29e" roughness={0.9} />
            </mesh>
          ))}
        </group>

        {/* 窑尾罩 + 烟道 + 尾部烟囱（烟气∝排温） */}
        <group position={[-2.05, KILN_Y + TILT * -2.05, 0]}>
          <mesh position={[0, 0.1, 0]} castShadow {...h("body")}>
            <boxGeometry args={[0.75, 1.35, 1.35]} />
            <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.55} />
          </mesh>
          <mesh position={[-0.5, 1.1, -0.45]} rotation={[0, 0, -0.7]}>
            <cylinderGeometry args={[0.14, 0.14, 1.4, 10]} />
            <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
          </mesh>
          <Smoke position={[-3.6, 3.6, -0.7]} count={5} rise={1.3} rate={0.55} opacity={0.32} />
          <mesh position={[-3.6, 3.15, -0.7]}>
            <cylinderGeometry args={[0.12, 0.16, 1.5, 12]} />
            <meshStandardMaterial color="#6b7280" metalness={0.4} roughness={0.6} />
          </mesh>
        </group>

        {/* 窑渣出口：溜槽 + 渣池 + 蒸汽 + 渣珠 */}
        <group position={[3.3, 0, 0.55]}>
          <mesh position={[-0.45, 1.15, -0.25]} rotation={[0.35, 0, -0.3]}>
            <boxGeometry args={[1.1, 0.05, 0.4]} />
            <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.5} />
          </mesh>
          <mesh position={[0.35, 0.3, 0.35]} castShadow {...h("slag")}>
            <boxGeometry args={[1.3, 0.5, 1.1]} />
            <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.6} />
          </mesh>
          <mesh position={[0.35, 0.56, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.15, 0.95]} />
            <meshStandardMaterial color="#0ea5e9" transparent opacity={0.5} metalness={0.5} roughness={0.15} />
          </mesh>
          <Smoke position={[0.35, 0.75, 0.35]} count={5} rise={1.5} rate={0.5} opacity={0.4} />
          <group ref={slagRef}>
            {Array.from({ length: 6 }).map((_, i) => (
              <mesh key={i}>
                <sphereGeometry args={[0.06, 8, 8]} />
                <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.9} roughness={0.7} />
              </mesh>
            ))}
          </group>
        </group>

        {/* 地面 */}
        <mesh position={[0.4, 0.03, 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[10, 5]} />
          <meshStandardMaterial color="#e3ebec" roughness={0.95} />
        </mesh>
        {/* 告警脉冲（下料装置「需关注」） */}
        {alert && telemetry.alerts > 0 && <AlertRing position={alert.position} radius={alert.radius} />}
      </group>
    </group>
  );
}

/* ================= 模型 3：铜冶炼闪速炉 ================= */

function FlashFurnaceModel({
  telemetry,
  openCard,
}: {
  telemetry: TwinTelemetry;
  openCard: (type: TwinType, id: string) => void;
}) {
  const feedRef = React.useRef<THREE.Group>(null);
  const matteRef = React.useRef<THREE.Group>(null);
  const towerRef = React.useRef<THREE.Mesh>(null);
  const bathRef = React.useRef<THREE.Mesh>(null);

  useFrame((state) => {
    // 精矿喷嘴料流（塔顶 → 塔内）
    if (feedRef.current) {
      const t = state.clock.elapsedTime * (0.6 + telemetry.feedRate * 0.25);
      feedRef.current.children.forEach((b, i) => {
        const phase = (t + i / 7) % 1;
        b.position.set(Math.sin(i * 2.2) * 0.1 * phase, 3.3 - phase * 1.5, Math.cos(i * 1.7) * 0.1 * phase);
        b.scale.setScalar(0.7 - phase * 0.3);
      });
    }
    // 冰铜放出流珠（沉淀池前端 → 冰铜包）
    if (matteRef.current) {
      const t = state.clock.elapsedTime * 0.5;
      matteRef.current.children.forEach((b, i) => {
        const phase = (t + i / 5) % 1;
        b.position.set(0.35 + phase * 0.75, 0.72 - phase * 0.18, 1.0 + phase * 0.28);
        b.scale.setScalar(0.85 - phase * 0.2);
      });
    }
    // 反应塔辉光脉动（∝塔温）与熔池辉光（∝渣温）
    const towerGlow = 0.4 + 0.25 * Math.sin(state.clock.elapsedTime * 2.2) + THREE.MathUtils.clamp((telemetry.mainTemp - 1200) / 400, 0, 1) * 0.3;
    if (towerRef.current) (towerRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = towerGlow;
    const bathGlow = 0.7 + 0.25 * Math.sin(state.clock.elapsedTime * 1.5 + 1);
    if (bathRef.current) (bathRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = bathGlow;
  });

  const h = (id: string) => deviceHandlers(openCard, "flashFurnace", id);

  return (
    <group>
      {/* 沉淀池（卧式熔池） */}
      <mesh position={[0, 0.8, 0]} castShadow {...h("body")}>
        <cylinderGeometry args={[0.72, 0.78, 2.6, 26]} />
        <meshStandardMaterial color="#0e7490" roughness={0.45} metalness={0.5} />
      </mesh>
      {/* 端墙 ×2 */}
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} position={[x, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.62, 0.66, 0.5, 22]} />
          <meshStandardMaterial color="#155e75" roughness={0.5} metalness={0.45} />
        </mesh>
      ))}
      {/* 熔池辉光（顶部开口缝） */}
      <mesh ref={bathRef} position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 2.3, 24]} />
        <meshStandardMaterial color="#fb923c" emissive="#ea580c" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 1.23, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.3, 1.0]} />
        <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.55} transparent opacity={0.5} />
      </mesh>

      {/* 反应塔（塔身辉光∝塔温） */}
      <mesh ref={towerRef} position={[0, 2.6, 0]} castShadow {...h("body")}>
        <cylinderGeometry args={[0.46, 0.46, 1.9, 24]} />
        <meshStandardMaterial color="#0e7490" roughness={0.4} metalness={0.55} emissive="#f97316" emissiveIntensity={0.55} />
      </mesh>
      {/* 塔内反应辉光 */}
      <mesh position={[0, 2.6, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1.7, 18]} />
        <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={0.9} transparent opacity={0.45} />
      </mesh>
      {/* 塔顶锥 + 精矿喷嘴 */}
      <mesh position={[0, 3.68, 0]} castShadow>
        <coneGeometry args={[0.46, 0.4, 24]} />
        <meshStandardMaterial color="#155e75" roughness={0.45} metalness={0.5} />
      </mesh>
      <group position={[0, 3.98, 0]} {...h("burner")}>
        <mesh>
          <cylinderGeometry args={[0.14, 0.14, 0.3, 14]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.25, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      <group ref={feedRef}>
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#a16207" emissive="#ca8a04" emissiveIntensity={0.5} roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* 精矿仓 + 给料管 */}
      <group position={[-1.9, 0, 0.5]}>
        <mesh position={[0, 3.3, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.6, 16]} />
          <meshStandardMaterial color="#57534e" metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.85, 0]}>
          <coneGeometry args={[0.4, 0.6, 16]} />
          <meshStandardMaterial color="#57534e" metalness={0.4} roughness={0.6} />
        </mesh>
        {[-0.3, 0.3].flatMap((dx) =>
          [-0.3, 0.3].map((dz) => (
            <mesh key={`${dx}-${dz}`} position={[dx, 1.45, dz]}>
              <boxGeometry args={[0.05, 2.4, 0.05]} />
              <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
            </mesh>
          ))
        )}
        <mesh position={[1.0, 2.35, -0.2]} rotation={[0, 0, Math.PI / 2 - 0.35]}>
          <cylinderGeometry args={[0.06, 0.06, 2.1, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>

      {/* 富氧系统：制氧机组 + 富氧管（配比越高管路辉光越亮） */}
      <group position={[-2.4, 0, -1.0]} {...h("oxygen")}>
        {[-0.35, 0.35].map((dx) => (
          <mesh key={dx} position={[dx, 0.45, 0]} castShadow>
            <boxGeometry args={[0.55, 0.75, 0.55]} />
            <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.45} />
          </mesh>
        ))}
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.5, 8]} />
          <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[1.2, 1.5, 0.75]} rotation={[0, 0.35, Math.PI / 2 - 0.55]}>
          <cylinderGeometry args={[0.055, 0.055, 3.1, 8]} />
          <meshStandardMaterial
            color="#14b8a6"
            emissive="#14b8a6"
            emissiveIntensity={0.25 + (telemetry.airPct / 100) * 0.7}
          />
        </mesh>
      </group>

      {/* 冰铜口流珠 + 冰铜包 */}
      <mesh position={[0.28, 0.72, 0.95]} {...h("matte")}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.8} />
      </mesh>
      <group ref={matteRef}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1} roughness={0.5} />
          </mesh>
        ))}
      </group>
      <group position={[1.35, 0, 1.35]}>
        <mesh position={[0, 0.32, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.26, 0.55, 14]} />
          <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.22, 0.24, 0.08, 14]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f97316" emissiveIntensity={0.7} />
        </mesh>
      </group>

      {/* 上升烟道 → 余热锅炉 → 烟囱 */}
      <mesh position={[1.7, 1.75, -0.2]} rotation={[0, 0, -0.9]}>
        <cylinderGeometry args={[0.3, 0.3, 1.9, 14]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      <group position={[2.75, 0, -0.3]} {...h("boiler")}>
        <mesh position={[0, 1.35, 0]} castShadow>
          <boxGeometry args={[1.15, 1.7, 1.0]} />
          <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.35, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 1.0, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
      <mesh position={[3.9, 1.35, -0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 1.4, 10]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[4.65, 1.35, -0.3]}>
        <cylinderGeometry args={[0.14, 0.18, 2.2, 12]} />
        <meshStandardMaterial color="#6b7280" metalness={0.4} roughness={0.6} />
      </mesh>
      <Smoke position={[4.65, 2.6, -0.3]} count={5} rise={1.5} rate={0.5 + telemetry.exhaustTemp * 0.0008} opacity={0.3} />

      {/* 地面 */}
      <mesh position={[0.5, 0.03, 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10.5, 5]} />
        <meshStandardMaterial color="#e3ebec" roughness={0.95} />
      </mesh>
    </group>
  );
}

/* ================= 模型 4：铝电解槽 ================= */

function ElectrolyticCellModel({
  telemetry,
  openCard,
}: {
  telemetry: TwinTelemetry;
  openCard: (type: TwinType, id: string) => void;
}) {
  const busRef = React.useRef<THREE.Group>(null);
  const hammerRef = React.useRef<THREE.Group>(null);
  const glowRefs = React.useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state, dt) => {
    // 电流辉光珠沿横向母线流动（双向）
    if (busRef.current) {
      const t = state.clock.elapsedTime * 0.6;
      busRef.current.children.forEach((b, i) => {
        const phase = (t + i / 8) % 1;
        const dir = i % 2 === 0 ? 1 : -1;
        b.position.set(dir * (phase - 0.5) * 4.6, 1.66, i % 2 === 0 ? 0.72 : -0.72);
      });
    }
    // 打壳锤头周期下砸
    if (hammerRef.current) {
      const phase = (state.clock.elapsedTime * 0.5) % 1;
      hammerRef.current.position.y = phase < 0.15 ? 1.1 - phase * 2 : Math.max(0.8, 1.1 - 0.3 * Math.exp(-(phase - 0.15) * 6));
    }
    // 电解质辉光逐槽脉动（1# 槽告警偏红更亮）
    glowRefs.current.forEach((m, i) => {
      if (!m) return;
      const warn = telemetry.alerts > 0 && i === 0;
      ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity =
        (warn ? 0.9 : 0.55) + 0.25 * Math.sin(state.clock.elapsedTime * 2 + i * 1.1);
    });
  });

  const h = (id: string) => deviceHandlers(openCard, "electrolyticCell", id);
  const cells = [-1.7, -0.85, 0, 0.85, 1.7];

  return (
    <group>
      {/* 基础 */}
      <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
        <boxGeometry args={[5.6, 0.24, 1.8]} />
        <meshStandardMaterial color="#b9c3cb" roughness={0.9} />
      </mesh>
      {/* 槽列 ×5：槽壳 + 电解质辉光带（壳顶外露）+ 槽罩 + 阳极炭块 + 铝导杆 */}
      {cells.map((x, ci) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.62, 0]} castShadow {...h("cell")}>
            <boxGeometry args={[0.76, 0.78, 1.3]} />
            <meshStandardMaterial color="#4a5058" roughness={0.5} metalness={0.55} />
          </mesh>
          {/* 电解质辉光（槽壳顶沿外露环带，逐槽脉动） */}
          <mesh
            ref={(m) => {
              glowRefs.current[ci] = m;
            }}
            position={[0, 0.94, 0]}
          >
            <boxGeometry args={[0.8, 0.18, 1.34]} />
            <meshStandardMaterial
              color={telemetry.alerts > 0 && ci === 0 ? "#f87171" : "#f59e0b"}
              emissive={telemetry.alerts > 0 && ci === 0 ? "#ef4444" : "#ea580c"}
              emissiveIntensity={0.6}
              transparent
              opacity={0.55}
            />
          </mesh>
          <mesh position={[0, 1.13, 0]} castShadow {...h("cell")}>
            <boxGeometry args={[0.84, 0.14, 1.38]} />
            <meshStandardMaterial color="#5b6470" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* 阳极炭块 ×4 + 铝导杆 */}
          {[-0.24, -0.08, 0.08, 0.24].map((ax) => (
            <group key={ax} position={[ax, 0, 0]}>
              <mesh position={[0, 1.28, 0]}>
                <boxGeometry args={[0.1, 0.26, 0.2]} />
                <meshStandardMaterial color="#292524" roughness={0.85} />
              </mesh>
              <mesh position={[0, 1.46, 0]} rotation={[0, Math.PI / 2, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.3, 8]} />
                <meshStandardMaterial color="#c0c7cf" metalness={0.85} roughness={0.3} />
              </mesh>
              <mesh position={[0, 1.54, 0]}>
                <boxGeometry args={[0.04, 0.06, 0.3]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
              </mesh>
            </group>
          ))}
          {/* 立柱母线 */}
          <mesh position={[0.3, 1.38, 0.62]}>
            <boxGeometry args={[0.08, 0.6, 0.05]} />
            <meshStandardMaterial color="#c0c7cf" metalness={0.85} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* 横向铝母线 ×2 */}
      {[0.72, -0.72].map((z) => (
        <mesh key={z} position={[0, 1.66, z]} castShadow {...h("busbar")}>
          <boxGeometry args={[5.2, 0.09, 0.11]} />
          <meshStandardMaterial color="#c0c7cf" metalness={0.85} roughness={0.28} />
        </mesh>
      ))}
      {/* 电流辉光珠（沿母线双向流动） */}
      <group ref={busRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#0d9488" emissive="#14b8a6" emissiveIntensity={1.4} />
          </mesh>
        ))}
      </group>
      {/* 打壳下料装置（3# 槽顶）：锤头周期动作 */}
      <group position={[0, 0, 0]}>
        <mesh position={[0.14, 1.55, -0.35]} castShadow {...h("crust")}>
          <boxGeometry args={[0.24, 0.3, 0.24]} />
          <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.45} />
        </mesh>
        <group ref={hammerRef} position={[0.14, 1.1, -0.35]}>
          <mesh>
            <cylinderGeometry args={[0.035, 0.035, 0.55, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.05, 0.035, 0.12, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      </group>
      {/* 集气总管 → 支管 ×5 → 净化塔 */}
      <mesh position={[0, 1.28, -1.02]} rotation={[0, 0, Math.PI / 2]} castShadow {...h("gas")}>
        <cylinderGeometry args={[0.09, 0.09, 5.2, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      {cells.map((x) => (
        <mesh key={`d-${x}`} position={[x, 1.2, -0.85]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.34, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <group position={[3.3, 0, -1.02]}>
        <mesh position={[0, 1.05, 0]} castShadow {...h("gas")}>
          <cylinderGeometry args={[0.3, 0.34, 1.7, 16]} />
          <meshStandardMaterial color="#0f766e" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.0, 0]}>
          <coneGeometry args={[0.3, 0.3, 16]} />
          <meshStandardMaterial color="#0d645d" metalness={0.5} roughness={0.5} />
        </mesh>
        <Smoke position={[0, 2.25, 0]} count={4} rise={1.1} rate={0.4} opacity={0.25} />
        <mesh position={[-1.35, 1.28, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 2.5, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

/* ================= 模型 5：化工裂解炉 ================= */

function CrackingFurnaceModel({
  telemetry,
  openCard,
}: {
  telemetry: TwinTelemetry;
  openCard: (type: TwinType, id: string) => void;
}) {
  const flameRefs = React.useRef<(THREE.Mesh | null)[]>([]);
  const steamRef = React.useRef<THREE.Group>(null);

  useFrame((state) => {
    // 烧嘴火焰阵列闪烁
    flameRefs.current.forEach((m, i) => {
      if (!m) return;
      const flicker = 0.8 + 0.2 * Math.sin(state.clock.elapsedTime * 9 + i * 1.9);
      m.scale.set(1, telemetry.fuelFlow > 0.1 ? flicker * 1.4 : 0.2, 1);
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.3 * flicker;
    });
    // 急冷锅炉汽包蒸汽
    if (steamRef.current) {
      const t = state.clock.elapsedTime * 0.45;
      steamRef.current.children.forEach((p, i) => {
        const phase = (t + i / 4) % 1;
        p.position.set(Math.sin(phase * 5 + i) * 0.12, phase * 1.0, Math.cos(phase * 4 + i) * 0.12);
        p.scale.setScalar(0.4 + phase * 1.2);
        const m = (p as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.opacity = 0.35 * (1 - phase) * Math.min(1, phase * 4);
        p.visible = phase < 0.9;
      });
    }
  });

  const h = (id: string) => deviceHandlers(openCard, "crackingFurnace", id);
  const burners = [-0.9, -0.45, 0, 0.45, 0.9];
  const coils = [-0.9, -0.3, 0.3, 0.9];

  return (
    <group>
      {/* 辐射段炉体 */}
      <mesh position={[0, 1.05, 0]} castShadow {...h("body")}>
        <boxGeometry args={[2.8, 1.7, 1.4]} />
        <meshStandardMaterial color="#2b3a4d" roughness={0.55} metalness={0.35} />
      </mesh>
      {/* 炉膛辉光（正面开口） */}
      <mesh position={[0, 1.05, 0.705]}>
        <planeGeometry args={[2.5, 1.4]} />
        <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.32} transparent opacity={0.3} />
      </mesh>
      {/* 底部烧嘴 ×5 + 火焰 */}
      {burners.map((x, i) => (
        <group key={x} position={[x, 0.24, 0.74]}>
          <mesh>
            <cylinderGeometry args={[0.07, 0.09, 0.12, 10]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh
            ref={(m) => {
              flameRefs.current[i] = m;
            }}
            position={[0, 0.16, 0]}
          >
            <coneGeometry args={[0.08, 0.44, 8]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f97316" emissiveIntensity={1.2} transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, 0.5, 1.2]} color="#fb923c" intensity={6} distance={5} />
      {/* 炉管 ×4（外露于炉墙挂装，温度辉光渐变） */}
      {coils.map((x, i) => {
        const temp = telemetry.mainTemp - 40 + i * 12;
        return (
          <mesh key={x} position={[x, 1.25, 0.76]} castShadow {...h("coil")}>
            <cylinderGeometry args={[0.065, 0.065, 1.55, 12]} />
            <meshStandardMaterial
              color={tempColor(temp)}
              emissive={tempColor(temp)}
              emissiveIntensity={0.85}
              metalness={0.6}
              roughness={0.35}
            />
          </mesh>
        );
      })}
      {/* 底部集管 */}
      <mesh position={[0, 0.45, 0.76]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 2.2, 10]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 对流段 + 翅片管 */}
      <mesh position={[0, 2.32, 0]} castShadow {...h("body")}>
        <boxGeometry args={[2.8, 0.95, 1.2]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.4} />
      </mesh>
      {[-0.25, 0, 0.25].map((y) => (
        <mesh key={y} position={[0, 2.32 + y, 0.62]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 2.5, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* 炉顶烟道 → 急冷锅炉（TLX）+ 汽包 */}
      <mesh position={[1.55, 2.5, -0.15]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.22, 0.22, 1.5, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      <group position={[2.35, 0, -0.3]} {...h("tlx")}>
        <mesh position={[0, 1.15, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 1.7, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.15, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.7, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
        </mesh>
        <group ref={steamRef} position={[0, 2.35, 0]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshStandardMaterial color="#e2e8f0" transparent opacity={0.35} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
      {/* 引风机 + 烟囱（烟气∝排温） */}
      <group position={[3.1, 0, 0.45]} {...h("fan")}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.7, 0.4, 0.7]} />
          <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.45, 16]} />
          <meshStandardMaterial color="#3f5270" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
      <mesh position={[3.55, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 1.2, 10]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[4.2, 1.55, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 2.1, 12]} />
        <meshStandardMaterial color="#6b7280" metalness={0.4} roughness={0.6} />
      </mesh>
      <Smoke position={[4.2, 2.75, 0]} count={5} rise={1.4} rate={0.4 + telemetry.exhaustTemp * 0.001} opacity={0.3} />
      {/* 进料/稀释蒸汽管 */}
      <mesh position={[-1.55, 1.6, 0.75]} rotation={[0, 0, Math.PI / 2 - 0.4]}>
        <cylinderGeometry args={[0.06, 0.06, 1.6, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* 地面 */}
      <mesh position={[0.6, 0.03, 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 4.6]} />
        <meshStandardMaterial color="#e3ebec" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** 渲染不同 twinType */
function ModelByType({
  twinType,
  telemetry,
  openCard,
}: {
  twinType: TwinType;
  telemetry: TwinTelemetry;
  openCard: (type: TwinType, id: string) => void;
}) {
  switch (twinType) {
    case "blastFurnace":
      return <BlastFurnaceModel telemetry={telemetry} openCard={openCard} />;
    case "rotaryKiln":
      return <RotaryKilnModel telemetry={telemetry} openCard={openCard} />;
    case "flashFurnace":
      return <FlashFurnaceModel telemetry={telemetry} openCard={openCard} />;
    case "electrolyticCell":
      return <ElectrolyticCellModel telemetry={telemetry} openCard={openCard} />;
    case "crackingFurnace":
      return <CrackingFurnaceModel telemetry={telemetry} openCard={openCard} />;
    default:
      return null;
  }
}

/** 自动旋转 Group */
function AutoRotate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const ref = React.useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current && enabled) {
      ref.current.rotation.y += delta * 0.3;
    }
  });
  return <group ref={ref}>{children}</group>;
}

/* ================= 主组件 ================= */

export function DigitalTwinViewer({ scene, fullHeight = false }: Props) {
  const [autoRotate, setAutoRotate] = React.useState(true);
  const [resetKey, setResetKey] = React.useState(0);
  const [isReady, setReady] = React.useState(false);
  const [showHotspots, setShowHotspots] = React.useState(true);
  const [showLabels, setShowLabels] = React.useState(false);
  const [card, setCard] = React.useState<string | null>(null);
  const [live, setLive] = React.useState(0);

  // 1Hz 抖动时钟：热点标注呈现"实时"读数
  React.useEffect(() => {
    const timer = setInterval(() => setLive((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const telemetry = React.useMemo(() => telemetryFor(scene, live), [scene, live]);
  const hotspots = HOTSPOTS_BY_TYPE[scene.twinType];
  const labels = LABELS_BY_TYPE[scene.twinType];
  const openCard = React.useCallback(
    (type: TwinType, id: string) => setCard(`${type}:${id}`),
    []
  );
  const cardMeta = card
    ? { id: card.split(":")[1], meta: DEVICE_META[(card.split(":")[0] as TwinType)][card.split(":")[1]] }
    : null;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border border-border bg-[#eef4f4] ${
        fullHeight ? "h-full min-h-[420px]" : "h-[460px]"
      }`}
    >
      {/* 加载提示 */}
      {!isReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm">加载 3D 数字孪生模型…</span>
        </div>
      )}

      {/* 顶部标签 */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-slate-600 shadow-sm backdrop-blur">
        <Box className="h-3.5 w-3.5 text-teal-600" />
        <span>3D 数字孪生</span>
        <span className="text-slate-300">·</span>
        <span>{scene.name}</span>
        <span className="rounded bg-amber-600/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
          示范数据
        </span>
      </div>

      {/* 活跃告警徽标 */}
      {scene.alerts > 0 && (
        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-red-600/30 bg-red-600/10 px-3 py-1 text-xs text-red-600 backdrop-blur">
          <TriangleAlert className="h-3.5 w-3.5" />
          {scene.alerts} 项活跃告警 · 见红色脉冲环
        </div>
      )}

      {/* 控制按钮 */}
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button
          type="button"
          className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition ${
            showHotspots
              ? "border-teal-600 bg-teal-600 text-white"
              : "border-border bg-card text-slate-500 hover:text-teal-700"
          }`}
          onClick={() => setShowHotspots((v) => !v)}
          title="参数标注"
        >
          <Activity className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition ${
            showLabels
              ? "border-teal-600 bg-teal-600 text-white"
              : "border-border bg-card text-slate-500 hover:text-teal-700"
          }`}
          onClick={() => setShowLabels((v) => !v)}
          title="设备名称"
        >
          <Tag className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition ${
            autoRotate
              ? "border-teal-600 bg-teal-600 text-white"
              : "border-border bg-card text-slate-500 hover:text-teal-700"
          }`}
          onClick={() => setAutoRotate((v) => !v)}
          title="自动巡游"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-slate-500 backdrop-blur transition hover:text-teal-700"
          onClick={() => {
            setCard(null);
            setResetKey((k) => k + 1);
          }}
          title="重置视角"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-3 rounded-lg border border-border bg-card/90 px-3 py-2 text-[11px] text-slate-500 shadow-sm backdrop-blur">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          高温区
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          中温区
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          进料/电压
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          排放/烟气
        </span>
      </div>

      <Canvas
        key={resetKey}
        shadows
        camera={{ position: [6, 4.2, 6], fov: 45 }}
        onCreated={({ scene: s }) => {
          s.background = new THREE.Color("#eef4f4");
          s.fog = new THREE.Fog("#eef4f4", 24, 60);
          setReady(true);
        }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-5, 4, -4]} intensity={0.35} />
        <AutoRotate enabled={autoRotate}>
          <ModelByType twinType={scene.twinType} telemetry={telemetry} openCard={openCard} />
          {/* 参数热点标注 */}
          {showHotspots &&
            hotspots.map((h, i) => (
              <Html key={i} position={h.position} center distanceFactor={7} style={{ pointerEvents: "none" }}>
                <div className="select-none whitespace-nowrap rounded-md border border-teal-600/30 bg-white/92 px-2 py-1 text-[10px] shadow-md backdrop-blur">
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: h.color, boxShadow: `0 0 6px ${h.color}` }}
                    />
                    <span className="text-slate-500">{h.label}</span>
                  </div>
                  <div className="font-mono text-[11px] font-semibold tabular-nums text-teal-700">
                    {h.value(telemetry)}
                  </div>
                </div>
              </Html>
            ))}
          {/* 设备名称标签 */}
          {showLabels &&
            labels.map((l) => (
              <Html key={l.name} position={l.pos} center distanceFactor={9} style={{ pointerEvents: "none" }}>
                <div className="flex select-none items-center gap-1 whitespace-nowrap rounded border border-slate-300 bg-white/85 px-1.5 py-0.5 shadow-sm backdrop-blur">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-600" />
                  <span className="text-[10px] font-medium text-slate-600">{l.name}</span>
                </div>
              </Html>
            ))}
        </AutoRotate>
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          autoRotate={false}
          minDistance={3}
          maxDistance={20}
          target={[0, 1.4, 0]}
        />
        {/* 网格地面（与主孪生同款浅色网格） */}
        <gridHelper args={[20, 20, "#cbd5d5", "#9fc4c4"]} position={[0, 0.01, 0]} />
      </Canvas>

      {/* 设备信息卡（点击场景设备弹出，与主孪生设备卡同款） */}
      {cardMeta && (
        <div className="absolute bottom-4 left-4 z-20 w-72 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-foreground">{cardMeta.meta.name}</p>
              <span className="rounded bg-teal-600/10 px-1.5 py-0.5 text-[9px] text-teal-700">
                {cardMeta.meta.role}
              </span>
            </div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setCard(null)}
            >
              ✕
            </button>
          </div>
          {cardMeta.meta.metrics.length > 0 && (
            <div className="mt-2 flex gap-2">
              {cardMeta.meta.metrics.map((m) => (
                <div
                  key={m.label}
                  className="flex-1 rounded-md border border-border bg-muted/40 px-2 py-1.5"
                >
                  <p className="text-[9px] text-muted-foreground">{m.label}</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-teal-700">
                    {m.value(telemetry)}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{cardMeta.meta.desc}</p>
        </div>
      )}

      {/* 底部说明 */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 text-[10px] text-muted-foreground/70">
        🖱 左拖旋转 · 右键拖移 · 滚轮缩放 · 点击设备查看详情
      </div>
    </div>
  );
}

export default DigitalTwinViewer;
