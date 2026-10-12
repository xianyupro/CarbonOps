/* ============================================
   工业过程全流程低碳运行智能监测与协同调控平台
   核心应用逻辑 v3.0
   ============================================ */

// ==================== DATA STORE ====================
const SCENES = [
  {
    id: 'steel', name: '钢铁高炉炼铁', industry: '钢铁行业', icon: '🏭',
    twinType: 'blastFurnace',
    desc: '高炉炼铁过程碳素流优化与能耗监测——针对碳流转机制复杂、运行工况动态特性认知难',
    status: 'running', reduction: 20.1, efficiency: 91.5, devices: 18, alerts: 2,
    location: '华北区域', co2Daily: '35.2 t', energyRate: '78.3%',
    params: { kilnTemp: 1550, inletSpeed: 6.8, airRatio: 0.78, speed: 65, slagTemp: 1400, exhaustTemp: 620, fuelFlow: 12.5 },
    equipment: [
      { name: '高炉主体', type: '核心设备', status: '运行正常', efficiency: '92.8%', co2: '18.5 t/h' },
      { name: '热风炉', type: '供风设备', status: '需关注', efficiency: '86.3%', co2: '5.2 t/h' },
      { name: '喷煤系统', type: '燃料设备', status: '运行正常', efficiency: '93.1%', co2: '8.1 t/h' },
      { name: 'TRT发电', type: '回收设备', status: '需关注', efficiency: '82.5%', co2: '0 t/h' },
      { name: '除尘系统', type: '环保设备', status: '运行正常', efficiency: '97.2%', co2: '-' },
    ]
  },
  {
    id: 'zinc', name: '锌冶炼回转挥发窑', industry: '有色行业', icon: '⚗',
    twinType: 'rotaryKiln',
    desc: '基于数字孪生的回转窑全工况碳排放实时监测与优化控制',
    status: 'running', reduction: 22.5, efficiency: 94.8, devices: 12, alerts: 1,
    location: '西南区域', co2Daily: '12.8 t', energyRate: '86.5%',
    params: { kilnTemp: 1250, inletSpeed: 3.2, airRatio: 0.85, speed: 82, slagTemp: 980, exhaustTemp: 420, fuelFlow: 2.4 },
    equipment: [
      { name: '回转窑主体', type: '核心设备', status: '运行正常', efficiency: '96.2%', co2: '4.2 t/h' },
      { name: '鼓风管系统', type: '辅助设备', status: '运行正常', efficiency: '93.5%', co2: '1.8 t/h' },
      { name: '下料装置', type: '进料设备', status: '需关注', efficiency: '88.1%', co2: '0.6 t/h' },
      { name: '温度传感器组', type: '监测设备', status: '运行正常', efficiency: '99.9%', co2: '-' },
      { name: '窑渣出口', type: '出口设备', status: '运行正常', efficiency: '94.0%', co2: '5.8 t/h' },
    ]
  },
  {
    id: 'copper', name: '铜冶炼闪速炉', industry: '有色行业', icon: '🔥',
    twinType: 'flashFurnace',
    desc: '闪速熔炼过程碳排放监测与富氧浓度优化控制——实现高碳排工序全工况智能表征',
    status: 'running', reduction: 19.8, efficiency: 96.2, devices: 14, alerts: 0,
    location: '华东区域', co2Daily: '18.5 t', energyRate: '92.1%',
    params: { kilnTemp: 1350, inletSpeed: 4.5, airRatio: 0.92, speed: 75, slagTemp: 1150, exhaustTemp: 520, fuelFlow: 3.8 },
    equipment: [
      { name: '闪速炉主体', type: '核心设备', status: '运行正常', efficiency: '97.1%', co2: '8.5 t/h' },
      { name: '富氧系统', type: '供气设备', status: '运行正常', efficiency: '95.8%', co2: '3.2 t/h' },
      { name: '精矿喷嘴', type: '进料设备', status: '运行正常', efficiency: '96.5%', co2: '1.2 t/h' },
      { name: '余热锅炉', type: '回收设备', status: '运行正常', efficiency: '91.2%', co2: '0 t/h' },
    ]
  },
  {
    id: 'aluminum', name: '铝电解槽', industry: '有色行业', icon: '⚡',
    twinType: 'electrolyticCell',
    desc: '铝电解过程碳排全生命周期追踪与多目标优化——针对生产全流程碳流转拓扑复杂',
    status: 'developing', reduction: 14.5, efficiency: null, devices: 8, alerts: 0,
    location: '西北区域', co2Daily: '22.4 t', energyRate: '71.2%',
    params: {}, equipment: []
  },
  {
    id: 'chemical', name: '化工裂解炉', industry: '石油化工', icon: '⚗',
    twinType: 'crackingFurnace',
    desc: '裂解过程碳排放精准监测与能质耦合优化——针对流程生产装备碳耗跨时空关联',
    status: 'developing', reduction: null, efficiency: null, devices: 6, alerts: 0,
    location: '华东区域', co2Daily: '--', energyRate: '--',
    params: {}, equipment: []
  }
];

// Group scenes by industry
const INDUSTRY_GROUPS = [
  { name: '钢铁行业', icon: '🏭', iconClass: 'steel', scenes: ['steel'] },
  { name: '有色行业', icon: '⚡', iconClass: 'nonferrous', scenes: ['zinc', 'copper', 'aluminum'] },
  { name: '石油化工', icon: '⚗', iconClass: 'petrochemical', scenes: ['chemical'] },
];

// ==================== MODEL LIBRARY DATA ====================
const MODEL_RESEARCH_DIRECTIONS = [
  { id: 'perception', name: '碳排放智能感知与动态监测', shortName: '智能感知', icon: '👁', description: '宽量程传感、多维度感知网络、碳排体数据求解与动态监测', subTopics: ['宽量程传感', '多维度感知网络', '碳排体数据求解', '动态监测'], color: '#00d4ff', count: 42, accuracy: 96.5 },
  { id: 'modeling', name: '碳流转建模与态势认知', shortName: '态势认知', icon: '🧠', description: '微观级碳分布、多尺度碳流转、全流程建模与碳足迹追踪', subTopics: ['微观级碳分布', '多尺度碳流转', '全流程建模', '碳足迹追踪'], color: '#a78bfa', count: 38, accuracy: 94.2 },
  { id: 'control', name: '低碳运行精准控制', shortName: '精准控制', icon: '🎯', description: '全工况表征、窄域精准控制、工况在线识别与控制器切换', subTopics: ['全工况表征', '窄域精准控制', '工况在线识别', '控制器切换'], color: '#f59e0b', count: 45, accuracy: 92.8 },
  { id: 'optimization', name: '全流程协同优化', shortName: '协同优化', icon: '⚡', description: '级联装备优化、工序工艺协调、碳素流优化与多目标动态优化', subTopics: ['级联装备优化', '工序工艺协调', '碳素流优化', '多目标动态优化'], color: '#10b981', count: 31, accuracy: 91.5 },
];

const ALL_MODELS = [
  // 碳排放智能感知与动态监测 (perception) — 6 models
  { id: 'P001', name: '光声电互标定宽量程传感模型', researchDirection: 'perception', category: '钢铁冶炼', type: 'monitoring', accuracy: 94.5, latency: '12ms', version: 'v2.3.1', status: 'active', description: '基于光声电多物理场互标定技术，实现宽量程高精度碳排放浓度实时传感检测' },
  { id: 'P002', name: '微弱碳排信号浓度特征描述模型', researchDirection: 'perception', category: '石化', type: 'monitoring', accuracy: 92.8, latency: '18ms', version: 'v1.8.0', status: 'active', description: '针对复杂工业背景下微弱碳排信号，提取浓度特征描述子实现高灵敏度检测' },
  { id: 'P003', name: '传感器温敏群组优化部署模型', researchDirection: 'perception', category: '有色冶金', type: 'optimization', accuracy: 91.3, latency: '8ms', version: 'v2.0.2', status: 'active', description: '基于温敏特性与群组协同的传感器网络优化部署策略，最大化监测覆盖率' },
  { id: 'P004', name: '气体逸散建模与感知网络模型', researchDirection: 'perception', category: '通用', type: 'prediction', accuracy: 89.7, latency: '22ms', version: 'v1.5.3', status: 'training', description: '构建工业场景气体逸散扩散模型，结合多维度感知网络实现逸散源定位与量化' },
  { id: 'P005', name: '碳排体数据真值高效求解模型', researchDirection: 'perception', category: '钢铁冶炼', type: 'prediction', accuracy: 93.2, latency: '15ms', version: 'v2.1.0', status: 'active', description: '基于稀疏采样数据的碳排体数据真值高效反演求解算法模型' },
  { id: 'P006', name: '跨域跨协议碳排放数据传输模型', researchDirection: 'perception', category: '通用', type: 'control', accuracy: 95.8, latency: '5ms', version: 'v3.0.1', status: 'active', description: '支持多域多协议异构网络环境下碳排放数据的高可靠低延迟传输' },
  // 碳流转建模与态势认知 (modeling) — 4 models
  { id: 'M001', name: '多相多场耦合微观级碳分布模型', researchDirection: 'modeling', category: '钢铁冶炼', type: 'prediction', accuracy: 91.5, latency: '28ms', version: 'v1.9.2', status: 'training', description: '基于多相流与多物理场耦合的微观尺度碳元素时空分布建模' },
  { id: 'M002', name: '宏微观时空边界协同一体化模型', researchDirection: 'modeling', category: '有色冶金', type: 'prediction', accuracy: 89.3, latency: '35ms', version: 'v2.2.0', status: 'active', description: '跨宏微观尺度的时空边界协同碳流转一体化建模与态势认知' },
  { id: 'M003', name: '全流程碳排放状态预测模型', researchDirection: 'modeling', category: '石化', type: 'prediction', accuracy: 93.7, latency: '20ms', version: 'v2.4.1', status: 'active', description: '基于深度时序网络的全流程碳排放状态实时预测与趋势分析模型' },
  { id: 'M004', name: '全生命周期碳足迹追踪模型', researchDirection: 'modeling', category: '通用', type: 'monitoring', accuracy: 94.2, latency: '10ms', version: 'v3.1.0', status: 'active', description: '覆盖产品全生命周期的碳足迹精准追踪与核算模型' },
  // 低碳运行精准控制 (control) — 4 models
  { id: 'C001', name: '多物理场碳排特性智能表征模型', researchDirection: 'control', category: '钢铁冶炼', type: 'control', accuracy: 92.1, latency: '16ms', version: 'v2.0.0', status: 'active', description: '融合多物理场信息的碳排特性智能表征与运行状态评估模型' },
  { id: 'C002', name: '窄区间多变量协同优化控制模型', researchDirection: 'control', category: '有色冶金', type: 'control', accuracy: 90.8, latency: '14ms', version: 'v1.7.3', status: 'active', description: '面向窄区间工况的多变量协同优化控制策略，实现精准低碳运行' },
  { id: 'C003', name: '碳迁移过程工况在线识别模型', researchDirection: 'control', category: '石化', type: 'monitoring', accuracy: 88.9, latency: '25ms', version: 'v1.6.1', status: 'training', description: '基于实时数据的碳迁移过程工况在线识别与运行模式分类模型' },
  { id: 'C004', name: '高碳排工序全工况智能表征模型', researchDirection: 'control', category: '通用', type: 'prediction', accuracy: 91.7, latency: '18ms', version: 'v2.3.0', status: 'active', description: '面向高碳排工序的全工况覆盖智能表征与参数优化推荐模型' },
  // 全流程协同优化 (optimization) — 6 models
  { id: 'O001', name: '级联装备低碳运行多参数优化模型', researchDirection: 'optimization', category: '钢铁冶炼', type: 'optimization', accuracy: 93.5, latency: '32ms', version: 'v2.5.0', status: 'active', description: '面向级联生产装备的低碳运行多参数联合优化模型' },
  { id: 'O002', name: '碳排约束下能质耦合工序协调模型', researchDirection: 'optimization', category: '有色冶金', type: 'optimization', accuracy: 91.2, latency: '26ms', version: 'v1.8.2', status: 'active', description: '碳排约束条件下能质耦合多工序协调优化调度模型' },
  { id: 'O003', name: '工业全流程碳素流多目标动态优化模型', researchDirection: 'optimization', category: '石化', type: 'optimization', accuracy: 89.6, latency: '40ms', version: 'v2.0.1', status: 'training', description: '面向工业全流程的碳素流多目标动态优化与调度决策模型' },
  { id: 'O004', name: '多种群差分进化求解器', researchDirection: 'optimization', category: '通用', type: 'optimization', accuracy: 94.2, latency: '8ms', version: 'v3.2.0', status: 'active', description: '基于多种群协同差分进化算法的高效优化求解引擎' },
  { id: 'O005', name: '模型蒸馏压缩引擎', researchDirection: 'optimization', category: '通用', type: 'optimization', accuracy: 95.1, latency: '3ms', version: 'v4.0.0', status: 'active', description: '基于知识蒸馏的深度学习模型轻量化压缩引擎，适配边缘端部署' },
  { id: 'O006', name: '知识图谱特征学习模型', researchDirection: 'optimization', category: '通用', type: 'prediction', accuracy: 92.8, latency: '19ms', version: 'v1.4.0', status: 'active', description: '面向工业碳减排知识图谱的图神经网络特征学习与推理模型' },
];

const MODEL_TYPE_LABELS = { monitoring: '监测', optimization: '优化', prediction: '预测', control: '控制' };
const MODEL_TYPE_COLORS = { monitoring: '#00d4ff', optimization: '#10b981', prediction: '#a78bfa', control: '#f59e0b' };
const MODEL_STATUS_LABELS = { active: '运行中', training: '训练中', inactive: '已停止' };

// ==================== FIELD SITE DATA ====================
const FIELD_SITES = [
  {
    id: 'fs-north', name: '华北监测站', icon: '🏭', location: '河北唐山', region: '华北区域',
    scene: '钢铁高炉炼铁', status: 'online',
    co2Today: '35.2 t', co2Month: '1,056 t', reductionRate: '20.1%',
    sensors: 18, alerts: 1, dataRate: '520 条/h', uptime: '99.2%',
    params: { co2: 35.2, temp: 1550, flow: 6.8, pressure: 0.78, speed: 65, efficiency: 91.5 },
    sensors_detail: [
      { name: 'CO₂传感器 #1', type: '气体监测', value: '35.2 t/h', status: '正常', trend: 'stable' },
      { name: '温度传感器 A', type: '温度监测', value: '1550°C', status: '正常', trend: 'up' },
      { name: '流量传感器 F1', type: '流量监测', value: '6.8 m/s', status: '正常', trend: 'stable' },
      { name: '压力传感器 P2', type: '压力监测', value: '0.78 MPa', status: '需关注', trend: 'down' },
      { name: '转速传感器 R1', type: '转速监测', value: '65 rpm', status: '正常', trend: 'stable' },
    ]
  },
  {
    id: 'fs-east', name: '华东监测站', icon: '🔥', location: '安徽铜陵', region: '华东区域',
    scene: '铜冶炼闪速炉', status: 'online',
    co2Today: '18.5 t', co2Month: '555 t', reductionRate: '19.8%',
    sensors: 14, alerts: 0, dataRate: '380 条/h', uptime: '99.8%',
    params: { co2: 18.5, temp: 1350, flow: 4.5, pressure: 0.92, speed: 75, efficiency: 96.2 },
    sensors_detail: [
      { name: 'CO₂传感器 #1', type: '气体监测', value: '18.5 t/h', status: '正常', trend: 'stable' },
      { name: '温度传感器 B', type: '温度监测', value: '1350°C', status: '正常', trend: 'stable' },
      { name: '富氧流量计', type: '流量监测', value: '4.5 m/s', status: '正常', trend: 'up' },
      { name: '精矿喷嘴传感器', type: '进料监测', value: '96.5%', status: '正常', trend: 'stable' },
    ]
  },
  {
    id: 'fs-south', name: '西南监测站', icon: '⚗', location: '云南曲靖', region: '西南区域',
    scene: '锌冶炼回转挥发窑', status: 'online',
    co2Today: '12.8 t', co2Month: '384 t', reductionRate: '22.5%',
    sensors: 12, alerts: 1, dataRate: '310 条/h', uptime: '98.5%',
    params: { co2: 12.8, temp: 1250, flow: 3.2, pressure: 0.85, speed: 82, efficiency: 94.8 },
    sensors_detail: [
      { name: 'CO₂传感器 #2', type: '气体监测', value: '12.8 t/h', status: '正常', trend: 'down' },
      { name: '温度传感器 C', type: '温度监测', value: '1250°C', status: '正常', trend: 'stable' },
      { name: '鼓风管流量计', type: '流量监测', value: '3.2 m/s', status: '需关注', trend: 'down' },
      { name: '下料传感器', type: '进料监测', value: '88.1%', status: '需关注', trend: 'down' },
    ]
  },
  {
    id: 'fs-west', name: '西北监测站', icon: '⚡', location: '甘肃兰州', region: '西北区域',
    scene: '铝电解槽', status: 'developing',
    co2Today: '22.4 t', co2Month: '672 t', reductionRate: '14.5%',
    sensors: 8, alerts: 0, dataRate: '180 条/h', uptime: '95.1%',
    params: { co2: 22.4, temp: 960, flow: 2.1, pressure: 0.65, speed: 45, efficiency: 71.2 },
    sensors_detail: [
      { name: 'CO₂传感器 #3', type: '气体监测', value: '22.4 t/h', status: '正常', trend: 'stable' },
      { name: '槽温传感器', type: '温度监测', value: '960°C', status: '正常', trend: 'up' },
      { name: '电流传感器', type: '电力监测', value: '320 kA', status: '正常', trend: 'stable' },
    ]
  },
  {
    id: 'fs-ne', name: '东北监测站', icon: '🏗', location: '辽宁鞍山', region: '东北区域',
    scene: '钢铁高炉炼铁', status: 'online',
    co2Today: '31.5 t', co2Month: '945 t', reductionRate: '18.9%',
    sensors: 15, alerts: 0, dataRate: '480 条/h', uptime: '99.5%',
    params: { co2: 31.5, temp: 1480, flow: 6.2, pressure: 0.81, speed: 62, efficiency: 90.3 },
    sensors_detail: [
      { name: 'CO₂传感器 #5', type: '气体监测', value: '31.5 t/h', status: '正常', trend: 'stable' },
      { name: '高炉温度计', type: '温度监测', value: '1480°C', status: '正常', trend: 'up' },
      { name: '热风炉流量计', type: '流量监测', value: '6.2 m/s', status: '正常', trend: 'stable' },
    ]
  },
];
let currentFieldSiteId = null;

// ==================== CHART MANAGER ====================
const chartInstances = {};
const chartObservers = {};
function getChart(domId) {
  if (typeof echarts === 'undefined') return null;
  if (chartInstances[domId]) chartInstances[domId].dispose();
  const dom = document.getElementById(domId);
  if (!dom) return null;
  const rect = dom.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return null;
  const chart = echarts.init(dom);
  chartInstances[domId] = chart;
  // Deferred resize to ensure chart fills container after layout settles
  requestAnimationFrame(() => {
    if (chart && !chart.isDisposed()) chart.resize();
  });
  // Observe container size changes (tab switches, window resize, etc.)
  if (typeof ResizeObserver !== 'undefined') {
    if (chartObservers[domId]) chartObservers[domId].disconnect();
    const observer = new ResizeObserver(() => {
      if (chart && !chart.isDisposed()) chart.resize();
    });
    observer.observe(dom);
    chartObservers[domId] = observer;
  }
  return chart;
}
function disposeAllCharts() {
  Object.keys(chartInstances).forEach(key => {
    if (chartInstances[key] && !chartInstances[key].isDisposed()) chartInstances[key].dispose();
    delete chartInstances[key];
  });
  Object.keys(chartObservers).forEach(key => {
    if (chartObservers[key]) chartObservers[key].disconnect();
    delete chartObservers[key];
  });
}
window.addEventListener('resize', () => {
  Object.values(chartInstances).forEach(c => { if (c && !c.isDisposed()) c.resize(); });
  if (currentTwin) updateTwinSize();
});

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initParticleBg();
  renderDashboard();
  initCloudEdge();
  updateTime();
  setInterval(updateTime, 10000);
});

