"""内置组件注册表 —— 控制流编排的基础组件库。

围绕「全流程低碳运行智能监测与调控」目标设定组件集：
数据输入（现场点位）→ 分析算子（统计/滤波/相关性）→ 元模型（推理/优化）
→ 逻辑控制（开始/条件/循环）→ 输出展示（报警/调控建议/结果）。

端口即参数：params/inputs/outputs 声明后，编辑器端口、参数面板、绑定选择器全部派生。
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models.flow import ComponentDef  # noqa: E402

BUILTIN_COMPONENTS: list[dict] = [
    # ===== 工艺工序（1号挥发窑流程，序号=工艺顺序） =====
    dict(
        code="proc.kiln_feed", name="① 给料工序", category="工艺工序", kind="single",
        description="球团经圆盘给料机入窑：给料频率决定处理量",
        params_schema=[
            {"key": "freq", "label": "给料频率设定", "dtype": "number", "default": 10, "unit": "Hz"},
        ],
        inputs=[{"key": "pellet", "label": "球团工件", "dtype": "workpiece"}],
        outputs=[
            {"key": "throughput", "label": "入窑量", "dtype": "number"},
            {"key": "stream", "label": "物料流", "dtype": "any"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#ca8a04"},
    ),
    dict(
        code="proc.kiln_roast", name="② 焙烧挥发", category="工艺工序", kind="single",
        description="窑内高温焙烧：有价金属挥发进入烟气，渣相完成铁酸盐化",
        params_schema=[
            {"key": "tailTempSet", "label": "窑尾温度设定", "dtype": "number", "default": 620, "unit": "℃"},
        ],
        inputs=[
            {"key": "stream", "label": "物料流", "dtype": "any"},
            {"key": "tailTemp", "label": "窑尾温度", "dtype": "number"},
        ],
        outputs=[
            {"key": "volatilized", "label": "挥发效率", "dtype": "number"},
            {"key": "gas", "label": "高温烟气", "dtype": "any"},
            {"key": "slag", "label": "炉渣工件", "dtype": "workpiece"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#dc2626"},
    ),
    dict(
        code="proc.kiln_quench", name="③ 窑渣水淬", category="工艺工序", kind="single",
        description="炉渣水淬粒化：急冷成粒化渣外运，余热以蒸汽形式回收",
        params_schema=[
            {"key": "waterFlow", "label": "水淬水量", "dtype": "number", "default": 40, "unit": "m³/h"},
        ],
        inputs=[{"key": "slag", "label": "炉渣工件", "dtype": "workpiece"}],
        outputs=[
            {"key": "quenchedSlag", "label": "粒化渣工件", "dtype": "workpiece"},
            {"key": "steam", "label": "回收蒸汽量", "dtype": "number"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#0284c7"},
    ),
    dict(
        code="proc.kiln_cool", name="④ 烟气冷却", category="工艺工序", kind="single",
        description="高温烟气经余热锅炉降温并回收余热",
        params_schema=[],
        inputs=[{"key": "gas", "label": "高温烟气", "dtype": "any"}],
        outputs=[
            {"key": "cooledGas", "label": "冷却烟气", "dtype": "any"},
            {"key": "steam", "label": "回收蒸汽量", "dtype": "number"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#0891b2"},
    ),
    dict(
        code="proc.kiln_dust", name="⑤ 收尘工序", category="工艺工序", kind="single",
        description="电收尘器捕集烟尘：富集铅锌镉等有价金属",
        params_schema=[
            {"key": "efficiency", "label": "收尘效率", "dtype": "number", "default": 0.985},
        ],
        inputs=[{"key": "cooledGas", "label": "冷却烟气", "dtype": "any"}],
        outputs=[
            {"key": "dust", "label": "烟尘工件", "dtype": "workpiece"},
            {"key": "cleanGas", "label": "净化烟气", "dtype": "any"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#7c3aed"},
    ),
    dict(
        code="proc.kiln_desulf", name="⑥ 脱硫净化", category="工艺工序", kind="single",
        description="双碱法脱硫塔：脱除 SO₂ 与氟化物，为达标排放提供保障",
        params_schema=[
            {"key": "efficiency", "label": "脱硫效率", "dtype": "number", "default": 0.92},
        ],
        inputs=[{"key": "cleanGas", "label": "净化烟气", "dtype": "any"}],
        outputs=[
            {"key": "cleanGas", "label": "脱硫后烟气", "dtype": "any"},
            {"key": "so2Removed", "label": "SO₂ 脱除量", "dtype": "number"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#059669"},
    ),
    dict(
        code="proc.kiln_idfan", name="⑦ 引风机", category="工艺工序", kind="single",
        description="增压引风机：维持窑内微负压并将脱硫后烟气输送至烟囱，变频调节",
        params_schema=[
            {"key": "freq", "label": "风机频率", "dtype": "number", "default": 35, "unit": "Hz"},
        ],
        inputs=[{"key": "cleanGas", "label": "脱硫后烟气", "dtype": "any"}],
        outputs=[
            {"key": "cleanGas", "label": "排放烟气", "dtype": "any"},
            {"key": "draft", "label": "系统负压", "dtype": "number"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#4f46e5"},
    ),
    dict(
        code="proc.kiln_stack", name="⑧ 达标排放", category="工艺工序", kind="single",
        description="净化烟气经增压风机排放，CO/含尘浓度在线监测",
        params_schema=[],
        inputs=[
            {"key": "cleanGas", "label": "净化烟气", "dtype": "any"},
            {"key": "co", "label": "CO 浓度", "dtype": "number"},
        ],
        outputs=[
            {"key": "compliant", "label": "是否达标", "dtype": "bool"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#16a34a"},
    ),
    # ----- 辅助工序（不占主流程序号） -----
    dict(
        code="proc.kiln_combust", name="燃烧配风", category="工艺工序", kind="single",
        description="窑头燃烧器：燃料/空气配比决定热负荷，直接影响窑头温度",
        params_schema=[
            {"key": "fuelFlow", "label": "燃料流量", "dtype": "number", "default": 1200, "unit": "m³/h"},
            {"key": "airRatio", "label": "空燃比", "dtype": "number", "default": 1.15},
        ],
        inputs=[{"key": "tailTemp", "label": "窑尾温度", "dtype": "number"}],
        outputs=[
            {"key": "heatLoad", "label": "热负荷", "dtype": "number"},
            {"key": "burnerGas", "label": "助燃烟气", "dtype": "any"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#ea580c"},
    ),
    dict(
        code="proc.kiln_drive", name="主传动", category="工艺工序", kind="single",
        description="主电机经大齿圈驱动筒体旋转：频率决定窑速与物料停留时间",
        params_schema=[
            {"key": "motorFreq", "label": "主电机频率", "dtype": "number", "default": 8, "unit": "Hz"},
        ],
        inputs=[{"key": "throughput", "label": "入窑量", "dtype": "number"}],
        outputs=[
            {"key": "kilnSpeed", "label": "筒体转速", "dtype": "number"},
            {"key": "power", "label": "主电机功率", "dtype": "number"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#334155"},
    ),
    # ===== 工件算子（物料在流程中的形态） =====
    dict(
        code="work.pellet", name="球团工件", category="工件算子", kind="single",
        description="入窑球团物料：携带成分与含水率属性，随流程传递演化",
        params_schema=[
            {"key": "moisture", "label": "含水率", "dtype": "number", "default": 12, "unit": "%"},
            {"key": "znGrade", "label": "锌品位", "dtype": "number", "default": 18, "unit": "%"},
        ],
        inputs=[],
        outputs=[
            {"key": "pellet", "label": "球团", "dtype": "workpiece"},
            {"key": "grade", "label": "综合品位", "dtype": "number"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#a16207"},
    ),
    dict(
        code="work.dust", name="烟尘工件", category="工件算子", kind="single",
        description="收尘产出的富集烟尘：富含铅锌镉铟，外送有价金属回收",
        params_schema=[],
        inputs=[{"key": "from", "label": "来源物料", "dtype": "any"}],
        outputs=[
            {"key": "value", "label": "有价金属富集度", "dtype": "number"},
        ],
        runtime="builtin", ref_code="process_sim", ui_config={"color": "#a16207"},
    ),
    # ===== 逻辑控制 =====
    dict(
        code="logic.start", name="开始", category="逻辑控制", kind="single",
        description="流程起点：每轮执行从此节点开始",
        params_schema=[], inputs=[], outputs=[],
        runtime="builtin", ref_code="start", ui_config={"color": "#0d9488"},
    ),
    dict(
        code="logic.end", name="结束", category="逻辑控制", kind="single",
        description="流程终点：汇总本轮执行结果",
        params_schema=[],
        inputs=[{"key": "result", "label": "执行结果", "dtype": "any"}],
        outputs=[],
        runtime="builtin", ref_code="end", ui_config={"color": "#64748b"},
    ),
    dict(
        code="logic.condition", name="条件分支", category="逻辑控制", kind="condition",
        description="按布尔条件选择 真/假 出口继续执行",
        params_schema=[
            {"key": "expression", "label": "条件表达式", "dtype": "string", "default": "value > 0",
             "description": "引用输入值用 value，如 value > 100；支持 > < >= <= == 以及 and/or"},
        ],
        inputs=[{"key": "value", "label": "输入值", "dtype": "number"}],
        outputs=[],
        runtime="builtin", ref_code="condition", ui_config={"color": "#d97706"},
    ),
    dict(
        code="logic.loop", name="循环执行", category="逻辑控制", kind="circulate",
        description="将循环体内节点重复执行 N 次（调度器按轮次推进）",
        params_schema=[
            {"key": "count", "label": "循环次数", "dtype": "int", "default": 3, "min": 1, "max": 100},
        ],
        inputs=[], outputs=[{"key": "round", "label": "当前轮次", "dtype": "int"}],
        runtime="builtin", ref_code="loop", ui_config={"color": "#7c3aed"},
    ),
    # ===== 数据输入 =====
    dict(
        code="data.point_read", name="点位读取", category="数据输入", kind="single",
        description="读取监测点位最近一条时序数据（支持数组型温度场曲线）",
        params_schema=[
            {"key": "pointId", "label": "数据点位", "dtype": "point", "default": None,
             "required": True, "bindable": False, "description": "从数据基座点位中选择"},
            {"key": "history", "label": "读取条数", "dtype": "int", "default": 50, "min": 1, "max": 5000},
        ],
        inputs=[],
        outputs=[
            {"key": "value", "label": "最新值", "dtype": "number"},
            {"key": "series", "label": "时序数组", "dtype": "array"},
            {"key": "timestamp", "label": "采集时间", "dtype": "string"},
        ],
        runtime="builtin", ref_code="point_read", ui_config={"color": "#0891b2"},
    ),
    dict(
        code="data.constant", name="常量设定", category="数据输入", kind="single",
        description="输出一个可绑定到下游参数的常量",
        params_schema=[
            {"key": "value", "label": "常量值", "dtype": "number", "default": 0},
        ],
        inputs=[], outputs=[{"key": "value", "label": "值", "dtype": "number"}],
        runtime="builtin", ref_code="constant", ui_config={"color": "#0891b2"},
    ),
    # ===== 分析算子 =====
    dict(
        code="analysis.stats", name="统计摘要", category="分析算子", kind="single",
        description="对时序数组计算均值/最值/标准差/趋势",
        params_schema=[],
        inputs=[{"key": "series", "label": "时序数组", "dtype": "array"}],
        outputs=[
            {"key": "mean", "label": "均值", "dtype": "number"},
            {"key": "max", "label": "最大值", "dtype": "number"},
            {"key": "min", "label": "最小值", "dtype": "number"},
            {"key": "std", "label": "标准差", "dtype": "number"},
            {"key": "trend", "label": "趋势斜率", "dtype": "number"},
        ],
        runtime="analysis", ref_code="stats", ui_config={"color": "#2563eb"},
    ),
    dict(
        code="analysis.moving_avg", name="滑动滤波", category="分析算子", kind="single",
        description="对时序数组做滑动平均滤波，平滑噪声",
        params_schema=[
            {"key": "window", "label": "窗口大小", "dtype": "int", "default": 10, "min": 2, "max": 500},
        ],
        inputs=[{"key": "series", "label": "时序数组", "dtype": "array"}],
        outputs=[{"key": "series", "label": "滤波数组", "dtype": "array"}],
        runtime="analysis", ref_code="moving_avg", ui_config={"color": "#2563eb"},
    ),
    dict(
        code="analysis.threshold_alarm", name="阈值判定", category="分析算子", kind="single",
        description="判定数值是否超限，输出越限标志与幅度",
        params_schema=[
            {"key": "limit", "label": "阈值", "dtype": "number", "default": 100},
            {"key": "direction", "label": "越限方向", "dtype": "select", "default": "above",
             "options": ["above", "below"]},
        ],
        inputs=[{"key": "value", "label": "输入值", "dtype": "number"}],
        outputs=[
            {"key": "exceeded", "label": "是否越限", "dtype": "bool"},
            {"key": "margin", "label": "越限幅度", "dtype": "number"},
        ],
        runtime="analysis", ref_code="threshold", ui_config={"color": "#2563eb"},
    ),
    dict(
        code="analysis.correlation", name="相关性分析", category="分析算子", kind="single",
        description="计算两条时序的皮尔逊相关系数",
        params_schema=[],
        inputs=[
            {"key": "seriesA", "label": "时序 A", "dtype": "array"},
            {"key": "seriesB", "label": "时序 B", "dtype": "array"},
        ],
        outputs=[{"key": "r", "label": "相关系数 r", "dtype": "number"}],
        runtime="analysis", ref_code="correlation", ui_config={"color": "#2563eb"},
    ),
    # ===== 元模型 =====
    dict(
        code="meta.infer", name="元模型推理", category="元模型", kind="single",
        description="调用平台登记的元模型执行推理/优化（仿真执行，调用计入模型调用统计）",
        params_schema=[
            {"key": "metamodelId", "label": "元模型", "dtype": "metamodel", "default": None,
             "required": True, "bindable": False, "description": "从元模型库中选择"},
        ],
        inputs=[{"key": "features", "label": "输入特征", "dtype": "any"}],
        outputs=[
            {"key": "result", "label": "推理结果", "dtype": "any"},
            {"key": "confidence", "label": "置信度", "dtype": "number"},
        ],
        runtime="metamodel", ref_code="infer", ui_config={"color": "#0f766e"},
    ),
    # ===== 输出展示 =====
    dict(
        code="output.regulation", name="调控建议", category="输出展示", kind="single",
        description="生成低碳调控建议（仿真：仅记录不下发设备指令）",
        params_schema=[
            {"key": "action", "label": "建议动作", "dtype": "string", "default": "下调给料频率 2Hz"},
            {"key": "reason", "label": "依据说明", "dtype": "string", "default": ""},
        ],
        inputs=[
            {"key": "basis", "label": "决策依据", "dtype": "any"},
        ],
        outputs=[
            {"key": "accepted", "label": "是否采纳", "dtype": "bool"},
        ],
        runtime="output", ref_code="regulation", ui_config={"color": "#16a34a"},
    ),
    dict(
        code="output.alarm", name="触发报警", category="输出展示", kind="single",
        description="条件满足时生成平台报警记录",
        params_schema=[
            {"key": "level", "label": "报警级别", "dtype": "select", "default": "WARNING",
             "options": ["INFO", "WARNING", "ERROR", "CRITICAL"]},
            {"key": "message", "label": "报警内容", "dtype": "string", "default": "参数越限"},
        ],
        inputs=[{"key": "trigger", "label": "触发信号", "dtype": "bool"}],
        outputs=[{"key": "alarmId", "label": "报警ID", "dtype": "number"}],
        runtime="output", ref_code="alarm", ui_config={"color": "#dc2626"},
    ),
]

# 流程级变量示例（绑定协议 $变量名）
DEFAULT_VARIABLES: dict[str, float] = {
    "窑尾温度设定": 620.0,
    "给料频率上限": 16.0,
}


def seed_components() -> None:
    db = SessionLocal()
    try:
        created = 0
        for c in BUILTIN_COMPONENTS:
            exists = db.scalar(select(ComponentDef).where(ComponentDef.code == c["code"]))
            if exists:
                for k, v in c.items():
                    setattr(exists, k, v)
            else:
                db.add(ComponentDef(**c))
                created += 1
        db.commit()
        print(f"组件注册完成：新增 {created}，共 {len(BUILTIN_COMPONENTS)} 个内置组件")
    finally:
        db.close()


if __name__ == "__main__":
    seed_components()
