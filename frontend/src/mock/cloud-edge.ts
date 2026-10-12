/**
 * 场景/云边端模块 mock 数据。
 * 结构与 demo_v2/offline/js/app.js 保持一致，确保与客户原意对齐。
 */
import type {
  Scene,
  IndustryGroup,
  ResearchDirectionInfo,
  ModelItem,
  EdgeNode,
  MonitorInstrument,
  FieldSite,
} from "@/types/cloud-edge";

/* ============================== 场景 ============================== */

export const SCENES: Scene[] = [
  {
    id: "steel",
    name: "钢铁高炉炼铁",
    industry: "钢铁",
    icon: "🏭",
    twinType: "blastFurnace",
    desc: "高炉炼铁过程碳素流优化与能耗监测——针对碳流转机制复杂、运行工况动态特性认知难",
    status: "running",
    reduction: 20.1,
    efficiency: 91.5,
    devices: 18,
    alerts: 2,
    location: "华北区域",
    co2Daily: "35.2 t",
    energyRate: "78.3%",
    params: {
      kilnTemp: 1550,
      inletSpeed: 6.8,
      airRatio: 0.78,
      speed: 65,
      slagTemp: 1400,
      exhaustTemp: 620,
      fuelFlow: 12.5,
    },
    equipment: [
      { name: "高炉主体", type: "核心设备", status: "运行正常", efficiency: "92.8%", co2: "18.5 t/h" },
      { name: "热风炉", type: "供风设备", status: "需关注", efficiency: "86.3%", co2: "5.2 t/h" },
      { name: "喷煤系统", type: "燃料设备", status: "运行正常", efficiency: "93.1%", co2: "8.1 t/h" },
      { name: "TRT发电", type: "回收设备", status: "需关注", efficiency: "82.5%", co2: "0 t/h" },
      { name: "除尘系统", type: "环保设备", status: "运行正常", efficiency: "97.2%", co2: "-" },
    ],
  },
  {
    id: "zinc",
    name: "锌冶炼回转挥发窑",
    industry: "有色",
    icon: "⚗",
    twinType: "rotaryKiln",
    desc: "基于数字孪生的回转窑全工况碳排放实时监测与优化控制",
    status: "running",
    reduction: 22.5,
    efficiency: 94.8,
    devices: 12,
    alerts: 1,
    location: "西南区域",
    co2Daily: "12.8 t",
    energyRate: "86.5%",
    params: {
      kilnTemp: 1250,
      inletSpeed: 3.2,
      airRatio: 0.85,
      speed: 82,
      slagTemp: 980,
      exhaustTemp: 420,
      fuelFlow: 2.4,
    },
    equipment: [
      { name: "回转窑主体", type: "核心设备", status: "运行正常", efficiency: "96.2%", co2: "4.2 t/h" },
      { name: "鼓风管系统", type: "辅助设备", status: "运行正常", efficiency: "93.5%", co2: "1.8 t/h" },
      { name: "下料装置", type: "进料设备", status: "需关注", efficiency: "88.1%", co2: "0.6 t/h" },
      { name: "温度传感器组", type: "监测设备", status: "运行正常", efficiency: "99.9%", co2: "-" },
      { name: "窑渣出口", type: "出口设备", status: "运行正常", efficiency: "94.0%", co2: "5.8 t/h" },
    ],
  },
  {
    id: "copper",
    name: "铜冶炼闪速炉",
    industry: "有色",
    icon: "🔥",
    twinType: "flashFurnace",
    desc: "闪速熔炼过程碳排放监测与富氧浓度优化控制——实现高碳排工序全工况智能表征",
    status: "running",
    reduction: 19.8,
    efficiency: 96.2,
    devices: 14,
    alerts: 0,
    location: "华东区域",
    co2Daily: "18.5 t",
    energyRate: "92.1%",
    params: {
      kilnTemp: 1350,
      inletSpeed: 4.5,
      airRatio: 0.92,
      speed: 75,
      slagTemp: 1150,
      exhaustTemp: 520,
      fuelFlow: 3.8,
    },
    equipment: [
      { name: "闪速炉主体", type: "核心设备", status: "运行正常", efficiency: "97.1%", co2: "8.5 t/h" },
      { name: "富氧系统", type: "供气设备", status: "运行正常", efficiency: "95.8%", co2: "3.2 t/h" },
      { name: "精矿喷嘴", type: "进料设备", status: "运行正常", efficiency: "96.5%", co2: "1.2 t/h" },
      { name: "余热锅炉", type: "回收设备", status: "运行正常", efficiency: "91.2%", co2: "0 t/h" },
    ],
  },
  {
    id: "aluminum",
    name: "铝电解槽",
    industry: "有色",
    icon: "⚡",
    twinType: "electrolyticCell",
    desc: "铝电解过程碳排全生命周期追踪与多目标优化——针对生产全流程碳流转拓扑复杂",
    status: "developing",
    reduction: 14.5,
    efficiency: null,
    devices: 8,
    alerts: 0,
    location: "西北区域",
    co2Daily: "22.4 t",
    energyRate: "71.2%",
  },
  {
    id: "chemical",
    name: "化工裂解炉",
    industry: "石化",
    icon: "⚗",
    twinType: "crackingFurnace",
    desc: "裂解过程碳排放精准监测与能质耦合优化——针对流程生产装备碳耗跨时空关联",
    status: "developing",
    reduction: null,
    efficiency: null,
    devices: 6,
    alerts: 0,
    location: "华东区域",
    co2Daily: "--",
    energyRate: "--",
  },
];