function updateTime() {
  const now = new Date();
  const el = document.getElementById('headerTime');
  if (el) el.textContent = now.toLocaleDateString('zh-CN') + ' ' + now.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

// ==================== PARTICLE BACKGROUND ====================
function initParticleBg() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  const maxParticles = 80;

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < maxParticles; i++) {
    particles.push({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5, a: Math.random() * 0.5 + 0.2
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${p.a})`;
      ctx.fill();
    }
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0, 168, 255, ${0.08 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
}

// ==================== NAVIGATION ====================
function initNavigation() {
  document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
    tab.addEventListener('click', () => { const v = tab.dataset.view; if (v) switchView(v); });
  });
}

function switchView(viewName) {
  disposeAllCharts();
  if (currentTwin) { cleanupTwin(); }

  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab[data-view]').forEach(t => t.classList.remove('active'));

  const panel = document.getElementById('view-' + viewName);
  if (panel) panel.classList.add('active');

  const detailTab = document.getElementById('tabSceneDetail');
  if (viewName === 'scene-detail') {
    detailTab.style.display = '';
    detailTab.classList.add('active');
  } else {
    detailTab.style.display = 'none';
    const tab = document.querySelector(`.nav-tab[data-view="${viewName}"]`);
    if (tab) tab.classList.add('active');
  }

  setTimeout(() => {
    if (viewName === 'config-dev') { resetWizard(); }
    if (viewName === 'dashboard') { renderDashboard(); }
    if (viewName === 'scene-detail') { renderSceneDetailCharts(); setTimeout(initTwinIfNeeded, 400); }
    if (viewName === 'cloud-edge') { initCloudEdgeView(); }
  }, 150);
}

// ==================== DASHBOARD ====================
function renderDashboard() {
  updateDashboardStats();
  renderIndustryShowcase();
  setTimeout(renderOverviewCharts, 300);
  renderAlertList();
}

function renderOverviewCharts() {
  renderIndustryBarChart();
  renderReductionGaugeChart();
}

function renderIndustryBarChart() {
  const chart = getChart('chartIndustryBar');
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 }, data: ['总排放量', '已减排量'] },
    grid: { left: 55, right: 30, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: ['钢铁', '有色', '化工'], axisLabel: { color: '#94a3b8', fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(0,168,255,0.2)' } } },
    yAxis: { type: 'value', name: '万吨CO₂', nameTextStyle: { color: '#64748b' }, axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } } },
    series: [
      { name: '总排放量', type: 'bar', barWidth: '35%', itemStyle: { borderRadius: [4,4,0,0], color: 'rgba(0,212,255,0.7)' }, data: [185, 142, 96], label: { show: true, position: 'top', color: '#94a3b8', fontSize: 10 } },
      { name: '已减排量', type: 'bar', barWidth: '35%', itemStyle: { borderRadius: [4,4,0,0], color: 'rgba(0,255,136,0.7)' }, data: [37, 31, 18], label: { show: true, position: 'top', color: '#94a3b8', fontSize: 10 } }
    ]
  });
}

function renderReductionGaugeChart() {
  const chart = getChart('chartReductionGauge');
  if (!chart) return;
  const running = SCENES.filter(s => s.status === 'running' && !isNoDataScene(s));
  const data = running.map(s => ({ name: s.name, value: s.reduction }));
  chart.setOption({
    tooltip: { trigger: 'item', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['55%', '82%'], center: ['50%', '45%'],
      itemStyle: { borderRadius: 6, borderColor: 'rgba(10,14,23,0.8)', borderWidth: 3 },
      label: { show: true, formatter: '{b}\n{d}%', color: '#94a3b8', fontSize: 10 },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data: data.length > 0 ? data.map((d, i) => ({
        value: d.value, name: d.name,
        itemStyle: { color: ['#00d4ff','#0088ff','#7c3aed','#00ff88'][i] || '#00d4ff' }
      })) : [{ value: 1, name: '暂无数据', itemStyle: { color: '#334155' } }]
    }]
  });
}

function updateDashboardStats() {
  const running = SCENES.filter(s => s.status === 'running');
  document.getElementById('statScenes').textContent = running.length;
  const withData = running.filter(s => typeof s.reduction === 'number');
  const avgReduction = withData.length > 0 ? withData.reduce((s, sc) => s + sc.reduction, 0) / withData.length : 0;
  document.getElementById('statReduction').innerHTML = (withData.length > 0 ? avgReduction.toFixed(1) : '--') + '<span style="font-size:18px">%</span>';
  document.getElementById('statModels').textContent = '12';
  document.getElementById('statDevices').textContent = SCENES.reduce((s, sc) => s + sc.devices, 0);
}

function renderIndustryShowcase() {
  const container = document.getElementById('industrySceneShowcase');
  if (!container) return;

  let html = '';
  INDUSTRY_GROUPS.forEach(group => {
    const groupScenes = group.scenes.map(id => SCENES.find(s => s.id === id)).filter(Boolean);
    html += `
    <div class="industry-section">
      <div class="industry-header">
        <div class="industry-icon ${group.iconClass}">${group.icon}</div>
        <span class="industry-name">${group.name}</span>
        <span class="industry-count">${groupScenes.length} 个场景</span>
        <div class="industry-divider"></div>
      </div>
      <div class="scene-showcase">`;

    groupScenes.forEach(s => {
      const isRunning = s.status === 'running';
      const noData = isNoDataScene(s);
      html += `
        <div class="scene-showcase-card" onclick="openSceneDetail('${s.id}')">
          <div class="scene-showcase-icon">${s.icon}</div>
          <div class="scene-showcase-info">
            <div class="scene-showcase-name">${s.name}</div>
            <div class="scene-showcase-desc">${s.desc}</div>
            <div class="scene-showcase-metrics">
              ${isRunning && !noData ? `
              <div class="scene-showcase-metric">
                <div class="val">${s.reduction}%</div>
                <div class="lbl">碳减排率</div>
              </div>
              <div class="scene-showcase-metric">
                <div class="val">${s.efficiency}%</div>
                <div class="lbl">综合效率</div>
              </div>
              <div class="scene-showcase-metric">
                <div class="val">${s.co2Daily}</div>
                <div class="lbl">日均CO₂排放</div>
              </div>` : isRunning && noData ? `
              <div class="scene-showcase-metric">
                <div class="val" style="color:var(--text-dim);font-size:14px;">无数据</div>
                <div class="lbl">等待设备上线</div>
              </div>` : `
              <div class="scene-showcase-metric">
                <div class="val" style="color:var(--accent-warning);">开发中</div>
                <div class="lbl">点击配置</div>
              </div>`}
            </div>
          </div>
          <div class="scene-showcase-status">
            <span class="tag ${noData ? 'tag-orange' : (isRunning ? 'tag-green' : '')}" style="${!isRunning && !noData ? 'background:rgba(255,170,0,0.1);color:var(--accent-warning);border:1px solid rgba(255,170,0,0.25);' : noData ? 'background:rgba(255,170,0,0.1);color:var(--accent-warning);border:1px solid rgba(255,170,0,0.25);' : ''}">${noData ? '● 待采集' : (isRunning ? '● 运行中' : '◎ 开发中')}</span>
          </div>
        </div>`;
    });

    html += '</div></div>';
  });

  container.innerHTML = html;
}

function renderAlertList() {
  const alerts = [
    { level: 'danger', scene: '钢铁高炉炼铁', msg: '热风炉效率下降至86.3%，建议检查换热器', time: '10分钟前' },
    { level: 'danger', scene: '钢铁高炉炼铁', msg: 'TRT发电设备效率低于阈值(82.5%)', time: '25分钟前' },
    { level: 'warning', scene: '锌冶炼回转窑', msg: '下料装置运行效率偏低(88.1%)，建议维护', time: '1小时前' },
    { level: 'warning', scene: '铜冶炼闪速炉', msg: '精矿喷嘴需定期清理维护', time: '2小时前' },
    { level: 'info', scene: '铜冶炼闪速炉', msg: '系统自动调优完成，富氧浓度已优化至92%', time: '3小时前' },
  ];
  const el = document.getElementById('alertList');
  if (!el) return;
  el.innerHTML = alerts.map(a => `
    <div class="metric-row">
      <div>
        <span style="color:${a.level==='danger'?'var(--accent-danger)':'var(--accent-warning)'};margin-right:8px;">${a.level==='danger'?'●':'⚠'}</span>
        <span style="font-size:13px;">${a.msg}</span>
      </div>
      <div style="text-align:right;">
        <span class="tag tag-blue" style="font-size:10px;">${a.scene}</span>
        <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">${a.time}</div>
      </div>
    </div>
  `).join('');
}

// ==================== DASHBOARD CHARTS ====================
function renderDashboardCharts() {
  renderEmissionTrendChart();
  renderScenePieChart();
}

function renderEmissionTrendChart() {
  const chart = getChart('chartEmission');
  if (!chart) return;
  const hours = ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'];
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 }, data: ['基准线', '优化后'] },
    grid: { left: 50, right: 30, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: hours, axisLine: { lineStyle: { color: 'rgba(0,168,255,0.2)' } }, axisLabel: { color: '#64748b', fontSize: 10 } },
    yAxis: { type: 'value', name: 'CO₂ (t/h)', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }, axisLabel: { color: '#64748b' }, nameTextStyle: { color: '#64748b' } },
    series: [
      { name: '基准线', type: 'line', data: [32,30,28,27,29,35,38,40,42,39,36,34], lineStyle: { color: 'rgba(100,116,139,0.6)', width: 2, type: 'dashed' }, itemStyle: { color: 'rgba(100,116,139,0.6)' }, symbol: 'none' },
      { name: '优化后', type: 'line', data: [28,26,24,23,25,30,32,33,34,32,30,28], lineStyle: { color: '#00d4ff', width: 2.5, shadowBlur: 10, shadowColor: 'rgba(0,212,255,0.5)' }, itemStyle: { color: '#00d4ff' }, symbol: 'circle', symbolSize: 6, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{ offset: 0, color: 'rgba(0,212,255,0.15)' },{ offset: 1, color: 'rgba(0,212,255,0)' }]) } }
    ]
  });
}

function renderScenePieChart() {
  const chart = getChart('chartScenePie');
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: 'item', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 } },
    series: [{ type: 'pie', radius: ['55%', '80%'], center: ['50%', '45%'], itemStyle: { borderRadius: 4, borderColor: 'rgba(10,14,23,0.8)', borderWidth: 3 }, label: { show: false }, emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data: [
        { value: 22.5, name: '锌冶炼回转窑', itemStyle: { color: '#00d4ff' } },
        { value: 20.1, name: '钢铁高炉炼铁', itemStyle: { color: '#0088ff' } },
        { value: 19.8, name: '铜冶炼闪速炉', itemStyle: { color: '#7c3aed' } },
        { value: 17.2, name: '水泥回转窑', itemStyle: { color: '#00ff88' } },
      ]
    }]
  });
}

// ==================== 3D DIGITAL TWIN ====================
let currentTwin = null; // { scene, renderer, scene3d, camera, modelGroup, animationId }
let twinAutoRotate = true;
let currentSceneId = null;

function initTwinIfNeeded() {
  if (!currentSceneId) return;
  const scene = SCENES.find(s => s.id === currentSceneId);
  if (!scene || scene.status !== 'running') return;
  if (isNoDataScene(scene)) {
    // Show no-data placeholder in twin container
    const container = document.getElementById('twinContainer');
    if (!container) return;
    // Remove existing canvas
    const existingCanvas = container.querySelector('canvas');
    if (existingCanvas) existingCanvas.remove();
    const overlay = document.getElementById('twinOverlay');
    if (overlay) {
      overlay.innerHTML = '<div style="text-align:center;padding-top:60px;"><div style="font-size:48px;">📡</div><div style="font-size:15px;color:var(--text-dim);margin-top:12px;">暂无数据</div><div style="font-size:12px;color:var(--text-dim);margin-top:4px;">数据采集中，请等待设备上线</div></div>';
    }
    const labels = document.getElementById('twinLabels');
    if (labels) labels.innerHTML = '';
    const lines = document.getElementById('twinLabelLines');
    if (lines) lines.innerHTML = '';
    const controls = container.querySelector('.twin-controls');
    if (controls) controls.style.display = 'none';
    const legend = container.querySelector('.twin-legend');
    if (legend) legend.style.display = 'none';
    return;
  }
  // Restore controls and legend for normal scenes
  const container = document.getElementById('twinContainer');
  if (container) {
    const controls = container.querySelector('.twin-controls');
    if (controls) controls.style.display = '';
    const legend = container.querySelector('.twin-legend');
    if (legend) legend.style.display = '';
  }
  initDigitalTwin(scene);
}

function initDigitalTwin(scene) {
  const container = document.getElementById('twinContainer');
  const overlay = document.getElementById('twinOverlay');
  if (!container) return;

  // Check THREE is loaded
  if (typeof THREE === 'undefined') {
    if (overlay) overlay.textContent = '⚠ Three.js 库加载失败，请刷新页面重试';
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width < 50 || height < 50) {
    // Container not ready, retry
    setTimeout(() => initDigitalTwin(scene), 300);
    return;
  }

  if (currentTwin) cleanupTwin();

  if (overlay) overlay.textContent = '⏳ 加载模型中...';

  try {

  // Three.js setup
  const scene3d = new THREE.Scene();
  scene3d.background = new THREE.Color(0x0a1628);
  scene3d.fog = new THREE.Fog(0x0a1628, 8, 40);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(8, 5, 12);
  camera.lookAt(0, 1.5, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a1628, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Lighting - brighter overall
  const ambientLight = new THREE.AmbientLight(0x5577aa, 3.5);
  scene3d.add(ambientLight);

  const fillLight = new THREE.DirectionalLight(0xaaccff, 1.8);
  fillLight.position.set(-5, 3, -5);
  scene3d.add(fillLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 4.5);
  keyLight.position.set(10, 15, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 50;
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -10;
  scene3d.add(keyLight);

  const accentLight = new THREE.PointLight(0x00d4ff, 5, 18);
  accentLight.position.set(0, 3, 5);
  scene3d.add(accentLight);

  const warmLight = new THREE.PointLight(0xff8800, 3.5, 12);
  warmLight.position.set(-3, 2, -3);
  scene3d.add(warmLight);

  // Ground grid
  const gridHelper = new THREE.PolarGridHelper(6, 32, 24, 64, 0x005588, 0x003355);
  scene3d.add(gridHelper);

  // Build model based on scene type
  const modelGroup = new THREE.Group();
  buildTwinModel(scene.twinType, modelGroup);
  scene3d.add(modelGroup);

  // Mouse interaction
  let isDragging = false, isPanning = false, prevMouse = { x: 0, y: 0 };
  const orbitTarget = new THREE.Vector2(0, 0);
  const panTarget = new THREE.Vector3(0, 1.5, 0); // camera lookAt shifted by pan

  container.addEventListener('contextmenu', e => e.preventDefault());

  function onMouseDown(e) {
    if (e.button === 2 || e.button === 1) {
      isPanning = true;
      container.style.cursor = 'move';
    } else {
      isDragging = true;
      container.style.cursor = 'grabbing';
    }
    prevMouse.x = e.clientX;
    prevMouse.y = e.clientY;
  }
  function onMouseMove(e) {
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    if (isDragging) {
      orbitTarget.x += dx * 0.005;
      orbitTarget.y += dy * 0.005;
      orbitTarget.y = Math.max(-1.2, Math.min(1.2, orbitTarget.y));
    } else if (isPanning) {
      panTarget.x -= dx * 0.012;
      panTarget.y += dy * 0.012;
    }
    prevMouse.x = e.clientX;
    prevMouse.y = e.clientY;
  }
  function onMouseUp() {
    isDragging = false;
    isPanning = false;
    container.style.cursor = 'grab';
  }

  container.addEventListener('mousedown', onMouseDown);
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseup', onMouseUp);
  container.addEventListener('mouseleave', onMouseUp);

  // Touch support
  container.addEventListener('touchstart', e => { if(e.touches.length===1){ isDragging=true; prevMouse.x=e.touches[0].clientX; prevMouse.y=e.touches[0].clientY; } });
  container.addEventListener('touchmove', e => { if(isDragging&&e.touches.length===1){ const dx=e.touches[0].clientX-prevMouse.x; const dy=e.touches[0].clientY-prevMouse.y; orbitTarget.x+=dx*0.005; orbitTarget.y+=dy*0.005; orbitTarget.y=Math.max(-1.2,Math.min(1.2,orbitTarget.y)); prevMouse.x=e.touches[0].clientX; prevMouse.y=e.touches[0].clientY; } });
  container.addEventListener('touchend', ()=>{ isDragging=false; });

  // Wheel zoom
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    twinZoomLevel += e.deltaY * 0.01;
    twinZoomLevel = Math.max(5, Math.min(28, twinZoomLevel));
  }, { passive: false });

  // Reset zoom on init
  twinZoomLevel = 13;

  function animate() {
    const id = requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    // Auto rotate
    if (twinAutoRotate && !isDragging && !isPanning) {
      orbitTarget.x += 0.003;
    }

    // Camera orbit around pan target
    const radius = twinZoomLevel;
    const camPos = new THREE.Vector3(
      panTarget.x + Math.sin(orbitTarget.x) * Math.cos(orbitTarget.y) * radius,
      panTarget.y + Math.sin(orbitTarget.y) * radius,
      panTarget.z + Math.cos(orbitTarget.x) * Math.cos(orbitTarget.y) * radius
    );
    camera.position.lerp(camPos, 0.05);
    camera.lookAt(panTarget);

    // Rotate model slightly (only when auto-rotating)
    if (twinAutoRotate && !isDragging && !isPanning) {
      modelGroup.rotation.y += 0.002;
    }

    // Animate emission particles on model group children
    modelGroup.children.forEach(child => {
      if (child.userData && child.userData.baseY !== undefined) {
        child.position.y = child.userData.baseY + Math.sin(time * child.userData.speed * 5) * 0.3;
        child.material.opacity = 0.5 + Math.sin(time * 3) * 0.3;
      }
    });

    // Pulsing lights
    accentLight.intensity = 3 + Math.sin(time * 3) * 0.8;
    warmLight.intensity = 2 + Math.sin(time * 2.5 + 1) * 1;

    // Update 3D annotation labels (with model matrix for rotation)
    modelGroup.updateMatrixWorld();
    updateTwinLabels(scene3d, camera, modelGroup, scene.twinType);

    renderer.render(scene3d, camera);
    currentTwin = { scene, renderer, scene3d, camera, modelGroup, animationId: id, container, accentLight, warmLight, orbitTarget, panTarget, isDragging: () => isDragging, isPanning: () => isPanning };
  }

  // Create label elements
  createTwinLabels(scene);
  animate();
  if (overlay) overlay.textContent = scene.name + ' · 数字孪生';

  } catch(err) {
    console.error('3D模型初始化失败:', err);
    if (overlay) overlay.textContent = '⚠ 3D渲染失败: ' + err.message;
    // Try to cleanup
    if (currentTwin) cleanupTwin();
  }
}

function buildTwinModel(twinType, group) {
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.35, metalness: 0.95 });
  const matIron = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.8 });
  const matHotBrick = new THREE.MeshStandardMaterial({ color: 0xcc4400, roughness: 0.6, metalness: 0.1, emissive: 0x441100, emissiveIntensity: 0.6 });
  const matRefractory = new THREE.MeshStandardMaterial({ color: 0xbb9977, roughness: 0.7, metalness: 0.05 });
  const matPipe = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.3, metalness: 0.9 });
  const matConcrete = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9, metalness: 0.05 });
  const matGlow = new THREE.MeshStandardMaterial({ color: 0x00ff88, roughness: 0.1, metalness: 0.05, emissive: 0x00ff66, emissiveIntensity: 0.8 });
  const matWarning = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.2, metalness: 0.3, emissive: 0xff4400, emissiveIntensity: 0.5 });
  const matCopper = new THREE.MeshStandardMaterial({ color: 0xcc8844, roughness: 0.3, metalness: 0.95 });
  const matDarkMetal = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.4, metalness: 0.9 });

  function addPipe(x, y, z, length, radius, rotX, rotZ, material) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material || matPipe);
    pipe.position.set(x, y, z);
    if (rotX) pipe.rotation.x = rotX;
    if (rotZ) pipe.rotation.z = rotZ;
    pipe.castShadow = true;
    group.add(pipe);
    return pipe;
  }

  function addFlange(x, y, z, radius, material) {
    const flange = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.3, 8, 16), material || matSteel);
    flange.position.set(x, y, z);
    flange.castShadow = true;
    group.add(flange);
  }

  function addBox(x, y, z, w, h, d, material) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material || matSteel);
    box.position.set(x, y, z);
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
    return box;
  }

  function addCylinder(x, y, z, rTop, rBot, h, material) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 32), material || matSteel);
    cyl.position.set(x, y, z);
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    group.add(cyl);
    return cyl;
  }

  switch (twinType) {
    case 'rotaryKiln': {
      // Tilted kiln sub-group (inlet higher by ~3°)
      const kilnGroup = new THREE.Group();
      kilnGroup.rotation.z = -0.052; // ~3° tilt, inlet (x<0) higher

      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 5.5, 48), matSteel);
      shell.rotation.z = Math.PI / 2;
      shell.position.set(0, 2.2, 0);
      shell.castShadow = true; shell.receiveShadow = true;
      kilnGroup.add(shell);

      const innerLining = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 5.2, 32), matRefractory);
      innerLining.rotation.z = Math.PI / 2;
      innerLining.position.y = 2.2;
      kilnGroup.add(innerLining);

      const hotZone = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.87, 2, 32), matHotBrick);
      hotZone.rotation.z = Math.PI / 2;
      hotZone.position.set(0.5, 2.2, 0);
      hotZone.castShadow = true;
      kilnGroup.add(hotZone);

      // Tires on shell
      for (let i = -1; i <= 1; i++) {
        const tire = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.1, 16, 48), matIron);
        tire.position.set(i * 1.8, 2.2, 0);
        tire.castShadow = true;
        kilnGroup.add(tire);
      }

      const gearRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 24, 64), matDarkMetal);
      gearRing.position.set(0.5, 2.2, 0);
      gearRing.castShadow = true;
      kilnGroup.add(gearRing);

      const inletHood = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 0.9, 32), matSteel);
      inletHood.position.set(-3.0, 2.2, 0);
      inletHood.rotation.z = Math.PI / 2;
      inletHood.castShadow = true;
      kilnGroup.add(inletHood);

      // Feed chute on inlet hood
      const feedChute = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.8, 32), matRefractory);
      feedChute.position.set(-3.0, 3.0, 0);
      feedChute.castShadow = true; feedChute.receiveShadow = true;
      kilnGroup.add(feedChute);

      const outletHood = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 0.9, 32), matSteel);
      outletHood.position.set(3.0, 2.2, 0);
      outletHood.rotation.z = Math.PI / 2;
      outletHood.castShadow = true;
      kilnGroup.add(outletHood);

      // Exhaust stack on outlet hood
      const exhaustStack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.0, 32), matPipe);
      exhaustStack.position.set(3.0, 3.3, 0);
      exhaustStack.castShadow = true; exhaustStack.receiveShadow = true;
      kilnGroup.add(exhaustStack);
      const stackCap = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.3, 16), matSteel);
      stackCap.position.set(3.0, 4.45, 0);
      kilnGroup.add(stackCap);

      for (let i = 0; i < 3; i++) {
        const particle = new THREE.Mesh(new THREE.SphereGeometry(0.04 + i * 0.02, 8, 8), matGlow);
        particle.position.set(3.0 + (Math.random() - 0.5) * 0.3, 4.5 + i * 0.15, (Math.random() - 0.5) * 0.3);
        particle.userData = { baseY: 4.5 + i * 0.15, speed: 0.3 + Math.random() * 0.5 };
        kilnGroup.add(particle);
      }

      group.add(kilnGroup);

      // Rollers + pedestals (level on ground, not tilted)
      for (let i = -1; i <= 1; i++) {
        for (let s = -1; s <= 1; s += 2) {
          const rollerY = 1.17 - i * 1.8 * 0.052; // roller height follows tilted tire
          const pedestalTop = rollerY - 0.12;
          const pedH = pedestalTop - 0.35;
          const pedY = 0.35 + pedH / 2;

          const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.2, pedH, 0.3), matConcrete);
          pedestal.position.set(i * 1.8, pedY, s * 0.5);
          pedestal.castShadow = true; pedestal.receiveShadow = true;
          group.add(pedestal);

          const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 16), matIron);
          roller.position.set(i * 1.8, rollerY, s * 0.5);
          roller.rotation.z = Math.PI / 2;
          roller.castShadow = true;
          group.add(roller);
        }
      }

      addBox(0, 0.2, 0, 6, 0.3, 2, matConcrete);
      break;
    }

    case 'blastFurnace': {
      // Foundation
      addBox(0, 0.2, 0, 4, 0.4, 4, matConcrete);

      // Hearth (bottom, sits on foundation)
      // h=1.4, y=0.9 → bottom=0.2, foundation top=0.4 → 0.2 overlap ✓
      addCylinder(0, 0.9, 0, 1.1, 1.2, 1.4, matIron);

      // Bosh (tapering inward, sits on hearth)
      // hearth top=1.6, bosh bottom=2.2-0.75=1.45 → overlap ✓
      const bosh = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 1.5, 32), matSteel);
      bosh.position.y = 2.2;
      bosh.castShadow = true;
      group.add(bosh);

      // Belly (widest, hottest, on bosh)
      // bosh top=2.95, belly bottom=3.2-0.6=2.6 → overlap ✓
      addCylinder(0, 3.2, 0, 1.2, 1.2, 1.2, matHotBrick);

      // Stack (upper tapering, on belly)
      // belly top=3.8, stack bottom=5.2-1.75=3.45 → overlap ✓
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 3.5, 32), matSteel);
      stack.position.y = 5.2;
      stack.castShadow = true;
      group.add(stack);

      // Throat / top
      // stack top=6.95, throat bottom=7.3-0.4=6.9 → near contact ✓
      const topCone = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.8, 32), matSteel);
      topCone.position.y = 7.3;
      topCone.castShadow = true;
      group.add(topCone);

      // Tap hole (on hearth surface)
      addBox(1.15, 0.85, 0, 0.3, 0.15, 0.2, matWarning);
      break;
    }

    case 'flashFurnace': {
      // Foundation: top at y=0.35
      addBox(0, 0.2, 0, 3.5, 0.3, 3, matConcrete);

      // Settler: sits on foundation
      // h=0.9, y=0.8 → bottom=0.35, foundation top=0.35 → touch ✓
      const settler = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 1.8), matSteel);
      settler.position.y = 0.8;
      settler.castShadow = true; settler.receiveShadow = true;
      group.add(settler);

      // Reaction shaft: sits on settler
      // settler top=1.25, shaft bottom=2.8-1.5=1.3 → overlap ✓
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 3, 32), matSteel);
      shaft.position.y = 2.8;
      shaft.castShadow = true;
      group.add(shaft);

      // Hot reaction zone inside shaft
      const reactHot = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.5, 32), matHotBrick);
      reactHot.position.y = 3.2;
      reactHot.castShadow = true;
      group.add(reactHot);

      // Concentrate burner: sits on top of shaft
      // shaft top=4.3, burner bottom=4.7-0.35=4.35 → overlap ✓
      const burner = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 16), matSteel);
      burner.position.y = 4.7;
      burner.castShadow = true;
      group.add(burner);

      // Burner glow
      const burnerGlow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), matWarning);
      burnerGlow.position.y = 5.05;
      group.add(burnerGlow);

      // Slag tap on settler side
      addBox(1.25, 0.55, 0, 0.25, 0.12, 0.2, matWarning);

      // Matte tap on settler side
      addBox(-1.15, 0.7, 0, 0.2, 0.1, 0.2, matWarning);
      break;
    }

    case 'electrolyticCell': {
      addBox(0, 0.2, 0, 5, 0.3, 2.5, matConcrete);

      const shell = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.2, 2, 1, 1, 1), matIron);
      shell.position.y = 1.0;
      shell.castShadow = true; shell.receiveShadow = true;
      group.add(shell);

      const lining = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 1.7), matDarkMetal);
      lining.position.y = 0.6;
      group.add(lining);

      const electrolyte = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.15, 1.5), matWarning);
      electrolyte.position.y = 0.85;
      group.add(electrolyte);

      for (let i = 0; i < 8; i++) {
        const anode = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 1.2), matDarkMetal);
        anode.position.set(-1.8 + i * 0.5, 1.5, 0);
        anode.castShadow = true;
        group.add(anode);

        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), matCopper);
        rod.position.set(-1.8 + i * 0.5, 2.0, 0);
        rod.castShadow = true;
        group.add(rod);
      }

      for (let s = -1; s <= 1; s += 2) {
        const busBar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 16), matCopper);
        busBar.rotation.z = Math.PI / 2;
        busBar.position.set(0, 2.1, s * 0.8);
        busBar.castShadow = true;
        group.add(busBar);

        for (let i = -1; i <= 1; i++) {
          const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8), matRefractory);
          insulator.position.set(i * 1.2, 1.9, s * 0.8);
          group.add(insulator);
        }
      }

      const hood = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 1.6), matSteel);
      hood.position.y = 2.3;
      hood.castShadow = true;
      group.add(hood);

      addCylinder(0, 3.2, 0, 0.2, 0.2, 1.5, matPipe);

      for (let i = 0; i < 5; i++) {
        const fume = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), matGlow);
        fume.position.set((Math.random() - 0.5) * 2, 3.8 + Math.random() * 0.5, (Math.random() - 0.5) * 1);
        fume.userData = { baseY: fume.position.y, speed: 0.2 + Math.random() * 0.3 };
        group.add(fume);
      }
      break;
    }

    case 'crackingFurnace': {
      // Foundation: top at y=0.4
      addBox(0, 0.2, 0, 2.5, 0.4, 2.5, matConcrete);

      // Radiant section: sits on foundation
      // y=1.9, h=3 → bottom=0.4, foundation top=0.4 → touch ✓
      const radiant = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.65, 3, 32), matSteel);
      radiant.position.y = 1.9;
      radiant.castShadow = true;
      group.add(radiant);

      // Hot zone inside radiant
      const radHot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 32), matHotBrick);
      radHot.position.y = 1.9;
      radHot.castShadow = true;
      group.add(radHot);

      // Convection section: sits on radiant
      // radiant top=3.4, convection y=4.5, h=2.5 → bottom=3.25 → overlap ✓
      const convection = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 2.5, 32), matSteel);
      convection.position.y = 4.5;
      convection.castShadow = true;
      group.add(convection);

      // Stack on top of convection
      // convection top=5.75, stack y=6.3, h=1.5 → bottom=5.55 → overlap ✓
      addCylinder(0, 6.3, 0, 0.2, 0.25, 1.5, matSteel);
      break;
    }

    default: {
      // Foundation: top at y=0.35
      addBox(0, 0.2, 0, 3, 0.3, 3, matConcrete);
      // Main body: sits on foundation, y=1.95, h=3.5 → bottom=0.2, sinks slightly into foundation ✓
      addCylinder(0, 1.95, 0, 0.7, 0.9, 3.5, matSteel);
      // Hot zone inside body
      addCylinder(0, 3.0, 0, 0.72, 0.72, 1, matHotBrick);
      // Stack on top: body top=3.7, stack y=4.5, h=1.5 → bottom=3.75, near contact ✓
      addCylinder(0, 4.5, 0, 0.25, 0.3, 1.5, matSteel);
    }
  }
}

function cleanupTwin() {
  if (!currentTwin) return;
  cancelAnimationFrame(currentTwin.animationId);
  if (currentTwin.renderer) {
    currentTwin.renderer.dispose();
    if (currentTwin.container && currentTwin.renderer.domElement.parentNode) {
      currentTwin.container.removeChild(currentTwin.renderer.domElement);
    }
  }
  if (currentTwin.scene3d) {
    currentTwin.scene3d.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }
  // Remove labels and leader lines
  const labelsLayer = document.getElementById('twinLabels');
  if (labelsLayer) labelsLayer.innerHTML = '';
  const linesSvg = document.getElementById('twinLabelLines');
  if (linesSvg) linesSvg.innerHTML = '';
  currentTwin = null;
}

// ==================== 3D LABELS ====================
let twinLabelDefs = [];
let twinZoomLevel = 13; // camera orbit radius, adjustable via scroll

function createTwinLabels(scene) {
  const layer = document.getElementById('twinLabels');
  const linesSvg = document.getElementById('twinLabelLines');
  if (!layer) return;
  layer.innerHTML = '';
  if (linesSvg) linesSvg.innerHTML = '';

  twinLabelDefs = getLabelDefs(scene.twinType);

  twinLabelDefs.forEach(def => {
    const el = document.createElement('div');
    el.className = 'twin-label';
    el.id = 'twlbl-' + def.id;
    el.innerHTML = `
      <div class="twin-label-tag">
        <span class="twin-label-dot ${def.dotClass}"></span>
        <span>${def.label}</span>
        <span class="twin-label-value">${def.value}</span>
        <span class="twin-label-unit">${def.unit}</span>
      </div>`;
    layer.appendChild(el);
  });
}

function updateTwinLabels(scene3d, camera, modelGroup, twinType) {
  const layer = document.getElementById('twinLabels');
  const linesSvg = document.getElementById('twinLabelLines');
  if (!layer || !linesSvg) return;
  const container = document.getElementById('twinContainer');
  if (!container) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w < 50) return;

  let svgParts = [];
  const cx = w / 2, cy = h / 2;
  const labelOffset = 70; // px away from model surface

  twinLabelDefs.forEach(def => {
    const el = document.getElementById('twlbl-' + def.id);
    if (!el) return;

    // Transform label position by model's world matrix (handles rotation)
    const worldPos = new THREE.Vector3(def.x, def.y, def.z);
    if (modelGroup) worldPos.applyMatrix4(modelGroup.matrixWorld);
    const screenPos = worldPos.clone().project(camera);

    const sx = (screenPos.x * 0.5 + 0.5) * w;
    const sy = (-screenPos.y * 0.5 + 0.5) * h;

    // Check if behind camera or off screen
    if (screenPos.z > 1 || sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) {
      el.style.opacity = '0';
      return;
    }

    // Offset label outward from model center on screen
    const dx = sx - cx;
    const dy = sy - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const lx = sx + (dx / dist) * labelOffset;
    const ly = sy + (dy / dist) * labelOffset;

    el.style.opacity = '1';
    el.style.left = lx + 'px';
    el.style.top = ly + 'px';

    // Leader line from label to anchor dot on model surface
    const colors = { hot: '#ff4444', warm: '#ffaa00', cool: '#00d4ff', green: '#00ff88' };
    const c = colors[def.dotClass] || '#00d4ff';
    svgParts.push(`<line stroke="${c}" stroke-opacity="0.4" stroke-width="1" stroke-dasharray="3 3" x1="${lx}" y1="${ly}" x2="${sx}" y2="${sy}"/>`);
    svgParts.push(`<circle fill="${c}" fill-opacity="0.8" cx="${sx}" cy="${sy}" r="2.5"/>`);
  });

  linesSvg.innerHTML = svgParts.join('');
}

function getLabelDefs(twinType) {
  const now = Date.now() * 0.001;
  const shared = {
    rotaryKiln: [
      // Shell center y=2.2, horizontal, r=0.87, x=-2.75..2.75
      // Hot zone at (0.5, 2.2, 0)
      { id: 'temp-hot', x: 0.5, y: 2.2, z: 0.88, label: '高温区', value: '1250', unit: '°C', dotClass: 'hot' },
      // Feed chute at (-3.0, 3.0, 0), sits on inlet hood
      { id: 'temp-inlet', x: -3.0, y: 3.1, z: 0.25, label: '进料口', value: '3.2', unit: 't/h', dotClass: 'cool' },
      // Exhaust stack at (3.0, 3.3, 0), h=2.0, top at y=4.3
      { id: 'temp-outlet', x: 3.0, y: 4.3, z: 0.22, label: '排烟', value: '420', unit: '°C', dotClass: 'warm' },
      // Stack cap area for CO2
      { id: 'co2-stack', x: 3.0, y: 4.55, z: 0.3, label: 'CO₂浓度', value: '18.5', unit: '%', dotClass: 'green' },
      // Gear ring at (0.5, 2.2, 0), TorusGeometry(0.95, 0.08) → outer r=0.97
      { id: 'rpm-ring', x: 0.5, y: 2.2, z: -0.98, label: '转速', value: '82', unit: 'rpm', dotClass: 'cool' },
      // Shell surface near hot zone
      { id: 'fuel-flow', x: -0.9, y: 2.2, z: 0.88, label: '燃料流量', value: '2.4', unit: 'm³/h', dotClass: 'warm' },
      // Outlet hood slag area: hood at (3.0, 2.2, 0), bottom surface
      { id: 'slag-temp', x: 2.8, y: 2.2, z: 0.88, label: '窑渣温度', value: '980', unit: '°C', dotClass: 'hot' },
    ],
    blastFurnace: [
      // Belly at y=3.2, r=1.2 (widest)
      { id: 'temp-hot', x: 0, y: 3.2, z: 1.2, label: '高温区', value: '1550', unit: '°C', dotClass: 'hot' },
      // Bosh at y=2.2, mid-radius ≈ 0.97
      { id: 'tuyere', x: 0.97, y: 2.2, z: 0, label: '炉腹', value: '1350', unit: '°C', dotClass: 'warm' },
      // Throat top at y=7.3+0.4=7.7, r≈0.4
      { id: 'top-gas', x: 0, y: 7.7, z: 0.42, label: '炉顶', value: '250', unit: '°C', dotClass: 'cool' },
      // Near top cone
      { id: 'co2-top', x: 0.42, y: 7.5, z: 0, label: 'CO₂浓度', value: '22.3', unit: '%', dotClass: 'green' },
      // Tap hole at (1.15, 0.85, 0)
      { id: 'tap-hole', x: 1.15, y: 0.85, z: 0.2, label: '出铁口', value: '1480', unit: '°C', dotClass: 'hot' },
      // Belly surface
      { id: 'fuel-rate', x: -1.2, y: 3.5, z: 0, label: '喷煤量', value: '12.5', unit: 't/h', dotClass: 'warm' },
      // Belly surface
      { id: 'blast-vol', x: 0, y: 3.8, z: 1.2, label: '炉腰', value: '1450', unit: '°C', dotClass: 'cool' },
    ],
    flashFurnace: [
      // reactHot at y=3.2, r=0.68
      { id: 'temp-hot', x: 0, y: 3.2, z: 0.69, label: '反应区', value: '1350', unit: '°C', dotClass: 'hot' },
      // Burner at y=4.7, cone r=0.4 at base
      { id: 'burner', x: 0, y: 4.8, z: 0.38, label: '精矿喷嘴', value: '4.5', unit: 't/h', dotClass: 'cool' },
      // Shaft top surface for SO2
      { id: 'off-gas', x: 0, y: 4.3, z: 0.72, label: '烟气SO₂', value: '12.8', unit: '%', dotClass: 'green' },
      // Matte tap at (-1.15, 0.7, 0)
      { id: 'matte', x: -1.15, y: 0.7, z: 0.2, label: '冰铜出口', value: '1220', unit: '°C', dotClass: 'hot' },
      // Slag tap at (1.25, 0.55, 0)
      { id: 'slag-tap', x: 1.25, y: 0.55, z: 0.2, label: '炉渣出口', value: '1280', unit: '°C', dotClass: 'warm' },
      // Shaft surface
      { id: 'o2-enrich', x: 0, y: 3.8, z: 0.72, label: '富氧浓度', value: '92', unit: '%', dotClass: 'cool' },
    ],
    electrolyticCell: [
      // Electrolyte at y=0.85, z half=0.75
      { id: 'temp-cell', x: 0, y: 0.85, z: 0.75, label: '电解温度', value: '960', unit: '°C', dotClass: 'hot' },
      // Bus bar at y=2.1, z=0.8
      { id: 'voltage', x: 0, y: 2.1, z: 0.85, label: '槽电压', value: '4.15', unit: 'V', dotClass: 'cool' },
      // Rod at x≈1.7, y=2.0
      { id: 'current', x: 1.7, y: 2.0, z: 0, label: '电流', value: '320', unit: 'kA', dotClass: 'warm' },
      // Gas exhaust pipe top: y=3.2+0.75=3.95, r=0.2
      { id: 'co2-cell', x: 0, y: 3.7, z: 0.2, label: 'CO₂排放', value: '22.4', unit: 't/d', dotClass: 'green' },
      // Rod at x≈-1.3, y=2.0
      { id: 'anode-pos', x: -1.3, y: 2.0, z: 0, label: '阳极位置', value: '18.5', unit: 'cm', dotClass: 'cool' },
    ],
    crackingFurnace: [
      // Radiant hot zone at y=1.9, r=0.62
      { id: 'temp-rad', x: 0, y: 1.9, z: 0.63, label: '辐射段', value: '850', unit: '°C', dotClass: 'hot' },
      // Convection at y=4.5, rBot=0.6
      { id: 'temp-conv', x: 0, y: 4.5, z: 0.6, label: '对流段', value: '620', unit: '°C', dotClass: 'warm' },
      // Convection surface
      { id: 'feed-in', x: 0.57, y: 5.0, z: 0, label: '进料段', value: '38', unit: 't/h', dotClass: 'cool' },
      // Stack at y=6.3, r≈0.22
      { id: 'co2-stack', x: 0, y: 6.3, z: 0.23, label: 'CO₂浓度', value: '16.2', unit: '%', dotClass: 'green' },
      // Radiant bottom surface
      { id: 'burner-flame', x: 0.62, y: 0.6, z: 0, label: '燃烧段', value: '1100', unit: '°C', dotClass: 'hot' },
    ]
  };

  // Animate values slightly
  const variation = Math.sin(now * 0.7) * 0.05;
  const defs = (shared[twinType] || shared.rotaryKiln).map(d => ({...d}));
  defs.forEach(d => {
    if (d.unit === '°C' && d.value) d.value = Math.round(parseFloat(d.value) * (1 + variation));
    if (d.unit === '%' && d.value) d.value = (parseFloat(d.value) * (1 + variation * 0.5)).toFixed(1);
  });
  return defs;
}

function resetTwinView() {
  if (!currentTwin) return;
  currentTwin.orbitTarget.x = 0;
  currentTwin.orbitTarget.y = 0;
  currentTwin.panTarget.set(0, 1.5, 0);
  twinZoomLevel = 13;
}

function toggleTwinAutoRotate() {
  twinAutoRotate = !twinAutoRotate;
}

function updateTwinSize() {
  if (!currentTwin || !currentTwin.container) return;
  const w = currentTwin.container.clientWidth;
  const h = currentTwin.container.clientHeight;
  currentTwin.renderer.setSize(w, h);
  currentTwin.camera.aspect = w / h;
  currentTwin.camera.updateProjectionMatrix();
}

// ==================== SCENE DETAIL ====================
function isNoDataScene(scene) {
  return scene.reduction === '--' && scene.efficiency === '--';
}

function openSceneDetail(sceneId) {
  const scene = SCENES.find(s => s.id === sceneId);
  if (!scene) return;

  if (scene.status === 'developing') {
    showModal(
      '场景开发中',
      `<p style="color:var(--text-secondary);line-height:1.8;">
        <strong>${scene.name}</strong> 的低碳运行智能监控系统正在开发中。<br><br>
        该场景属于 <span class="tag tag-blue">${scene.industry}</span>，位于 <span class="tag tag-purple">${scene.location}</span>。<br><br>
        您可以通过 <strong style="color:var(--accent-primary);">新增场景</strong> 功能完成该场景的系统构建。
      </p>`,
      [
        { text: '前往新增场景', class: 'btn-primary', action: () => { closeModal(); switchView('config-dev'); } },
        { text: '返回', class: 'btn-secondary', action: closeModal }
      ]
    );
    return;
  }

  currentSceneId = sceneId;
  const noData = isNoDataScene(scene);

  document.getElementById('sceneDetailTitle').textContent = scene.name + ' · 低碳运行智能监控';
  document.getElementById('sceneDetailStatus').textContent = noData ? '● 待采集数据' : '● 运行中';
  document.getElementById('sceneDetailStatus').className = noData ? 'tag tag-orange' : 'tag tag-green';

  // Stats
  document.getElementById('sceneDetailStats').innerHTML = noData ? `
    <div class="stat-card"><div class="stat-card-icon blue">♻</div><div class="stat-value" style="font-size:16px;color:var(--text-dim);">无数据</div><div class="stat-label">碳减排率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon green">◎</div><div class="stat-value" style="font-size:16px;color:var(--text-dim);">无数据</div><div class="stat-label">综合运行效率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon purple">⛁</div><div class="stat-value" style="font-size:16px;color:var(--text-dim);">无数据</div><div class="stat-label">日均CO₂排放</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon orange">⚡</div><div class="stat-value" style="font-size:16px;color:var(--text-dim);">无数据</div><div class="stat-label">能源利用率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
  ` : `
    <div class="stat-card"><div class="stat-card-icon blue">♻</div><div class="stat-value">${scene.reduction}<span style="font-size:18px">%</span></div><div class="stat-label">碳减排率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon green">◎</div><div class="stat-value">${scene.efficiency}<span style="font-size:18px">%</span></div><div class="stat-label">综合运行效率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon purple">⛁</div><div class="stat-value">${scene.co2Daily}</div><div class="stat-label">日均CO₂排放</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon orange">⚡</div><div class="stat-value">${scene.energyRate}</div><div class="stat-label">能源利用率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
  `;

  // Equipment table
  const eqBody = document.querySelector('#view-scene-detail #equipmentTable tbody');
  if (eqBody) {
    eqBody.innerHTML = scene.equipment.map(e => `
      <tr>
        <td>${e.name}</td><td>${e.type}</td>
        <td><span class="tag ${e.status==='运行正常'?'tag-green':''}" style="${e.status!=='运行正常'?'background:rgba(255,170,0,0.1);color:var(--accent-warning);border:1px solid rgba(255,170,0,0.25);':''}">${e.status}</span></td>
        <td class="mono">${noData ? '--' : e.efficiency}</td><td class="mono">${noData ? '--' : e.co2}</td>
      </tr>`).join('');
  }

  // Reset AI panel
  const aiBody = document.getElementById('aiPanelBody');
  if (aiBody) {
    if (noData) {
      aiBody.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-dim);">
          <div style="font-size:48px;margin-bottom:12px;">📡</div>
          <div style="font-size:14px;">场景数据采集中<br><span style="color:var(--accent-warning);">暂无可分析数据</span></div>
        </div>`;
    } else {
      aiBody.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-dim);">
          <div style="font-size:48px;margin-bottom:12px;">🤖</div>
          <div style="font-size:14px;">点击上方 <span style="color:var(--accent-primary);">「AI 一键分析」</span> 按钮<br>获取当前场景智能诊断报告</div>
        </div>`;
    }
  }
  document.getElementById('aiStatus').textContent = noData ? '无数据' : '就绪';

  switchView('scene-detail');
  setTimeout(() => {
    renderSceneDetailCharts();
  }, 200);
}

function renderSceneDetailCharts() {
  const scene = SCENES.find(s => s.id === currentSceneId);
  if (!scene) return;

  if (isNoDataScene(scene)) {
    // Show no-data placeholders in chart containers
    ['chartSceneRealtime', 'chartParams'].forEach(id => {
      const dom = document.getElementById(id);
      if (dom) dom.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:14px;">📡 暂无数据</div>';
      if (chartInstances[id]) { chartInstances[id].dispose(); delete chartInstances[id]; }
    });
    return;
  }
  renderSceneRealtimeChart();
  renderSceneParamsChart();
}

function renderSceneRealtimeChart() {
  const chart = getChart('chartSceneRealtime');
  if (!chart) return;
  const times = [], co2Vals = [], baseVals = [];
  const now = new Date();
  for (let i = 24; i >= 0; i--) {
    const t = new Date(now - i * 60000);
    times.push(t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0'));
    co2Vals.push((28 + Math.random() * 8).toFixed(1));
    baseVals.push((32 + Math.random() * 6).toFixed(1));
  }
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 }, data: ['实时CO₂','基准线'] },
    grid: { left: 50, right: 30, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: 'rgba(0,168,255,0.2)' } }, axisLabel: { color: '#64748b', fontSize: 9, interval: 5 } },
    yAxis: { type: 'value', name: 'CO₂ (t/h)', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }, axisLabel: { color: '#64748b' }, nameTextStyle: { color: '#64748b' } },
    series: [
      { name: '基准线', type: 'line', data: baseVals, lineStyle: { color: 'rgba(255,59,92,0.4)', width: 1.5, type: 'dashed' }, symbol: 'none' },
      { name: '实时CO₂', type: 'line', data: co2Vals, lineStyle: { color: '#00d4ff', width: 2, shadowBlur: 8, shadowColor: 'rgba(0,212,255,0.4)' }, itemStyle: { color: '#00d4ff' }, symbol: 'circle', symbolSize: 4, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{ offset: 0, color: 'rgba(0,212,255,0.12)' },{ offset: 1, color: 'rgba(0,212,255,0)' }]) } }
    ]
  });
}

function renderSceneParamsChart() {
  const chart = getChart('chartParams');
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 }, data: ['当前值','优化建议'] },
    grid: { left: 60, right: 30, top: 30, bottom: 40 },
    radar: {
      center: ['50%', '45%'], radius: '65%',
      indicator: [
        { name: '窑内温度', max: 1600 }, { name: '进料速率', max: 10 }, { name: '空气配比', max: 1.0 },
        { name: '窑体转速', max: 100 }, { name: '燃料流量', max: 15 }, { name: '排烟温度', max: 700 }
      ],
      axisName: { color: '#94a3b8', fontSize: 10 },
      splitArea: { areaStyle: { color: ['rgba(0,168,255,0.02)','rgba(0,168,255,0.02)'] } },
      splitLine: { lineStyle: { color: 'rgba(0,168,255,0.1)' } },
      axisLine: { lineStyle: { color: 'rgba(0,168,255,0.15)' } }
    },
    series: [{
      type: 'radar',
      data: [
        { value: [1350, 4.5, 0.92, 75, 3.8, 520], name: '当前值', areaStyle: { color: 'rgba(0,212,255,0.15)' }, lineStyle: { color: '#00d4ff', width: 2 }, itemStyle: { color: '#00d4ff' } },
        { value: [1250, 3.2, 0.85, 82, 2.4, 420], name: '优化建议', areaStyle: { color: 'rgba(0,255,136,0.1)' }, lineStyle: { color: '#00ff88', width: 2, type: 'dashed' }, itemStyle: { color: '#00ff88' } }
      ]
    }]
  });
}

// ==================== AI ANALYSIS ====================
function runAIAnalysis() {
  if (!currentSceneId) return;
  const scene = SCENES.find(s => s.id === currentSceneId);
  if (!scene) return;

  const aiBody = document.getElementById('aiPanelBody');
  const aiStatus = document.getElementById('aiStatus');
  if (!aiBody || !aiStatus) return;

  // Show thinking
  aiStatus.textContent = '分析中...';
  aiBody.innerHTML = `
    <div class="ai-message">
      <div class="ai-avatar">AI</div>
      <div class="ai-bubble">
        <div style="margin-bottom:8px;">正在分析 <span class="highlight">${scene.name}</span> 的运行数据...</div>
        <div class="ai-typing">
          <div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div>
        </div>
      </div>
    </div>`;

  // Generate analysis after delay
  setTimeout(() => {
    const analysis = generateSceneAnalysis(scene);
    aiBody.innerHTML = analysis;
    aiStatus.textContent = '分析完成';
  }, 2000);
}

function generateSceneAnalysis(scene) {
  const alerts = scene.alerts || 0;
  const hasIssues = alerts > 0;

  let html = '';

  // Summary
  html += `
    <div class="ai-message">
      <div class="ai-avatar">AI</div>
      <div class="ai-bubble">
        <div style="font-weight:600;margin-bottom:8px;font-size:14px;">📋 综合诊断报告 —— ${scene.name}</div>

        <div class="report-card">
          <div class="report-card-title">🔍 <span style="color:var(--accent-primary);">核心发现</span></div>
          <div style="font-size:13px;line-height:1.7;color:var(--text-secondary);">
            <p>当前<span class="highlight">碳减排率 ${scene.reduction}%</span>，处于行业领先水平；
            综合运行效率 <span class="${scene.efficiency > 90 ? 'good' : 'warning'}">${scene.efficiency}%</span>，
            ${scene.efficiency > 90 ? '表现良好，主要得益于优化控制算法的持续迭代。' : '尚有提升空间，建议关注关键设备效率。'}</p>
            <p style="margin-top:8px;">日均CO₂排放 <span class="highlight">${scene.co2Daily}</span>，
            能源利用率 <span class="good">${scene.energyRate}</span>。
            ${hasIssues ? `<span class="danger">当前存在 ${alerts} 条活跃告警需要关注。</span>` : '<span class="good">当前无活跃告警，系统运行状态良好。</span>'}</p>
          </div>
        </div>`;

  // Problems
  html += `
    <div class="report-card">
      <div class="report-card-title">⚠️ <span style="color:var(--accent-warning);">存在问题</span></div>
      <ul class="report-card-list">
        ${hasIssues ? getSceneProblems(scene) : '<li style="color:var(--accent-tertiary);">未发现明显的系统性问题，建议继续保持当前运维策略。</li>'}
      </ul>
    </div>`;

  // Suggestions
  html += `
    <div class="report-card">
      <div class="report-card-title">💡 <span style="color:var(--accent-tertiary);">优化建议</span></div>
      <div class="ai-suggestions">
        ${getSceneSuggestions(scene)}
      </div>
    </div>`;

  // Forecast
  const potReduction = (scene.reduction + Math.random() * 5 + 1).toFixed(1);
  html += `
    <div class="report-card">
      <div class="report-card-title">📈 <span style="color:var(--accent-purple);">减排预测</span></div>
      <div style="font-size:13px;line-height:1.7;color:var(--text-secondary);">
        <p>若实施上述优化建议，预计可将碳减排率提升至 <span class="highlight">${potReduction}%</span>，
        每月额外减少碳排放约 <span class="good">${(Math.random()*50+20).toFixed(1)} 吨CO₂</span>。</p>
        <div class="progress-bar" style="margin-top:10px;">
          <div class="progress-fill" style="width:${potReduction}%;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:var(--text-dim);">
          <span>当前: ${scene.reduction}%</span><span>目标: ${potReduction}%</span>
        </div>
      </div>
    </div>`;

  html += `
      </div>
    </div>`;

  return html;
}

function getSceneProblems(scene) {
  const problemsByScene = {
    'steel': [
      '<span class="danger">热风炉效率下降至86.3%</span>，低于正常运行阈值（>90%），可能因换热器积灰导致',
      '<span class="danger">TRT发电设备效率82.5%</span>，低于设计值（>88%），影响余能回收效率',
      '高炉燃料流量波动幅度±15%，<span class="warning">工况稳定性有待提升</span>',
    ],
    'zinc': [
      '下料装置运行效率 <span class="warning">88.1%</span>，建议安排预防性维护',
      '窑体转速与进料量匹配度 <span class="warning">偏低</span>，可能导致局部过烧',
      '排烟温度存在 <span class="warning">周期性波动</span>，需检查鼓风系统稳定性',
    ],
    'copper': [
      '精矿喷嘴存在 <span class="warning">轻微结瘤</span>，需定期清理维护',
    ]
  };
  return problemsByScene[scene.id] ? problemsByScene[scene.id].join('') : '<li>设备运行状态基本正常，建议持续监测关键指标。</li>';
}

function getSceneSuggestions(scene) {
  const suggestionsByScene = {
    'steel': [
      { text: '建议检修热风炉换热器，恢复效率至90%以上', tag: '高优先', tagClass: '' },
      { text: '优化TRT透平叶片角度，提升发电效率', tag: '中优先', tagClass: 'tag-blue' },
      { text: '启用自适应喷煤量控制模型，稳定燃料流量', tag: '建议', tagClass: 'tag-purple' },
      { text: '高炉操作参数微调：风温+15°C，富氧率+0.5%', tag: '参数优化', tagClass: 'tag-green' },
    ],
    'zinc': [
      { text: '安排下料装置预防性维护，恢复效率至92%以上', tag: '高优先', tagClass: '' },
      { text: '启用窄区间多变量协同优化控制模型', tag: '建议', tagClass: 'tag-blue' },
      { text: '优化空气配比至0.88，预计可提高燃烧效率3.5%', tag: '参数优化', tagClass: 'tag-green' },
    ],
    'copper': [
      { text: '清理精矿喷嘴结瘤，恢复雾化效果', tag: '建议', tagClass: 'tag-blue' },
      { text: '持续优化富氧浓度控制策略，目标92%→94%', tag: '参数优化', tagClass: 'tag-green' },
    ]
  };
  const items = suggestionsByScene[scene.id] || [
    { text: '保持当前运维策略，定期检查关键设备', tag: '建议', tagClass: 'tag-blue' },
  ];
  return items.map((s, i) => `
    <div class="ai-suggestion-item">
      <div class="ai-suggestion-num">${i+1}</div>
      <div class="ai-suggestion-text">${s.text}</div>
      <span class="ai-suggestion-tag tag ${s.tagClass || ''}" style="${s.tag === '高优先' ? 'background:rgba(255,59,92,0.1);color:var(--accent-danger);border:1px solid rgba(255,59,92,0.2);' : ''}">${s.tag}</span>
    </div>
  `).join('');
}

// ==================== VISUAL COMPONENT BUILDER (组态化开发) ====================
let canvasNodes = [];
let connections = [];
let nodeIdCounter = 0;
let connectingFrom = null; // { nodeId, portType }

function initComposer() {
  // Composer tab toggle (模型库 / 组件库)
  document.querySelectorAll('.composer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.composer-tab').forEach(t => {
        t.classList.remove('active');
        t.style.borderBottomColor = 'transparent';
        t.style.color = 'var(--text-dim)';
      });
      tab.classList.add('active');
      tab.style.borderBottomColor = 'var(--accent-primary)';
      tab.style.color = 'var(--accent-primary)';
      document.querySelectorAll('.composer-tab-panel').forEach(p => p.style.display = 'none');
      const target = document.getElementById('tab-' + tab.dataset.tab);
      if (target) target.style.display = '';
    });
  });

  // Category toggle
  document.querySelectorAll('.composer-category').forEach(cat => {
    cat.addEventListener('click', () => {
      document.querySelectorAll('.composer-category').forEach(c => c.classList.remove('active'));
      cat.classList.add('active');
      document.querySelectorAll('.composer-items').forEach(items => items.style.display = 'none');
      const target = document.getElementById('cat-' + cat.dataset.cat);
      if (target) target.style.display = '';
    });
  });

  // Drag start for component items
  document.querySelectorAll('.composer-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: item.dataset.type,
        icon: item.dataset.icon,
        label: item.dataset.label,
        isModel: item.dataset.model === 'true'
      }));
      e.dataTransfer.effectAllowed = 'copy';
    });
  });
}

function handleDrop(e) {
  e.preventDefault();
  const canvas = document.getElementById('composerCanvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left + canvas.scrollLeft;
  const y = e.clientY - rect.top + canvas.scrollTop;

  try {
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    addCanvasNode(data.type, data.icon, data.label, x, y, data.isModel);
  } catch (err) {
    // ignore
  }
}

function addCanvasNode(type, icon, label, x, y, isModel) {
  const id = 'node-' + (++nodeIdCounter);
  const node = { id, type, icon, label, x, y, isModel: !!isModel };
  canvasNodes.push(node);
  renderCanvasNodes();
  updateConnectionSvg();
}

function renderCanvasNodes() {
  const container = document.getElementById('canvasNodes');
  if (!container) return;

  container.innerHTML = canvasNodes.map(n => `
    <div class="canvas-node${n.isModel ? ' model-node' : ''}" id="${n.id}"
         style="left:${n.x}px;top:${n.y}px;${n.isModel ? 'border-color:rgba(0,180,255,0.5);' : ''}"
         onmousedown="startDragNode(event, '${n.id}')"
         oncontextmenu="deleteNode(event, '${n.id}')"
         onclick="selectNode(event, '${n.id}')">
      <div class="canvas-node-header">
        <span>${n.icon}</span>
        <span>${n.label}</span>
        ${n.isModel ? '<span style="font-size:9px;color:var(--accent-primary);margin-left:auto;">模型库</span>' : ''}
      </div>
      <div class="canvas-node-type">${n.type}</div>
      <div class="canvas-node-port output" onclick="event.stopPropagation();startConnection('${n.id}', 'output')" title="输出端口"></div>
      <div class="canvas-node-port input" onclick="event.stopPropagation();startConnection('${n.id}', 'input')" title="输入端口"></div>
    </div>
  `).join('');
}

function startDragNode(e, id) {
  e.preventDefault();
  const nodeEl = document.getElementById(id);
  const canvas = document.getElementById('composerCanvas');
  const startX = e.clientX;
  const startY = e.clientY;
  const origLeft = nodeEl.offsetLeft;
  const origTop = nodeEl.offsetTop;

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const newLeft = origLeft + dx;
    const newTop = origTop + dy;

    const nodeData = canvasNodes.find(n => n.id === id);
    if (nodeData) {
      nodeData.x = Math.max(0, newLeft);
      nodeData.y = Math.max(0, newTop);
    }
    nodeEl.style.left = Math.max(0, newLeft) + 'px';
    nodeEl.style.top = Math.max(0, newTop) + 'px';
    updateConnectionSvg();
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function deleteNode(e, id) {
  e.preventDefault();
  e.stopPropagation();
  canvasNodes = canvasNodes.filter(n => n.id !== id);
  connections = connections.filter(c => c.from !== id && c.to !== id);
  renderCanvasNodes();
  updateConnectionSvg();
  if (connectingFrom && connectingFrom.nodeId === id) connectingFrom = null;
}

function selectNode(e, id) {
  e.stopPropagation();
  document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
  document.getElementById(id)?.classList.add('selected');

  const node = canvasNodes.find(n => n.id === id);
  if (node) {
    showNodeProperties(node);
  }
}

function showNodeProperties(node) {
  const props = document.getElementById('composerProps');
  if (!props) return;

  const migForm = node.isModel ? `
    <div class="glow-divider"></div>
    <div style="font-size:11px;color:var(--accent-primary);margin-bottom:8px;">⚡ 模型数据迁移配置</div>
    <div class="form-group" style="margin-bottom:8px;">
      <label class="form-label">数据源绑定</label>
      <select class="form-input" style="font-size:11px;padding:6px;" id="propsMigDS">
        <option value="">选择数据源</option>
        <option value="rtdb">实时数据库 (RTDB)</option>
        <option value="opc">OPC UA 服务器</option>
        <option value="mqtt">MQTT 数据流</option>
        <option value="hist">历史数据库</option>
      </select>
    </div>
    <div class="form-group" style="margin-bottom:8px;">
      <label class="form-label">训练数据集</label>
      <select class="form-input" style="font-size:11px;padding:6px;" id="propsMigDataset">
        <option value="">选择数据集</option>
        <option value="hist-6m">历史运行数据 (6个月)</option>
        <option value="sim-steel">仿真模拟数据 (钢铁)</option>
        <option value="sim-nonferrous">仿真模拟数据 (有色)</option>
        <option value="edge-collect">边缘端采集数据</option>
      </select>
    </div>
    <div class="form-group" style="margin-bottom:8px;">
      <label class="form-label">迁移策略</label>
      <select class="form-input" style="font-size:11px;padding:6px;" id="propsMigStrategy">
        <option value="">选择策略</option>
        <option value="finetune">微调 (Fine-tuning)</option>
        <option value="transfer">迁移学习 (Transfer)</option>
        <option value="retrain">增量重训练</option>
        <option value="adapt">领域自适应</option>
      </select>
    </div>
    <button class="btn btn-sm btn-primary" onclick="applyModelMigrationFromProps('${node.id}')" style="width:100%;margin-top:6px;">
      ⚡ 应用迁移配置
    </button>
  ` : '';

  props.innerHTML = `
    <div class="panel" style="height:100%;">
      <div class="panel-header"><div class="panel-title">${node.isModel ? '🤖 模型配置' : '属性配置'}</div></div>
      <div style="padding:14px;overflow-y:auto;max-height:calc(100% - 40px);">
        <div class="form-group">
          <label class="form-label">组件名称</label>
          <input class="form-input" value="${node.label}" onchange="updateNodeProp('${node.id}','label',this.value)">
        </div>
        <div class="form-group">
          <label class="form-label">类型</label>
          <input class="form-input" value="${node.type}" readonly style="opacity:0.6;">
        </div>
        ${node.isModel ? `<span class="tag tag-blue" style="margin-top:4px;display:inline-block;">📦 模型库节点</span>` : ''}
        <div class="form-group">
          <label class="form-label">位置 X</label>
          <input class="form-input" value="${Math.round(node.x)}" onchange="updateNodeProp('${node.id}','x',parseInt(this.value));renderCanvasNodes();updateConnectionSvg();">
        </div>
        <div class="form-group">
          <label class="form-label">位置 Y</label>
          <input class="form-input" value="${Math.round(node.y)}" onchange="updateNodeProp('${node.id}','y',parseInt(this.value));renderCanvasNodes();updateConnectionSvg();">
        </div>
        <div class="glow-divider"></div>
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">连接信息</div>
        <div style="font-size:12px;color:var(--text-secondary);">
          ${connections.filter(c => c.from === node.id).length} 个输出连接<br>
          ${connections.filter(c => c.to === node.id).length} 个输入连接
        </div>
        ${migForm}
      </div>
    </div>
  `;
}

function applyModelMigrationFromProps(nodeId) {
  const node = canvasNodes.find(n => n.id === nodeId);
  if (!node) return;
  const ds = document.getElementById('propsMigDS')?.value || '';
  const dataset = document.getElementById('propsMigDataset')?.value || '';
  const strategy = document.getElementById('propsMigStrategy')?.value || '';
  if (!ds || !dataset || !strategy) {
    alert('请完整填写模型迁移配置参数。');
    return;
  }
  // Activate cloud-edge port
  const dot = document.getElementById('cePortDot');
  const status = document.getElementById('cePortStatus');
  if (dot && status) {
    dot.classList.add('connected');
    status.textContent = '已连接 · 待协同';
    status.style.color = 'var(--accent-tertiary)';
  }
  alert('✅ 模型 [' + node.label + '] 数据迁移配置已应用！\n\n数据源: ' + ds + '\n数据集: ' + dataset + '\n策略: ' + strategy);
}

function updateNodeProp(id, key, value) {
  const node = canvasNodes.find(n => n.id === id);
  if (node) node[key] = value;
}

function startConnection(nodeId, portType) {
  if (!connectingFrom) {
    connectingFrom = { nodeId, portType };
    // Highlight all ports
    document.querySelectorAll('.canvas-node-port').forEach(p => p.style.boxShadow = '0 0 10px rgba(0,255,136,0.6)');
    document.getElementById(nodeId).classList.add('selected');
  } else {
    // Complete connection
    const fromNode = canvasNodes.find(n => n.id === connectingFrom.nodeId);
    const toNode = canvasNodes.find(n => n.id === nodeId);

    if (connectingFrom.nodeId !== nodeId && fromNode && toNode) {
      if (connectingFrom.portType === 'output' && portType === 'input') {
        connections.push({ from: connectingFrom.nodeId, to: nodeId });
      } else if (connectingFrom.portType === 'input' && portType === 'output') {
        connections.push({ from: nodeId, to: connectingFrom.nodeId });
      }
    }

    connectingFrom = null;
    document.querySelectorAll('.canvas-node-port').forEach(p => p.style.boxShadow = '');
    document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
    updateConnectionSvg();
  }
}

function updateConnectionSvg() {
  const svg = document.getElementById('connectionSvg');
  if (!svg) return;
  const canvas = document.getElementById('composerCanvas');

  let paths = '';
  connections.forEach(conn => {
    const fromEl = document.getElementById(conn.from);
    const toEl = document.getElementById(conn.to);
    if (fromEl && toEl) {
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();

      const x1 = (fromRect.right - canvasRect.left + canvas.scrollLeft) + 4;
      const y1 = (fromRect.top + fromRect.height / 2 - canvasRect.top + canvas.scrollTop);
      const x2 = (toRect.left - canvasRect.left + canvas.scrollLeft) - 4;
      const y2 = (toRect.top + toRect.height / 2 - canvasRect.top + canvas.scrollTop);

      const midX = (x1 + x2) / 2;
      paths += `<path d="M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}" class="connection-line"/>`;
      // Arrow
      const arrowSize = 6;
      const t = 0.5;
      const ax = Math.pow(1-t,3)*x1 + 3*Math.pow(1-t,2)*t*midX + 3*(1-t)*t*t*midX + Math.pow(t,3)*x2;
      const ay = Math.pow(1-t,3)*y1 + 3*Math.pow(1-t,2)*t*y1 + 3*(1-t)*t*t*y2 + Math.pow(t,3)*y2;
      paths += `<circle cx="${ax}" cy="${ay}" r="3" fill="#00d4ff" opacity="0.7"/>`;
    }
  });
  svg.innerHTML = paths;
}

function clearCanvas() {
  canvasNodes = [];
  connections = [];
  connectingFrom = null;
  nodeIdCounter = 0;
  renderCanvasNodes();
  updateConnectionSvg();
  const props = document.getElementById('composerProps');
  if (props) props.innerHTML = `<div class="panel" style="height:100%;"><div class="panel-header"><div class="panel-title">属性配置</div></div><div style="padding:12px;color:var(--text-dim);text-align:center;font-size:13px;">选择一个组件查看属性</div></div>`;
}

function resetWizard() {
  // Clear canvas state
  clearCanvas();

  // Reset scene name and industry
  const nameInput = document.getElementById('wizSceneName');
  if (nameInput) nameInput.value = '';
  const industrySelect = document.getElementById('wizIndustrySelect');
  if (industrySelect) industrySelect.value = '';

  // Reset to step 1
  goToWizStep(1);

  // Hide deploy completion section, show migration action bar
  const deploySection = document.getElementById('deployCompleteSection');
  if (deploySection) deploySection.style.display = 'none';
  const migBar = document.getElementById('migActionBar');
  if (migBar) migBar.style.display = 'flex';

  // Reset migration progress bar
  const progressBar = document.querySelector('#wizPanel3 .migration-progress div[style*="width"]');
  if (progressBar) progressBar.style.width = '76%';
  const progressText = document.querySelector('#wizPanel3 .migration-progress span:last-child');
  if (progressText) progressText.textContent = '76%';

  // Reset migration stage indicators — restore "边端部署" to pending state
  const stages = document.querySelectorAll('#wizPanel3 [style*="grid-template-columns:repeat(4,1fr)"] > div');
  if (stages.length >= 4) {
    // Stage 1: 格式转换 — already done
    stages[0].innerHTML = '<div style="color:var(--accent-primary);font-size:18px;">✓</div><div style="color:var(--text-secondary);">格式转换</div><div style="color:var(--text-dim);font-size:10px;">PyTorch→ONNX</div>';
    stages[0].style.border = '';
    // Stage 2: 精度校验 — already done
    stages[1].innerHTML = '<div style="color:var(--accent-primary);font-size:18px;">✓</div><div style="color:var(--text-secondary);">精度校验</div><div style="color:var(--text-dim);font-size:10px;">偏差 &lt;1.2%</div>';
    stages[1].style.border = '';
    // Stage 3: 量化压缩 — in progress
    stages[2].innerHTML = '<div style="color:var(--accent-warning);font-size:18px;">⟳</div><div style="color:var(--accent-primary);">量化压缩</div><div style="color:var(--text-dim);font-size:10px;">FP32→INT8</div>';
    stages[2].style.border = '1px solid var(--accent-primary)';
    // Stage 4: 边端部署 — pending
    stages[3].innerHTML = '<div style="color:var(--text-dim);font-size:18px;">○</div><div style="color:var(--text-dim);">边端部署</div><div style="color:var(--text-dim);font-size:10px;">待执行</div>';
    stages[3].style.border = '';
  }

  // Clear terminal and edge node lists
  const termList = document.getElementById('terminalList');
  if (termList) termList.innerHTML = '';
  const edgeList = document.getElementById('edgeNodeList');
  if (edgeList) edgeList.innerHTML = '';

  // Reset cloud-edge port indicator
  const dot = document.getElementById('cePortDot');
  if (dot) dot.classList.remove('connected');
  const status = document.getElementById('cePortStatus');
  if (status) { status.textContent = '未连接'; status.style.color = ''; }
}

function goToWizStep(step) {
  // Update step indicators
  document.querySelectorAll('.wiz-step').forEach(el => {
    el.classList.remove('active', 'done');
    const s = parseInt(el.dataset.step);
    const numEl = el.querySelector('.wiz-step-num');
    if (s === step) {
      el.classList.add('active');
      if (numEl) numEl.textContent = s;
    } else if (s < step) {
      el.classList.add('done');
      if (numEl) numEl.textContent = '✓';
    } else {
      if (numEl) numEl.textContent = s;
    }
  });

  const connectors = document.querySelectorAll('.wiz-step-connector');
  connectors.forEach((el, i) => {
    el.classList.toggle('done', i < step - 1);
  });

  document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('wizPanel' + step);
  if (panel) panel.classList.add('active');

  // When entering step 2, init cloud-edge topology canvas
  if (step === 2) {
    setTimeout(initCeTopoCanvas, 200);
  }
}

function applyModelMigration() {
  const ds = document.getElementById('migDataSource').value;
  const dataset = document.getElementById('migDataset').value;
  const strategy = document.getElementById('migStrategy').value;
  const threshold = document.getElementById('migThreshold').value;

  if (!ds || !dataset || !strategy) {
    alert('请完整填写数据迁移配置参数。');
    return;
  }

  // Connect the cloud-edge port indicator
  const dot = document.getElementById('cePortDot');
  const status = document.getElementById('cePortStatus');
  if (dot && status) {
    dot.classList.add('connected');
    status.textContent = '已连接 · 待协同';
    status.style.color = 'var(--accent-tertiary)';
  }

  const sceneName = document.getElementById('wizSceneName').value || '未命名场景';
  alert('✅ 模型数据迁移配置已应用！\n\n场景: ' + sceneName +
    '\n数据源: ' + ds + '\n数据集: ' + dataset +
    '\n迁移策略: ' + strategy + '\n目标精度: ' + threshold +
    '\n\n云边协同端口已激活，可在下一步配置资源协同。');
}

function executeMigration() {
  const exportFormat = document.getElementById('migExportFormat').value;
  const adaptOpt = document.getElementById('migAdaptOpt').value;
  const sceneName = document.getElementById('wizSceneName').value || '未命名场景';

  // Animate progress bar to 100%
  const progressBar = document.querySelector('.migration-progress div[style*="width"]');
  const progressText = document.querySelector('.migration-progress span:last-child');
  if (progressBar) {
    let p = 76;
    const timer = setInterval(() => {
      p += 2;
      if (p >= 100) {
        clearInterval(timer);
        p = 100;
        // Complete progress — update all stages to done
        const stages = document.querySelectorAll('#wizPanel3 .ce-device, #wizPanel3 [style*="grid-template-columns"] > div');
        // Update the last stage (边端部署) to complete
        const lastStage = document.querySelector('#wizPanel3 [style*="padding:12px;background:var(--bg-primary);border-radius:8px;"]:last-child');
        if (lastStage) {
          lastStage.innerHTML = '<div style="color:var(--accent-tertiary);font-size:18px;">✓</div><div style="color:var(--accent-tertiary);">边端部署</div><div style="color:var(--text-dim);font-size:10px;">部署完成</div>';
          lastStage.style.border = '1px solid var(--accent-tertiary)';
        }
        // Show deploy completion section
        const deploySection = document.getElementById('deployCompleteSection');
        if (deploySection) deploySection.style.display = 'block';
        const migBar = document.getElementById('migActionBar');
        if (migBar) migBar.style.display = 'none';
        const resultText = document.getElementById('deployResultText');
        if (resultText) resultText.textContent = '场景: ' + sceneName + ' | 导出: ' + exportFormat + ' | 优化: ' + adaptOpt;
        // Scroll to deploy section
        if (deploySection) deploySection.scrollIntoView({ behavior: 'smooth' });
      }
      if (progressBar) progressBar.style.width = p + '%';
      if (progressText) progressText.textContent = p + '%';
    }, 150);
  }
}

function completeDeployment() {
  const sceneName = document.getElementById('wizSceneName').value || '未命名场景';
  const industry = document.getElementById('wizIndustrySelect')?.value || '钢铁行业';

  // Mark all wizard steps as done
  document.querySelectorAll('.wiz-step').forEach(el => {
    el.classList.remove('active');
    el.classList.add('done');
    const numEl = el.querySelector('.wiz-step-num');
    if (numEl) numEl.textContent = '✓';
  });
  document.querySelectorAll('.wiz-step-connector').forEach(el => el.classList.add('done'));

  // Build equipment from canvas nodes
  const equipment = canvasNodes.map(n => ({
    name: n.label || n.type || '组件',
    type: n.isModel ? '智能模型' : (n.category || '功能组件'),
    status: '运行正常',
    efficiency: (90 + Math.random() * 9).toFixed(1) + '%',
    co2: n.isModel ? '-' : (Math.random() * 5).toFixed(1) + ' t/h'
  }));
  if (equipment.length === 0) {
    equipment.push(
      { name: sceneName + '主体', type: '核心设备', status: '运行正常', efficiency: '94.5%', co2: '6.2 t/h' },
      { name: '监测传感器组', type: '监测设备', status: '运行正常', efficiency: '99.2%', co2: '-' }
    );
  }

  // Industry-specific defaults
  const industryIcons = { '钢铁行业': '🏭', '有色行业': '⚡', '石油化工': '⚗' };
  const industryTwinTypes = { '钢铁行业': 'blastFurnace', '有色行业': 'rotaryKiln', '石油化工': 'crackingFurnace' };
  const locations = { '钢铁行业': '华北区域', '有色行业': '西南区域', '石油化工': '华东区域' };

  // Create new scene — all data fields set to 无数据
  const newId = 'scene_' + Date.now();
  const newScene = {
    id: newId, name: sceneName, industry: industry,
    icon: industryIcons[industry] || '🏭',
    twinType: industryTwinTypes[industry] || 'rotaryKiln',
    desc: sceneName + '——基于数字孪生的全工况碳排放实时监测与智能协同调控',
    status: 'running', reduction: '--', efficiency: '--',
    devices: equipment.length, alerts: 0,
    location: locations[industry] || '华东区域',
    co2Daily: '--', energyRate: '--',
    params: { kilnTemp: '--', inletSpeed: '--', airRatio: '--', speed: '--', slagTemp: '--', exhaustTemp: '--', fuelFlow: '--' },
    equipment: equipment
  };

  SCENES.push(newScene);

  // Add to industry groups
  let group = INDUSTRY_GROUPS.find(g => g.name === industry);
  if (group) {
    group.scenes.push(newId);
  } else {
    INDUSTRY_GROUPS.push({
      name: industry, icon: industryIcons[industry] || '🏭',
      iconClass: industry === '钢铁行业' ? 'steel' : industry === '有色行业' ? 'nonferrous' : 'petrochemical',
      scenes: [newId]
    });
  }

  showModal(
    '🎉 场景部署成功！',
    `<div style="line-height:2;color:var(--text-secondary);">
      <p>场景 <strong style="color:var(--accent-primary);">${sceneName}</strong> 已完成全流程部署。</p>
      <p>所属行业：<span class="tag tag-blue">${industry}</span></p>
      <p>已配置组件：<strong>${equipment.length}</strong> 个</p>
      <p>已建立连接：<strong>${connections.length}</strong> 条</p>
      <p>初始状态：<strong style="color:var(--accent-warning);">待采集数据</strong></p>
      <div class="glow-divider"></div>
      <p style="font-size:12px;color:var(--text-dim);">
        ✓ 组态化系统开发完成<br>
        ✓ 云边端资源协同配置完成<br>
        ✓ 模型自适应迁移完成<br>
        ✓ 碳排监测终端已上线<br>
        ✓ 边缘节点已部署
      </p>
    </div>`,
    [
      { text: '返回驾驶舱', class: 'btn-primary', action: () => { closeModal(); switchView('dashboard'); } },
      { text: '查看场景详情', class: 'btn-secondary', action: () => { closeModal(); openSceneDetail(newId); } }
    ]
  );
}

// Dialog functions
function showAddTerminalDialog() {
  const dlg = document.getElementById('dlgTerminal');
  if (dlg) dlg.style.display = 'flex';
}
function showAddEdgeDialog() {
  const dlg = document.getElementById('dlgEdge');
  if (dlg) dlg.style.display = 'flex';
}
function closeDialog(id) {
  const dlg = document.getElementById(id);
  if (dlg) dlg.style.display = 'none';
}

function addTerminal() {
  const name = document.getElementById('termName').value.trim();
  const type = document.getElementById('termType').value;
  const location = document.getElementById('termLocation').value;
  if (!name) { alert('请输入终端名称'); return; }

  const list = document.getElementById('terminalList');
  if (list) {
    const typeLabels = { co2: 'CO₂监测', temp: '温度监测', flow: '流量监测', multi: '多参数综合' };
    const card = document.createElement('div');
    card.className = 'ce-resource-card';
    card.style.marginBottom = '6px';
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;">📡 ${name}</span>
      <span class="tag tag-green">在线</span>
    </div>
    <div style="font-size:10px;color:var(--text-dim);margin-top:3px;">${location}区域 · ${typeLabels[type] || type} · 采样率1kHz</div>`;
    list.appendChild(card);
  }
  closeDialog('dlgTerminal');
  document.getElementById('termName').value = '';
}

