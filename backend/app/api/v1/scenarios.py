"""Scenario management (M5 行业场景)."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import require_permission, write_audit
from app.core.exceptions import NotFoundError, BizError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.platform import Scenario
from app.schemas.platform import ScenarioCreate, ScenarioUpdate, ScenarioOut

router = APIRouter()


def _scenario_out(s: Scenario) -> dict:
    return ScenarioOut(
        id=s.id,
        code=s.code,
        name=s.name,
        industry=s.industry,
        description=s.description,
        config=s.config,
        status=s.status,
        icon=s.icon,
        ownerId=s.owner_id,
        createdAt=s.created_at,
    ).model_dump()


@router.get("")
def list_scenarios(
    page: int = 1,
    pageSize: int = 20,
    keyword: str = "",
    industry: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("scenario:read")),
):
    stmt = select(Scenario).order_by(Scenario.id.desc())
    if industry:
        stmt = stmt.where(Scenario.industry == industry)
    if status:
        stmt = stmt.where(Scenario.status == status)
    if keyword:
        stmt = stmt.where(
            (Scenario.name.contains(keyword)) | (Scenario.code.contains(keyword))
        )

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()
    data = [_scenario_out(s) for s in rows]
    return ok({"list": data, "meta": {"page": page, "pageSize": pageSize, "total": total}})


@router.get("/{scenario_id}")
def get_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("scenario:read")),
):
    s = db.get(Scenario, scenario_id)
    if not s:
        raise NotFoundError("场景不存在")
    return ok(_scenario_out(s))


@router.post("")
def create_scenario(
    payload: ScenarioCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("scenario:read")),
):
    if db.scalar(select(Scenario).where(Scenario.code == payload.code)):
        raise BizError("场景编码已存在", code=409, status_code=409)
    s = Scenario(
        code=payload.code,
        name=payload.name,
        industry=payload.industry,
        description=payload.description,
        config=payload.config,
        status="TEMPLATE",
        icon=payload.icon,
        owner_id=user.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    write_audit(
        db,
        user,
        "CREATE_SCENARIO",
        resource=f"scenario:{s.id}",
        detail=s.name,
        ip=request.client.host if request.client else None,
    )
    return ok(_scenario_out(s))


@router.put("/{scenario_id}")
def update_scenario(
    scenario_id: int,
    payload: ScenarioUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("scenario:read")),
):
    s = db.get(Scenario, scenario_id)
    if not s:
        raise NotFoundError("场景不存在")
    data = payload.model_dump(exclude_unset=True)
    mapping = {"ownerId": "owner_id"}
    for k, v in data.items():
        setattr(s, mapping.get(k, k), v)
    db.commit()
    db.refresh(s)
    write_audit(
        db,
        user,
        "UPDATE_SCENARIO",
        resource=f"scenario:{s.id}",
        ip=request.client.host if request.client else None,
    )
    return ok(_scenario_out(s))


@router.delete("/{scenario_id}")
def delete_scenario(
    scenario_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("scenario:read")),
):
    s = db.get(Scenario, scenario_id)
    if not s:
        raise NotFoundError("场景不存在")
    db.delete(s)
    db.commit()
    write_audit(
        db,
        user,
        "DELETE_SCENARIO",
        resource=f"scenario:{scenario_id}",
        ip=request.client.host if request.client else None,
    )
    return ok({"id": scenario_id})
