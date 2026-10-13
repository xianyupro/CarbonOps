"""AI 助手对话模型 —— 智能助手模块的会话与消息存储。

每个登录用户拥有独立的会话列表；消息按会话归属，随会话级联删除。
"""
from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AiChatSession(Base):
    __tablename__ = "ai_chat_sessions"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), default="新对话", nullable=False)

    messages: Mapped[list["AiChatMessage"]] = relationship(
        "AiChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="AiChatMessage.id",
        lazy="selectin",
    )

    @property
    def message_count(self) -> int:
        return len(self.messages)

    @property
    def last_message(self) -> str | None:
        return self.messages[-1].content[:120] if self.messages else None


class AiChatMessage(Base):
    __tablename__ = "ai_chat_messages"
    __table_args__ = (Index("ix_ai_chat_messages_session", "session_id"),)

    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), nullable=False
    )
    # user / assistant
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    session: Mapped["AiChatSession"] = relationship("AiChatSession", back_populates="messages")