function addEdgeNode() {
  const name = document.getElementById('edgeName').value.trim();
  const location = document.getElementById('edgeLocation').value;
  const hw = document.getElementById('edgeHardware').value;
  if (!name) { alert('请输入节点名称'); return; }

  const list = document.getElementById('edgeNodeList');
  if (list) {
    const hwLabels = { mlu370: 'NPU: MLU370', jetson: 'GPU: Jetson Orin', atlas: 'NPU: Atlas 200', k230: 'NPU: K230' };
    const card = document.createElement('div');
    card.className = 'ce-resource-card';
    card.style.marginBottom = '6px';
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;">◈ ${name}</span>
      <span class="tag tag-blue">${hwLabels[hw] || hw}</span>
    </div>
    <div style="font-size:10px;color:var(--text-dim);margin-top:3px;">${location}区域 · 推理延迟&lt;10ms · 功耗&lt;80W</div>`;
    list.appendChild(card);
  }
  closeDialog('dlgEdge');
  document.getElementById('edgeName').value = '';
}

function exportCanvasConfig() {
  const config = { nodes: canvasNodes, connections: connections, sceneName: document.getElementById('wizSceneName')?.value || '', industry: document.getElementById('wizIndustrySelect')?.value || '' };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = (config.sceneName || 'config') + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importCanvasConfig() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const config = JSON.parse(reader.result);
        if (config.nodes) { canvasNodes = config.nodes; nodeIdCounter = canvasNodes.length; }
        if (config.connections) connections = config.connections;
        if (config.sceneName) document.getElementById('wizSceneName').value = config.sceneName;
        if (config.industry) document.getElementById('wizIndustrySelect').value = config.industry;
        renderCanvasNodes();
        updateConnectionSvg();
      } catch (err) { alert('配置文件格式错误'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function initCeTopoCanvas() {
  const canvas = document.getElementById('ceTopoCanvas');
  if (!canvas) return;
  const container = document.getElementById('ceTopoContainer');
  if (!container) return;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const nodes = container.querySelectorAll('.ce-node');
  const positions = [];
  nodes.forEach(n => {
    const rect = n.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    positions.push({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top + rect.height / 2,
      w: rect.width, h: rect.height
    });
  });

  // Draw animated connection lines
  let offset = 0;
  function draw() {
    if (!canvas.isConnected) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    offset = (offset + 0.3) % 16;

    // Cloud to each edge node
    for (let i = 1; i <= 3 && i < positions.length; i++) {
      drawCeLine(ctx, positions[0], positions[i], offset, 'rgba(0,212,255,0.4)');
    }
    // Edge nodes to devices
    for (let ei = 1; ei <= 3 && ei < positions.length; ei++) {
      for (let di = 4; di < positions.length; di++) {
        drawCeLine(ctx, positions[ei], positions[di], offset, 'rgba(0,255,136,0.2)');
      }
    }

    requestAnimationFrame(draw);
  }

  function drawCeLine(ctx, from, to, off, color) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y + from.h / 2);
    ctx.lineTo(to.x, to.y - to.h / 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -off;
    ctx.stroke();
    ctx.setLineDash([]);

    // Moving dot
    const t = (Date.now() / 2000 + off / 16) % 1;
    const dx = to.x - from.x;
    const dy = (to.y - to.h / 2) - (from.y + from.h / 2);
    const dotX = from.x + dx * t;
    const dotY = (from.y + from.h / 2) + dy * t;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,212,255,0.8)';
    ctx.fill();
  }

  draw();
}

// ==================== CLOUD-EDGE ====================

// ==================== CLOUD-EDGE ====================
function initCloudEdge() {
  // Set up initial state — actual rendering happens in initCloudEdgeView
  // when user first clicks the tab, or here for pre-rendering
  renderCeModelOverview();
  renderCeModelDetail();
}

function initTopoCanvas() {
  const canvas = document.getElementById('topoCanvas');
  const container = document.getElementById('topoContainer');
  if (!canvas || !container) return;

  // Size canvas to match the node container
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  canvas.style.top = (rect.top - canvas.parentElement.getBoundingClientRect().top) + 'px';
  canvas.style.left = (rect.left - canvas.parentElement.getBoundingClientRect().left) + 'px';

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const nodes = container.querySelectorAll('.topo-node');
  const nodePositions = [];
  nodes.forEach(n => {
    const nRect = n.getBoundingClientRect();
    nodePositions.push({ x: nRect.left - rect.left + nRect.width/2, y: nRect.top - rect.top + nRect.height/2, w: nRect.width, h: nRect.height });
  });

  if (nodePositions.length < 4) return;

  let frame = 0;
  function animateLines() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame += 0.02;
    // Cloud center X
    const cloudX = nodePositions[0].x;
    const cloudBot = nodePositions[0].y + nodePositions[0].h/2;

    // Draw cloud → edge lines
    for (let i = 1; i <= 3 && i < nodePositions.length; i++) {
      const alpha = 0.2 + Math.sin(frame + i) * 0.08;
      ctx.beginPath();
      ctx.moveTo(cloudX, cloudBot);
      ctx.lineTo(nodePositions[i].x, nodePositions[i].y - nodePositions[i].h/2);
      ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
      ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -frame * 20;
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Draw edge → device lines
    for (let i = 4; i < nodePositions.length; i++) {
      const edgeIdx = ((i - 4) % 3) + 1;
      if (edgeIdx < nodePositions.length) {
        const alpha = 0.12 + Math.sin(frame + i) * 0.06;
        ctx.beginPath();
        ctx.moveTo(nodePositions[edgeIdx].x, nodePositions[edgeIdx].y + nodePositions[edgeIdx].h/2);
        ctx.lineTo(nodePositions[i].x, nodePositions[i].y - nodePositions[i].h/2);
        ctx.strokeStyle = `rgba(0, 255, 136, ${alpha})`;
        ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -frame * 15;
        ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // Animated dots on cloud → edge lines
    for (let i = 1; i <= 3 && i < nodePositions.length; i++) {
      const t = ((frame * 0.4 + i * 0.3) % 1);
      const x = cloudX + (nodePositions[i].x - cloudX) * t;
      const y = cloudBot + (nodePositions[i].y - nodePositions[i].h/2 - cloudBot) * t;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,212,255,0.9)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,212,255,0.12)'; ctx.fill();
    }

    // Animated dots on edge → device lines
    for (let i = 4; i < nodePositions.length; i++) {
      const edgeIdx = ((i - 4) % 3) + 1;
      if (edgeIdx < nodePositions.length) {
        const t = ((frame * 0.35 + i * 0.25) % 1);
        const sx = nodePositions[edgeIdx].x, sy = nodePositions[edgeIdx].y + nodePositions[edgeIdx].h/2;
        const ex = nodePositions[i].x, ey = nodePositions[i].y - nodePositions[i].h/2;
        const x = sx + (ex - sx) * t, y = sy + (ey - sy) * t;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(0,255,136,0.8)'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(0,255,136,0.1)'; ctx.fill();
      }
    }
    requestAnimationFrame(animateLines);
  }
  animateLines();
}

function renderModelTable() {
  const models = [
    { name: '碳排放状态预测模型', category: '预测模型', version: 'v2.1', status: '运行中', accuracy: '94.5%' },
    { name: '工况在线识别模型', category: '识别模型', version: 'v1.8', status: '运行中', accuracy: '92.3%' },
    { name: '多参数协同优化模型', category: '优化模型', version: 'v3.0', status: '运行中', accuracy: '96.1%' },
    { name: '能耗预测模型', category: '预测模型', version: 'v1.5', status: '运行中', accuracy: '91.8%' },
    { name: '碳足迹追踪模型', category: '分析模型', version: 'v2.3', status: '训练中', accuracy: '93.7%' },
    { name: '设备健康评估模型', category: '诊断模型', version: 'v1.2', status: '运行中', accuracy: '89.4%' },
    { name: '传感器部署优化模型', category: '优化模型', version: 'v3.1', status: '规划中', accuracy: '--' },
    { name: '质量预测模型', category: '预测模型', version: 'v1.0', status: '运行中', accuracy: '90.2%' },
  ];
  const tbody = document.getElementById('modelTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = models.map(m => `
    <tr>
      <td>${m.name}</td>
      <td><span class="tag tag-blue">${m.category}</span></td>
      <td>${m.version}</td>
      <td><span class="tag ${m.status==='运行中'?'tag-green':''}">${m.status}</span></td>
      <td class="mono">${m.accuracy}</td>
      <td><button class="btn btn-sm btn-secondary">详情</button> <button class="btn btn-sm btn-primary">部署</button></td>
    </tr>`).join('');
}

function renderMonitorTable() {
  const monitors = [];
  const types = ['CO₂浓度传感器', '温度传感器', '流量传感器', '压力传感器'];
  const locs = ['回转窑窑头', '回转窑窑尾', '高温反应区', '排气管道', '预热器出口', '鼓风管', '下料口', '出渣口'];
  const statuses = ['在线', '在线', '在线', '在线', '在线', '在线', '在线', '离线'];
  for (let i = 1; i <= 12; i++) {
    monitors.push({
      id: 'CO₂-' + String(i).padStart(3,'0'), loc: locs[(i-1)%locs.length] + ' #' + i,
      type: types[(i-1)%types.length], value: (15 + Math.random()*25).toFixed(1) + ' ppm',
      status: statuses[(i-1)%statuses.length]
    });
  }
  const tbody = document.getElementById('monitorTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = monitors.map(m => `
    <tr>
      <td class="mono">${m.id}</td><td>${m.loc}</td><td>${m.type}</td><td class="mono">${m.value}</td>
      <td><span class="tag ${m.status==='在线'?'tag-green':''}" style="${m.status==='离线'?'background:rgba(255,59,92,0.1);color:var(--accent-danger);border:1px solid rgba(255,59,92,0.2);':''}">${m.status}</span></td>
    </tr>`).join('');
}

function renderDataTable() {
  const records = [];
  const sources = ['温度传感器', 'CO₂传感器', '流量计', '压力计'];
  const types = ['温度', 'CO₂浓度', '流量', '压力'];
  const units = ['°C', 'ppm', 'm³/h', 'MPa'];
  for (let i = 0; i < 8; i++) {
    const now = new Date(Date.now() - i * 300000);
    records.push({
      time: now.toLocaleTimeString('zh-CN'), source: sources[i%4] + ' #' + (Math.floor(Math.random()*8)+1),
      type: types[i%4], value: (Math.random()*100).toFixed(2) + ' ' + units[i%4],
      quality: Math.random() > 0.1 ? '合格' : '异常'
    });
  }
  const tbody = document.getElementById('dataTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.time}</td><td>${r.source}</td><td>${r.type}</td><td class="mono">${r.value}</td>
      <td><span class="tag ${r.quality==='合格'?'tag-green':''}" style="${r.quality==='异常'?'background:rgba(255,59,92,0.1);color:var(--accent-danger);border:1px solid rgba(255,59,92,0.2);':''}">${r.quality}</span></td>
    </tr>`).join('');
}

