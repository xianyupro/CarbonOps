"""组件化交互平台（阶段3）：组件注册表 + 控制流工程 + 运行记录。

控制流模型借鉴 ApexMotion：
- 双语义边：控制边（调度顺序）与数据边（参数绑定）共用连线表，kind 区分
- 端口=参数：组件声明 inputs/outputs/params，端口、参数面板、绑定选择器全部派生
- 绑定协议："$变量名" / "节点Id.输出引脚名" 三段式（节点用 Id 引用，不用 Name）
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ComponentDef(Base):
    __tablename__ = "component_defs"

    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    # 数据输入 / 元模型 / 分析算子 / 逻辑控制 / 输出展示
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 控制出口形态：single（Next）/ condition（真/假）/ circulate（循环/退出）
    kind: Mapped[str] = mapped_column(String(16), default="single")

    # 声明式参数/引脚（端口即参数）
    params_schema: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # [{key,label,dtype,unit,default,options,required,bindable}]
    inputs: Mapped[list | None] = mapped_column(JSON, nullable=True)   # [{key,label,dtype}]
    outputs: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [{key,label,dtype}]

    # 执行类型：builtin / metamodel / analysis / output
    runtime: Mapped[str] = mapped_column(String(16), default="builtin")
    ref_code: Mapped[str | None] = mapped_column(String(64), nullable=True)  # runtime 细分标识

    ui_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {color}


class FlowProject(Base):
    __tablename__ = "flow_projects"

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 图 JSON：{nodes:[{id,componentCode,name,x,y,params,bindings}], edges:[{id,source,target,kind}]}
    graph: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="DRAFT")  # DRAFT/PUBLISHED
    version: Mapped[int] = mapped_column(Integer, default=1)

    runs: Mapped[list["FlowRun"]] = relationship(
        "FlowRun", back_populates="project", cascade="all, delete-orphan",
        order_by="FlowRun.id.desc()",
    )


class FlowRun(Base):
    __tablename__ = "flow_runs"

    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("flow_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    mode: Mapped[str] = mapped_column(String(16), default="once")  # once / simulate
    # IDLE / RUNNING / SUCCESS / FAILED / CANCELLED
    state: Mapped[str] = mapped_column(String(16), default="RUNNING")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    # 每节点执行日志 [{nodeId,name,componentCode,state,startedAt,durationMs,inputs,outputs,error}]
    node_logs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["FlowProject"] = relationship("FlowProject", back_populates="runs")
