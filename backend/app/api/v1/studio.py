"""Studio / form config management (M4 组态开发)."""
import re
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import require_permission, write_audit
from app.core.exceptions import NotFoundError, BizError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.platform import FormConfig
from app.schemas.platform import FormConfigCreate, FormConfigUpdate, FormConfigOut

router = APIRouter()


def _bump_version(version_no: str) -> str:
    """Increment a vN version string: v1 -> v2, v2 -> v3 ..."""
    m = re.match(r"^v(\d+)$", version_no or "")
    if m:
        return f"v{int(m.group(1)) + 1}"
    return "v1"


def _form_out(f: FormConfig, include_page: bool = False) -> dict:
    data = FormConfigOut(
        id=f.id,
        code=f.code,
        name=f.name,
        industry=f.industry,
        scenario=f.scenario,
        description=f.description,
        status=f.status,
        versionNo=f.version_no,
        createdBy=f.created_by,
        createdAt=f.created_at,
    ).model_dump()
    if include_page:
        data["pageConfig"] = f.page_config
    return data


@router.get("")
def list_forms(
    page: int = 1,
    pageSize: int = 20,
    keyword: str = "",
    industry: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("studio:read")),
):
    stmt = select(FormConfig).order_by(FormConfig.id.desc())
    if industry:
        stmt = stmt.where(FormConfig.industry == industry)
    if status:
        stmt = stmt.where(FormConfig.status == status)
    if keyword:
        stmt = stmt.where(
            (FormConfig.name.contains(keyword)) | (FormConfig.code.contains(keyword))
        )

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()
    data = [_form_out(f) for f in rows]
    return ok({"list": data, "meta": {"page": page, "pageSize": pageSize, "total": total}})


@router.get("/{form_id}")
def get_form(
    form_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("studio:read")),
):
    f = db.get(FormConfig, form_id)
    if not f:
        raise NotFoundError("组态工程不存在")
    return ok(_form_out(f, include_page=True))


@router.post("")
def create_form(
    payload: FormConfigCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("studio:write")),
):
    if db.scalar(select(FormConfig).where(FormConfig.code == payload.code)):
        raise BizError("组态编码已存在", code=409, status_code=409)
    f = FormConfig(
        code=payload.code,
        name=payload.name,
        industry=payload.industry,
        scenario=payload.scenario,
        description=payload.description,
        page_config=payload.pageConfig,
        status="DRAFT",
        version_no="v1",
        created_by=user.id,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    write_audit(
        db,
        user,
        "CREATE_FORM",
        resource=f"form:{f.id}",
        detail=f.name,
        ip=request.client.host if request.client else None,
    )
    return ok(_form_out(f, include_page=True))


@router.put("/{form_id}")
def update_form(
    form_id: int,
    payload: FormConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("studio:write")),
):
    f = db.get(FormConfig, form_id)
    if not f:
        raise NotFoundError("组态工程不存在")
    data = payload.model_dump(exclude_unset=True)
    mapping = {"pageConfig": "page_config"}
    for k, v in data.items():
        setattr(f, mapping.get(k, k), v)
    db.commit()
    db.refresh(f)
    write_audit(
        db,
        user,
        "UPDATE_FORM",
        resource=f"form:{f.id}",
        ip=request.client.host if request.client else None,
    )
    return ok(_form_out(f, include_page=True))


@router.delete("/{form_id}")
def delete_form(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("studio:write")),
):
    f = db.get(FormConfig, form_id)
    if not f:
        raise NotFoundError("组态工程不存在")
    db.delete(f)
    db.commit()
    write_audit(
        db,
        user,
        "DELETE_FORM",
        resource=f"form:{form_id}",
        ip=request.client.host if request.client else None,
    )
    return ok({"id": form_id})


@router.post("/{form_id}/publish")
def publish_form(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("studio:write")),
):
    f = db.get(FormConfig, form_id)
    if not f:
        raise NotFoundError("组态工程不存在")
    f.status = "PUBLISHED"
    f.version_no = _bump_version(f.version_no)
    db.commit()
    db.refresh(f)
    write_audit(
        db,
        user,
        "PUBLISH_FORM",
        resource=f"form:{f.id}",
        detail=f.version_no,
        ip=request.client.host if request.client else None,
    )
    return ok(_form_out(f, include_page=True))