function renderModelCharts() { renderModelEvalChart(); }

function renderModelEvalChart() {
  const chart = getChart('chartModelEval');
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 } },
    grid: { left: 50, right: 30, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: ['预测模型','识别模型','优化模型','诊断模型','分析模型'], axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: 'rgba(0,168,255,0.2)' } } },
    yAxis: { type: 'value', name: '准确率 %', min: 80, max: 100, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }, axisLabel: { color: '#64748b' }, nameTextStyle: { color: '#64748b' } },
    series: [
      { name: '当前版本', type: 'bar', data: [94.5,92.3,96.1,89.4,93.7], barWidth: '30%', itemStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{ offset: 0, color: '#00d4ff' },{ offset: 1, color: '#0066aa' }]), borderRadius: [4,4,0,0] } },
      { name: '上一版本', type: 'bar', data: [91.2,89.5,93.8,86.7,91.0], barWidth: '30%', itemStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{ offset: 0, color: 'rgba(100,116,139,0.6)' },{ offset: 1, color: 'rgba(100,116,139,0.2)' }]), borderRadius: [4,4,0,0] } }
    ]
  });
}

function renderMonitorCharts() {
  const chart = getChart('chartMonitorMap');
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    grid: { left: 50, right: 30, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: ['西南','华东','西北','华北','华中'], axisLabel: { color: '#64748b' }, axisLine: { lineStyle: { color: 'rgba(0,168,255,0.2)' } } },
    yAxis: { type: 'value', name: '仪表数量', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }, axisLabel: { color: '#64748b' }, nameTextStyle: { color: '#64748b' } },
    series: [{ type: 'bar', barWidth: '40%', itemStyle: { borderRadius: [4,4,0,0] }, label: { show: true, position: 'top', color: '#94a3b8', fontSize: 11 },
      data: [{ value: 14, itemStyle: { color: '#00d4ff' } },{ value: 12, itemStyle: { color: '#0088ff' } },{ value: 10, itemStyle: { color: '#7c3aed' } },{ value: 8, itemStyle: { color: '#00ff88' } },{ value: 4, itemStyle: { color: '#ffaa00' } }]
    }]
  });
}

