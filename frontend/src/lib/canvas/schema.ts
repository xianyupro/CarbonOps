/**
 * 组态编辑器 PageConfig Schema 类型定义
 * 对标 Ignition Perspective / Grafana Dashboard 的 JSON 模型
 */

/** 组件类型枚举 */
export type ComponentType =
  | "kpi" // KPI 数值卡片
  | "chart" // 折线/柱状图
  | "gauge" // 仪表盘
  | "alarm" // 告警列表
  | "status" // 状态指示灯
  | "text" // 文本标签
  | "tank" // 储罐（工业矢量）
  | "valve" // 阀门（工业矢量）
  | "pipe" // 管道（工业矢量）
  | "meter" // 工业仪表
  | "model" // 智能模型组件
  | "point"; // 点位实时值（真实数据）

/** 组件分类 */
export type ComponentCategory = "basic" | "chart" | "industrial" | "data" | "model";

/** 数据绑定类型 */
export type BindingKind = "static" | "point" | "expression";

/** 聚合方式 */
export type AggType = "raw" | "avg" | "sum" | "max" | "min";

/** 单个属性的绑定定义 */
export interface BindingDefinition {
  kind: BindingKind;
  /** 静态值（kind=static 时使用） */
  value?: string | number | boolean;
  /** 数据源编码（kind=point 时使用） */
  sourceCode?: string;
  /** 点位名称（kind=point 时使用） */
  point?: string;
  /** 聚合方式 */
  agg?: AggType;
  /** 表达式（kind=expression 时使用） */
  expr?: string;
}

/** 模型绑定（模型组件特有） */
export interface ModelBinding {
  /** 模型 ID */
  modelId: number;
  /** 模型编码 */
  modelCode: string;
  /** 模型版本 */
  versionNo?: string;
  /** 输入参数映射（参数名 → 数据源点位） */
  inputMappings: Record<string, { sourceCode: string; point: string }>;
}

/** 画布配置 */
export interface CanvasConfig {
  background: string;
  theme: "dark" | "light";
  gridSize: number;
}

/** 行业主题模板 */
export interface ThemeTemplate {
  id: string;
  name: string;
  background: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  cardBg: string;
  borderColor: string;
}

/** 内置主题模板 */
export const THEME_TEMPLATES: ThemeTemplate[] = [
  {
    id: "dark-tech",
    name: "暗黑科技",
    background: "#0f172a",
    primaryColor: "#3b82f6",
    accentColor: "#06b6d4",
    textColor: "#e2e8f0",
    cardBg: "#1e293b",
    borderColor: "#334155",
  },
  {
    id: "industrial-green",
    name: "工业绿",
    background: "#0a1f0e",
    primaryColor: "#22c55e",
    accentColor: "#84cc16",
    textColor: "#d1fae5",
    cardBg: "#14321a",
    borderColor: "#1e4d2b",
  },
  {
    id: "energy-orange",
    name: "能源橙",
    background: "#1c1310",
    primaryColor: "#f97316",
    accentColor: "#eab308",
    textColor: "#fed7aa",
    cardBg: "#2a1c14",
    borderColor: "#4a3020",
  },
  {
    id: "carbon-blue",
    name: "碳排蓝",
    background: "#0c1929",
    primaryColor: "#0ea5e9",
    accentColor: "#818cf8",
    textColor: "#bae6fd",
    cardBg: "#162d4a",
    borderColor: "#1e3a5f",
  },
  {
    id: "light-clean",
    name: "简洁浅色",
    background: "#f8fafc",
    primaryColor: "#2563eb",
    accentColor: "#7c3aed",
    textColor: "#1e293b",
    cardBg: "#ffffff",
    borderColor: "#e2e8f0",
  },
];

/** 组件实例 */
export interface ComponentInstance {
  /** 唯一实例 ID */
  id: string;
  /** 组件类型 */
  type: ComponentType;
  /** 显示标题 */
  title: string;
  /** Grid 布局位置 {x, y, w, h} */
  position: { x: number; y: number; w: number; h: number };
  /** 组件属性（类型特定） */
  props: Record<string, unknown>;
  /** 数据绑定映射（属性路径 → 绑定定义） */
  bindings: Record<string, BindingDefinition>;
  /** 模型绑定（仅 type=model 时使用） */
  modelBinding?: ModelBinding;
  /** 是否锁定 */
  locked?: boolean;
  /** 是否可见 */
  visible?: boolean;
  /** 图层名 */
  layer?: string;
}

/** 完整的 PageConfig */
export interface PageConfig {
  version: string;
  layout: "grid";
  canvas: CanvasConfig;
  components: ComponentInstance[];
}

/** 创建空白 PageConfig */
export function createEmptyPageConfig(): PageConfig {
  return {
    version: "2.0",
    layout: "grid",
    canvas: {
      background: "#0f172a",
      theme: "dark",
      gridSize: 8,
    },
    components: [],
  };
}

/** 兼容旧版 pageConfig（seed 数据格式）的转换器 */
export function migratePageConfig(raw: unknown): PageConfig {
  if (raw == null || typeof raw !== "object") return createEmptyPageConfig();
  const rawObj = raw as Record<string, unknown>;
  // 如果已经是 v2 格式
  if (rawObj.version === "2.0" && Array.isArray(rawObj.components)) {
    return raw as PageConfig;
  }
  // 旧格式转换（seed 数据的 components 数组）
  const oldComponents = Array.isArray(rawObj.components) ? rawObj.components : [];
  return {
    version: "2.0",
    layout: "grid",
    canvas: {
      background: (rawObj.style as Record<string, string>)?.background ?? "#0f172a",
      theme: ((rawObj.style as Record<string, string>)?.theme as "dark" | "light") ?? "dark",
      gridSize: 8,
    },
    components: oldComponents.map((c: Record<string, unknown>) => ({
      id: (c.id as string) ?? `comp_${Math.random().toString(36).slice(2, 9)}`,
      type: (c.type as ComponentType) ?? "kpi",
      title: (c.title as string) ?? "未命名组件",
      position: {
        x: (c.position as Record<string, number>)?.x ?? 0,
        y: (c.position as Record<string, number>)?.y ?? 0,
        w: (c.position as Record<string, number>)?.w ?? 4,
        h: (c.position as Record<string, number>)?.h ?? 2,
      },
      props: {},
      bindings: {
        value: {
          kind: "point" as BindingKind,
          sourceCode: (c.binding as Record<string, string>)?.sourceCode,
          point: (c.binding as Record<string, string>)?.point,
        },
      },
    })),
  };
}
