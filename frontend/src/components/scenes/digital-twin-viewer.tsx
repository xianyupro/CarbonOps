"use client";

/**
 * 场景详情 — 3D 数字孪生查看器。
 * 使用 @react-three/fiber + drei 渲染不同装备的几何模型（高炉/回转窑/闪速炉/电解槽/裂解炉），
 * 支持鼠标旋转/缩放/平移、自动旋转、视角重置、热点标注。
 *
 * 客户端 only：three.js 依赖浏览器环境。
 */
import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Box, Loader2, RotateCw, ZoomIn } from "lucide-react";
import type { Scene, TwinType } from "@/types/cloud-edge";

interface Props {
  scene: Scene;
}

/* ---------------- 模型组件 ---------------- */

/** 高炉：圆柱炉身 + 锥形炉喉 + 底座 */
function BlastFurnaceModel() {
  return (
    <group position={[0, 0, 0]}>
      {/* 底座 */}
      <mesh position={[0, -1.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.2, 0.6, 32]} />
        <meshStandardMaterial color="#1f2937" roughness={0.5} />
      </mesh>
      {/* 炉身（主）*/}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.7, 1.0, 1.8, 32]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* 炉喉（锥形）*/}
      <mesh position={[0, 1.5, 0]} castShadow>
        <coneGeometry args={[0.7, 0.6, 32]} />
        <meshStandardMaterial color="#ef4444" roughness={0.5} />
      </mesh>
      {/* 顶盖 */}
      <mesh position={[0, 1.9, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.1, 32]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.3} />
      </mesh>
      {/* 喷煤管（左侧）*/}
      <mesh position={[-1.0, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.6, 16]} />
        <meshStandardMaterial color="#52525b" />
      </mesh>
      {/* 出铁口（前面）*/}
      <mesh position={[0, -1.0, 0.7]} castShadow>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

/** 回转挥发窑：倾斜圆柱 + 支撑 */
function RotaryKilnModel() {
  return (
    <group rotation={[0, 0, Math.PI / 12]}>
      {/* 窑体（倾斜圆柱）*/}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 3.6, 32]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* 窑头（球形）*/}
      <mesh position={[1.9, 0, 0]} castShadow>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} />
      </mesh>
      {/* 窑尾（球形）*/}
      <mesh position={[-1.9, 0, 0]} castShadow>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial color="#ea580c" roughness={0.3} />
      </mesh>
      {/* 支撑环 1 */}
      <mesh position={[1.0, -0.7, 0]} castShadow>
        <torusGeometry args={[0.55, 0.06, 16, 24]} />
        <meshStandardMaterial color="#52525b" />
      </mesh>
      <mesh position={[-1.0, -0.7, 0]} castShadow>
        <torusGeometry args={[0.55, 0.06, 16, 24]} />
        <meshStandardMaterial color="#52525b" />
      </mesh>
      {/* 底座支架 */}
      <mesh position={[0, -1.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.0, 0.1, 1.0]} />
        <meshStandardMaterial color="#27272a" />
      </mesh>
    </group>
  );
}

/** 闪速炉：垂直圆柱 + 顶部锥 + 旁路管道 */
function FlashFurnaceModel() {
  return (
    <group>
      {/* 主体圆柱 */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.9, 2.0, 32]} />
        <meshStandardMaterial color="#0e7490" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* 顶部圆顶 */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#06b6d4" roughness={0.3} />
      </mesh>
      {/* 旁通管（左侧）*/}
      <mesh position={[-1.0, 0.8, 0]} rotation={[0, 0, Math.PI / 2.5]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.8, 16]} />
        <meshStandardMaterial color="#52525b" />
      </mesh>
      {/* 反应塔 */}
      <mesh position={[0.4, 2.1, 0]} castShadow>
        <coneGeometry args={[0.3, 0.6, 24]} />
        <meshStandardMaterial color="#22d3ee" />
      </mesh>
      {/* 底座 */}
      <mesh position={[0, -0.7, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.0, 0.2, 32]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* 火焰锥（内部辉光）*/}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 1.6, 24]} />
        <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={0.6} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/** 电解槽：长方体阵列 + 顶部母线 */
