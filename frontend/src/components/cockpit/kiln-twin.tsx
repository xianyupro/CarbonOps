"use client";

/**
 * KilnTwin —— 1号回转挥发窑三维数字孪生（程序化几何 + 实时数据驱动）。
 *
 * 场景组成：回转窑筒体（轴向温度场着色）/ 滚圈+托轮 / 大齿圈 / 窑头罩+燃烧器火焰 /
 * 窑尾给料圆盘+料流 / 烟道→余热锅炉→电收尘→烟囱（烟气）。
 * 数据驱动：筒体转速∝主电机频率；给料盘与料流∝给料频率；火焰强度∝窑头温度；
 *          筒体轴向着色=温度场曲线（计算点01.Temp_01）。
 */

import * as React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";

export interface KilnTelemetry {
  tailTemp: number | null; // 窑尾温度 ℃
  headTemp: number | null; // 窑头温度 ℃
  feedFreq: number | null; // 给料机频率 Hz
  motorFreq: number | null; // 主电机频率 Hz
  co: number | null; // CO 浓度 %
  tempField: [number, number][] | null; // 温度场曲线 [位置m, 温度℃]
}

const SHELL_R = 1.6;
const SHELL_LEN = 24;
const KILN_Y = 4.2;
const TILT = -0.045; // ~2.6°，窑头低
const SEGMENTS = 12;

/** 温度 → 颜色（600℃ 暗红 → 1100℃ 亮黄） */
function tempColor(temp: number): string {
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
  const fieldRef = React.useRef(telemetry.tempField);
  fieldRef.current = telemetry.tempField;

  useFrame((_, dt) => {
    // 转速 ∝ 主电机频率（正常约 0.5 rad/s 量级的视觉速度）
    const speed = 0.15 + (telemetry.motorFreq ?? 8) * 0.06;
    if (spinRef.current) spinRef.current.rotation.x += dt * speed;
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
    </group>
  );
}

/** 窑头罩 + 燃烧器火焰 */
function KilnHead({ telemetry }: { telemetry: KilnTelemetry }) {
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
      {/* 窑头罩 */}
      <mesh position={[0.9, 0.4, 0]}>
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
function FeedEnd({ telemetry }: { telemetry: KilnTelemetry }) {
  const discRef = React.useRef<THREE.Mesh>(null);
  const beadsRef = React.useRef<THREE.Group>(null);
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
  });

  return (
    <group position={[tailX, KILN_Y - TILT * -tailX, 0]}>
      {/* 窑尾罩 */}
      <mesh position={[-0.8, 0.3, 0]}>
        <boxGeometry args={[2.4, 3.8, 3.8]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* 圆盘给料机（上方） */}
      <group position={[-3.4, 3.4, 0]}>
        <mesh ref={discRef} rotation={[0, 0, 0]}>
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

/** 烟气处理：余热锅炉 → 电收尘 → 烟囱（烟气粒子） */
function GasTrain({ telemetry }: { telemetry: KilnTelemetry }) {
  const smokeRef = React.useRef<THREE.Group>(null);

  useFrame((state) => {
    if (smokeRef.current) {
      const t = state.clock.elapsedTime * 0.5;
      smokeRef.current.children.forEach((p, i) => {
        const phase = (t + i / smokeRef.current!.children.length) % 1;
        p.position.y = phase * 7;
        p.position.x = Math.sin(phase * 5 + i) * 0.35;
        const s = 0.5 + phase * 1.4;
        p.scale.setScalar(s);
        (p as THREE.Mesh).visible = phase < 0.9;
      });
    }
  });

  return (
    <group position={[SHELL_LEN / 2 + 4.5, 0, 0]}>
      {/* 余热锅炉 */}
      <group position={[2.5, 0, -3.5]}>
        <mesh position={[0, 3, 0]}>
          <boxGeometry args={[4.2, 6, 3.4]} />
          <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.5} />
        </mesh>
        {/* 锅筒 */}
        <mesh position={[0, 6.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.7, 0.7, 3.4, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
      {/* 电收尘器 */}
      <group position={[8.5, 0, -3.5]}>
        <mesh position={[0, 3.2, 0]}>
          <cylinderGeometry args={[1.7, 1.9, 6.4, 20]} />
          <meshStandardMaterial color="#54627a" metalness={0.6} roughness={0.45} />
        </mesh>
        <mesh position={[0, 7, 0]}>
          <coneGeometry args={[1.7, 1.2, 20]} />
          <meshStandardMaterial color="#54627a" metalness={0.6} roughness={0.45} />
        </mesh>
      </group>
      {/* 烟囱 + 烟气 */}
      <group position={[13, 0, -3.5]}>
        <mesh position={[0, 5.5, 0]}>
          <cylinderGeometry args={[0.55, 0.75, 11, 14]} />
          <meshStandardMaterial color="#6b7280" metalness={0.4} roughness={0.6} />
        </mesh>
        <group ref={smokeRef} position={[0, 11.2, 0]}>
          {Array.from({ length: 7 }).map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.42, 8, 8]} />
              <meshStandardMaterial color="#cbd5e1" transparent opacity={0.5} />
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
    </group>
  );
}

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
  night = false,
  xray = false,
  onSegmentClick,
}: {
  telemetry: KilnTelemetry;
  showLabels?: boolean;
  /** 夜间模式：暗背景 + 窑体自发光更突出 */
  night?: boolean;
  /** 窑内透视：筒体半透明，露出料床 */
  xray?: boolean;
  onSegmentClick?: (index: number, temp: number) => void;
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
        <KilnHead telemetry={telemetry} />
        <FeedEnd telemetry={telemetry} />
        <GasTrain telemetry={telemetry} />
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
      <OrbitControls
        target={[2, 4, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={12}
        maxDistance={80}
        enableDamping
      />
    </Canvas>
  );
}

export default KilnTwin;
