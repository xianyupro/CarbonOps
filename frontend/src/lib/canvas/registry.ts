/**
 * 组态编辑器组件注册表
 * 定义所有可拖拽的组件类型、默认属性、属性面板 Schema
 */
import {
  Gauge,
  BarChart3,
  Bell,
  Activity,
  Type,
  Cylinder,
  ToggleLeft,
  Waves,
  Compass,
  LayoutGrid,
  Brain,
} from "lucide-react";
import type { ComponentCategory, ComponentType } from "./schema";

/** 属性面板字段类型 */
export type PropFieldType =
  | "text"
  | "number"
  | "color"
  | "select"
  | "textarea"
  | "binding";

/** 属性面板字段定义 */
export interface PropField {
  /** 属性路径（props 内的 key） */
  key: string;
  /** 显示名称 */
  label: string;
  /** 字段类型 */
  type: PropFieldType;
  /** select 类型的选项 */
  options?: { label: string; value: string }[];
  /** 默认值 */
  default?: unknown;
  /** 分组 */
  group?: string;
  /** 描述说明 */
  description?: string;
}

/** 组件定义 */
export interface ComponentDefinition {
  /** 组件类型 */
  type: ComponentType;
  /** 分类 */
  category: ComponentCategory;
  /** 显示名称 */
  label: string;
  /** 图标（lucide 组件） */
  icon: React.ElementType;
  /** 描述 */
  description: string;
  /** 默认尺寸 */
  defaultSize: { w: number; h: number };
  /** 默认属性 */
  defaultProps: Record<string, unknown>;
  /** 属性面板 Schema */
  propSchema: PropField[];
}

