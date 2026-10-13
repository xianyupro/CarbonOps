"use client";

/**
 * KilnTwin —— 1号回转挥发窑三维数字孪生（程序化几何 + 实时数据驱动）。
 *
 * 场景组成：回转窑筒体（轴向温度场着色）/ 滚圈+托轮 / 大齿圈 / 窑头罩+燃烧器火焰 /
 * 窑尾给料圆盘+料流 / 主传动（小齿轮与筒体联动反转）/ 窑头卸料→水淬池（渣流+蒸汽）/
 * 烟道→余热锅炉→电收尘→脱硫塔→引风机（叶轮旋转）→烟囱（烟气）。
 * 数据驱动：筒体转速∝主电机频率；给料盘与料流∝给料频率；火焰强度∝窑头温度；
 *          筒体轴向着色=温度场曲线（计算点01.Temp_01）。
 * 扩展能力：过温告警环（>1050℃ 脉冲红环）/ 球团仓落料 / 烟气流向粒子（橙→青渐变）/
 *          设备名称标签 / 相机预设视角飞行 / 自动巡游 / 温度场图例 /
 *          关键设备点击信息卡（窑头罩/给料圆盘/余热锅炉/电收尘/烟囱）/
 *          透视模式窑内物料推移粒子（速度∝给料频率）/ 烟囱烟气淡入淡出柔和化。
 */

import * as React from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";

export interface KilnTelemetry {
  tailTemp: number | null; // 窑尾温度 ℃
  headTemp: number | null; // 窑头温度 ℃
  feedFreq: number | null; // 给料机频率 Hz
  motorFreq: number | null; // 主电机频率 Hz
  co: number | null; // CO 浓度 %
  boilerPressure: number | null; // 余热锅炉锅筒压力 MPa
  fanValve: number | null; // 增压风机进口阀门开度反馈值 %
  drumLevel: number | null; // 1#锅筒液位 mm
  tempField: [number, number][] | null; // 温度场曲线 [位置m, 温度℃]
}

type TelemetryNumField = Exclude<keyof KilnTelemetry, "tempField">;

/** 可点击设备 ID：窑头罩 / 圆盘给料机 / 余热锅炉 / 电收尘器 / 烟囱 */
export type TwinDeviceId = "kilnHead" | "feeder" | "boiler" | "esp" | "stack";

export interface TwinDeviceMetric {
  label: string;
  value: string;
  unit: string;
}

/** 设备信息卡数据（点击场景设备后弹出） */
export interface TwinDeviceInfo {
  id: TwinDeviceId;
  name: string;
  role: string;
  description: string;
  metrics: TwinDeviceMetric[];
}

/** 设备静态档案（工艺作用 + 说明 + 关联实时点位） */
const DEVICE_META: Record<
  TwinDeviceId,
  {
    name: string;
    role: string;
    description: string;
    metrics: { label: string; field: TelemetryNumField; unit: string; digits: number }[];
  }
> = {
  kilnHead: {
    name: "窑头罩",
    role: "燃烧与窑端密封",
    description:
      "承载燃烧器向窑内喷入燃料与一次风，为焙烧带提供主要热源；罩内维持微负压防止高温烟气外逸。窑头温度反映燃烧强度与物料烧成状态，CO 浓度用于监控燃烧完全程度。",
    metrics: [
      { label: "窑头温度", field: "headTemp", unit: "℃", digits: 1 },
      { label: "CO 浓度", field: "co", unit: "%", digits: 3 },
    ],
  },
  feeder: {
    name: "圆盘给料机",
    role: "入窑物料计量给料",
    description:
      "按设定频率将球团均匀给入窑尾，给料量与窑速、温度场匹配，决定料层厚度与焙烧质量；频率反馈持续偏高或剧烈波动时，需关注下料口堵塞与仓内料位。",
    metrics: [{ label: "给料频率", field: "feedFreq", unit: "Hz", digits: 1 }],
  },
  boiler: {
    name: "余热锅炉",
    role: "高温烟气余热回收",
    description:
      "回收窑头高温烟气显热生产蒸汽，降低排烟温度与系统能耗，是全流程低碳运行的核心余热利用设备；锅筒压力与液位共同反映产汽系统的安全与稳定。",
    metrics: [
      { label: "锅筒压力", field: "boilerPressure", unit: "MPa", digits: 2 },
      { label: "锅筒液位", field: "drumLevel", unit: "mm", digits: 1 },
    ],
  },
  esp: {
    name: "电收尘器",
    role: "高压静电除尘",
    description:
      "高压电晕使烟气中金属氧化物粉尘荷电并沉积于集尘极，振打回收后返回配料，实现有价金属资源循环；入口 CO 超限存在燃爆风险，需与燃烧工况联锁。",
    metrics: [
      { label: "CO 浓度", field: "co", unit: "%", digits: 3 },
      { label: "风机阀开度", field: "fanValve", unit: "%", digits: 1 },
    ],
  },
  stack: {
    name: "烟囱",
    role: "净化烟气达标排放",
    description:
      "经余热锅炉、电收尘与脱硫塔净化后的烟气由引风机送入烟囱达标排放；烟囱抽力与增压风机进口阀门开度共同决定系统通风量与窑内负压分布。",
    metrics: [{ label: "风机阀开度", field: "fanValve", unit: "%", digits: 1 }],
  },
};

