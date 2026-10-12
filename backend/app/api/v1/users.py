"""User & role management + audit logs."""
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission, write_audit
from app.core.exceptions import BizError, NotFoundError
from app.core.response import ok
from app.core.security import hash_password
from app.db.session import get_db
from app.models.auth import User, Role, Permission, AuditLog
from app.schemas.auth import (
    UserOut,
    AuditLogOut,
    RoleDetailOut,
    PermissionOut,
    UserCreateIn,
    UserUpdateIn,
    ResetPasswordIn,
)

router = APIRouter()


def _user_out(u: User) -> dict:
    return UserOut(
        id=u.id,
        username=u.username,
        email=u.email,
        displayName=u.display_name,
        isActive=u.is_active,
        lastLoginAt=u.last_login_at,
        roles=[{"id": r.id, "code": r.code, "name": r.name} for r in u.roles],
        permissions=sorted(u.permission_codes),
    ).model_dump()


def _role_detail_out(r: Role) -> dict:
    return RoleDetailOut(
        id=r.id,
        code=r.code,
        name=r.name,
        description=r.description,
        isBuiltin=r.is_builtin,
        permissions=[
            PermissionOut(
                id=p.id, code=p.code, name=p.name, module=p.module
            ).model_dump()
            for p in r.permissions
        ],
    ).model_dump()


# -------------------------------------------------------------------- Roles ---

@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("system:role:read")),
):
    rows = db.execute(select(Role).order_by(Role.id.asc())).scalars().all()
    return ok([_role_detail_out(r) for r in rows])


@router.get("/permissions")
def list_permissions(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("system:role:read")),
):
    rows = db.execute(
        select(Permission).order_by(Permission.module.asc(), Permission.id.asc())
    ).scalars().all()
    return ok([
        PermissionOut(id=p.id, code=p.code, name=p.name, module=p.module).model_dump()
        for p in rows
    ])


# -------------------------------------------------------------------- Users ---

@router.get("")
def list_users(
    page: int = 1,
    pageSize: int = 20,
    keyword: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("system:user:read")),
):
    stmt = select(User).order_by(User.id.desc())
    if keyword:
        like = f"%{keyword}%"
        stmt = stmt.where(
            (User.username.contains(keyword))
            | (User.display_name.contains(keyword))
            | (User.email.contains(like))
        )
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()
    return ok({
        "list": [_user_out(u) for u in rows],
        "meta": {"page": page, "pageSize": pageSize, "total": total},
    })


@router.post("")
def create_user(
    payload: UserCreateIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("system:user:write")),
):
    if db.scalar(select(User).where(User.username == payload.username)):
        raise BizError("用户名已存在", code=409, status_code=409)
    roles = []
    if payload.roleIds:
        roles = db.execute(
            select(Role).where(Role.id.in_(payload.roleIds))
        ).scalars().all()
        if len(roles) != len(payload.roleIds):
            raise BizError("部分角色不存在")
    u = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        email=payload.email,
        display_name=payload.displayName,
        is_active=True,
        roles=roles,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    write_audit(db, user, "CREATE_USER", resource=f"user:{u.id}",
                detail=u.username, ip=request.client.host if request.client else None)
    return ok(_user_out(u))


@router.put("/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdateIn,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_permission("system:user:write")),
):
    u = db.get(User, user_id)
    if not u:
        raise NotFoundError("用户不存在")
    data = payload.model_dump(exclude_unset=True)
    role_ids = data.pop("roleIds", None)
    if "email" in data:
        u.email = data["email"]
    if "displayName" in data:
        u.display_name = data["displayName"]
    if "isActive" in data:
        u.is_active = data["isActive"]
    if role_ids is not None:
        if u.username == "admin" and any(
            r.code == "admin" for r in u.roles
        ) and 1 not in role_ids:
            # Allow admin to edit others but prevent accidental self-demotion
            # of the primary admin.
            admin_role = db.scalar(select(Role).where(Role.code == "admin"))
            if admin_role and admin_role.id not in role_ids:
                raise BizError("不能移除内置管理员角色的管理员权限")
        roles = []
        if role_ids:
            roles = db.execute(
                select(Role).where(Role.id.in_(role_ids))
            ).scalars().all()
        u.roles = roles
    db.commit()
    db.refresh(u)
    write_audit(db, current, "UPDATE_USER", resource=f"user:{u.id}",
                detail=u.username, ip=request.client.host if request.client else None)
    return ok(_user_out(u))


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_permission("system:user:delete")),
):
    u = db.get(User, user_id)
    if not u:
        raise NotFoundError("用户不存在")
    if u.username == "admin":
        raise BizError("不能删除内置管理员账号")
    db.delete(u)
    db.commit()
    write_audit(db, current, "DELETE_USER", resource=f"user:{user_id}",
                ip=request.client.host if request.client else None)
    return ok({"id": user_id})


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: ResetPasswordIn,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_permission("system:user:write")),
):
    u = db.get(User, user_id)
    if not u:
        raise NotFoundError("用户不存在")
    u.password_hash = hash_password(payload.newPassword)
    db.commit()
    write_audit(db, current, "RESET_PASSWORD", resource=f"user:{u.id}",
                detail=u.username, ip=request.client.host if request.client else None)
    return ok({"id": user_id})


# --------------------------------------------------------------- Audit logs ---

@router.get("/audit-logs")
def list_audit_logs(
    page: int = 1,
    pageSize: int = 50,
    username: str = "",
    action: str = "",
    start: str = "",
    end: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("system:audit:read")),
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    if username:
        stmt = stmt.where(AuditLog.username.contains(username))
    if action:
        stmt = stmt.where(AuditLog.action.contains(action))
    if start:
        try:
            start_dt = datetime.fromisoformat(start)
            stmt = stmt.where(AuditLog.created_at >= start_dt)
        except ValueError:
            pass
    if end:
        try:
            end_dt = datetime.fromisoformat(end)
            stmt = stmt.where(AuditLog.created_at <= end_dt)
        except ValueError:
            pass
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()
    return ok({
        "list": [
            AuditLogOut(
                id=r.id, username=r.username, action=r.action, resource=r.resource,
                detail=r.detail, ip=r.ip, createdAt=r.created_at,
            ).model_dump()
            for r in rows
        ],
        "meta": {"page": page, "pageSize": pageSize, "total": total},
    })
