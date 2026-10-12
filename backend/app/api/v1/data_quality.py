"""Data quality monitoring."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, Integer
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.core.exceptions import NotFoundError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.data import DataQualityLog, DataSource, DataPoint, TimeSeries

router = APIRouter()


@router.get("/overview")
def overview(db: Session = Depends(get_db), _: User = Depends(require_permission("data:quality:read"))):
    sources = db.execute(select(DataSource)).scalars().all()
    out = []
    for src in sources:
        log = db.execute(
            select(DataQualityLog).where(DataQualityLog.source_id == src.id).order_by(DataQualityLog.recorded_at.desc()).limit(1)
        ).scalars().first()
        point_count = db.scalar(select(func.count()).select_from(DataPoint).where(DataPoint.source_id == src.id)) or 0
        out.append({
            "sourceId": src.id, "sourceName": src.name, "industry": src.industry,
            "accessRate": log.access_rate if log else 0.0,
            "completenessRate": log.completeness_rate if log else 0.0,
            "anomalyRate": log.anomaly_rate if log else 0.0,
            "pointCount": point_count,
        })
    return ok(out)


@router.get("/{source_id}/trend")
def trend(source_id: int, hours: int = 24, db: Session = Depends(get_db), _: User = Depends(require_permission("data:quality:read"))):
    since = datetime.utcnow() - timedelta(hours=hours)
    rows = db.execute(
        select(DataQualityLog).where(
            DataQualityLog.source_id == source_id, DataQualityLog.recorded_at >= since
        ).order_by(DataQualityLog.recorded_at.asc())
    ).scalars().all()
    return ok([{
        "recordedAt": r.recorded_at, "accessRate": r.access_rate,
        "completenessRate": r.completeness_rate, "anomalyRate": r.anomaly_rate,
    } for r in rows])


@router.get("/{source_id}/heatmap")
def heatmap(source_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("data:quality:read"))):
    src = db.get(DataSource, source_id)
    if not src:
        raise NotFoundError("数据源不存在")
    points = db.execute(select(DataPoint).where(DataPoint.source_id == source_id)).scalars().all()
    since = datetime.utcnow() - timedelta(hours=24)
    out = []
    for p in points:
        # per-hour GOOD ratio over last 24h
        stmt = (
            select(func.strftime("%H", TimeSeries.timestamp).label("h"),
                   func.avg((TimeSeries.quality == "GOOD").cast(Integer)))
            .where(TimeSeries.point_id == p.id, TimeSeries.timestamp >= since)
            .group_by("h")
        )
        rows = db.execute(stmt).all()
        for r in rows:
            out.append({"pointId": p.id, "pointName": p.name, "hour": int(r[0]), "rate": round(r[1] or 0.0, 3)})
    return ok(out)
