"""工业元模型（Metamodel）——按《元模型交付模板》8 节结构建模。

四类模型共用一套结构，差异由 model_type 区分：
- MECHANISM      机理模型（方程/守恒/传递）
- DATA_MODEL     数据模型（统计学习/回归/网络）
- ALGORITHM      算法模型（运筹优化/进化/搜索）
- KNOWLEDGE_RULE 知识规则模型（规则库/模糊推理/Sugeno 等）
"""
from sqlalchemy import ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

MODEL_TYPES = ("MECHANISM", "DATA_MODEL", "ALGORITHM", "KNOWLEDGE_RULE")
MODEL_TYPE_LABELS = {
    "MECHANISM": "机理模型",
    "DATA_MODEL": "数据模型",
    "ALGORITHM": "算法模型",
    "KNOWLEDGE_RULE": "知识规则模型",
}


class Metamodel(Base):
    __tablename__ = "metamodels"

    # ---------- 一、基本信息 ----------
    meta_code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    model_type: Mapped[str] = mapped_column(String(24), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(64), nullable=True)          # 领域，如 热工传热 / 有色·挥发窑
    hierarchy: Mapped[str | None] = mapped_column(String(128), nullable=True)      # 领域/层级，如 设备输入输出模型
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)               # 功能/用途
    method_structure: Mapped[str | None] = mapped_column(Text, nullable=True)      # 方法/结构
    version_no: Mapped[str] = mapped_column(String(32), default="1.0.0")           # 版本/状态
    maturity: Mapped[str | None] = mapped_column(String(255), nullable=True)       # 成熟/部署
    keywords: Mapped[list | None] = mapped_column(JSON, nullable=True)             # 关键词
    scope_object: Mapped[str | None] = mapped_column(String(255), nullable=True)   # 对象/粒度
    source_ownership: Mapped[str | None] = mapped_column(String(255), nullable=True)  # 来源/权属
    author_maintainer: Mapped[str | None] = mapped_column(String(255), nullable=True)  # 作者/维护
    naming_rule: Mapped[str | None] = mapped_column(String(128), nullable=True)    # 命名规则

    # ---------- 二、适用范围与前提 ----------
    scene_domain: Mapped[str | None] = mapped_column(Text, nullable=True)          # 场景/有效域
    assumptions: Mapped[str | None] = mapped_column(Text, nullable=True)           # 假设/边界
    limits_precision: Mapped[str | None] = mapped_column(Text, nullable=True)      # 限制/精度

    # ---------- 三、结构与核心关系 ----------
    structure_flow: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # 流程标签链，如 ["温度/流量/c_p/UA", "热容量→NTU/ε→守恒", "Q/两侧出口温度/诊断量"]
    core_relations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # 核心关系式 [{"id": "E(1)", "expression": "...", "note": "..."}]

    # ---------- 四、变量与参数定义 ----------
    io_params: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # [{"category": "输入/参数/输出传参/输出", "symbol": "...", "dtype": "float; 标量",
    #   "dim": "1", "unit": "℃", "range_required": ">0；必需",
    #   "example_default": "90；无缺省", "source_meaning": "..."}]

    # ---------- 五、计算、推理与接口 ----------
    method_flow: Mapped[str | None] = mapped_column(Text, nullable=True)           # 方法/流程
    entry_interface: Mapped[str | None] = mapped_column(Text, nullable=True)       # 入口/响应
    exception_behavior: Mapped[str | None] = mapped_column(Text, nullable=True)    # 异常/性能

    # ---------- 六、源代码交付、部署与组合 ----------
    env_materials: Mapped[str | None] = mapped_column(Text, nullable=True)         # 环境/材料
    source_manifest: Mapped[str | None] = mapped_column(Text, nullable=True)       # 源码清单
    delivery_repro: Mapped[str | None] = mapped_column(Text, nullable=True)        # 交付/复现
    deploy_combination: Mapped[str | None] = mapped_column(Text, nullable=True)    # 部署/组合

    # ---------- 七、验证与确认 ----------
    validation_baseline: Mapped[str | None] = mapped_column(Text, nullable=True)   # 基准/交叉
    validation_limits: Mapped[str | None] = mapped_column(Text, nullable=True)     # 极限/确认

    # ---------- 管理字段 ----------
    status: Mapped[str] = mapped_column(String(16), default="DEVELOPING", index=True)
    # DEVELOPING / TESTING / ONLINE / OFFLINE
    industry: Mapped[str] = mapped_column(String(32), default="通用", index=True)
    process_stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    call_count: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[float | None] = mapped_column(default=None, nullable=True)
    legacy_model_id: Mapped[int | None] = mapped_column(Integer, nullable=True)    # 迁移自 model_registry
    owner_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    versions: Mapped[list["MetamodelVersion"]] = relationship(
        "MetamodelVersion", back_populates="metamodel", cascade="all, delete-orphan",
        order_by="MetamodelVersion.id.desc()",
    )


class MetamodelVersion(Base):
    __tablename__ = "metamodel_versions"

    metamodel_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("metamodels.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version_no: Mapped[str] = mapped_column(String(32), nullable=False)
    changelog: Mapped[str | None] = mapped_column(Text, nullable=True)
    snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # 全量 8 节快照
    created_by: Mapped[str | None] = mapped_column(String(64), nullable=True)

    metamodel: Mapped["Metamodel"] = relationship("Metamodel", back_populates="versions")
