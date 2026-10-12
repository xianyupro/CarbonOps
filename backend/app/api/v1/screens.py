"""自定义大屏配置（阶段4 驾驶舱中心）。"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_permission, write_audit
from app.core.exceptions import NotFoundError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.screen import ScreenConfig

router = APIRouter()


class ScreenSave(BaseModel):
    name: str
    layout: dict


class ScreenOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True,
        protected_namespaces=(),
    )
    id: int
    name: str
    layout: dict | None = None
    updated_at: object = None
    created_at: object = None


@router.get("")
def list_screens(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("studio:read", "model:read")),
):
    rows = db.execute(select(ScreenConfig).order_by(ScreenConfig.updated_at.desc())).scalars().all()
    return ok([ScreenOut.model_validate(r).model_dump(by_alias=True, mode="json") for r in rows])


@router.post("")
def create_screen(
    payload: ScreenSave,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("studio:write", "model:write")),
):
    s = ScreenConfig(name=payload.name.strip() or "未命名大屏", layout=payload.layout)
    db.add(s)
    db.commit()
    write_audit(db, user, "CREATE", resource="screen", detail=s.name)
    return ok(ScreenOut.model_validate(s).model_dump(by_alias=True, mode="json"))


@router.put("/{screen_id}")
def update_screen(
    screen_id: int,
    payload: ScreenSave,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("studio:write", "model:write")),
):
    s = db.get(ScreenConfig, screen_id)
    if not s:
        raise NotFoundError("大屏不存在")
    s.name = payload.name.strip() or s.name
    s.layout = payload.layout
    db.commit()
    write_audit(db, user, "UPDATE", resource="screen", detail=s.name)
    return ok(ScreenOut.model_validate(s).model_dump(by_alias=True, mode="json"))


@router.delete("/{screen_id}")
def delete_screen(
    screen_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("studio:write", "model:write")),
):
    s = db.get(ScreenConfig, screen_id)
    if not s:
        raise NotFoundError("大屏不存在")
    db.delete(s)
    db.commit()
    return ok({"done": True})
