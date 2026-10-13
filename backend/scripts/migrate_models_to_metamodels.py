"""将旧 model_registry 的 125 个模型迁移登记为标准元模型（8 节结构）。

字段缺失部分按四类模型的行业常识模拟补全（编号规则、假设边界、变量表等），
每条生成版本快照，幂等：按 legacy_model_id 判断是否已迁移。

用法：
    cd backend && .venv/Scripts/python.exe scripts/migrate_models_to_metamodels.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.mock.metamodel_scholar import apply_scholar_content  # noqa: E402
from app.models.auth import User  # noqa: E402
from app.models.metamodel import Metamodel, MetamodelVersion  # noqa: E402
from app.models.model_lib import ModelRegistry, ModelVersion  # noqa: E402
from app.schemas.metamodel import MetamodelOut  # noqa: E402

# function_type → (model_type, 类别编码)
FUNCTION_MAP = {
    "PROCESS_MODELING": ("MECHANISM", "MEC"),
    "PREDICTION": ("DATA_MODEL", "DAT"),
    "CLASSIFICATION": ("DATA_MODEL", "DAT"),
    "DATA_PERCEPTION": ("DATA_MODEL", "DAT"),
    "CARBON_MONITORING": ("DATA_MODEL", "DAT"),
    "CARBON_ACCOUNTING": ("DATA_MODEL", "DAT"),
    "OPTIMIZATION": ("ALGORITHM", "ALG"),
    "PROCESS_CONTROL": ("ALGORITHM", "ALG"),
    "AUXILIARY": ("KNOWLEDGE_RULE", "KRL"),
}
INDUSTRY_CODES = {"通用": "GEN", "有色": "NFM", "石化": "PET", "钢铁": "IRN"}

TYPE_TEXT = {
    "MECHANISM": {
        "hierarchy": "工序/设备级机理模型",
        "method_structure": "机理方程；确定性；基于物理化学守恒关系",
        "scene": "基于工艺机理建立，适用于稳态工况下的过程量推算与机理校核；输入在物理有效域内且不为零。",
        "assumptions": "A1 稳态工况；A2 系统对外绝热/密闭；A3 物性参数取工况均值恒定；A4 忽略监测噪声与滞后。",
        "limits": "不描述瞬态、强非线性与异常工况；机理算例残差不等同于现场预测精度。",
        "flow": ["输入/边界校核", "机理方程求解", "守恒校核/输出"],
        "relations": [
            {"id": "E(1)", "expression": "输入→机理方程(守恒/传递关系)→输出；系数由设计值或标定数据确定", "note": "结构占位，详版模板中展开为具体方程"},
        ],
        "method_flow": "输入校验→机理方程逐步求解→物理守恒校核→输出；超限输入抛出异常。",
        "entry": "predict(inputs, params) → dict；inputs 为工况量，params 为机理/设备系数；平台内存函数入口。",
        "exception": "缺项、非有限值、违反物理范围输入抛 ValueError；计算耗时毫秒级。",
    },
    "DATA_MODEL": {
        "hierarchy": "数据驱动统计学习模型",
        "method_structure": "统计学习；回归/分类；离线训练 + 在线推断",
        "scene": "基于历史运行数据训练，适用于与训练数据分布一致的稳态工况推断；输入特征完整。",
        "assumptions": "A1 训练与推断特征同分布；A2 缺失特征按训练中值填充；A3 工况漂移需定期重训。",
        "limits": "外推工况可信度下降；评估指标（MAE/RMSE）基于留出测试集，非现场实测精度。",
        "flow": ["特征输入/标准化", "模型前向推断", "反标准化/输出"],
        "relations": [
            {"id": "E(1)", "expression": "y = f(x; θ)，f 为训练得到的回归/分类函数，θ 为模型参数", "note": "结构占位，详版模板中展开为网络结构"},
        ],
        "method_flow": "特征校验→缺失填充→标准化→模型前向计算→反标准化→输出；跨工件/跨班组可直接调用。",
        "entry": "predict(sample_id, features) → dict；特征向量按登记顺序排列；平台统一推断入口。",
        "exception": "特征维度不符或含非数值抛 ValueError；单次推断毫秒级，无显式迭代。",
    },
    "ALGORITHM": {
        "hierarchy": "运筹优化/进化算法模型",
        "method_structure": "迭代优化；种群/启发式；约束处理",
        "scene": "面向运行优化与调控决策，适用于约束明确的工况优化问题；目标与约束可量化。",
        "assumptions": "A1 目标函数可计算；A2 约束边界给定；A3 算法参数采用缺省或按工况整定。",
        "limits": "启发式算法不保证全局最优；结果为推荐值，执行前需工艺校核。",
        "flow": ["编码/初始化", "评价-选择-进化迭代", "解码/输出推荐值"],
        "relations": [
            {"id": "E(1)", "expression": "min/max f(x) s.t. g(x)≤0, h(x)=0；x 为可调操作变量向量", "note": "结构占位，详版模板中展开为目标与约束"},
        ],
        "method_flow": "编码→初始化种群→评价→选择/交叉/变异→终止判定→解码输出；随机算法需固定种子复现。",
        "entry": "optimize(problem, config) → dict；返回最优个体、目标值与评价次数；平台统一优化入口。",
        "exception": "无可行解或迭代超限返回状态标志；单次求解秒级，可配置种群与代数。",
    },
    "KNOWLEDGE_RULE": {
        "hierarchy": "知识规则/专家推理模型",
        "method_structure": "规则库；模糊推理（Sugeno/ Mamdani）；前向链推理",
        "scene": "基于工艺知识与专家经验，适用于工况判别、异常诊断与调控建议生成；事实可观测。",
        "assumptions": "A1 规则库覆盖目标工况域；A2 隶属函数由专家给定；A3 事实输入为监测点位值。",
        "limits": "规则未覆盖工况输出'无法判定'；推理结论为建议性质，需人工或上位控制确认。",
        "flow": ["事实输入/模糊化", "规则匹配/推理", "去模糊化/结论"],
        "relations": [
            {"id": "E(1)", "expression": "IF 前件(事实,隶属度) THEN 后件(结论/调控量, 权重)", "note": "结构占位，详版模板中展开为规则库"},
        ],
        "method_flow": "事实校验→模糊化→规则前向推理→聚合→去模糊化→输出结论与依据规则。",
        "entry": "infer(facts) → dict；返回结论、置信度与命中规则；平台统一推理入口。",
        "exception": "事实缺失按未知处理并在结论中标注；推理毫秒级，规则数线性。",
    },
}


def main() -> None:
    db = SessionLocal()
    try:
        admin = db.scalar(select(User).where(User.username == "admin"))
        models = db.execute(select(ModelRegistry)).scalars().all()
        created = 0
        for m in models:
            exists = db.scalar(
                select(Metamodel).where(Metamodel.legacy_model_id == m.id)
            )
            if exists:
                continue
            model_type, type_code = FUNCTION_MAP[m.function_type]
            txt = TYPE_TEXT[model_type]

            # 行业-类别 内序号
            prefix = f"CSU-{INDUSTRY_CODES.get(m.industry, 'GEN')}-{type_code}"
            seq = db.scalar(
                select(Metamodel.meta_code).where(Metamodel.meta_code.like(f"{prefix}-%")).order_by(Metamodel.meta_code.desc()).limit(1)
            )
            n = int(seq.rsplit("-", 1)[1]) + 1 if seq else 1

            desc = m.description or m.name
            io_params = [
                {"category": "输入", "symbol": "x_1", "dtype": "float; 标量", "dim": "1",
                 "unit": "-", "rangeRequired": "工艺有效域；必需", "exampleDefault": "无缺省",
                 "sourceMeaning": f"{m.process_stage or '工序'}关键工况参数（按详版登记展开）"},
                {"category": "参数", "symbol": "θ", "dtype": "float; 向量", "dim": "n",
                 "unit": "-", "rangeRequired": "标定/训练确定", "exampleDefault": "随版本固化",
                 "sourceMeaning": "模型系数/训练参数"},
                {"category": "输出", "symbol": "y", "dtype": "float; 标量", "dim": "1",
                 "unit": "-", "rangeRequired": "物理有效域", "exampleDefault": "-",
                 "sourceMeaning": desc[:60]},
            ]

            mm = Metamodel(
                meta_code=f"{prefix}-{n:06d}",
                model_type=model_type,
                name=m.name,
                domain=m.industry,
                hierarchy=txt["hierarchy"],
                purpose=desc,
                method_structure=txt["method_structure"],
                version_no="1.0.0",
                maturity="已接入平台统一调用入口；运行统计见调用记录",
                keywords=(m.tags or [])[:6] or [m.function_type.lower(), (m.process_stage or "工序")],
                scope_object=f"{m.industry}·{m.process_stage or '通用工序'}；单设备/单工序粒度",
                source_ownership=m.provider or "系统预置",
                author_maintainer="平台运营组",
                naming_rule="1.0：域_对象_类别_任务_方法；编号 CSU-行业-类别-6位序号",
                scene_domain=txt["scene"],
                assumptions=txt["assumptions"],
                limits_precision=txt["limits"],
                structure_flow=txt["flow"],
                core_relations=txt["relations"],
                io_params=io_params,
                method_flow=txt["method_flow"],
                entry_interface=txt["entry"],
                exception_behavior=txt["exception"],
                env_materials="平台托管运行：Python 3.11 + FastAPI；无需独立部署包",
                source_manifest="模型源码/参数配置/依赖清单存于模型版本库（legacy 版本已继承）",
                delivery_repro="随平台版本交付；调用日志与指标可在平台内复核",
                deploy_combination=f"上游：{'、'.join(['监测点位数据'])}；下游：组态/场景/驾驶舱调用",
                validation_baseline=(f"平台登记准确率/评分 {m.accuracy:.2f}" if m.accuracy else "待现场标定"),
                validation_limits="极端工况未经现场验证，输出仅供参考",
                status=m.status if m.status in ("DEVELOPING", "TESTING", "ONLINE", "OFFLINE") else "DEVELOPING",
                industry=m.industry,
                process_stage=m.process_stage,
                tags=m.tags,
                provider=m.provider,
                call_count=m.call_count,
                accuracy=m.accuracy,
                legacy_model_id=m.id,
                owner_id=admin.id if admin else None,
            )
            # 学术内容库命中则覆盖为精品学术内容（公式/变量表/V&V/文献）
            scholar_applied = apply_scholar_content(mm)
            db.add(mm)
            db.flush()

            legacy_ver = db.scalar(
                select(ModelVersion)
                .where(ModelVersion.model_id == m.id)
                .order_by(ModelVersion.id.desc())
                .limit(1)
            )
            db.add(
                MetamodelVersion(
                    metamodel_id=mm.id,
                    version_no="1.0.0",
                    changelog=(
                        f"迁移自旧模型库 {m.code}"
                        + (f"（原版本 {legacy_ver.version_no}）" if legacy_ver else "")
                        + "；按元模型模板模拟补全 8 节登记信息"
                        + ("；学术内容库充实（关系式/变量表/V&V/文献）" if scholar_applied else "")
                    ),
                    snapshot=MetamodelOut.model_validate(mm).model_dump(by_alias=True, mode="json"),
                    created_by="migrate_script",
                )
            )
            created += 1
        db.commit()
        print(f"迁移完成：{created} 条元模型已登记（共 {len(models)} 条旧模型）")
    finally:
        db.close()


if __name__ == "__main__":
    main()
