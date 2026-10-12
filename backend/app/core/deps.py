"""FastAPI dependencies: current user, permission enforcement, audit logging."""
from typing import Callable
from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AuthError, ForbiddenError
from app.core.security import decode_token, TOKEN_TYPE_ACCESS
from app.db.session import get_db
from app.models.auth import User, AuditLog


def _extract_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("缺少认证令牌")
    return authorization.split(" ", 1)[1].strip()


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_token(authorization)
    payload = decode_token(token)
    if not payload or payload.get("type") != TOKEN_TYPE_ACCESS:
        raise AuthError("认证令牌无效或已过期")
    user_id = payload.get("sub")
    user = db.get(User, int(user_id)) if user_id else None
    if not user or not user.is_active:
        raise AuthError("用户不存在或已停用")
    return user


def require_permission(*perm_codes: str) -> Callable:
    """Dependency factory: require the current user to hold ALL given permission codes."""

    def _checker(user: User = Depends(get_current_user)) -> User:
        # built-in admin bypasses
        if any(r.code == "admin" for r in user.roles):
            return user
        user_codes = user.permission_codes
        missing = [c for c in perm_codes if c not in user_codes]
        if missing:
            raise ForbiddenError(f"缺少权限: {', '.join(missing)}")
        return user

    _checker.__name__ = f"require_permission_{'_'.join(perm_codes)}"
    return _checker


def write_audit(
    db: Session,
    user: User | None,
    action: str,
    resource: str | None = None,
    detail: str | None = None,
    ip: str | None = None,
) -> None:
    try:
        log = AuditLog(
            user_id=user.id if user else None,
            username=user.username if user else None,
            action=action,
            resource=resource,
            detail=detail,
            ip=ip,
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()
