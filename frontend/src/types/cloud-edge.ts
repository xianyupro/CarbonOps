/**
 * 场景/云边端模块的类型定义。
 * 数据全部来自前端 mock（src/mock/cloud-edge.ts），不依赖后端。
 */

/** 行业分类 */
export type Industry = "钢铁" | "有色" | "石化";

/** 3D 数字孪生几何类型 */
export type TwinType =
  | "blastFurnace" // 高炉
  | "rotaryKiln" // 回转挥发窑
  | "flashFurnace" // 闪速炉
  | "electrolyticCell" // 铝电解槽
  | "crackingFurnace"; // 裂解炉

/** 场景状态 */
export type SceneStatus = "running" | "developing" | "stopped";

/** 场景数字孪生关键运行参数 */
export interface SceneParams {
  kilnTemp: number;
  inletSpeed: number;
  airRatio: number;
  speed: number;
  slagTemp: number;
  exhaustTemp: number;
  fuelFlow: number;
}

/** 场景设备 */
export interface SceneEquipment {
  name: string;
  type: string;
  status: string;
  efficiency: string;
  co2: string;
}

/** 场景 */
export interface Scene {
  id: string;
  name: string;
  industry: Industry;
  icon: string;
  twinType: TwinType;
  desc: string;
  status: SceneStatus;
  reduction: number | null;
  efficiency: number | null;
  devices: number;
  alerts: number;
  location: string;
  co2Daily: string;
  energyRate: string;
  params?: SceneParams;
  equipment?: SceneEquipment[];
}

/** 行业分组 */
export interface IndustryGroup {
  name: Industry;
  label: string;
  icon: string;
  sceneIds: string[];
}

/** ====================================================== */
/** 模型库 — 4 个研究方向 + 模型卡片 */
/** ====================================================== */

export type ResearchDirection = "perception" | "modeling" | "control" | "optimization";

export interface ResearchDirectionInfo {
  id: ResearchDirection;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  subTopics: string[];
  color: string;
  count: number;
  accuracy: number;
}

export type ModelType = "monitoring" | "optimization" | "prediction" | "control";
export type ModelStatus = "active" | "training" | "inactive";

export interface ModelItem {
  id: string;
  name: string;
  researchDirection: ResearchDirection;
  category: string; // 钢铁冶炼 / 有色冶金 / 石化 / 通用
  type: ModelType;
  accuracy: number;
  latency: string;
  version: string;
  status: ModelStatus;
  description: string;
  /** 可选：与研究方向的语义边（用于知识图谱） */
  relations?: string[];
}

/** ====================================================== */
/** 云边端协同 — 边缘节点 / 监测终端 */
/** ====================================================== */

export interface EdgeNode {
  id: string;
  name: string;
  region: string;
  npu: string;
  latency: string;
  power: string;
  status: "online" | "warning" | "offline";
}

export interface MonitorInstrument {
  id: string;
  no: string; // 仪表编号
  point: string; // 监测点位
  reading: string;
  status: "online" | "warning" | "offline";
}

export interface FieldSite {
  id: string;
  name: string;
  icon: string;
  location: string;
  region: string;
  scene: string;
  status: "online" | "warning" | "offline";
  stats: {
    co2Daily: string;
    energyRate: string;
    reductionRate: string;
    sensors: number;
  };
}

/** ====================================================== */
/** 组态画布节点（新增场景向导 Step1）*/
/** ====================================================== */

export type ComposerNodeKind = "model" | "component";

export interface ComposerNode {
  key: string; // 唯一 id
  kind: ComposerNodeKind;
  type: string; // e.g. co2-sensing / sensor / trend-chart
  icon: string;
  label: string;
  category: string; // 感知/建模/控制/优化 or 数据采集/智能模型/可视化/...
  x: number;
  y: number;
}

/** 模型数据迁移配置（新增场景向导 Step3）*/
export interface MigrationConfig {
  dataSource: string;
  dataset: string;
  strategy: string;
  threshold: number;
  exportFormat: string;
  adaptOpt: string;
}
