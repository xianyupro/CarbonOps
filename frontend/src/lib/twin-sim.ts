/**
 * 数字孪生模拟数据引擎（演示模式）。
 *
 * 现场数据为历史快照、/data/latest 恒定时，开启「模拟演示」由本引擎按秒生成
 * 逼真的实时波动：每个维度围绕现场观测基准值做 OU 随机游走 + 多周期正弦耦合，
 * 温度场曲线附加行波扰动与峰值游走。仅用于演示，不写回数据基座。
 */

import type { KilnTelemetry } from "@/components/cockpit/kiln-twin";

type Num = number | null;

/** 各维度基准值（取自 1 号挥发窑现场数据观测均值）与波动参数 */
interface DimSpec {
  base: number;
  wander: number; // 慢漂移幅度
  noise: number; // 每秒快噪声
  sineAmp?: number; // 正弦摆幅
  sineSpeed?: number; // 正弦角速度 rad/s
  digits: number;
}

const SPEC: Record<Exclude<keyof KilnTelemetry, "tempField">, DimSpec> = {
  tailTemp: { base: 592.6, wander: 5, noise: 1.1, sineAmp: 3.2, sineSpeed: 0.11, digits: 1 },
  headTemp: { base: 342.8, wander: 4, noise: 0.9, sineAmp: 2.4, sineSpeed: 0.09, digits: 1 },
  headTempLower: { base: 570.2, wander: 4.5, noise: 1.0, sineAmp: 2.6, sineSpeed: 0.08, digits: 1 },
  feedFreq: { base: 10.5, wander: 0.45, noise: 0.12, sineAmp: 0.3, sineSpeed: 0.14, digits: 2 },
  motorFreq: { base: 18.1, wander: 0.25, noise: 0.06, sineAmp: 0.16, sineSpeed: 0.1, digits: 2 },
  co: { base: 0.016, wander: 0.004, noise: 0.0012, sineAmp: 0.002, sineSpeed: 0.2, digits: 3 },
  boilerPressure: { base: 1.18, wander: 0.055, noise: 0.014, sineAmp: 0.04, sineSpeed: 0.12, digits: 2 },
  fanValve: { base: 39.7, wander: 1.8, noise: 0.4, sineAmp: 1.2, sineSpeed: 0.09, digits: 1 },
  drumLevel: { base: 42.9, wander: 2.4, noise: 0.5, sineAmp: 1.6, sineSpeed: 0.07, digits: 1 },
  drum2Level: { base: 45.2, wander: 2.4, noise: 0.5, sineAmp: 1.5, sineSpeed: 0.06, digits: 1 },
  drum3Level: { base: 47.9, wander: 2.4, noise: 0.5, sineAmp: 1.5, sineSpeed: 0.06, digits: 1 },
  roofLevel: { base: -8.5, wander: 1.3, noise: 0.25, sineAmp: 0.8, sineSpeed: 0.05, digits: 1 },
  feedCurrent: { base: 3.75, wander: 0.18, noise: 0.05, sineAmp: 0.12, sineSpeed: 0.13, digits: 2 },
  motorCurrent: { base: 260.2, wander: 9, noise: 2.2, sineAmp: 6, sineSpeed: 0.1, digits: 1 },
  airPress: { base: 42.2, wander: 0.9, noise: 0.22, sineAmp: 0.6, sineSpeed: 0.11, digits: 2 },
  airFlow: { base: -8.5, wander: 0.5, noise: 0.12, sineAmp: 0.35, sineSpeed: 0.12, digits: 2 },
  whInPress: { base: 18.7, wander: 0.7, noise: 0.16, sineAmp: 0.5, sineSpeed: 0.1, digits: 2 },
  whOutPress: { base: -10.4, wander: 0.4, noise: 0.1, sineAmp: 0.3, sineSpeed: 0.1, digits: 2 },
  whInTemp: { base: 583.4, wander: 4, noise: 0.9, sineAmp: 2.8, sineSpeed: 0.1, digits: 1 },
  espInTemp: { base: 271.3, wander: 3, noise: 0.7, sineAmp: 2, sineSpeed: 0.09, digits: 1 },
  espOutPress: { base: -252, wander: 8, noise: 1.8, sineAmp: 5.5, sineSpeed: 0.1, digits: 1 },
  fanOutPress: { base: 487.5, wander: 9, noise: 2, sineAmp: 6, sineSpeed: 0.1, digits: 1 },
  fanOutTemp: { base: 316.3, wander: 2.5, noise: 0.6, sineAmp: 1.8, sineSpeed: 0.09, digits: 1 },
};

type NumField = Exclude<keyof KilnTelemetry, "tempField">;
type SimValues = Record<NumField, number>;

/** 高斯噪声（两均匀叠加近似） */
function gauss(scale: number): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) * scale;
}

/** 合成温度场曲线：钟形焙烧带 + 峰值游走 + 幅值呼吸 + 逐点微噪 */
function synthTempField(t: number, tailTemp: number): [number, number][] {
  const pts: [number, number][] = [];
  const peakPos = 0.45 + 0.06 * Math.sin(t * 0.045);
  const peakTemp = 1150 + 75 * Math.sin(t * 0.06);
  for (let i = 0; i <= 23; i++) {
    const pos = i / 23;
    const d = (pos - peakPos) / 0.2;
    const bell = Math.exp(-(d * d) / 2);
    const temp =
      tailTemp + (peakTemp - tailTemp) * bell + gauss(4) + 6 * Math.sin(t * 0.5 + i * 0.8);
    pts.push([Math.round(pos * 68 * 10) / 10, Math.round(temp * 10) / 10]);
  }
  return pts;
}

export class TwinSimulator {
  private t = 0;
  private values: Record<NumField, number>;
  /** CO 偶发尖峰剩余秒数 */
  private spikeLeft = 0;

  constructor() {
    this.values = {} as Record<NumField, number>;
    for (const [k, spec] of Object.entries(SPEC)) {
      this.values[k as NumField] = spec.base;
    }
  }

  /** 重置到基准 */
  reset(): void {
    this.t = 0;
    for (const [k, spec] of Object.entries(SPEC)) {
      this.values[k as NumField] = spec.base;
    }
  }

  /** 推进 dt 秒，返回全量遥测（含合成温度场） */
  tick(dt = 1): KilnTelemetry {
    this.t += dt;
    // CO 偶发尖峰调度
    if (this.spikeLeft <= 0 && Math.random() < 0.004) this.spikeLeft = 6 + Math.random() * 8;
    if (this.spikeLeft > 0) this.spikeLeft -= dt;

    const out = {} as Record<NumField, number>;
    for (const [k, spec] of Object.entries(SPEC)) {
      const field = k as NumField;
      const sine =
        (spec.sineAmp ?? 0) * Math.sin(this.t * (spec.sineSpeed ?? 0.1) + spec.base);
      const target = spec.base + sine;
      // OU 向目标收敛 + 快噪声
      let v =
        this.values[field] +
        (target - this.values[field]) * 0.12 +
        gauss(spec.noise) * 0.6;
      if (field === "co" && this.spikeLeft > 0) {
        v = spec.base * (2.4 + Math.random() * 1.2); // 燃烧不完全尖峰
      }
      this.values[field] = v;
      out[field] = Number(v.toFixed(spec.digits));
    }

    return {
      ...out,
      tempField: synthTempField(this.t, out.tailTemp),
    } as KilnTelemetry;
  }
}
