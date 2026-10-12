"""Common/shared schemas."""
from datetime import datetime
from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PageMeta(BaseModel):
    page: int
    pageSize: int
    total: int
    totalPages: int


class PageOut(BaseModel, Generic[T]):
    list: List[T]
    meta: PageMeta


class IdOut(BaseModel):
    id: int
