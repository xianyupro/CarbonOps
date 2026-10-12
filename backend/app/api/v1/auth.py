"""Auth endpoints: login / refresh / me."""
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, write_audit
from app.core.exceptions import AuthError
from app.core.response import ok
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
    TOKEN_TYPE_REFRESH,
)
from app.db.session import get_db
from app.models.auth import User
from app.schemas.auth import LoginIn, RefreshIn, UserOut
from app.core.config import settings

router = APIRouter()


def _user_out(user: User) -> dict:
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        displayName=user.display_name,
        isActive=user.is_active,
        lastLoginAt=user.last_login_at,
        roles=[{"id": r.id, "code": r.code, "name": r.name} for r in user.roles],
        permissions=sorted(user.permission_codes),
    ).model_dump()


def _tokens(user: User) -> dict:
    return {
        "accessToken": create_access_token(user.id),
        "refreshToken": create_refresh_token(user.id),
        "expiresIn": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": _user_out(user),
    }


@router.post("/login")
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not verify_password(payload.password, user.password_hash):
        raise AuthError("用户名或密码错误")
    if not user.is_active:
        raise AuthError("账号已停用")
    user.last_login_at = datetime.utcnow()
    db.commit()
    write_audit(db, user, "LOGIN", resource="auth", ip=request.client.host if request.client else None)
    return ok(_tokens(user))


@router.post("/refresh")
def refresh(payload: RefreshIn, db: Session = Depends(get_db)):
    data = decode_token(payload.refreshToken)
    if not data or data.get("type") != TOKEN_TYPE_REFRESH:
        raise AuthError("刷新令牌无效")
    user = db.get(User, int(data["sub"]))
    if not user or not user.is_active:
        raise AuthError("用户不存在或已停用")
    return ok({
        "accessToken": create_access_token(user.id),
        "expiresIn": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    })


@router.post("/logout")
def logout(user: User = Depends(get_current_user)):
    # stateless JWT: client simply discards tokens
    return ok({"done": True})


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok(_user_out(user))
