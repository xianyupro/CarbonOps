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