/** 组装设备信息卡（静态档案 + 实时点位当前值） */
export function deviceInfo(id: TwinDeviceId, telemetry: KilnTelemetry): TwinDeviceInfo {
  const meta = DEVICE_META[id];
  return {
    id,
    name: meta.name,
    role: meta.role,
    description: meta.description,
    metrics: meta.metrics.map((m) => ({
      label: m.label,
      value: fmt(telemetry[m.field], m.digits),
      unit: m.unit,
    })),
  };
}

/** 设备 mesh 的交互 props：点击弹出信息卡 + 悬停指针光标 */
function deviceHandlers(
  id: TwinDeviceId,
  telemetry: KilnTelemetry,
  onDeviceClick?: (info: TwinDeviceInfo) => void
): {
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
} {
  return {
    onClick: (e) => {
      e.stopPropagation();
      onDeviceClick?.(deviceInfo(id, telemetry));
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

const SHELL_R = 1.6;
const SHELL_LEN = 24;
const KILN_Y = 4.2;
const TILT = -0.045; // ~2.6°，窑头低
const SEGMENTS = 12;

/** 烟气路径拐点（GasTrain 组局部坐标）：窑头 → 余热锅炉 → 电收尘 → 脱硫塔 → 烟囱顶 */
const GAS_PATH: [number, number, number][] = [
  [-1.6, 6.6, -3.5],
  [2.5, 6.6, -3.5],
  [8.5, 6.6, -3.5],
  [11.6, 5.5, -3.5],
  [13.9, 6.9, -3.5],
  [16.2, 6.9, -3.5],
  [16.2, 12.4, -3.5],
];
const GAS_SEGS = GAS_PATH.slice(1).map((b, i) => {
  const a = GAS_PATH[i];
  return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) };
});
const GAS_TOTAL = GAS_SEGS.reduce((s, x) => s + x.len, 0);

// 粒子颜色三段渐变（高温橙 → 中性灰 → 净化青）与临时向量，避免每帧分配
const _cHot = new THREE.Color("#fb923c");
const _cMid = new THREE.Color("#cbd5e1");
const _cClean = new THREE.Color("#5eead4");
const _cTmp = new THREE.Color();
const _vPos = new THREE.Vector3();
const _vTarget = new THREE.Vector3();

/** 温度 → 颜色（600℃ 暗红 → 1100℃ 亮黄）；导出供图例色带复用 */
export function tempColor(temp: number): string {
  const t = THREE.MathUtils.clamp((temp - 500) / 700, 0, 1);
  const c = new THREE.Color();
  c.setHSL(THREE.MathUtils.lerp(0.02, 0.13, t), 0.95, THREE.MathUtils.lerp(0.16, 0.6, t));
  return `#${c.getHexString()}`;
}

/** 从温度场曲线取位置 ratio(0~1) 处的温度 */
function sampleField(field: [number, number][] | null, ratio: number, fallback: number): number {
  if (!field || field.length < 2) return fallback;
  const pos = field[0] != null ? field[0][0] : 0;
  const min = field[0][0];
  const max = field[field.length - 1][0];
  const x = min + (max - min) * ratio;
  for (let i = 1; i < field.length; i++) {
    if (x <= field[i][0]) {
      const [x0, t0] = field[i - 1];
      const [x1, t1] = field[i];
      const k = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return t0 + (t1 - t0) * k;
    }
  }
  return field[field.length - 1][1];
}

/** 窑内物料推移粒子（透视模式）：小球沿窑轴从窑尾向窑头循环移动，速度∝给料频率 */
function BedParticles({ telemetry }: { telemetry: KilnTelemetry }) {
  const ref = React.useRef<THREE.Group>(null);
  const N = 16;

  useFrame((state) => {
    if (!ref.current) return;
    const rate = 0.02 + (telemetry.feedFreq ?? 0) * 0.005; // 循环周期随给料频率加快
    const t = state.clock.elapsedTime * rate;
    const half = SHELL_LEN / 2 - 0.9;
    ref.current.children.forEach((p, i) => {
      const phase = (t + i / N) % 1;
      // 沿轴 从窑尾(-x) 向窑头(+x) 推进，贴料床高度并轻微起伏
      p.position.x = -half + phase * half * 2;
      p.position.y = -SHELL_R * 0.45 + Math.sin(phase * Math.PI * 2 + i) * 0.08;
      p.position.z = Math.sin(i * 2.7) * 0.55;
      p.scale.setScalar(0.85 + 0.3 * Math.sin(i * 1.3));
    });
  });

  return (
    <group ref={ref}>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial
            color="#fdba74"
            emissive="#ea580c"
            emissiveIntensity={0.8}
            roughness={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

/** 筒体（含滚圈/齿圈）——整体绕轴线旋转；支持分段点击与透视模式 */
function KilnBody({
  telemetry,
  xray,
  onSegmentClick,
}: {
  telemetry: KilnTelemetry;
  xray?: boolean;
  onSegmentClick?: (index: number, temp: number) => void;
}) {
  const spinRef = React.useRef<THREE.Group>(null);
  const segRefs = React.useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const warnRef = React.useRef<THREE.Group>(null);
  const fieldRef = React.useRef(telemetry.tempField);
  fieldRef.current = telemetry.tempField;

  useFrame((state, dt) => {
    // 转速 ∝ 主电机频率（正常约 0.5 rad/s 量级的视觉速度）
    const speed = 0.15 + (telemetry.motorFreq ?? 8) * 0.06;
    if (spinRef.current) spinRef.current.rotation.x += dt * speed;
    // 过温告警环呼吸脉冲
    if (warnRef.current) {
      const pulse = 0.45 + 0.4 * Math.sin(state.clock.elapsedTime * 5);
      warnRef.current.children.forEach((c) => {
        ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = pulse;
      });
    }
  });

  // 轴向着色：温度场曲线 → 分段自发光
  React.useEffect(() => {
    for (let i = 0; i < SEGMENTS; i++) {
      const mat = segRefs.current[i];
      if (!mat) continue;
      const temp = sampleField(telemetry.tempField, (i + 0.5) / SEGMENTS, 700 + i * 20);
      mat.emissive = new THREE.Color(tempColor(temp));
      mat.emissiveIntensity = 0.75;
    }
  }, [telemetry.tempField]);

  const segLen = SHELL_LEN / SEGMENTS;

  return (
    <group position={[0, KILN_Y, 0]} rotation={[0, 0, TILT]}>
      {/* 筒体分段（温度场着色，随轴旋转） */}
      <group ref={spinRef}>
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const x = -SHELL_LEN / 2 + segLen * (i + 0.5);
          const temp = sampleField(telemetry.tempField, (i + 0.5) / SEGMENTS, 700 + i * 20);
          return (
            <mesh
              key={i}
              position={[x, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
              onClick={(e) => {
                e.stopPropagation();
                onSegmentClick?.(i, Math.round(temp));
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = onSegmentClick ? "pointer" : "default";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "default";
              }}
            >
              <cylinderGeometry args={[SHELL_R, SHELL_R, segLen + 0.02, 28]} />
              <meshStandardMaterial
                ref={(m) => {
                  segRefs.current[i] = m;
                }}
                color={tempColor(temp)}
                emissive={tempColor(temp)}
                emissiveIntensity={0.75}
                metalness={0.55}
                roughness={0.45}
                transparent={xray}
                opacity={xray ? 0.22 : 1}
                depthWrite={!xray}
              />
            </mesh>
          );
        })}
        {/* 透视模式：窑内料床（沿轴发光条） */}
        {xray && (
          <mesh position={[0, -SHELL_R * 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[SHELL_R * 0.55, SHELL_R * 0.55, SHELL_LEN * 0.94, 20]} />
            <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={1.1} />
          </mesh>
        )}

        {/* 滚圈 ×2 */}
        {[-7.5, 7.5].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[SHELL_R + 0.22, 0.2, 14, 40]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.35} />
          </mesh>
        ))}
        {/* 大齿圈 */}
        <mesh position={[9.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[SHELL_R + 0.42, 0.26, 12, 44]} />
          <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.3} />
        </mesh>
      </group>

      {/* 透视模式：窑内物料推移（窑尾→窑头，速度∝给料频率） */}
      {xray && <BedParticles telemetry={telemetry} />}

      {/* 托轮（静态） */}
      {[-7.5, 7.5].flatMap((x) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${x}-${side}`}
            position={[x, -(SHELL_R + 0.62), side * (SHELL_R + 0.72)]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.55, 0.55, 1.1, 20]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
          </mesh>
        ))
      )}

      {/* 过温告警环（分段温度 > 1050℃ 时脉冲红环，提示结圈风险） */}
      <group ref={warnRef}>
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const temp = sampleField(telemetry.tempField, (i + 0.5) / SEGMENTS, 700 + i * 20);
          if (temp <= 1050) return null;
          return (
            <mesh
              key={`warn-${i}`}
              position={[-SHELL_LEN / 2 + segLen * (i + 0.5), 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <torusGeometry args={[SHELL_R + 0.3, 0.08, 8, 36]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** 主传动：小齿轮（与大齿圈啮合、反向联动）+ 减速机 + 主电机 */
function DriveUnit({ telemetry }: { telemetry: KilnTelemetry }) {
  const driveRef = React.useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    // 与 KilnBody 同源角速度；小齿轮齿数少 → 反向、约 4.5 倍速（视觉取 2.4 倍避免过快）
    const speed = (0.15 + (telemetry.motorFreq ?? 8) * 0.06) * 2.4;
    if (driveRef.current) driveRef.current.rotation.x -= dt * speed;
  });

  const x = 9.2; // 对齐大齿圈轴向位置
  const y = KILN_Y + TILT * x; // 齿圈中心高度（补偿筒体倾角）
  const z = SHELL_R + 0.68 + 0.5; // 齿圈外沿 + 小齿轮半径（啮合位）
  return (
    <group position={[x, y, z]}>
      {/* 小齿轮（轴沿 x，与筒体反转） */}
      <group ref={driveRef}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.5, 0.5, 0.6, 14]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
      {/* 联轴器 */}
      <mesh position={[1.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.9, 10]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* 减速机 */}
      <mesh position={[1.9, 0, 0]}>
        <boxGeometry args={[1.3, 1.3, 1.25]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 主电机 */}
      <mesh position={[3.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.5, 0.5, 1.7, 18]} />
        <meshStandardMaterial color="#1d4ed8" metalness={0.55} roughness={0.45} />
      </mesh>
      <mesh position={[3.8, 0.55, 0]}>
        <boxGeometry args={[0.5, 0.3, 0.4]} />
        <meshStandardMaterial color="#1e40af" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* 底座 */}
      <mesh position={[1.9, -1.05, 0]}>
        <boxGeometry args={[5.6, 0.32, 1.8]} />
        <meshStandardMaterial color="#64748b" metalness={0.25} roughness={0.75} />
      </mesh>
    </group>
  );
}

/** 窑头罩 + 燃烧器火焰 */
function KilnHead({
  telemetry,
  onDeviceClick,
}: {
  telemetry: KilnTelemetry;
  onDeviceClick?: (info: TwinDeviceInfo) => void;
}) {
  const flameRef = React.useRef<THREE.Mesh>(null);
  const lightRef = React.useRef<THREE.PointLight>(null);
  const headX = SHELL_LEN / 2 + 1.6;

  useFrame((state) => {
    const heat = THREE.MathUtils.clamp((telemetry.headTemp ?? 900) / 1100, 0.2, 1.4);
    const flicker = 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 11);
    if (flameRef.current) {
      flameRef.current.scale.set(1, heat * flicker * 1.6, 1);
      (flameRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 * heat;
    }
    if (lightRef.current) lightRef.current.intensity = 22 * heat * flicker;
  });

  return (
    <group position={[headX, KILN_Y + TILT * headX, 0]}>
      {/* 窑头罩（可点击查看工艺详情） */}
      <mesh position={[0.9, 0.4, 0]} {...deviceHandlers("kilnHead", telemetry, onDeviceClick)}>
        <boxGeometry args={[3.2, 4.4, 4.4]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* 燃烧器 */}
      <mesh position={[2.6, 0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 3.4, 12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 火焰 */}
      <mesh ref={flameRef} position={[-0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.55, 2.6, 12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f97316" emissiveIntensity={1.4} transparent opacity={0.85} />
      </mesh>
      <pointLight ref={lightRef} position={[0.4, 0, 0]} color="#fb923c" intensity={20} distance={16} />
      {/* 烟道（窑头罩顶部 → 后续处理） */}
      <mesh position={[1.2, 3.4, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.55, 0.55, 5, 14]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** 窑尾给料：圆盘给料机 + 料流 */
function FeedEnd({
  telemetry,
  onDeviceClick,
}: {
  telemetry: KilnTelemetry;
  onDeviceClick?: (info: TwinDeviceInfo) => void;
}) {
  const discRef = React.useRef<THREE.Mesh>(null);
  const beadsRef = React.useRef<THREE.Group>(null);
  const siloBeadsRef = React.useRef<THREE.Group>(null);
  const tailX = -SHELL_LEN / 2 - 1.2;

  useFrame((state, dt) => {
    const freq = telemetry.feedFreq ?? 8;
    if (discRef.current) discRef.current.rotation.y += dt * freq * 0.35;
    if (beadsRef.current) {
      const t = state.clock.elapsedTime * (0.4 + freq * 0.09);
      beadsRef.current.children.forEach((bead, i) => {
        const phase = (t + i / beadsRef.current!.children.length) % 1;
        // 沿溜槽滑入窑尾：x 从 0→4，y 从 1.2→0，继续进窑
        bead.position.set(phase * 3.6, 1.4 - phase * 1.5 + Math.sin(phase * Math.PI) * 0.12, 0);
        const s = 1 - phase * 0.35;
        bead.scale.setScalar(Math.max(0.15, s));
      });
    }
    // 球团仓 → 圆盘给料机 落料
    if (siloBeadsRef.current) {
      const t = state.clock.elapsedTime * (0.5 + freq * 0.07);
      siloBeadsRef.current.children.forEach((bead, i) => {
        const phase = (t + i / siloBeadsRef.current!.children.length) % 1;
        bead.position.set(-3.4 + Math.sin(phase * Math.PI) * 0.06, 4.55 - phase * 0.75, 0);
        bead.scale.setScalar(0.9);
      });
    }
  });

  return (
    <group position={[tailX, KILN_Y - TILT * -tailX, 0]}>
      {/* 窑尾罩 */}
      <mesh position={[-0.8, 0.3, 0]}>
        <boxGeometry args={[2.4, 3.8, 3.8]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* 球团仓（锥底料仓 + 支腿） */}
      <group position={[-3.4, 0, 0]}>
        <mesh position={[0, 6.4, 0]}>
          <cylinderGeometry args={[1.35, 1.35, 1.7, 20]} />
          <meshStandardMaterial color="#57534e" metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[0, 5.05, 0]}>
          <cylinderGeometry args={[0.45, 1.35, 1.0, 20]} />
          <meshStandardMaterial color="#57534e" metalness={0.4} roughness={0.6} />
        </mesh>
        {/* 料仓顶盖 */}
        <mesh position={[0, 7.35, 0]}>
          <sphereGeometry args={[1.35, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#44403c" metalness={0.4} roughness={0.6} />
        </mesh>
        {/* 支腿 */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}-${sz}`} position={[sx * 1.05, 2.9, sz * 1.05]}>
              <boxGeometry args={[0.12, 2.6, 0.12]} />
              <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
            </mesh>
          ))
        )}
        {/* 仓→圆盘落料珠串 */}
        <group ref={siloBeadsRef}>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.15, 8, 8]} />
              <meshStandardMaterial color="#a8a29e" roughness={0.9} />
            </mesh>
          ))}
        </group>
      </group>
      {/* 圆盘给料机（上方，可点击查看工艺详情） */}
      <group position={[-3.4, 3.4, 0]}>
        <mesh
          ref={discRef}
          rotation={[0, 0, 0]}
          {...deviceHandlers("feeder", telemetry, onDeviceClick)}
        >
          <cylinderGeometry args={[1.5, 1.5, 0.22, 26]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.8, 10]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </group>
      {/* 料流珠串（球团） */}
      <group ref={beadsRef}>
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.16, 8, 8]} />
            <meshStandardMaterial color="#a8a29e" roughness={0.9} />
          </mesh>
        ))}
      </group>
      {/* 溜槽 */}
      <mesh position={[0.8, 1.1, 0]} rotation={[0, 0, -0.42]}>
        <boxGeometry args={[3.4, 0.12, 1.1]} />
        <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** 窑渣水淬：窑头卸料溜槽 → 水淬池（渣流+蒸汽，速率∝给料频率） */