function renderDataFlowChart() {
  const chart = getChart('chartDataFlow');
  if (!chart) return;
  const times = [], vals = [];
  const now = new Date();
  for (let i = 30; i >= 0; i--) {
    const t = new Date(now - i * 1000);
    times.push(t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0')+':'+t.getSeconds().toString().padStart(2,'0'));
    vals.push(Math.floor(80 + Math.random() * 160));
  }
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    grid: { left: 60, right: 30, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: 'rgba(0,168,255,0.2)' } }, axisLabel: { color: '#64748b', fontSize: 9, interval: 10 } },
    yAxis: { type: 'value', name: '条/s', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }, axisLabel: { color: '#64748b' }, nameTextStyle: { color: '#64748b' } },
    series: [{ type: 'line', data: vals, lineStyle: { color: '#00d4ff', width: 1.5, shadowBlur: 6, shadowColor: 'rgba(0,212,255,0.3)' }, symbol: 'none', areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{ offset: 0, color: 'rgba(0,212,255,0.15)' },{ offset: 1, color: 'rgba(0,212,255,0)' }]) } }]
  });
}

// ==================== MODAL ====================
function showModal(title, bodyHtml, buttons) {
  document.getElementById('modalContent').innerHTML = `<div class="modal-title">${title}</div>${bodyHtml}<div class="modal-actions" id="modalActions"></div>`;
  const actionsContainer = document.getElementById('modalActions');
  (buttons || [{text:'确定', class:'btn-primary', action: closeModal}]).forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'btn ' + b.class;
    btn.textContent = b.text;
    btn.addEventListener('click', () => { closeModal(); if (b.action) setTimeout(b.action, 100); });
    actionsContainer.appendChild(btn);
  });
  document.getElementById('modalOverlay').style.display = '';
}

