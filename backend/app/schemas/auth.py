"""Auth schemas."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class LoginIn(BaseModel):
    username: str
    password: str


class RefreshIn(BaseModel):
    refreshToken: str


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    module: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: Optional[str] = None
    displayName: Optional[str] = None
    isActive: bool
    lastLoginAt: Optional[datetime] = None
    roles: List[RoleOut] = []
    permissions: List[str] = []


class TokenOut(BaseModel):
    accessToken: str
    refreshToken: str
    expiresIn: int
    user: UserOut


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: Optional[str] = None
    action: str
    resource: Optional[str] = None
    detail: Optional[str] = None
    ip: Optional[str] = None
    createdAt: datetime


class RoleDetailOut(RoleOut):
    description: Optional[str] = None
    isBuiltin: bool = False
    permissions: List[PermissionOut] = []


class UserCreateIn(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    displayName: Optional[str] = None
    roleIds: List[int] = []


class UserUpdateIn(BaseModel):
    email: Optional[str] = None
    displayName: Optional[str] = None
    isActive: Optional[bool] = None
    roleIds: Optional[List[int]] = None


class ResetPasswordIn(BaseModel):
    newPassword: str