export const INDUSTRY_GROUPS: IndustryGroup[] = [
  { name: "钢铁", label: "钢铁行业", icon: "🏭", sceneIds: ["steel"] },
  { name: "有色", label: "有色行业", icon: "⚡", sceneIds: ["zinc", "copper", "aluminum"] },
  { name: "石化", label: "石油化工", icon: "⚗", sceneIds: ["chemical"] },
];

export function getSceneById(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

/* ============================== 研究方向与模型库 ============================== */

export const RESEARCH_DIRECTIONS: ResearchDirectionInfo[] = [
  {
    id: "perception",
    name: "碳排放智能感知与动态监测",
    shortName: "智能感知",
    icon: "👁",
    description: "宽量程传感、多维度感知网络、碳排体数据求解与动态监测",
    subTopics: ["宽量程传感", "多维度感知网络", "碳排体数据求解", "动态监测"],
    color: "#0d9488",
    count: 42,
    accuracy: 96.5,
  },
  {
    id: "modeling",
    name: "碳流转建模与态势认知",
    shortName: "态势认知",
    icon: "🧠",
    description: "微观级碳分布、多尺度碳流转、全流程建模与碳足迹追踪",
    subTopics: ["微观级碳分布", "多尺度碳流转", "全流程建模", "碳足迹追踪"],
    color: "#7c3aed",
    count: 38,
    accuracy: 94.2,
  },
  {
    id: "control",
    name: "低碳运行精准控制",
    shortName: "精准控制",
    icon: "🎯",
    description: "全工况表征、窄域精准控制、工况在线识别与控制器切换",
    subTopics: ["全工况表征", "窄域精准控制", "工况在线识别", "控制器切换"],
    color: "#f59e0b",
    count: 45,
    accuracy: 92.8,
  },
  {
    id: "optimization",
    name: "全流程协同优化",
    shortName: "协同优化",
    icon: "⚡",
    description: "级联装备优化、工序工艺协调、碳素流优化与多目标动态优化",
    subTopics: ["级联装备优化", "工序工艺协调", "碳素流优化", "多目标动态优化"],
    color: "#10b981",
    count: 31,
    accuracy: 91.5,
  },
];

export const MODEL_TYPE_LABELS: Record<string, string> = {
  monitoring: "监测",
  optimization: "优化",
  prediction: "预测",
  control: "控制",
};

export const MODEL_TYPE_COLORS: Record<string, string> = {
  monitoring: "#0d9488",
  optimization: "#10b981",
  prediction: "#7c3aed",
  control: "#f59e0b",
};

export const MODEL_STATUS_LABELS: Record<string, string> = {
  active: "运行中",
  training: "训练中",
  inactive: "已停止",
};

export const ALL_MODELS: ModelItem[] = [
  // 感知 6 个
  { id: "P001", name: "光声电互标定宽量程传感模型", researchDirection: "perception", category: "钢铁冶炼", type: "monitoring", accuracy: 94.5, latency: "12ms", version: "v2.3.1", status: "active", description: "基于光声电多物理场互标定技术，实现宽量程高精度碳排放浓度实时传感检测" },
  { id: "P002", name: "微弱碳排信号浓度特征描述模型", researchDirection: "perception", category: "石化", type: "monitoring", accuracy: 92.8, latency: "18ms", version: "v1.8.0", status: "active", description: "针对复杂工业背景下微弱碳排信号，提取浓度特征描述子实现高灵敏度检测" },
  { id: "P003", name: "传感器温敏群组优化部署模型", researchDirection: "perception", category: "有色冶金", type: "optimization", accuracy: 91.3, latency: "8ms", version: "v2.0.2", status: "active", description: "基于温敏特性与群组协同的传感器网络优化部署策略，最大化监测覆盖率" },
  { id: "P004", name: "气体逸散建模与感知网络模型", researchDirection: "perception", category: "通用", type: "prediction", accuracy: 89.7, latency: "22ms", version: "v1.5.3", status: "training", description: "构建工业场景气体逸散扩散模型，结合多维度感知网络实现逸散源定位与量化" },
  { id: "P005", name: "碳排体数据真值高效求解模型", researchDirection: "perception", category: "钢铁冶炼", type: "prediction", accuracy: 93.2, latency: "15ms", version: "v2.1.0", status: "active", description: "基于稀疏采样数据的碳排体数据真值高效反演求解算法模型" },
  { id: "P006", name: "跨域跨协议碳排放数据传输模型", researchDirection: "perception", category: "通用", type: "control", accuracy: 95.8, latency: "5ms", version: "v3.0.1", status: "active", description: "支持多域多协议异构网络环境下碳排放数据的高可靠低延迟传输" },
  // 建模 4 个
  { id: "M001", name: "多相多场耦合微观级碳分布模型", researchDirection: "modeling", category: "钢铁冶炼", type: "prediction", accuracy: 91.5, latency: "28ms", version: "v1.9.2", status: "training", description: "基于多相流与多物理场耦合的微观尺度碳元素时空分布建模" },
  { id: "M002", name: "宏微观时空边界协同一体化模型", researchDirection: "modeling", category: "有色冶金", type: "prediction", accuracy: 89.3, latency: "35ms", version: "v2.2.0", status: "active", description: "跨宏微观尺度的时空边界协同碳流转一体化建模与态势认知" },
  { id: "M003", name: "全流程碳排放状态预测模型", researchDirection: "modeling", category: "石化", type: "prediction", accuracy: 93.7, latency: "20ms", version: "v2.4.1", status: "active", description: "基于深度时序网络的全流程碳排放状态实时预测与趋势分析模型" },
  { id: "M004", name: "全生命周期碳足迹追踪模型", researchDirection: "modeling", category: "通用", type: "monitoring", accuracy: 94.2, latency: "10ms", version: "v3.1.0", status: "active", description: "覆盖产品全生命周期的碳足迹精准追踪与核算模型" },
  // 控制 4 个
  { id: "C001", name: "多物理场碳排特性智能表征模型", researchDirection: "control", category: "钢铁冶炼", type: "control", accuracy: 92.1, latency: "16ms", version: "v2.0.0", status: "active", description: "融合多物理场信息的碳排特性智能表征与运行状态评估模型" },
  { id: "C002", name: "窄区间多变量协同优化控制模型", researchDirection: "control", category: "有色冶金", type: "control", accuracy: 90.8, latency: "14ms", version: "v1.7.3", status: "active", description: "面向窄区间工况的多变量协同优化控制策略，实现精准低碳运行" },
  { id: "C003", name: "碳迁移过程工况在线识别模型", researchDirection: "control", category: "石化", type: "monitoring", accuracy: 88.9, latency: "25ms", version: "v1.6.1", status: "training", description: "基于实时数据的碳迁移过程工况在线识别与运行模式分类模型" },
  { id: "C004", name: "高碳排工序全工况智能表征模型", researchDirection: "control", category: "通用", type: "prediction", accuracy: 91.7, latency: "18ms", version: "v2.3.0", status: "active", description: "面向高碳排工序的全工况覆盖智能表征与参数优化推荐模型" },
  // 优化 6 个
  { id: "O001", name: "级联装备低碳运行多参数优化模型", researchDirection: "optimization", category: "钢铁冶炼", type: "optimization", accuracy: 93.5, latency: "32ms", version: "v2.5.0", status: "active", description: "面向级联生产装备的低碳运行多参数联合优化模型" },
  { id: "O002", name: "碳排约束下能质耦合工序协调模型", researchDirection: "optimization", category: "有色冶金", type: "optimization", accuracy: 91.2, latency: "26ms", version: "v1.8.2", status: "active", description: "碳排约束条件下能质耦合多工序协调优化调度模型" },
  { id: "O003", name: "工业全流程碳素流多目标动态优化模型", researchDirection: "optimization", category: "石化", type: "optimization", accuracy: 89.6, latency: "40ms", version: "v2.0.1", status: "training", description: "面向工业全流程的碳素流多目标动态优化与调度决策模型" },
  { id: "O004", name: "多种群差分进化求解器", researchDirection: "optimization", category: "通用", type: "optimization", accuracy: 94.2, latency: "8ms", version: "v3.2.0", status: "active", description: "基于多种群协同差分进化算法的高效优化求解引擎" },
  { id: "O005", name: "模型蒸馏压缩引擎", researchDirection: "optimization", category: "通用", type: "optimization", accuracy: 95.1, latency: "3ms", version: "v4.0.0", status: "active", description: "基于知识蒸馏的深度学习模型轻量化压缩引擎，适配边缘端部署" },
  { id: "O006", name: "知识图谱特征学习模型", researchDirection: "optimization", category: "通用", type: "prediction", accuracy: 92.8, latency: "19ms", version: "v1.4.0", status: "active", description: "面向工业碳减排知识图谱的图神经网络特征学习与推理模型" },
];

/** 组态画布左侧模型库（拖拽节点）— 4 方向 13 个核心模型 */
export const COMPOSER_MODEL_LIBRARY = [
  {
    category: "智能感知",
    color: "#0d9488",
    nodes: [
      { type: "co2-sensing", icon: "🛰", label: "CO₂排放在线感知" },
      { type: "energy-sensing", icon: "📡", label: "能效在线感知" },
      { type: "fault-detect", icon: "🔎", label: "故障在线检测" },
    ],
  },
  {
    category: "智能建模",
    color: "#7c3aed",
    nodes: [
      { type: "co2-predict", icon: "📉", label: "CO₂排放预测模型" },
      { type: "quality-predict", icon: "📊", label: "质量预测模型" },
      { type: "health-mgmt", icon: "💚", label: "设备健康管理" },
    ],
  },
  {
    category: "智能控制",
    color: "#f59e0b",
    nodes: [
      { type: "combustion-opt", icon: "🔥", label: "燃烧优化控制" },
      { type: "mpc-ctrl", icon: "🎛", label: "MPC模型预测控制" },
      { type: "energy-opt", icon: "⚡", label: "能效优化控制" },
    ],
  },
  {
    category: "智能优化",
    color: "#10b981",
    nodes: [
      { type: "carbon-track", icon: "🎯", label: "碳足迹追踪优化" },
      { type: "multi-obj", icon: "🔮", label: "多目标优化" },
      { type: "twin-blast", icon: "🏭", label: "高炉数字孪生" },
      { type: "twin-kiln", icon: "⛏", label: "回转窑数字孪生" },
    ],
  },
];

/** 组态画布左侧组件库（拖拽节点） */
export const COMPOSER_COMPONENT_LIBRARY = [
  {
    category: "数据采集",
    key: "data-collect",
    nodes: [
      { type: "sensor", icon: "🌡", label: "传感器" },
      { type: "edge-gateway", icon: "📶", label: "边缘网关" },
    ],
  },
  {
    category: "智能模型",
    key: "ai-model",
    nodes: [
      { type: "energy-model", icon: "⚡", label: "能耗预测" },
      { type: "quality-model", icon: "📊", label: "质量预测" },
      { type: "health-model", icon: "💚", label: "设备健康" },
      { type: "mpc-model", icon: "🎛", label: "MPC控制" },
    ],
  },
  {
    category: "可视化",
    key: "visual",
    nodes: [
      { type: "trend-chart", icon: "📉", label: "趋势图" },
      { type: "monitor-panel", icon: "🖥", label: "监控面板" },
      { type: "alert-board", icon: "⚠", label: "告警看板" },
    ],
  },
  {
    category: "数据存储",
    key: "storage",
    nodes: [
      { type: "tsdb", icon: "🗄", label: "时序数据库" },
      { type: "rdb", icon: "📚", label: "关系型数据库" },
    ],
  },
  {
    category: "接口服务",
    key: "api",
    nodes: [
      { type: "rest-api", icon: "🌐", label: "REST API" },
      { type: "websocket", icon: "🔗", label: "WebSocket" },
    ],
  },
];

/* ============================== 云边端 ============================== */

export const EDGE_NODES_INITIAL: EdgeNode[] = [
  { id: "edge-a", name: "边缘节点 A", region: "西南区域", npu: "MLU370", latency: "<10ms", power: "75W", status: "online" },
  { id: "edge-b", name: "边缘节点 B", region: "华东区域", npu: "MLU370", latency: "<8ms", power: "68W", status: "online" },
  { id: "edge-c", name: "边缘节点 C", region: "西北区域", npu: "MLU370", latency: "<15ms", power: "82W", status: "warning" },
];

export const MONITOR_INSTRUMENTS_INITIAL: MonitorInstrument[] = Array.from({
  length: 48,
}).map((_, i) => {
  const points = [
    "高炉炉顶 CO₂",
    "热风炉烟气",
    "回转窑尾气 O₂",
    "回转窑窑头温度",
    "闪速炉反应塔 CO₂",
    "闪速炉烟气 SO₂",
    "裂解炉管表面温度",
    "裂解炉出口 CO₂",
    "电解槽槽电压",
    "电解槽阳极 CO₂",
  ];
  const readRange = (i: number) => {
    if (i % 7 === 3) return (12.4 + Math.random() * 3).toFixed(2) + " %";
    if (i % 7 === 1) return (320 + Math.random() * 50).toFixed(0) + " ℃";
    if (i % 7 === 5) return (850 + Math.random() * 30).toFixed(0) + " ppm";
    return (8.2 + Math.random() * 1.4).toFixed(2) + " t/h";
  };
  const status: MonitorInstrument["status"] = i % 11 === 5 ? "warning" : "online";
  return {
    id: "M" + String(i + 1).padStart(3, "0"),
    no: `CM-${String(i + 1).padStart(3, "0")}`,
    point: points[i % points.length],
    reading: readRange(i),
    status,
  };
});

export const FIELD_SITES: FieldSite[] = [
  { id: "fs-north", name: "华北监测站", icon: "🏭", location: "河北唐山", region: "华北区域", scene: "钢铁高炉炼铁", status: "online", stats: { co2Daily: "35.2 t", energyRate: "78.3%", reductionRate: "20.1%", sensors: 18 } },
  { id: "fs-southwest", name: "西南锌冶炼站", icon: "⚗", location: "云南昆明", region: "西南区域", scene: "锌冶炼回转挥发窑", status: "online", stats: { co2Daily: "12.8 t", energyRate: "86.5%", reductionRate: "22.5%", sensors: 12 } },
  { id: "fs-east", name: "华东铜冶炼站", icon: "🔥", location: "江西贵溪", region: "华东区域", scene: "铜冶炼闪速炉", status: "online", stats: { co2Daily: "18.5 t", energyRate: "92.1%", reductionRate: "19.8%", sensors: 14 } },
  { id: "fs-northwest", name: "西北铝电解站", icon: "⚡", location: "甘肃白银", region: "西北区域", scene: "铝电解槽", status: "warning", stats: { co2Daily: "22.4 t", energyRate: "71.2%", reductionRate: "14.5%", sensors: 8 } },
  { id: "fs-south", name: "华南化工站", icon: "⚗", location: "广东惠州", region: "华南区域", scene: "化工裂解炉", status: "online", stats: { co2Daily: "26.8 t", energyRate: "84.6%", reductionRate: "17.2%", sensors: 6 } },
  { id: "fs-north-2", name: "华北焦化站", icon: "🏭", location: "山西临汾", region: "华北区域", scene: "焦炉全流程", status: "online", stats: { co2Daily: "42.1 t", energyRate: "75.4%", reductionRate: "16.8%", sensors: 22 } },
];