function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

document.addEventListener('click', function(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

// ==================== MODEL LIBRARY DATA & FUNCTIONS ====================
// Data is defined earlier (ALL_MODELS, MODEL_RESEARCH_DIRECTIONS, etc.)
// These are shared between the standalone 模型库 tab and cloud-edge sub-tab

let modelLibraryView = 'overview';
let modelDirFilter = 'all';
let kgAnimationId = null;

function initModelLibrary() {
  initModelSubNav();
  renderModelOverview();
  renderModelDetail();
  switchModelSubView('overview');
}

function initModelSubNav() {
  document.querySelectorAll('.model-sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const v = tab.dataset.modelView;
      if (v) switchModelSubView(v);
    });
  });
}

function switchModelSubView(view) {
  modelLibraryView = view;
  document.querySelectorAll('.model-sub-tab').forEach(t => t.classList.toggle('active', t.dataset.modelView === view));
  document.querySelectorAll('.model-sub-panel').forEach(p => p.classList.toggle('active', p.id === 'model' + view.charAt(0).toUpperCase() + view.slice(1)));
  if (view === 'detail') {
    renderModelGrid();
    setTimeout(initKgCanvas, 300);
  }
  if (view === 'overview') {
    if (kgAnimationId) { cancelAnimationFrame(kgAnimationId); kgAnimationId = null; }
  }
}