function ElectrolyticCellModel() {
  return (
    <group>
      {/* 槽列（5 个）*/}
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.85, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 1.4, 1.2]} />
          <meshStandardMaterial color="#3b3f46" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      {/* 顶部阳极棒 */}
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={`a-${i}`} position={[i * 0.85, 0.85, 0]}>
          <boxGeometry args={[0.6, 0.06, 1.1]} />
          <meshStandardMaterial color="#71717a" />
        </mesh>
      ))}
      {/* 母线 */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[5.0, 0.04, 0.12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#fbbf24" emissiveIntensity={0.4} />
      </mesh>
      {/* 底座 */}
      <mesh position={[0, -0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 0.1, 1.6]} />
        <meshStandardMaterial color="#27272a" />
      </mesh>
      {/* 底部辉光（电弧）*/}
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={`g-${i}`} position={[i * 0.85, 0.0, 0]}>
          <boxGeometry args={[0.5, 1.0, 0.9]} />
          <meshStandardMaterial color="#fcd34d" emissive="#facc15" emissiveIntensity={0.5} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** 裂解炉：长方体炉体 + 阵列炉管 + 顶部烟囱 */
function CrackingFurnaceModel() {
  return (
    <group>
      {/* 炉体 */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[3.0, 1.8, 1.0]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
      {/* 炉管阵列（6 列）*/}
      {[-1.2, -0.7, -0.2, 0.3, 0.8, 1.3].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.6, 16]} />
          <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={0.7} />
        </mesh>
      ))}
      {/* 顶部 */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[3.2, 0.15, 1.1]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {/* 烟囱 */}
      <mesh position={[1.2, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.9, 16]} />
        <meshStandardMaterial color="#52525b" />
      </mesh>
      {/* 底座 */}
      <mesh position={[0, -1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 0.1, 1.4]} />
        <meshStandardMaterial color="#27272a" />
      </mesh>
      {/* 火焰辉光 */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.8, 1.6, 0.9]} />
        <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={0.4} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/** 渲染不同 twinType */
function ModelByType({ twinType }: { twinType: TwinType }) {
  switch (twinType) {
    case "blastFurnace":
      return <BlastFurnaceModel />;
    case "rotaryKiln":
      return <RotaryKilnModel />;
    case "flashFurnace":
      return <FlashFurnaceModel />;
    case "electrolyticCell":
      return <ElectrolyticCellModel />;
    case "crackingFurnace":
      return <CrackingFurnaceModel />;
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

/* ---------------- 热点标注 ---------------- */

interface Hotspot {
  position: [number, number, number];
  label: string;
  value: string;
  color: string;
}

const HOTSPOTS_BY_TYPE: Record<TwinType, Hotspot[]> = {
  blastFurnace: [
    { position: [0.0, 1.6, 0.5], label: "炉顶温度", value: "285 ℃", color: "#ef4444" },
    { position: [0.0, 0.0, 1.0], label: "炉腹 CO₂", value: "32.4%", color: "#f59e0b" },
    { position: [0.0, -1.2, 0.5], label: "出铁温度", value: "1480 ℃", color: "#facc15" },
    { position: [-1.1, 0.5, 0.0], label: "喷煤量", value: "12.5 t/h", color: "#10b981" },
  ],
  rotaryKiln: [
    { position: [0.0, 0.5, 0.5], label: "窑中温度", value: "1250 ℃", color: "#ef4444" },
    { position: [-1.9, 0.5, 0.0], label: "窑尾 O₂", value: "3.2%", color: "#f59e0b" },
    { position: [1.9, 0.5, 0.0], label: "窑头 CO", value: "1.8%", color: "#10b981" },
    { position: [0.0, -1.0, 0.0], label: "窑速", value: "82 rpm", color: "#3b82f6" },
  ],
  flashFurnace: [
    { position: [0.0, 1.6, 0.0], label: "反应塔顶", value: "1380 ℃", color: "#ef4444" },
    { position: [0.0, 0.4, 0.9], label: "富氧浓度", value: "78%", color: "#f59e0b" },
    { position: [-1.0, 0.8, 0.0], label: "旁通烟气", value: "920 ppm", color: "#10b981" },
    { position: [0.0, -0.5, 0.0], label: "熔池", value: "稳定", color: "#3b82f6" },
  ],
  electrolyticCell: [
    { position: [-1.7, 0.5, 0.5], label: "1#槽电压", value: "4.05 V", color: "#ef4444" },
    { position: [0.0, 0.5, 0.5], label: "3#槽电压", value: "4.08 V", color: "#f59e0b" },
    { position: [1.7, 0.5, 0.5], label: "5#槽电压", value: "4.11 V", color: "#10b981" },
    { position: [0.0, -0.7, 0.0], label: "阳极 CO₂", value: "12.3 t/h", color: "#3b82f6" },
  ],
  crackingFurnace: [
    { position: [-1.0, 0.5, 0.6], label: "1#炉管", value: "985 ℃", color: "#ef4444" },
    { position: [0.0, 0.5, 0.6], label: "3#炉管", value: "1010 ℃", color: "#f59e0b" },
    { position: [1.2, 1.0, 0.0], label: "烟气出口", value: "320 ℃", color: "#10b981" },
    { position: [0.0, -0.5, 0.6], label: "进料", value: "12.5 t/h", color: "#3b82f6" },
  ],
};

/* ---------------- 主组件 ---------------- */

export function DigitalTwinViewer({ scene }: Props) {
  const [autoRotate, setAutoRotate] = React.useState(true);
  const [resetKey, setResetKey] = React.useState(0);
  const [isReady, setReady] = React.useState(false);
  const hotspots = HOTSPOTS_BY_TYPE[scene.twinType];

  return (
    <div className="relative h-[460px] w-full overflow-hidden rounded-lg border border-border/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 加载提示 */}
      {!isReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 text-slate-200">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm">加载 3D 数字孪生模型…</span>
        </div>
      )}

      {/* 顶部标签 */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200 backdrop-blur">
        <Box className="h-3.5 w-3.5 text-emerald-400" />
        <span>3D 数字孪生</span>
        <span className="text-slate-500">·</span>
        <span>{scene.name}</span>
      </div>

      {/* 控制按钮 */}
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-slate-200 backdrop-blur transition hover:bg-slate-800"
          onClick={() => setResetKey((k) => k + 1)}
          title="重置视角"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition ${
            autoRotate ? "bg-emerald-500 text-white" : "bg-slate-900/70 text-slate-200 hover:bg-slate-800"
          }`}
          onClick={() => setAutoRotate((v) => !v)}
          title="自动旋转"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-3 rounded-lg bg-slate-900/70 px-3 py-2 text-[11px] text-slate-200 backdrop-blur">
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
        camera={{ position: [6, 4, 6], fov: 45 }}
        onCreated={() => setReady(true)}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-5, 3, -3]} intensity={0.4} color="#22d3ee" />
        <AutoRotate enabled={autoRotate}>
          <ModelByType twinType={scene.twinType} />
          {hotspots.map((h, i) => (
            <Html
              key={i}
              position={h.position}
              center
              distanceFactor={6}
              style={{ pointerEvents: "none" }}
            >
              <div className="select-none whitespace-nowrap rounded-md border border-slate-700 bg-slate-900/95 px-2 py-1 text-[10px] text-slate-100 shadow-lg backdrop-blur">
                <div className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: h.color, boxShadow: `0 0 6px ${h.color}` }}
                  />
                  <span className="text-slate-300">{h.label}</span>
                </div>
                <div className="font-mono text-[11px] font-semibold text-white">{h.value}</div>
              </div>
            </Html>
          ))}
        </AutoRotate>
        <Environment preset="warehouse" />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          autoRotate={false}
          minDistance={3}
          maxDistance={20}
        />
        {/* 网格地面 */}
        <gridHelper args={[20, 20, "#cbd5e1", "#e2e8f0"]} position={[0, -1.6, 0]} />
      </Canvas>

      {/* 底部说明 */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 text-[10px] text-slate-500">
        🖱 左拖旋转 · 右键拖移 · 滚轮缩放
      </div>
    </div>
  );
}

export default DigitalTwinViewer;