function SlagQuench({ telemetry }: { telemetry: KilnTelemetry }) {
  const beadsRef = React.useRef<THREE.Group>(null);
  const steamRef = React.useRef<THREE.Group>(null);
  const px = SHELL_LEN / 2 + 4.1; // 池中心 x（窑头卸料口外侧）
  const pz = 3.0;

  useFrame((state) => {
    const rate = 0.55 + (telemetry.feedFreq ?? 8) * 0.08;
    if (beadsRef.current) {
      const t = state.clock.elapsedTime * rate;
      beadsRef.current.children.forEach((bead, i) => {
        const phase = (t + i / beadsRef.current!.children.length) % 1;
        // 窑头卸料口(局部 [0.6, 2.1, -3]) → 池面(局部 [0, 0.95, 0])，带抛物弧
        bead.position.set(
          0.6 - phase * 0.6,
          2.1 - phase * 1.15 + Math.sin(phase * Math.PI) * 0.5,
          -pz - phase * pz
        );
        bead.scale.setScalar(1 - phase * 0.3);
      });
    }
    if (steamRef.current) {
      const t = state.clock.elapsedTime * 0.42;
      steamRef.current.children.forEach((p, i) => {
        const phase = (t + i / steamRef.current!.children.length) % 1;
        p.position.set(
          Math.sin(phase * 6 + i * 2) * 0.5,
          1.1 + phase * 2.4,
          Math.cos(phase * 5 + i) * 0.5
        );
        const s = 0.35 + phase * 1.3;
        p.scale.setScalar(s);
        (p as THREE.Mesh).visible = phase < 0.85;
      });
    }
  });

  return (
    <group position={[px, 0, pz]}>
      {/* 池体 */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[3.6, 1.0, 3.2]} />
        <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 水面 */}
      <mesh position={[0, 0.93, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.3, 2.9]} />
        <meshStandardMaterial
          color="#0ea5e9"
          transparent
          opacity={0.55}
          metalness={0.5}
          roughness={0.15}
        />
      </mesh>
      {/* 卸料溜槽（窑头罩 → 池沿） */}
      <mesh position={[-1.0, 1.75, -pz / 2]} rotation={[0.5, 0, -0.35]}>
        <boxGeometry args={[0.9, 0.1, 3.4]} />
        <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.5} />
      </mesh>
      {/* 渣流珠串（高温炉渣） */}
      <group ref={beadsRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.17, 8, 8]} />
            <meshStandardMaterial
              color="#f97316"
              emissive="#ea580c"
              emissiveIntensity={0.9}
              roughness={0.8}
            />
          </mesh>
        ))}
      </group>
      {/* 水淬蒸汽 */}
      <group ref={steamRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshStandardMaterial color="#e2e8f0" transparent opacity={0.45} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** 烟气处理：余热锅炉 → 电收尘 → 脱硫塔 → 引风机 → 烟囱（烟气粒子） */
function GasTrain({
  telemetry,
  onDeviceClick,
}: {
  telemetry: KilnTelemetry;
  onDeviceClick?: (info: TwinDeviceInfo) => void;
}) {
  const smokeRef = React.useRef<THREE.Group>(null);
  const fanRef = React.useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    if (smokeRef.current) {
      const t = state.clock.elapsedTime * 0.5;
      smokeRef.current.children.forEach((p, i) => {
        const phase = (t + i / smokeRef.current!.children.length) % 1;
        p.position.y = phase * 7.2;
        p.position.x = Math.sin(phase * 4.5 + i) * 0.45;
        // 柔和烟气：上升过程中逐渐放大 + 透明度渐隐（源头淡入、顶端淡出）
        const s = 0.45 + phase * 1.9;
        p.scale.setScalar(s);
        const mat = (p as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.opacity = 0.52 * Math.min(1, phase * 5) * (1 - phase);
        (p as THREE.Mesh).visible = phase < 0.95;
      });
    }
    // 引风机叶轮恒速旋转（机组运行状态）
    if (fanRef.current) fanRef.current.rotation.z += dt * 7;
  });

  return (
    <group position={[SHELL_LEN / 2 + 4.5, 0, 0]}>
      {/* 余热锅炉（可点击查看工艺详情） */}
      <group position={[2.5, 0, -3.5]}>
        <mesh position={[0, 3, 0]} {...deviceHandlers("boiler", telemetry, onDeviceClick)}>
          <boxGeometry args={[4.2, 6, 3.4]} />
          <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.5} />
        </mesh>
        {/* 锅筒 */}
        <mesh position={[0, 6.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.7, 0.7, 3.4, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
      {/* 电收尘器（可点击查看工艺详情） */}
      <group position={[8.5, 0, -3.5]}>
        <mesh position={[0, 3.2, 0]} {...deviceHandlers("esp", telemetry, onDeviceClick)}>
          <cylinderGeometry args={[1.7, 1.9, 6.4, 20]} />
          <meshStandardMaterial color="#54627a" metalness={0.6} roughness={0.45} />
        </mesh>
        <mesh position={[0, 7, 0]}>
          <coneGeometry args={[1.7, 1.2, 20]} />
          <meshStandardMaterial color="#54627a" metalness={0.6} roughness={0.45} />
        </mesh>
      </group>
      {/* 脱硫塔（双碱法：浆液循环泵 + 喷淋环管 + 除雾器） */}
      <group position={[11.6, 0, -3.5]}>
        <mesh position={[0, 3.75, 0]}>
          <cylinderGeometry args={[1.35, 1.5, 7.5, 22]} />
          <meshStandardMaterial color="#0f766e" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 8.1, 0]}>
          <coneGeometry args={[1.35, 1.1, 22]} />
          <meshStandardMaterial color="#0d645d" metalness={0.5} roughness={0.5} />
        </mesh>
        {/* 除雾器段（塔顶浅色环带） */}
        <mesh position={[0, 6.9, 0]}>
          <cylinderGeometry args={[1.38, 1.38, 0.5, 22]} />
          <meshStandardMaterial color="#5eead4" roughness={0.6} />
        </mesh>
        {/* 喷淋环管 */}
        <mesh position={[0, 4.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.55, 0.09, 8, 26]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
        </mesh>
        {/* 循环泵 + 浆液管 */}
        <mesh position={[1.9, 0.6, 0]}>
          <boxGeometry args={[0.9, 1.2, 0.9]} />
          <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[1.35, 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 10]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      {/* 引风机（离心风机：蜗壳 + 叶轮 + 电机，叶轮旋转） */}
      <group position={[13.4, 0, -0.9]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[2.4, 0.4, 2.4]} />
          <meshStandardMaterial color="#64748b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.05, 1.05, 1.3, 24]} />
          <meshStandardMaterial color="#3f5270" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* 叶轮（前面板开口可见旋转叶片） */}
        <group ref={fanRef} position={[0, 1.75, 0.72]}>
          <mesh>
            <cylinderGeometry args={[0.22, 0.22, 0.3, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
          </mesh>
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0]}
                rotation={[0, 0, a]}
              >
                <boxGeometry args={[0.85, 0.3, 0.08]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.35} />
              </mesh>
            );
          })}
        </group>
        {/* 驱动电机 */}
        <mesh position={[0, 1.75, -1.55]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 1.2, 16]} />
          <meshStandardMaterial color="#1d4ed8" metalness={0.55} roughness={0.45} />
        </mesh>
      </group>
      {/* 烟囱 + 烟气（烟囱可点击查看工艺详情） */}
      <group position={[16.2, 0, -3.5]}>
        <mesh position={[0, 5.5, 0]} {...deviceHandlers("stack", telemetry, onDeviceClick)}>
          <cylinderGeometry args={[0.55, 0.75, 11, 14]} />
          <meshStandardMaterial color="#6b7280" metalness={0.4} roughness={0.6} />
        </mesh>
        <group ref={smokeRef} position={[0, 11.2, 0]}>
          {Array.from({ length: 7 }).map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.42, 8, 8]} />
              <meshStandardMaterial color="#d3dce6" transparent opacity={0.45} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
      {/* 连接烟道 */}
      <mesh position={[1.4, 6.6, -3.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.5, 0.5, 5, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[5.6, 6.6, -3.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.5, 0.5, 4.2, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 电收尘 → 脱硫塔 */}
      <mesh position={[10.05, 5.5, -3.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.45, 0.45, 2.4, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 脱硫塔 → 烟囱（经引风机上方汇入） */}
      <mesh position={[13.9, 6.9, -3.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.45, 0.45, 4.0, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 引风机立管（风机出口 → 主烟道） */}
      <mesh position={[13.4, 4.2, -0.9]}>
        <cylinderGeometry args={[0.4, 0.4, 4.4, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[13.4, 6.5, -2.2]}>
        <boxGeometry args={[0.9, 0.9, 2.6]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 烟气流向粒子 */}
      <GasFlowParticles />
    </group>
  );
}

/** 烟气流向粒子：沿烟气路径匀速流动，颜色 高温橙→中性灰→净化青（体现净化进程） */
function GasFlowParticles() {
  const ref = React.useRef<THREE.Group>(null);
  const N = 14;

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.085;
    ref.current.children.forEach((p, i) => {
      const d = (((t + i / N) % 1) + 1) % 1 * GAS_TOTAL;
      let acc = 0;
      let seg = GAS_SEGS[GAS_SEGS.length - 1];
      for (const s of GAS_SEGS) {
        if (d <= acc + s.len) {
          seg = s;
          break;
        }
        acc += s.len;
      }
      const k = seg.len === 0 ? 0 : (d - acc) / seg.len;
      p.position.set(
        seg.a[0] + (seg.b[0] - seg.a[0]) * k,
        seg.a[1] + (seg.b[1] - seg.a[1]) * k,
        seg.a[2] + (seg.b[2] - seg.a[2]) * k
      );
      const u = d / GAS_TOTAL;
      if (u < 0.5) _cTmp.lerpColors(_cHot, _cMid, u / 0.5);
      else _cTmp.lerpColors(_cMid, _cClean, (u - 0.5) / 0.5);
      ((p as THREE.Mesh).material as THREE.MeshBasicMaterial).color.copy(_cTmp);
      const s = 0.13 + 0.07 * Math.sin(u * Math.PI);
      p.scale.setScalar(s / 0.16);
    });
  });

  return (
    <group ref={ref}>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.16, 8, 8]} />
          <meshBasicMaterial color="#fb923c" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** 设备名称标签（与数据标签独立开关，纯展示不拦截鼠标） */
function EquipmentLabels({ visible }: { visible: boolean }) {
  if (!visible) return null;
  const items: { pos: [number, number, number]; name: string }[] = [
    { pos: [-16.6, 10.2, 0], name: "球团仓" },
    { pos: [9.2, KILN_Y + TILT * 9.2 + 2.0, 3.4], name: "主传动" },
    { pos: [16.1, 3.5, 3.0], name: "水淬池" },
    { pos: [15.0, 7.6, -3.5], name: "余热锅炉" },
    { pos: [21.0, 9.0, -3.5], name: "电收尘" },
    { pos: [24.1, 10.0, -3.5], name: "脱硫塔" },
    { pos: [25.9, 4.6, -0.9], name: "引风机" },
    { pos: [28.7, 12.6, -3.5], name: "烟囱" },
  ];
  return (
    <>
      {items.map((it) => (
        <Html key={it.name} position={it.pos} center distanceFactor={32} style={{ pointerEvents: "none" }}>
          <div className="flex items-center gap-1 whitespace-nowrap rounded border border-slate-300 bg-white/85 px-1.5 py-0.5 shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            <span className="text-[11px] font-medium text-slate-600">{it.name}</span>
          </div>
        </Html>
      ))}
    </>
  );
}

/** 相机预设视角：平滑飞行到目标位（配合 OrbitControls makeDefault） */
function CameraRig({ view }: { view: { key: number; preset: ViewPreset } | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as
    | { target: THREE.Vector3; update: () => void }
    | null;
  const doneKey = React.useRef(-1);

  useFrame((_, dt) => {
    if (!view || !controls || doneKey.current === view.key) return;
    const k = 1 - Math.exp(-3.2 * dt);
    _vPos.set(...view.preset.pos);
    _vTarget.set(...view.preset.target);
    camera.position.lerp(_vPos, k);
    controls.target.lerp(_vTarget, k);
    controls.update();
    if (camera.position.distanceTo(_vPos) < 0.3 && controls.target.distanceTo(_vTarget) < 0.3) {
      doneKey.current = view.key;
    }
  });
  return null;
}

/** 预设视角（世界坐标，场景组含 -4 x 偏移）：全景 / 窑头特写 / 窑尾特写 / 烟气处理 */
export interface ViewPreset {
  name: string;
  pos: [number, number, number];
  target: [number, number, number];
}

export const VIEW_PRESETS: Record<string, ViewPreset> = {
  overview: { name: "全景", pos: [30, 14, 26], target: [2, 4, 0] },
  headClose: { name: "窑头特写", pos: [16, 7.5, 10], target: [9.5, 3.6, 0] },
  tailClose: { name: "窑尾特写", pos: [-28, 9.5, 12], target: [-17.5, 5, 0] },
  gas: { name: "烟气处理", pos: [33, 12, 14], target: [21, 6, -3] },
};

/** 数据悬浮标签 */
function TelemetryLabels({ telemetry, visible }: { telemetry: KilnTelemetry; visible: boolean }) {
  if (!visible) return null;
  const items: { pos: [number, number, number]; label: string; value: string; unit: string }[] = [
    { pos: [-SHELL_LEN / 2 - 1, KILN_Y + 3.2, 0], label: "窑尾温度", value: fmt(telemetry.tailTemp), unit: "℃" },
    { pos: [SHELL_LEN / 2 + 1, KILN_Y + 3.4, 0], label: "窑头温度", value: fmt(telemetry.headTemp), unit: "℃" },
    { pos: [-SHELL_LEN / 2 - 4.5, KILN_Y + 4.6, 0], label: "给料频率", value: fmt(telemetry.feedFreq), unit: "Hz" },
    { pos: [SHELL_LEN / 2 + 3, KILN_Y - 2.2, 3.2], label: "CO 浓度", value: fmt(telemetry.co, 3), unit: "%" },
  ];
  return (
    <>
      {items.map((it) => (
        <Html key={it.label} position={it.pos} center distanceFactor={26}>
          <div className="whitespace-nowrap rounded-md border border-teal-600/30 bg-white/92 px-2.5 py-1.5 shadow-md backdrop-blur">
            <p className="text-[10px] text-slate-500">{it.label}</p>
            <p className="text-sm font-semibold tabular-nums text-teal-700">
              {it.value}
              <span className="ml-0.5 text-[10px] font-normal text-slate-400">{it.unit}</span>
            </p>
          </div>
        </Html>
      ))}
    </>
  );
}

/** 昼夜切换：更新场景背景与雾 */
function SceneAtmosphere({ night }: { night: boolean }) {
  const { scene } = useThree();
  React.useEffect(() => {
    const bg = night ? "#0b1220" : "#eef4f4";
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, 60, 140);
  }, [night, scene]);
  return null;
}

function fmt(v: number | null, digits = 1): string {
  return v == null ? "--" : v.toFixed(digits);
}

/** 主组件 */
export function KilnTwin({
  telemetry,
  showLabels = true,
  showDevices = false,
  night = false,
  xray = false,
  autoRotate = false,
  view = null,
  onSegmentClick,
  onDeviceClick,
}: {
  telemetry: KilnTelemetry;
  showLabels?: boolean;
  /** 设备名称标签 */
  showDevices?: boolean;
  /** 夜间模式：暗背景 + 窑体自发光更突出 */
  night?: boolean;
  /** 窑内透视：筒体半透明，露出料床 */
  xray?: boolean;
  /** 自动巡游（绕目标点缓慢环绕） */
  autoRotate?: boolean;
  /** 相机预设视角（key 变化触发一次平滑飞行） */
  view?: { key: number; preset: ViewPreset } | null;
  onSegmentClick?: (index: number, temp: number) => void;
  /** 点击场景设备（窑头罩/给料圆盘/余热锅炉/电收尘/烟囱）弹出信息卡 */
  onDeviceClick?: (info: TwinDeviceInfo) => void;
}) {
  const bg = night ? "#0b1220" : "#eef4f4";
  return (
    <Canvas
      camera={{ position: [30, 14, 26], fov: 42 }}
      dpr={[1, 2]}
      shadows={false}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color(bg);
        scene.fog = new THREE.Fog(bg, 60, 140);
      }}
    >
      <ambientLight intensity={night ? 0.3 : 0.75} />
      <directionalLight position={[18, 30, 12]} intensity={night ? 0.35 : 1.1} />
      <directionalLight position={[-20, 16, -14]} intensity={night ? 0.15 : 0.35} />
      {/* 夜间补光：窑体上方青色氛围光 */}
      {night && <pointLight position={[0, 16, 8]} color="#2dd4bf" intensity={12} distance={50} />}

      <group position={[-4, 0, 0]}>
        <KilnBody telemetry={telemetry} xray={xray} onSegmentClick={onSegmentClick} />
        <KilnHead telemetry={telemetry} onDeviceClick={onDeviceClick} />
        <FeedEnd telemetry={telemetry} onDeviceClick={onDeviceClick} />
        <DriveUnit telemetry={telemetry} />
        <SlagQuench telemetry={telemetry} />
        <GasTrain telemetry={telemetry} onDeviceClick={onDeviceClick} />
      </group>

      {/* 地面 */}
      <Grid
        args={[90, 60]}
        cellSize={1.5}
        cellColor={night ? "#1e293b" : "#cbd5d5"}
        sectionSize={7.5}
        sectionColor={night ? "#334155" : "#9fc4c4"}
        position={[6, 0, 0]}
        infiniteGrid={false}
        fadeDistance={90}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, -0.05, 0]} receiveShadow>
        <planeGeometry args={[140, 100]} />
        <meshStandardMaterial color={night ? "#0f172a" : "#e8efef"} />
      </mesh>

      <SceneAtmosphere night={night} />
      <TelemetryLabels telemetry={telemetry} visible={showLabels} />
      <EquipmentLabels visible={showDevices} />
      <CameraRig view={view} />
      <OrbitControls
        target={[2, 4, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={8}
        maxDistance={90}
        enableDamping
        makeDefault
        autoRotate={autoRotate}
        autoRotateSpeed={0.8}
      />
    </Canvas>
  );
}

export default KilnTwin;
