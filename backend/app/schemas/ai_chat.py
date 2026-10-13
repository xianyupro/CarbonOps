"""AI 助手对话 schemas。"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True,
        protected_namespaces=(),
    )


class AiChatMessageOut(CamelModel):
    id: int
    role: str
    content: str
    created_at: datetime


class AiChatSessionOut(CamelModel):
    id: int
    title: str
    message_count: int = 0
    last_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AiChatSessionCreate(BaseModel):
    title: str = "新对话"


class AiChatSessionRename(BaseModel):
    title: str


class AiChatSend(BaseModel):
    content: str
    stream: bool = True