function renderModelOverview() {
  const statsEl = document.getElementById('modelOverviewStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-card-icon blue">▣</div><div class="stat-value">156</div><div class="stat-label">总模型数</div><div class="stat-change up">+12 本月</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon green">◎</div><div class="stat-value">128</div><div class="stat-label">运行中</div><div class="stat-change up">82% 在线率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon orange">⟳</div><div class="stat-value">18</div><div class="stat-label">训练中</div><div class="stat-change up">6 个即将完成</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon purple">◈</div><div class="stat-value">4</div><div class="stat-label">研究方向</div><div class="stat-change up">覆盖全流程</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
  `;

  const dirsEl = document.getElementById('modelDirections');
  if (dirsEl) dirsEl.innerHTML = MODEL_RESEARCH_DIRECTIONS.map(d => `
    <div class="panel model-dir-card" style="cursor:pointer;border-left:3px solid ${d.color};" onclick="switchToModelDetail('${d.id}')">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:24px;">${d.icon}</span>
        <div>
          <div style="font-weight:600;color:var(--text-primary);">${d.shortName}</div>
          <div style="font-size:11px;color:var(--text-dim);">${d.name}</div>
        </div>
        <span style="margin-left:auto;font-size:20px;font-weight:700;color:${d.color};">${d.count}</span>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">${d.subTopics.join(' · ')}</div>
      <div style="font-size:10px;color:var(--text-dim);">平均准确率 <span style="color:${d.color};font-weight:600;">${d.accuracy}%</span></div>
    </div>
  `).join('');

  const updatesEl = document.getElementById('modelRecentUpdates');
  if (updatesEl) updatesEl.innerHTML = `
    <div class="metric-row"><span>🔧 光声电互标定宽量程传感模型</span><span class="metric-value" style="font-size:12px;color:var(--text-dim);">2小时前 · 优化</span></div>
    <div class="metric-row"><span>🆕 多维度碳排放感知网络模型</span><span class="metric-value" style="font-size:12px;color:var(--text-dim);">5小时前 · 新增</span></div>
    <div class="metric-row"><span>📝 碳排体数据智能求解模型</span><span class="metric-value" style="font-size:12px;color:var(--text-dim);">1天前 · 更新</span></div>
    <div class="metric-row"><span>⚡ 多种群差分进化求解器</span><span class="metric-value" style="font-size:12px;color:var(--text-dim);">1天前 · 参数调优</span></div>
    <div class="metric-row"><span>🧠 知识图谱特征学习模型</span><span class="metric-value" style="font-size:12px;color:var(--text-dim);">2天前 · 新增</span></div>
  `;
}

function switchToModelDetail(dirId) {
  modelDirFilter = dirId;
  document.getElementById('modelSearch') && (document.getElementById('modelSearch').value = '');
  document.getElementById('modelCategoryFilter') && (document.getElementById('modelCategoryFilter').value = 'all');
  switchModelSubView('detail');
  renderModelDirFilter();
  renderModelGrid();
  setTimeout(initKgCanvas, 300);
}

function renderModelDetail() {
  const statsEl = document.getElementById('modelDetailStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-card-icon blue">▣</div><div class="stat-value">20</div><div class="stat-label">开放模型</div><div class="stat-change up">156 总计</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon green">◎</div><div class="stat-value">82%</div><div class="stat-label">在线率</div><div class="stat-change up">17 个活跃</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon purple">⚡</div><div class="stat-value" style="font-size:22px;">18ms</div><div class="stat-label">平均延迟</div><div class="stat-change up">-8% 优化</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon orange">♻</div><div class="stat-value">23.5<span style="font-size:18px">%</span></div><div class="stat-label">碳减排贡献</div><div class="stat-change up">+5.2% 提升</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
  `;
  renderModelDirFilter();
}

function renderModelDirFilter() {
  const container = document.getElementById('modelDirFilter');
  if (!container) return;

  const dirs = [{ id: 'all', name: '全部模型', shortName: '全部', icon: '▣', color: '#00d4ff', count: ALL_MODELS.length }].concat(
    MODEL_RESEARCH_DIRECTIONS.map(d => ({ id: d.id, name: d.name, shortName: d.shortName, icon: d.icon, color: d.color, count: ALL_MODELS.filter(m => m.researchDirection === d.id).length, subTopics: d.subTopics }))
  );

  container.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">${dirs.map(d => `
    <div class="model-dir-filter-card ${modelDirFilter === d.id ? 'active' : ''}" style="cursor:pointer;flex:1;min-width:130px;padding:12px;background:var(--bg-primary);border:1px solid ${modelDirFilter === d.id ? d.color : 'var(--border-subtle)'};border-radius:8px;text-align:center;transition:all 0.2s;" onclick="modelDirFilter='${d.id}';renderModelDirFilter();renderModelGrid();updateModelSidebar('${d.id}');">
      <div style="font-size:20px;margin-bottom:4px;">${d.icon}</div>
      <div style="font-size:11px;color:${modelDirFilter === d.id ? d.color : 'var(--text-secondary)'};font-weight:600;">${d.shortName}</div>
      <div style="font-size:18px;font-weight:700;color:${d.color};margin-top:2px;">${d.count}</div>
      ${d.subTopics ? `<div style="font-size:9px;color:var(--text-dim);margin-top:4px;">${d.subTopics.slice(0,2).join(' · ')}</div>` : '<div style="font-size:9px;color:var(--text-dim);margin-top:4px;">全部研究方向</div>'}
    </div>`).join('')}</div>`;

  if (modelDirFilter !== 'all') {
    updateModelSidebar(modelDirFilter);
  } else {
    const el = document.getElementById('modelDirDetail');
    if (el) el.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text-dim);text-align:center;">请选择研究方向查看详情</div>';
  }
}

function updateModelSidebar(dirId) {
  const dir = MODEL_RESEARCH_DIRECTIONS.find(d => d.id === dirId);
  const el = document.getElementById('modelDirDetail');
  if (!dir || !el) return;
  el.innerHTML = `
    <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">${dir.icon} ${dir.name}</div>
    <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px;">${dir.description}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;">
      ${dir.subTopics.map(t => `<span class="tag tag-blue" style="font-size:10px;">${t}</span>`).join('')}
    </div>
    <div style="margin-top:10px;font-size:11px;color:var(--text-dim);">
      模型数: <strong style="color:${dir.color};">${dir.count}</strong> · 准确率: <strong style="color:${dir.color};">${dir.accuracy}%</strong>
    </div>
  `;
}

