"""Data source management."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission, write_audit
from app.core.exceptions import NotFoundError, BizError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.data import DataSource, DataPoint
from app.schemas.data import DataSourceCreate, DataSourceUpdate, DataSourceOut, DataSourceDetail, DataPointBrief
from app.mock.industrial import fake_connect_latency_ms, runtime

router = APIRouter()


def _src_out(src: DataSource, point_count: int | None = None) -> dict:
    return DataSourceOut(
        id=src.id, name=src.name, code=src.code, protocol=src.protocol,
        host=src.host, port=src.port, config=src.config, status=src.status,
        industry=src.industry, collectIntervalMs=src.collect_interval_ms,
        lastCollectedAt=src.last_collected_at, description=src.description,
        pointCount=point_count if point_count is not None else 0,
        createdAt=src.created_at,
    ).model_dump()


@router.get("")
def list_sources(
    page: int = 1,
    pageSize: int = 20,
    industry: str = "",
    protocol: str = "",
    status: str = "",
    keyword: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("data:source:read")),
):
    stmt = select(DataSource).order_by(DataSource.id.desc())
    if industry:
        stmt = stmt.where(DataSource.industry == industry)
    if protocol:
        stmt = stmt.where(DataSource.protocol == protocol)
    if status:
        stmt = stmt.where(DataSource.status == status)
    if keyword:
        stmt = stmt.where((DataSource.name.contains(keyword)) | (DataSource.code.contains(keyword)))

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()

    data = []
    for src in rows:
        pc = db.scalar(select(func.count()).select_from(DataPoint).where(DataPoint.source_id == src.id)) or 0
        data.append(_src_out(src, pc))
    return ok({"list": data, "meta": {"page": page, "pageSize": pageSize, "total": total}})


@router.get("/{source_id}")
def get_source(source_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("data:source:read"))):
    src = db.get(DataSource, source_id)
    if not src:
        raise NotFoundError("数据源不存在")
    points = db.execute(select(DataPoint).where(DataPoint.source_id == src.id)).scalars().all()
    out = _src_out(src, len(points))
    out["points"] = [DataPointBrief(
        id=p.id, code=p.code, name=p.name, unit=p.unit, dataType=p.data_type,
        processStage=p.process_stage, device=p.device,
    ).model_dump() for p in points]
    return ok(out)


@router.post("")
def create_source(
    payload: DataSourceCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("data:source:write")),
):
    if db.scalar(select(DataSource).where(DataSource.code == payload.code)):
        raise BizError("数据源编码已存在", code=409, status_code=409)
    src = DataSource(
        name=payload.name, code=payload.code, protocol=payload.protocol,
        host=payload.host, port=payload.port, config=payload.config,
        status="DISCONNECTED", industry=payload.industry,
        collect_interval_ms=payload.collectIntervalMs, description=payload.description,
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    write_audit(db, user, "CREATE_DATA_SOURCE", resource=f"data_source:{src.id}",
                detail=src.name, ip=request.client.host if request.client else None)
    return ok(_src_out(src, 0))


@router.put("/{source_id}")
def update_source(
    source_id: int,
    payload: DataSourceUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("data:source:write")),
):
    src = db.get(DataSource, source_id)
    if not src:
        raise NotFoundError("数据源不存在")
    data = payload.model_dump(exclude_unset=True)
    mapping = {"collectIntervalMs": "collect_interval_ms"}
    for k, v in data.items():
        setattr(src, mapping.get(k, k), v)
    db.commit()
    db.refresh(src)
    write_audit(db, user, "UPDATE_DATA_SOURCE", resource=f"data_source:{src.id}", ip=request.client.host if request.client else None)
    return ok(_src_out(src))


@router.delete("/{source_id}")
def delete_source(source_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_permission("data:source:delete"))):
    src = db.get(DataSource, source_id)
    if not src:
        raise NotFoundError("数据源不存在")
    db.delete(src)
    db.commit()
    write_audit(db, user, "DELETE_DATA_SOURCE", resource=f"data_source:{source_id}", ip=request.client.host if request.client else None)
    return ok({"id": source_id})


@router.post("/{source_id}/test")
def test_source(source_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("data:source:read"))):
    src = db.get(DataSource, source_id)
    if not src:
        raise NotFoundError("数据源不存在")
    latency = fake_connect_latency_ms(src.protocol)
    return ok({"connected": True, "latencyMs": latency, "message": "连接成功（Mock）"})


@router.post("/{source_id}/start")
def start_source(source_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_permission("data:source:write"))):
    from datetime import datetime
    src = db.get(DataSource, source_id)
    if not src:
        raise NotFoundError("数据源不存在")
    src.status = "CONNECTED"
    src.last_collected_at = datetime.utcnow()
    db.commit()
    db.refresh(src)
    # ensure live generators are registered
    from app.mock.seed import _register_live_generators
    _register_live_generators_one(db, src)
    write_audit(db, user, "START_SOURCE", resource=f"data_source:{src.id}", ip=request.client.host if request.client else None)
    return ok(_src_out(src))


@router.post("/{source_id}/stop")
def stop_source(source_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_permission("data:source:write"))):
    src = db.get(DataSource, source_id)
    if not src:
        raise NotFoundError("数据源不存在")
    src.status = "DISCONNECTED"
    db.commit()
    db.refresh(src)
    write_audit(db, user, "STOP_SOURCE", resource=f"data_source:{src.id}", ip=request.client.host if request.client else None)
    return ok(_src_out(src))


def _register_live_generators_one(db: Session, src: DataSource) -> None:
    points = db.execute(select(DataPoint).where(DataPoint.source_id == src.id)).scalars().all()
    from app.mock.generator import TimeSeriesGenerator
    for p in points:
        runtime.register(p.id, TimeSeriesGenerator(
            base=p.gen_base, amplitude=p.gen_amplitude, period_s=p.gen_period_s,
            noise=p.gen_noise, trend=p.gen_trend, data_type=p.data_type, seed=p.id,
        ))
