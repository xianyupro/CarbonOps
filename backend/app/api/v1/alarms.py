"""Alarm center (M5 告警)."""
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import require_permission, write_audit
from app.core.exceptions import NotFoundError, BizError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.platform import Alarm
from app.schemas.platform import AlarmOut

router = APIRouter()


def _alarm_out(a: Alarm) -> dict:
    return AlarmOut(
        id=a.id,
        level=a.level,
        category=a.category,
        sourceType=a.source_type,
        sourceId=a.source_id,
        title=a.title,
        content=a.content,
        status=a.status,
        ackedBy=a.acked_by,
        ackedAt=a.acked_at,
        createdAt=a.created_at,
    ).model_dump()


@router.get("")
def list_alarms(
    page: int = 1,
    pageSize: int = 20,
    level: str = "",
    category: str = "",
    status: str = "",
    sourceType: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("data:quality:read")),
):
    stmt = select(Alarm).order_by(Alarm.id.desc())
    if level:
        stmt = stmt.where(Alarm.level == level)
    if category:
        stmt = stmt.where(Alarm.category == category)
    if status:
        stmt = stmt.where(Alarm.status == status)
    if sourceType:
        stmt = stmt.where(Alarm.source_type == sourceType)

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()
    data = [_alarm_out(a) for a in rows]
    return ok({"list": data, "meta": {"page": page, "pageSize": pageSize, "total": total}})


@router.get("/{alarm_id}")
def get_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("data:quality:read")),
):
    a = db.get(Alarm, alarm_id)
    if not a:
        raise NotFoundError("告警不存在")
    return ok(_alarm_out(a))


@router.post("/{alarm_id}/ack")
def ack_alarm(
    alarm_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("data:source:write")),
):
    a = db.get(Alarm, alarm_id)
    if not a:
        raise NotFoundError("告警不存在")
    if a.status != "ACTIVE":
        raise BizError("告警当前状态不可确认", code=409, status_code=409)
    a.status = "ACK"
    a.acked_by = user.id
    a.acked_at = datetime.utcnow()
    db.commit()
    db.refresh(a)
    write_audit(
        db,
        user,
        "ACK_ALARM",
        resource=f"alarm:{a.id}",
        ip=request.client.host if request.client else None,
    )
    return ok(_alarm_out(a))


@router.post("/{alarm_id}/resolve")
def resolve_alarm(
    alarm_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("data:source:write")),
):
    a = db.get(Alarm, alarm_id)
    if not a:
        raise NotFoundError("告警不存在")
    if a.status == "RESOLVED":
        raise BizError("告警已解决", code=409, status_code=409)
    a.status = "RESOLVED"
    if not a.acked_by:
        a.acked_by = user.id
        a.acked_at = datetime.utcnow()
    db.commit()
    db.refresh(a)
    write_audit(
        db,
        user,
        "RESOLVE_ALARM",
        resource=f"alarm:{a.id}",
        ip=request.client.host if request.client else None,
    )
    return ok(_alarm_out(a))