function renderModelGrid() {
  const container = document.getElementById('modelGrid');
  if (!container) return;

  const search = (document.getElementById('modelSearch')?.value || '').toLowerCase();
  const category = document.getElementById('modelCategoryFilter')?.value || 'all';

  let models = ALL_MODELS;
  if (modelDirFilter !== 'all') models = models.filter(m => m.researchDirection === modelDirFilter);
  if (category !== 'all') models = models.filter(m => m.category === category);
  if (search) models = models.filter(m => m.name.toLowerCase().includes(search) || m.description.toLowerCase().includes(search));

  if (models.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-dim);">未找到匹配的模型</div>';
    return;
  }

  container.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${models.map(m => {
    const dir = MODEL_RESEARCH_DIRECTIONS.find(d => d.id === m.researchDirection);
    const statusLabel = MODEL_STATUS_LABELS[m.status] || m.status;
    const typeLabel = MODEL_TYPE_LABELS[m.type] || m.type;
    const typeColor = MODEL_TYPE_COLORS[m.type] || '#888';
    return `
    <div class="model-card" style="background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;padding:14px;transition:all 0.2s;cursor:pointer;" onmouseover="this.style.borderColor='${dir ? dir.color : 'var(--accent-primary)'}'" onmouseout="this.style.borderColor='var(--border-subtle)'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-weight:600;color:var(--text-primary);font-size:13px;">${m.name}</div>
          <div style="font-size:10px;color:var(--text-dim);">${m.id}</div>
        </div>
        <span class="tag ${m.status === 'active' ? 'tag-green' : ''}" style="${m.status === 'training' ? 'background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.25);' : m.status === 'inactive' ? 'background:rgba(148,163,184,0.1);color:#94a3b8;border:1px solid rgba(148,163,184,0.25);' : ''}">${m.status === 'active' ? '● ' : m.status === 'training' ? '⟳ ' : '○ '}${statusLabel}</span>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${m.description}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
        <span class="tag tag-blue" style="font-size:10px;">${dir ? dir.shortName : ''}</span>
        <span class="tag" style="font-size:10px;background:${typeColor}1a;color:${typeColor};border:1px solid ${typeColor}33;">${typeLabel}</span>
        <span class="tag" style="font-size:10px;">${m.category}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="flex:1;height:4px;background:var(--bg-tertiary);border-radius:2px;overflow:hidden;">
          <div style="width:${m.accuracy}%;height:100%;background:linear-gradient(90deg,var(--accent-primary),${dir ? dir.color : 'var(--accent-tertiary)'});border-radius:2px;"></div>
        </div>
        <span style="font-size:12px;font-weight:600;color:${dir ? dir.color : 'var(--accent-primary)'};">${m.accuracy}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;gap:12px;font-size:10px;color:var(--text-dim);">
          <span>延迟: ${m.latency}</span><span>${m.version}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary" style="font-size:10px;padding:3px 8px;" onclick="event.stopPropagation();">查看</button>
          <button class="btn btn-sm btn-primary" style="font-size:10px;padding:3px 8px;" onclick="event.stopPropagation();">部署</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function initKgCanvas() {
  const canvas = document.getElementById('kgCanvas');
  if (!canvas) return;
  const container = document.getElementById('kgContainer');
  if (!container) return;

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = Math.min(cx, cy) - 30;
  const dir = MODEL_RESEARCH_DIRECTIONS.find(d => d.id === modelDirFilter);

  const centerNode = { x: cx, y: cy, r: 16, color: dir ? dir.color : '#00d4ff', label: dir ? dir.shortName : '知识图谱', pulse: 0 };
  const orbitNodes = [
    { angle: 0, r: r * 0.55, nr: 8, color: '#00d4ff', label: '感知', speed: 0.008 },
    { angle: Math.PI / 4, r: r * 0.7, nr: 7, color: '#a78bfa', label: '建模', speed: 0.006 },
    { angle: Math.PI / 2, r: r * 0.6, nr: 9, color: '#f59e0b', label: '控制', speed: 0.007 },
    { angle: Math.PI * 1.3, r: r * 0.65, nr: 8, color: '#10b981', label: '优化', speed: 0.008 },
    { angle: Math.PI * 1.6, r: r * 0.5, nr: 6, color: '#ff6b6b', label: '碳排', speed: 0.009 },
    { angle: Math.PI * 1.9, r: r * 0.58, nr: 7, color: '#ffd93d', label: '能效', speed: 0.007 },
  ];

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Connection lines from center to orbit nodes
    orbitNodes.forEach(n => {
      const nx = cx + Math.cos(n.angle) * n.r;
      const ny = cy + Math.sin(n.angle) * n.r;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = 'rgba(0,168,255,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Inter-node connections
    for (let i = 0; i < orbitNodes.length; i++) {
      for (let j = i + 1; j < orbitNodes.length; j++) {
        const a = orbitNodes[i], b = orbitNodes[j];
        const ax = cx + Math.cos(a.angle) * a.r, ay = cy + Math.sin(a.angle) * a.r;
        const bx = cx + Math.cos(b.angle) * b.r, by = cy + Math.sin(b.angle) * b.r;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = 'rgba(0,168,255,0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Orbit nodes
    orbitNodes.forEach(n => {
      n.angle += n.speed;
      const nx = cx + Math.cos(n.angle) * n.r;
      const ny = cy + Math.sin(n.angle) * n.r;

      // Glow
      const hexToRgb = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
      const [cr, cg, cb] = hexToRgb(n.color);
      ctx.beginPath();
      ctx.arc(nx, ny, n.nr + 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.15)`;
      ctx.fill();

      // Node body
      ctx.beginPath();
      ctx.arc(nx, ny, n.nr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.7)`;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, nx, ny + n.nr + 12);
    });

    // Center node
    centerNode.pulse += 0.03;
    const pulseScale = 1 + Math.sin(centerNode.pulse) * 0.3;
    const [cr, cg, cb] = (centerNode.color.startsWith('#') ? [parseInt(centerNode.color.slice(1,3),16), parseInt(centerNode.color.slice(3,5),16), parseInt(centerNode.color.slice(5,7),16)] : [0, 212, 255]);
    ctx.beginPath();
    ctx.arc(cx, cy, centerNode.r * pulseScale + 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.1)`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, centerNode.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.8)`;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(centerNode.label, cx, cy + 4);

    kgAnimationId = requestAnimationFrame(draw);
  }

  if (kgAnimationId) cancelAnimationFrame(kgAnimationId);
  draw();
}

// ==================== CLOUD-EDGE VIEW INIT ====================
function initCloudEdgeView() {
  // Reset CE tabs to first tab
  document.querySelectorAll('.ce-sub-tab').forEach(t => t.classList.remove('active'));
  const firstTab = document.querySelector('.ce-sub-tab[data-ce-tab="ce-models"]');
  if (firstTab) firstTab.classList.add('active');
  document.querySelectorAll('.ce-sub-panel').forEach(p => p.classList.remove('active'));
  const firstPanel = document.getElementById('ceModels');
  if (firstPanel) firstPanel.classList.add('active');

  // Reset model sub-tabs to overview
  document.querySelectorAll('#ceModelSubNav .model-sub-tab').forEach(t => t.classList.remove('active'));
  const overviewTab = document.querySelector('#ceModelSubNav .model-sub-tab[data-model-view="ce-overview"]');
  if (overviewTab) overviewTab.classList.add('active');
  document.querySelectorAll('#ceModels .model-sub-panel').forEach(p => p.classList.remove('active'));
  const overviewPanel = document.getElementById('modelCeOverview');
  if (overviewPanel) overviewPanel.classList.add('active');

  // Render content — only ce-models is visible now
  renderCeModelOverview();
  renderCeModelDetail();
  renderMonitorTable();
  renderFieldSiteList();
  setTimeout(() => { initTopoCanvas(); }, 200);
}

function switchCeTab(tabId) {
  document.querySelectorAll('.ce-sub-tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`.ce-sub-tab[data-ce-tab="${tabId}"]`);
  if (tab) tab.classList.add('active');
  document.querySelectorAll('.ce-sub-panel').forEach(p => p.classList.remove('active'));
  // Map kebab-case data attribute to camelCase element ID
  const panelIdMap = { 'ce-models': 'ceModels', 'ce-monitor': 'ceMonitor', 'ce-field': 'ceField' };
  const panel = document.getElementById(panelIdMap[tabId] || tabId);
  if (panel) panel.classList.add('active');

  if (tabId === 'ce-models') {
    switchCeModelSubView('ce-overview');
  }
  if (tabId === 'ce-monitor') {
    renderMonitorTable();
    setTimeout(() => { renderMonitorCharts(); }, 300);
  }
  if (tabId === 'ce-field') {
    backToFieldList();
  }
}

function switchCeModelSubView(view) {
  document.querySelectorAll('#ceModelSubNav .model-sub-tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`#ceModelSubNav .model-sub-tab[data-model-view="${view}"]`);
  if (tab) tab.classList.add('active');

  const panelMap = { 'ce-overview': 'modelCeOverview', 'ce-detail': 'modelCeDetail' };
  document.querySelectorAll('#ceModels .model-sub-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(panelMap[view]);
  if (panel) panel.classList.add('active');

  if (view === 'ce-detail') {
    renderCeModelDirFilter();
    renderCeModelGrid();
    setTimeout(initCeKgCanvas, 300);
  }
  if (view === 'ce-overview') {
    if (kgAnimationId) { cancelAnimationFrame(kgAnimationId); kgAnimationId = null; }
  }
}

function renderCeModelOverview() {
  const statsEl = document.getElementById('modelCeOverviewStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-card-icon blue">▣</div><div class="stat-value">156</div><div class="stat-label">总模型数</div><div class="stat-change up">+12 本月</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon green">◎</div><div class="stat-value">128</div><div class="stat-label">运行中</div><div class="stat-change up">82% 在线率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon orange">⟳</div><div class="stat-value">18</div><div class="stat-label">训练中</div><div class="stat-change up">6 个即将完成</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon purple">◈</div><div class="stat-value">4</div><div class="stat-label">研究方向</div><div class="stat-change up">覆盖全流程</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
  `;

  const dirsEl = document.getElementById('modelCeDirections');
  if (dirsEl) dirsEl.innerHTML = MODEL_RESEARCH_DIRECTIONS.map(d => `
    <div class="panel model-dir-card" style="cursor:pointer;border-left:3px solid ${d.color};" onclick="switchToCeModelDetail('${d.id}')">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:24px;">${d.icon}</span>
        <div>
          <div style="font-weight:600;color:var(--text-primary);">${d.shortName}</div>
          <div style="font-size:11px;color:var(--text-dim);">${d.name}</div>
        </div>
        <span style="margin-left:auto;font-size:20px;font-weight:700;color:${d.color};">${d.count}</span>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">${d.subTopics.join(' · ')}</div>
      <div style="font-size:10px;color:var(--text-dim);">平均准确率 <span style="color:${d.color};font-weight:600;">${d.accuracy}%</span></div>
    </div>
  `).join('');

  const updatesEl = document.getElementById('modelCeRecentUpdates');
  if (updatesEl) updatesEl.innerHTML = `
    <div class="metric-row"><span>🔧 光声电互标定宽量程传感模型</span><span class="metric-value" style="font-size:12px;color:var(--text-dim);">2小时前 · 优化</span></div>
    <div class="metric-row"><span>🆕 多维度碳排放感知网络模型</span><span class="metric-value" style="font-size:12px;color:var(--text-dim);">5小时前 · 新增</span></div>
    <div class="metric-row"><span>📝 碳排体数据智能求解模型</span><span class="metric-value" style="font-size:12px;color:var(--text-dim);">1天前 · 更新</span></div>
    <div class="metric-row"><span>⚡ 多种群差分进化求解器</span><span class="metric-value" style="font-size:12px;color:var(--text-dim);">1天前 · 参数调优</span></div>
    <div class="metric-row"><span>🧠 知识图谱特征学习模型</span><span class="metric-value" style="font-size:12px;color:var(--text-dim);">2天前 · 新增</span></div>
  `;
}

function switchToCeModelDetail(dirId) {
  modelDirFilter = dirId;
  const searchEl = document.getElementById('modelCeSearch');
  if (searchEl) searchEl.value = '';
  const catEl = document.getElementById('modelCeCategoryFilter');
  if (catEl) catEl.value = 'all';
  switchCeModelSubView('ce-detail');
  renderCeModelDirFilter();
  renderCeModelGrid();
  setTimeout(initCeKgCanvas, 300);
}

function renderCeModelDetail() {
  const statsEl = document.getElementById('modelCeDetailStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-card-icon blue">▣</div><div class="stat-value">20</div><div class="stat-label">开放模型</div><div class="stat-change up">156 总计</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon green">◎</div><div class="stat-value">82%</div><div class="stat-label">在线率</div><div class="stat-change up">17 个活跃</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon purple">⚡</div><div class="stat-value" style="font-size:22px;">18ms</div><div class="stat-label">平均延迟</div><div class="stat-change up">-8% 优化</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon orange">♻</div><div class="stat-value">23.5<span style="font-size:18px">%</span></div><div class="stat-label">碳减排贡献</div><div class="stat-change up">+5.2% 提升</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
  `;
  renderCeModelDirFilter();
}

function renderCeModelDirFilter() {
  const container = document.getElementById('modelCeDirFilter');
  if (!container) return;

  const dirs = [{ id: 'all', name: '全部模型', shortName: '全部', icon: '▣', color: '#00d4ff', count: ALL_MODELS.length }].concat(
    MODEL_RESEARCH_DIRECTIONS.map(d => ({ id: d.id, name: d.name, shortName: d.shortName, icon: d.icon, color: d.color, count: ALL_MODELS.filter(m => m.researchDirection === d.id).length, subTopics: d.subTopics }))
  );

  container.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">${dirs.map(d => `
    <div class="model-dir-filter-card ${modelDirFilter === d.id ? 'active' : ''}" style="cursor:pointer;flex:1;min-width:130px;padding:12px;background:var(--bg-primary);border:1px solid ${modelDirFilter === d.id ? d.color : 'var(--border-subtle)'};border-radius:8px;text-align:center;transition:all 0.2s;" onclick="modelDirFilter='${d.id}';renderCeModelDirFilter();renderCeModelGrid();updateCeModelSidebar('${d.id}');">
      <div style="font-size:20px;margin-bottom:4px;">${d.icon}</div>
      <div style="font-size:11px;color:${modelDirFilter === d.id ? d.color : 'var(--text-secondary)'};font-weight:600;">${d.shortName}</div>
      <div style="font-size:18px;font-weight:700;color:${d.color};margin-top:2px;">${d.count}</div>
      ${d.subTopics ? `<div style="font-size:9px;color:var(--text-dim);margin-top:4px;">${d.subTopics.slice(0,2).join(' · ')}</div>` : '<div style="font-size:9px;color:var(--text-dim);margin-top:4px;">全部研究方向</div>'}
    </div>`).join('')}</div>`;

  if (modelDirFilter !== 'all') {
    updateCeModelSidebar(modelDirFilter);
  } else {
    const el = document.getElementById('modelCeDirDetail');
    if (el) el.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text-dim);text-align:center;">请选择研究方向查看详情</div>';
  }
}

function updateCeModelSidebar(dirId) {
  const dir = MODEL_RESEARCH_DIRECTIONS.find(d => d.id === dirId);
  const el = document.getElementById('modelCeDirDetail');
  if (!dir || !el) return;
  el.innerHTML = `
    <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">${dir.icon} ${dir.name}</div>
    <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px;">${dir.description}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;">
      ${dir.subTopics.map(t => `<span class="tag tag-blue" style="font-size:10px;">${t}</span>`).join('')}
    </div>
    <div style="margin-top:10px;font-size:11px;color:var(--text-dim);">
      模型数: <strong style="color:${dir.color};">${dir.count}</strong> · 准确率: <strong style="color:${dir.color};">${dir.accuracy}%</strong>
    </div>
  `;
}

function renderCeModelGrid() {
  const container = document.getElementById('modelCeGrid');
  if (!container) return;

  const search = (document.getElementById('modelCeSearch')?.value || '').toLowerCase();
  const category = document.getElementById('modelCeCategoryFilter')?.value || 'all';

  let models = ALL_MODELS;
  if (modelDirFilter !== 'all') models = models.filter(m => m.researchDirection === modelDirFilter);
  if (category !== 'all') models = models.filter(m => m.category === category);
  if (search) models = models.filter(m => m.name.toLowerCase().includes(search) || m.description.toLowerCase().includes(search));

  if (models.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-dim);">未找到匹配的模型</div>';
    return;
  }

  container.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${models.map(m => {
    const dir = MODEL_RESEARCH_DIRECTIONS.find(d => d.id === m.researchDirection);
    const statusLabel = MODEL_STATUS_LABELS[m.status] || m.status;
    const typeLabel = MODEL_TYPE_LABELS[m.type] || m.type;
    const typeColor = MODEL_TYPE_COLORS[m.type] || '#888';
    return `
    <div class="model-card" style="background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;padding:14px;transition:all 0.2s;cursor:pointer;" onmouseover="this.style.borderColor='${dir ? dir.color : 'var(--accent-primary)'}'" onmouseout="this.style.borderColor='var(--border-subtle)'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-weight:600;color:var(--text-primary);font-size:13px;">${m.name}</div>
          <div style="font-size:10px;color:var(--text-dim);">${m.id}</div>
        </div>
        <span class="tag ${m.status === 'active' ? 'tag-green' : ''}" style="${m.status === 'training' ? 'background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.25);' : m.status === 'inactive' ? 'background:rgba(148,163,184,0.1);color:#94a3b8;border:1px solid rgba(148,163,184,0.25);' : ''}">${m.status === 'active' ? '● ' : m.status === 'training' ? '⟳ ' : '○ '}${statusLabel}</span>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${m.description}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
        <span class="tag tag-blue" style="font-size:10px;">${dir ? dir.shortName : ''}</span>
        <span class="tag" style="font-size:10px;background:${typeColor}1a;color:${typeColor};border:1px solid ${typeColor}33;">${typeLabel}</span>
        <span class="tag" style="font-size:10px;">${m.category}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="flex:1;height:4px;background:var(--bg-tertiary);border-radius:2px;overflow:hidden;">
          <div style="width:${m.accuracy}%;height:100%;background:linear-gradient(90deg,var(--accent-primary),${dir ? dir.color : 'var(--accent-tertiary)'});border-radius:2px;"></div>
        </div>
        <span style="font-size:12px;font-weight:600;color:${dir ? dir.color : 'var(--accent-primary)'};">${m.accuracy}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;gap:12px;font-size:10px;color:var(--text-dim);">
          <span>延迟: ${m.latency}</span><span>${m.version}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary" style="font-size:10px;padding:3px 8px;" onclick="event.stopPropagation();">查看</button>
          <button class="btn btn-sm btn-primary" style="font-size:10px;padding:3px 8px;" onclick="event.stopPropagation();">部署</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function initCeKgCanvas() {
  const canvas = document.getElementById('ceKgCanvas');
  if (!canvas) return;
  const container = document.getElementById('ceKgContainer');
  if (!container) return;

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = Math.min(cx, cy) - 30;
  const dir = MODEL_RESEARCH_DIRECTIONS.find(d => d.id === modelDirFilter);

  const centerNode = { x: cx, y: cy, r: 16, color: dir ? dir.color : '#00d4ff', label: dir ? dir.shortName : '知识图谱', pulse: 0 };
  const orbitNodes = [
    { angle: 0, r: r * 0.55, nr: 8, color: '#00d4ff', label: '感知', speed: 0.008 },
    { angle: Math.PI / 4, r: r * 0.7, nr: 7, color: '#a78bfa', label: '建模', speed: 0.006 },
    { angle: Math.PI / 2, r: r * 0.6, nr: 9, color: '#f59e0b', label: '控制', speed: 0.007 },
    { angle: Math.PI * 1.3, r: r * 0.65, nr: 8, color: '#10b981', label: '优化', speed: 0.008 },
    { angle: Math.PI * 1.6, r: r * 0.5, nr: 6, color: '#ff6b6b', label: '碳排', speed: 0.009 },
    { angle: Math.PI * 1.9, r: r * 0.58, nr: 7, color: '#ffd93d', label: '能效', speed: 0.007 },
  ];

  const hexToRgb = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    orbitNodes.forEach(n => {
      const nx = cx + Math.cos(n.angle) * n.r, ny = cy + Math.sin(n.angle) * n.r;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny);
      ctx.strokeStyle = 'rgba(0,168,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();
    });

    for (let i = 0; i < orbitNodes.length; i++) {
      for (let j = i + 1; j < orbitNodes.length; j++) {
        const a = orbitNodes[i], b = orbitNodes[j];
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a.angle) * a.r, cy + Math.sin(a.angle) * a.r);
        ctx.lineTo(cx + Math.cos(b.angle) * b.r, cy + Math.sin(b.angle) * b.r);
        ctx.strokeStyle = 'rgba(0,168,255,0.06)'; ctx.lineWidth = 0.5; ctx.stroke();
      }
    }

    orbitNodes.forEach(n => {
      n.angle += n.speed;
      const nx = cx + Math.cos(n.angle) * n.r, ny = cy + Math.sin(n.angle) * n.r;
      const [cr, cg, cb] = hexToRgb(n.color);
      ctx.beginPath(); ctx.arc(nx, ny, n.nr + 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.15)`; ctx.fill();
      ctx.beginPath(); ctx.arc(nx, ny, n.nr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.7)`; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(n.label, nx, ny + n.nr + 12);
    });

    centerNode.pulse += 0.03;
    const [cr, cg, cb] = centerNode.color.startsWith('#') ? hexToRgb(centerNode.color) : [0, 212, 255];
    ctx.beginPath(); ctx.arc(cx, cy, centerNode.r * (1 + Math.sin(centerNode.pulse) * 0.3) + 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.1)`; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, centerNode.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.8)`; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(centerNode.label, cx, cy + 4);

    kgAnimationId = requestAnimationFrame(draw);
  }

  if (kgAnimationId) cancelAnimationFrame(kgAnimationId);
  draw();
}

// ==================== FIELD SITE FUNCTIONS ====================
function renderFieldSiteList() {
  currentFieldSiteId = null;
  const listEl = document.getElementById('fieldSiteList');
  const detailEl = document.getElementById('fieldSiteDetail');
  if (listEl) listEl.style.display = 'block';
  if (detailEl) detailEl.style.display = 'none';

  // Overview stats
  const online = FIELD_SITES.filter(s => s.status === 'online');
  const statsEl = document.getElementById('fieldOverviewStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-card-icon blue">📍</div><div class="stat-value">${FIELD_SITES.length}</div><div class="stat-label">监测现场</div><div class="stat-change up">覆盖5大区域</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon green">◎</div><div class="stat-value">${online.length}</div><div class="stat-label">在线现场</div><div class="stat-change up">${(online.length/FIELD_SITES.length*100).toFixed(0)}% 在线率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon purple">📡</div><div class="stat-value">${FIELD_SITES.reduce((s,f)=>s+f.sensors,0)}</div><div class="stat-label">传感器总数</div><div class="stat-change up">实时采集</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon orange">⚠</div><div class="stat-value">${FIELD_SITES.reduce((s,f)=>s+f.alerts,0)}</div><div class="stat-label">活跃告警</div><div class="stat-change down">需关注</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
  `;

  const labelEl = document.getElementById('fieldCountLabel');
  if (labelEl) labelEl.textContent = online.length + ' 个在线';

  // Field site cards
  const gridEl = document.getElementById('fieldSiteGrid');
  if (gridEl) gridEl.innerHTML = FIELD_SITES.map(f => `
    <div class="field-site-card" onclick="openFieldSiteDetail('${f.id}')" style="background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;cursor:pointer;transition:all 0.2s;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="font-size:28px;">${f.icon}</span>
        <div>
          <div style="font-weight:600;color:var(--text-primary);font-size:14px;">${f.name}</div>
          <div style="font-size:10px;color:var(--text-dim);">${f.location} · ${f.region}</div>
        </div>
        <span class="tag ${f.status === 'online' ? 'tag-green' : ''}" style="margin-left:auto;${f.status !== 'online' ? 'background:rgba(255,170,0,0.1);color:var(--accent-warning);border:1px solid rgba(255,170,0,0.25);' : ''}">${f.status === 'online' ? '● 在线' : '◎ 部署中'}</span>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;">关联场景: ${f.scene}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <span style="font-size:10px;color:var(--text-dim);">CO₂日均: <strong style="color:var(--accent-primary);">${f.co2Today}</strong></span>
        <span style="font-size:10px;color:var(--text-dim);">碳减排: <strong style="color:var(--accent-tertiary);">${f.reductionRate}</strong></span>
        <span style="font-size:10px;color:var(--text-dim);">传感器: <strong>${f.sensors}</strong></span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--text-dim);">
        <span>📊 ${f.dataRate}</span>
        <span>⏱ 在线率 ${f.uptime}</span>
        <span style="color:var(--accent-primary);cursor:pointer;">查看详情 →</span>
      </div>
    </div>
  `).join('');
}

function openFieldSiteDetail(siteId) {
  const site = FIELD_SITES.find(s => s.id === siteId);
  if (!site) return;
  currentFieldSiteId = siteId;

  document.getElementById('fieldSiteList').style.display = 'none';
  document.getElementById('fieldSiteDetail').style.display = 'block';

  document.getElementById('fieldDetailTitle').textContent = site.icon + ' ' + site.name + ' · ' + site.scene;
  const statusEl = document.getElementById('fieldDetailStatus');
  statusEl.textContent = site.status === 'online' ? '● 在线' : '◎ 部署中';
  statusEl.className = 'tag ' + (site.status === 'online' ? 'tag-green' : '');

  // Stats
  document.getElementById('fieldDetailStats').innerHTML = `
    <div class="stat-card"><div class="stat-card-icon blue">🛢</div><div class="stat-value" style="font-size:22px;">${site.co2Today}</div><div class="stat-label">CO₂日均排放</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon green">♻</div><div class="stat-value" style="font-size:22px;">${site.reductionRate}</div><div class="stat-label">碳减排率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon purple">📡</div><div class="stat-value" style="font-size:22px;">${site.sensors}</div><div class="stat-label">传感器数</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
    <div class="stat-card"><div class="stat-card-icon orange">⏱</div><div class="stat-value" style="font-size:22px;">${site.uptime}</div><div class="stat-label">在线率</div><div class="corner-decor tl"></div><div class="corner-decor br"></div></div>
  `;

  // Sensor table
  const sensorEl = document.getElementById('fieldSensorTable');
  if (sensorEl) sensorEl.innerHTML = `<table class="data-table"><thead><tr><th>传感器</th><th>类型</th><th>读数</th><th>状态</th><th>趋势</th></tr></thead><tbody>
    ${site.sensors_detail.map(s => {
      const trendIcon = { up: '▲', down: '▼', stable: '—' };
      const trendColor = { up: 'var(--accent-danger)', down: 'var(--accent-tertiary)', stable: 'var(--text-dim)' };
      return `<tr>
        <td>${s.name}</td><td>${s.type}</td><td class="mono">${s.value}</td>
        <td><span class="tag ${s.status === '正常' ? 'tag-green' : ''}" style="${s.status !== '正常' ? 'background:rgba(255,170,0,0.1);color:var(--accent-warning);border:1px solid rgba(255,170,0,0.25);' : ''}">${s.status}</span></td>
        <td style="color:${trendColor[s.trend]};font-size:12px;">${trendIcon[s.trend]}</td>
      </tr>`;
    }).join('')}
  </tbody></table>`;

  // Data summary
  const summaryEl = document.getElementById('fieldDataSummary');
  if (summaryEl) summaryEl.innerHTML = `
    <div class="metric-row"><span>📍 位置</span><span class="metric-value">${site.location}</span></div>
    <div class="metric-row"><span>🌐 区域</span><span class="metric-value">${site.region}</span></div>
    <div class="metric-row"><span>🏭 关联场景</span><span class="metric-value">${site.scene}</span></div>
    <div class="metric-row"><span>📊 数据速率</span><span class="metric-value">${site.dataRate}</span></div>
    <div class="metric-row"><span>📅 CO₂月累计</span><span class="metric-value">${site.co2Month}</span></div>
    <div class="metric-row"><span>⚠ 活跃告警</span><span class="metric-value ${site.alerts > 0 ? 'danger' : 'positive'}">${site.alerts} 条</span></div>
    <div class="metric-row"><span>🟢 在线率</span><span class="metric-value">${site.uptime}</span></div>
  `;

  // Render detail charts
  setTimeout(() => {
    renderFieldCo2Chart(site);
    renderFieldParamsChart(site);
    renderFieldEnergyChart(site);
  }, 200);
}

function backToFieldList() {
  renderFieldSiteList();
}

function renderFieldCo2Chart(site) {
  const chart = getChart('chartFieldCo2');
  if (!chart) return;
  const times = [], vals = [], baseVals = [];
  const now = new Date();
  for (let i = 24; i >= 0; i--) {
    const t = new Date(now - i * 60000);
    times.push(t.getHours().toString().padStart(2,'0') + ':' + t.getMinutes().toString().padStart(2,'0'));
    const base = site.params.co2;
    vals.push((base + (Math.random() - 0.5) * base * 0.3).toFixed(1));
    baseVals.push((base * 1.15 + (Math.random() - 0.5) * base * 0.2).toFixed(1));
  }
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 }, data: ['实时CO₂排放', '基准线'] },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#334155' } }, axisLabel: { color: '#94a3b8', fontSize: 9 } },
    yAxis: { type: 'value', name: 't/h', nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(51,65,85,0.3)' } } },
    series: [
      { type: 'line', data: vals, smooth: true, symbol: 'none', lineStyle: { color: '#00d4ff', width: 2 }, areaStyle: { color: 'rgba(0,212,255,0.08)' } },
      { type: 'line', data: baseVals, smooth: true, symbol: 'none', lineStyle: { color: '#ff6b6b', width: 1.5, type: 'dashed' } }
    ]
  });
}

function renderFieldParamsChart(site) {
  const chart = getChart('chartFieldParams');
  if (!chart) return;
  const times = [], tempVals = [], flowVals = [];
  const now = new Date();
  for (let i = 24; i >= 0; i--) {
    const t = new Date(now - i * 60000);
    times.push(t.getHours().toString().padStart(2,'0') + ':' + t.getMinutes().toString().padStart(2,'0'));
    tempVals.push((site.params.temp + (Math.random() - 0.5) * 80).toFixed(0));
    flowVals.push((site.params.flow + (Math.random() - 0.5) * 1.5).toFixed(1));
  }
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 }, data: ['温度 (°C)', '流速 (m/s)'] },
    grid: { left: 55, right: 55, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#334155' } }, axisLabel: { color: '#94a3b8', fontSize: 9 } },
    yAxis: [
      { type: 'value', name: '°C', nameTextStyle: { color: '#ff9800' }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(51,65,85,0.3)' } } },
      { type: 'value', name: 'm/s', nameTextStyle: { color: '#00d4ff' }, axisLabel: { color: '#94a3b8' }, splitLine: { show: false } }
    ],
    series: [
      { type: 'line', data: tempVals, smooth: true, symbol: 'none', lineStyle: { color: '#ff9800', width: 2 } },
      { type: 'line', yAxisIndex: 1, data: flowVals, smooth: true, symbol: 'none', lineStyle: { color: '#00d4ff', width: 2 } }
    ]
  });
}

function renderFieldEnergyChart(site) {
  const chart = getChart('chartFieldEnergy');
  if (!chart) return;
  const vals = [];
  for (let i = 0; i < 7; i++) {
    vals.push((site.params.efficiency + (Math.random() - 0.5) * 8).toFixed(1));
  }
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,23,0.9)', borderColor: 'rgba(0,212,255,0.3)', textStyle: { color: '#e2e8f0' } },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: ['周一','周二','周三','周四','周五','周六','周日'], axisLine: { lineStyle: { color: '#334155' } }, axisLabel: { color: '#94a3b8', fontSize: 9 } },
    yAxis: { type: 'value', name: '%', min: 60, max: 100, nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(51,65,85,0.3)' } } },
    series: [{
      type: 'bar', data: vals, itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#00d4ff' }, { offset: 1, color: 'rgba(0,212,255,0.2)' }
        ])
      },
      barWidth: '50%'
    }]
  });
}

// ==================== INIT CALL ====================
// Initialize composer when config-dev tab is clicked
document.querySelector('[data-view="config-dev"]')?.addEventListener('click', () => {
  setTimeout(initComposer, 150);
});

// Init composer on first load (if config-dev is the landing page)
setTimeout(initComposer, 500);
