"""Unified API response envelope: {code, msg, data}."""
from typing import Any, Generic, TypeVar, Optional, List
from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = 0
    msg: str = "ok"
    data: Optional[T] = None

    @classmethod
    def ok(cls, data: Any = None, msg: str = "ok") -> "ApiResponse":
        return cls(code=0, msg=msg, data=data)

    @classmethod
    def fail(cls, msg: str, code: int = -1, data: Any = None) -> "ApiResponse":
        return cls(code=code, msg=msg, data=data)


class PageMeta(BaseModel):
    page: int
    pageSize: int
    total: int


class PageData(BaseModel, Generic[T]):
    list: List[T]
    meta: PageMeta


def ok(data: Any = None, msg: str = "ok") -> dict:
    """Shorthand for a success envelope dict."""
    return {"code": 0, "msg": msg, "data": data}
