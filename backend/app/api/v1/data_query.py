"""Time-series query & dimensions."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, distinct
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.core.exceptions import BizError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.data import DataPoint
from app.schemas.data import DataQueryIn
from app.services.data_service import query_series, latest_values

router = APIRouter()


@router.post("/query")
def query(payload: DataQueryIn, db: Session = Depends(get_db), _: User = Depends(require_permission("data:query"))):
    if not payload.pointIds:
        raise BizError("请至少选择一个点位")
    if payload.start >= payload.end:
        raise BizError("时间范围无效")
    data = query_series(db, payload.pointIds, payload.start, payload.end, payload.interval, payload.agg)
    return ok(data)


@router.get("/latest")
def latest(point_ids: str, db: Session = Depends(get_db), _: User = Depends(require_permission("data:query"))):
    ids = [int(x) for x in point_ids.split(",") if x.strip().isdigit()]
    if not ids:
        raise BizError("point_ids 参数无效")
    return ok(latest_values(db, ids))


@router.get("/dimensions")
def dimensions(db: Session = Depends(get_db), _: User = Depends(require_permission("data:query"))):
    rows = db.execute(select(DataPoint)).scalars().all()
    industry = sorted({r.industry for r in rows if r.industry})
    process_stage = sorted({r.process_stage for r in rows if r.process_stage})
    device = sorted({r.device for r in rows if r.device})
    data_type = sorted({r.data_type for r in rows if r.data_type})
    return ok({"industry": industry, "processStage": process_stage, "device": device, "dataType": data_type})
