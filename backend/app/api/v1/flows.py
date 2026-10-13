"""控制流平台 API（组件注册 / 流程工程 / 运行）。"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_permission, write_audit
from app.core.exceptions import BizError, NotFoundError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.flow import ComponentDef, FlowProject, FlowRun
from app.models.metamodel import Metamodel
from app.services.flow_engine import FlowEngine

router = APIRouter()

# 流程级变量（demo 固定集；后续可随工程保存）
FLOW_VARIABLES: dict[str, float] = {
    "窑尾温度设定": 620.0,
    "给料频率上限": 16.0,
}


# ---------- Schemas ----------
class FlowSave(BaseModel):
    name: str
    description: Optional[str] = None
    graph: Optional[dict] = None
    status: Optional[str] = None


class FlowOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True,
        protected_namespaces=(),
    )
    id: int
    name: str
    description: str | None = None
    graph: dict | None = None
    status: str
    version: int
    created_at: datetime
    updated_at: datetime


class FlowRunOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True
    )
    id: int
    project_id: int
    mode: str
    state: str
    started_at: datetime
    finished_at: datetime | None = None
    duration_ms: int
    node_logs: list | None = None
    error: str | None = None


class ComponentOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True,
        protected_namespaces=(),
    )
    code: str
    name: str
    category: str
    description: str | None = None
    kind: str
    params_schema: list | None = None
    inputs: list | None = None
    outputs: list | None = None
    runtime: str
    ref_code: str | None = None
    ui_config: dict | None = None


# ---------- 组件注册表 ----------
@router.get("/components")
def list_components(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("orchestration:read", "model:read")),
):
    comps = db.execute(select(ComponentDef).order_by(ComponentDef.id)).scalars().all()
    grouped: dict[str, list] = {}
    for c in comps:
        grouped.setdefault(c.category, []).append(
            ComponentOut.model_validate(c).model_dump(by_alias=True, mode="json")
        )
    # 领域组件（工艺工序/工件算子）置顶，通用组随后
    order = ["工艺工序", "工件算子", "数据输入", "分析算子", "元模型", "逻辑控制", "输出展示"]
    groups = {k: grouped[k] for k in order if k in grouped}
    for k, v in grouped.items():
        groups.setdefault(k, v)
    return ok({"groups": groups, "variables": FLOW_VARIABLES})


@router.get("/components/metamodel-options")
def metamodel_options(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("orchestration:read", "model:read")),
):
    """元模型组件的参数选择器数据源。"""
    mms = db.execute(select(Metamodel).order_by(Metamodel.model_type, Metamodel.name)).scalars().all()
    return ok([
        {"id": m.id, "metaCode": m.meta_code, "name": m.name, "modelType": m.model_type}
        for m in mms
    ])


# ---------- 流程工程 ----------
@router.get("")
def list_flows(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("orchestration:read", "model:read")),
):
    flows = db.execute(select(FlowProject).order_by(FlowProject.updated_at.desc())).scalars().all()
    return ok([
        FlowOut.model_validate(f).model_dump(by_alias=True, mode="json") for f in flows
    ])


@router.post("")
def create_flow(
    payload: FlowSave,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("orchestration:write", "model:write")),
):
    if not payload.name.strip():
        raise BizError("流程名称不能为空")
    f = FlowProject(
        name=payload.name.strip(),
        description=payload.description,
        graph=payload.graph or {"nodes": [], "edges": []},
        status=payload.status or "DRAFT",
    )
    db.add(f)
    db.commit()
    write_audit(db, user, "CREATE", resource="flow", detail=f.name)
    return ok(FlowOut.model_validate(f).model_dump(by_alias=True, mode="json"))


@router.get("/{flow_id}")
def get_flow(
    flow_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("orchestration:read", "model:read")),
):
    f = db.get(FlowProject, flow_id)
    if not f:
        raise NotFoundError("流程不存在")
    return ok(FlowOut.model_validate(f).model_dump(by_alias=True, mode="json"))


@router.put("/{flow_id}")
def update_flow(
    flow_id: int,
    payload: FlowSave,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("orchestration:write", "model:write")),
):
    f = db.get(FlowProject, flow_id)
    if not f:
        raise NotFoundError("流程不存在")
    changed = False
    if payload.name is not None and payload.name != f.name:
        f.name = payload.name.strip()
        changed = True
    if payload.description is not None:
        f.description = payload.description
        changed = True
    if payload.graph is not None:
        f.graph = payload.graph
        f.version += 1
        changed = True
    if payload.status is not None and payload.status != f.status:
        f.status = payload.status
        changed = True
    if changed:
        db.commit()
        write_audit(db, user, "UPDATE", resource="flow", detail=f.name)
    return ok(FlowOut.model_validate(f).model_dump(by_alias=True, mode="json"))


@router.delete("/{flow_id}")
def delete_flow(
    flow_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("orchestration:write", "model:write")),
):
    f = db.get(FlowProject, flow_id)
    if not f:
        raise NotFoundError("流程不存在")
    name = f.name
    db.delete(f)
    db.commit()
    write_audit(db, user, "DELETE", resource="flow", detail=name)
    return ok({"done": True})


# ---------- 运行 ----------
@router.post("/{flow_id}/run")
def run_flow(
    flow_id: int,
    payload: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("orchestration:write", "model:write")),
):
    """仿真执行：真跑引擎（真实点位/分析算子/元模型统计），设备指令只记录不下发。"""
    f = db.get(FlowProject, flow_id)
    if not f:
        raise NotFoundError("流程不存在")
    if not f.graph or not f.graph.get("nodes"):
        raise BizError("流程画布为空，请先搭建流程")

    run = FlowRun(project_id=flow_id, mode=(payload or {}).get("mode") or "once", state="RUNNING")
    db.add(run)
    db.commit()

    engine = FlowEngine(db, f.graph, FLOW_VARIABLES)
    t0 = datetime.utcnow()
    try:
        engine.start()
        run.state = "SUCCESS"
    except Exception as e:
        run.state = "FAILED"
        run.error = str(e)
    run.finished_at = datetime.utcnow()
    run.duration_ms = int((run.finished_at - t0).total_seconds() * 1000)
    run.node_logs = engine.logs
    db.commit()
    write_audit(db, user, "EXECUTE", resource="flow", detail=f"{f.name} → {run.state}")
    return ok(FlowRunOut.model_validate(run).model_dump(by_alias=True, mode="json"))


@router.get("/{flow_id}/runs")
def list_runs(
    flow_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("orchestration:read", "model:read")),
):
    runs = db.execute(
        select(FlowRun).where(FlowRun.project_id == flow_id).order_by(FlowRun.id.desc()).limit(20)
    ).scalars().all()
    return ok([
        FlowRunOut.model_validate(r).model_dump(by_alias=True, mode="json") for r in runs
    ])