/** 全局组件注册表 */
export const COMPONENT_REGISTRY: Record<ComponentType, ComponentDefinition> = {
  kpi: {
    type: "kpi",
    category: "data",
    label: "KPI 卡片",
    icon: LayoutGrid,
    description: "实时数值显示卡片，支持单位、趋势箭头",
    defaultSize: { w: 3, h: 2 },
    defaultProps: {
      unit: "",
      decimals: 1,
      color: "#22c55e",
      showTrend: true,
    },
    propSchema: [
      { key: "unit", label: "单位", type: "text", default: "", group: "基础" },
      { key: "decimals", label: "小数位", type: "number", default: 1, group: "基础" },
      { key: "color", label: "数值颜色", type: "color", default: "#22c55e", group: "样式" },
      { key: "showTrend", label: "显示趋势", type: "select", default: "true",
        options: [{ label: "是", value: "true" }, { label: "否", value: "false" }], group: "样式" },
      { key: "value", label: "绑定数据", type: "binding", group: "数据绑定",
        description: "绑定数据源点位，实时显示数值" },
    ],
  },

  chart: {
    type: "chart",
    category: "chart",
    label: "趋势图表",
    icon: BarChart3,
    description: "折线/柱状趋势图，支持多点位叠加",
    defaultSize: { w: 6, h: 4 },
    defaultProps: {
      chartType: "line",
      timeWindow: "1h",
      showLegend: true,
      color: "#3b82f6",
    },
    propSchema: [
      { key: "chartType", label: "图表类型", type: "select", default: "line",
        options: [
          { label: "折线图", value: "line" },
          { label: "柱状图", value: "bar" },
          { label: "面积图", value: "area" },
        ], group: "基础" },
      { key: "timeWindow", label: "时间窗口", type: "select", default: "1h",
        options: [
          { label: "近1小时", value: "1h" },
          { label: "近6小时", value: "6h" },
          { label: "近24小时", value: "24h" },
          { label: "近7天", value: "7d" },
        ], group: "基础" },
      { key: "showLegend", label: "显示图例", type: "select", default: "true",
        options: [{ label: "是", value: "true" }, { label: "否", value: "false" }], group: "样式" },
      { key: "color", label: "线条颜色", type: "color", default: "#3b82f6", group: "样式" },
      { key: "value", label: "绑定数据", type: "binding", group: "数据绑定",
        description: "绑定数据源点位，展示历史趋势" },
    ],
  },

  gauge: {
    type: "gauge",
    category: "chart",
    label: "仪表盘",
    icon: Gauge,
    description: "圆形仪表盘，支持量程和阈值色带",
    defaultSize: { w: 3, h: 3 },
    defaultProps: {
      min: 0,
      max: 100,
      unit: "%",
      thresholds: "60,85",
    },
    propSchema: [
      { key: "min", label: "最小值", type: "number", default: 0, group: "基础" },
      { key: "max", label: "最大值", type: "number", default: 100, group: "基础" },
      { key: "unit", label: "单位", type: "text", default: "%", group: "基础" },
      { key: "thresholds", label: "阈值色带", type: "text", default: "60,85", group: "样式",
        description: "逗号分隔，如 60,85 表示三段色带" },
      { key: "value", label: "绑定数据", type: "binding", group: "数据绑定",
        description: "绑定数据源点位，驱动仪表指针" },
    ],
  },

  alarm: {
    type: "alarm",
    category: "data",
    label: "告警列表",
    icon: Bell,
    description: "实时告警列表，按级别着色",
    defaultSize: { w: 6, h: 4 },
    defaultProps: {
      maxItems: 10,
      filterLevel: "all",
    },
    propSchema: [
      { key: "maxItems", label: "最大条数", type: "number", default: 10, group: "基础" },
      { key: "filterLevel", label: "级别筛选", type: "select", default: "all",
        options: [
          { label: "全部", value: "all" },
          { label: "仅严重", value: "CRITICAL" },
          { label: "严重+警告", value: "WARN" },
        ], group: "基础" },
    ],
  },

  status: {
    type: "status",
    category: "basic",
    label: "状态指示灯",
    icon: Activity,
    description: "布尔状态指示灯，绿/红切换",
    defaultSize: { w: 2, h: 2 },
    defaultProps: {
      onColor: "#22c55e",
      offColor: "#ef4444",
      label: "运行状态",
    },
    propSchema: [
      { key: "label", label: "标签", type: "text", default: "运行状态", group: "基础" },
      { key: "onColor", label: "亮灯颜色", type: "color", default: "#22c55e", group: "样式" },
      { key: "offColor", label: "灭灯颜色", type: "color", default: "#ef4444", group: "样式" },
      { key: "value", label: "绑定数据", type: "binding", group: "数据绑定",
        description: "绑定布尔点位，控制指示灯亮灭" },
    ],
  },

  text: {
    type: "text",
    category: "basic",
    label: "文本标签",
    icon: Type,
    description: "静态或动态文本标签",
    defaultSize: { w: 3, h: 1 },
    defaultProps: {
      text: "双击编辑文本",
      fontSize: 14,
      color: "#e2e8f0",
      bold: false,
    },
    propSchema: [
      { key: "text", label: "文本内容", type: "text", default: "双击编辑文本", group: "基础" },
      { key: "fontSize", label: "字号", type: "number", default: 14, group: "样式" },
      { key: "color", label: "颜色", type: "color", default: "#e2e8f0", group: "样式" },
      { key: "bold", label: "加粗", type: "select", default: "false",
        options: [{ label: "是", value: "true" }, { label: "否", value: "false" }], group: "样式" },
    ],
  },

  tank: {
    type: "tank",
    category: "industrial",
    label: "储罐",
    icon: Cylinder,
    description: "工业储罐液位动画控件",
    defaultSize: { w: 2, h: 4 },
    defaultProps: {
      fillColor: "#3b82f6",
      maxLevel: 100,
      label: "储罐",
    },
    propSchema: [
      { key: "label", label: "标签", type: "text", default: "储罐", group: "基础" },
      { key: "maxLevel", label: "满量程", type: "number", default: 100, group: "基础" },
      { key: "fillColor", label: "填充色", type: "color", default: "#3b82f6", group: "样式" },
      { key: "value", label: "绑定数据", type: "binding", group: "数据绑定",
        description: "绑定液位点位，驱动填充高度" },
    ],
  },

  valve: {
    type: "valve",
    category: "industrial",
    label: "阀门",
    icon: ToggleLeft,
    description: "工业阀门状态控件",
    defaultSize: { w: 2, h: 2 },
    defaultProps: {
      onColor: "#22c55e",
      offColor: "#64748b",
      label: "阀门",
    },
    propSchema: [
      { key: "label", label: "标签", type: "text", default: "阀门", group: "基础" },
      { key: "onColor", label: "开启颜色", type: "color", default: "#22c55e", group: "样式" },
      { key: "offColor", label: "关闭颜色", type: "color", default: "#64748b", group: "样式" },
      { key: "value", label: "绑定数据", type: "binding", group: "数据绑定" },
    ],
  },

  pipe: {
    type: "pipe",
    category: "industrial",
    label: "管道",
    icon: Waves,
    description: "工业管道流向控件",
    defaultSize: { w: 4, h: 1 },
    defaultProps: {
      color: "#475569",
      flowColor: "#06b6d4",
      animated: true,
    },
    propSchema: [
      { key: "color", label: "管道颜色", type: "color", default: "#475569", group: "样式" },
      { key: "flowColor", label: "流体颜色", type: "color", default: "#06b6d4", group: "样式" },
      { key: "animated", label: "流动动画", type: "select", default: "true",
        options: [{ label: "是", value: "true" }, { label: "否", value: "false" }], group: "样式" },
    ],
  },

  meter: {
    type: "meter",
    category: "industrial",
    label: "工业仪表",
    icon: Compass,
    description: "工业圆形仪表表盘",
    defaultSize: { w: 2, h: 3 },
    defaultProps: {
      min: 0,
      max: 100,
      unit: "",
      label: "压力",
    },
    propSchema: [
      { key: "label", label: "标签", type: "text", default: "压力", group: "基础" },
      { key: "min", label: "最小值", type: "number", default: 0, group: "基础" },
      { key: "max", label: "最大值", type: "number", default: 100, group: "基础" },
      { key: "unit", label: "单位", type: "text", default: "", group: "基础" },
      { key: "value", label: "绑定数据", type: "binding", group: "数据绑定" },
    ],
  },

  model: {
    type: "model",
    category: "model",
    label: "智能模型",
    icon: Brain,
    description: "从模型库选择已上线模型，拖入画布进行推理调控",
    defaultSize: { w: 4, h: 3 },
    defaultProps: {
      showInput: true,
      showOutput: true,
      autoRun: true,
    },
    propSchema: [
      { key: "showInput", label: "显示输入", type: "select", default: "true",
        options: [{ label: "是", value: "true" }, { label: "否", value: "false" }], group: "基础" },
      { key: "showOutput", label: "显示输出", type: "select", default: "true",
        options: [{ label: "是", value: "true" }, { label: "否", value: "false" }], group: "基础" },
      { key: "autoRun", label: "自动运行", type: "select", default: "true",
        options: [{ label: "是", value: "true" }, { label: "否", value: "false" }], group: "基础" },
    ],
  },
};

/** 按分类获取组件列表 */
export function getComponentsByCategory(): {
  category: ComponentCategory;
  label: string;
  items: ComponentDefinition[];
}[] {
  const categoryLabels: Record<ComponentCategory, string> = {
    basic: "基础控件",
    chart: "图表组件",
    data: "数据组件",
    industrial: "工业控件",
    model: "智能模型",
  };
  const groups: Record<ComponentCategory, ComponentDefinition[]> = {
    basic: [],
    chart: [],
    data: [],
    industrial: [],
    model: [],
  };
  Object.values(COMPONENT_REGISTRY).forEach((def) => {
    groups[def.category].push(def);
  });
  return (Object.keys(groups) as ComponentCategory[])
    .map((cat) => ({
      category: cat,
      label: categoryLabels[cat],
      items: groups[cat],
    }))
    .filter((g) => g.items.length > 0);
}

/** 获取组件定义 */
export function getComponentDef(type: ComponentType): ComponentDefinition {
  return COMPONENT_REGISTRY[type] ?? COMPONENT_REGISTRY.kpi;
}
