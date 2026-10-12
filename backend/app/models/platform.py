"""Platform models (M4/M5/M6): scenario, alarm, form config."""
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Scenario(Base):
    """Industry scenario configuration (M5)."""

    __tablename__ = "scenarios"

    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    industry: Mapped[str] = mapped_column(String(32), default="通用")  # 有色/石化/钢铁/通用
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # sourceCodes/modelIds/formCode
    status: Mapped[str] = mapped_column(String(16), default="TEMPLATE")  # ACTIVE/INACTIVE/TEMPLATE
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    owner_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class Alarm(Base):
    """Alarm record (M5)."""

    __tablename__ = "alarms"

    level: Mapped[str] = mapped_column(String(16), nullable=False)  # INFO/WARN/CRITICAL
    category: Mapped[str] = mapped_column(String(16), nullable=False)  # DATA/MODEL/CONTROL/SYSTEM
    source_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE")  # ACTIVE/ACK/RESOLVED
    acked_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    acked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class FormConfig(Base):
    """Form / dashboard engineering config (M4 组态开发)."""

    __tablename__ = "form_configs"

    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    industry: Mapped[str] = mapped_column(String(32), default="通用")
    scenario: Mapped[str | None] = mapped_column(String(64), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # component tree + styles + bindings
    status: Mapped[str] = mapped_column(String(16), default="DRAFT")  # DRAFT/PUBLISHED/ARCHIVED
    version_no: Mapped[str] = mapped_column(String(32), default="v1")
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
