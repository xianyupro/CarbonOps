"""Data point management."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.core.exceptions import NotFoundError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.data import DataPoint, DataSource
from app.schemas.data import DataPointCreate, DataPointOut

router = APIRouter()


def _out(p: DataPoint) -> dict:
    return DataPointOut(
        id=p.id, sourceId=p.source_id, code=p.code, name=p.name, unit=p.unit,
        dataType=p.data_type, tags=p.tags, industry=p.industry,
        processStage=p.process_stage, device=p.device,
        genBase=p.gen_base, genAmplitude=p.gen_amplitude, genPeriodS=p.gen_period_s,
        genNoise=p.gen_noise, description=p.description,
    ).model_dump()


@router.get("")
def list_points(
    sourceId: int = 0,
    keyword: str = "",
    page: int = 1,
    pageSize: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("data:point:read")),
):
    stmt = select(DataPoint).order_by(DataPoint.id.asc())
    if sourceId:
        stmt = stmt.where(DataPoint.source_id == sourceId)
    if keyword:
        stmt = stmt.where((DataPoint.code.contains(keyword)) | (DataPoint.name.contains(keyword)))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()
    return ok({"list": [_out(p) for p in rows], "meta": {"page": page, "pageSize": pageSize, "total": total}})


@router.post("")
def create_point(payload: DataPointCreate, db: Session = Depends(get_db), _: User = Depends(require_permission("data:point:write"))):
    if not db.get(DataSource, payload.sourceId):
        raise NotFoundError("数据源不存在")
    p = DataPoint(
        source_id=payload.sourceId, code=payload.code, name=payload.name, unit=payload.unit,
        data_type=payload.dataType, tags=payload.tags, industry=payload.industry,
        process_stage=payload.processStage, device=payload.device, description=payload.description,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return ok(_out(p))


@router.delete("/{point_id}")
def delete_point(point_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("data:point:write"))):
    p = db.get(DataPoint, point_id)
    if not p:
        raise NotFoundError("点位不存在")
    db.delete(p)
    db.commit()
    return ok({"id": point_id})
