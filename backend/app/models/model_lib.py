"""Model library models (M3)."""
from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    industry: Mapped[str] = mapped_column(String(32), default="通用")
    # Extended function types: OPTIMIZATION/PREDICTION/CLASSIFICATION/CARBON_ACCOUNTING
    # + PROCESS_MODELING/PROCESS_CONTROL/CARBON_MONITORING/DATA_PERCEPTION/AUXILIARY
    function_type: Mapped[str] = mapped_column(String(32), nullable=False)
    process_stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)  # 提供单位
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="DEVELOPING")  # DEVELOPING/TESTING/ONLINE/OFFLINE
    call_count: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    owner_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Model Card structured content (JSON)
    model_card: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    versions: Mapped[list["ModelVersion"]] = relationship(
        "ModelVersion", back_populates="model", cascade="all, delete-orphan"
    )
    owner = relationship("User", foreign_keys=[owner_id])  # type: ignore # noqa: F821


class ModelVersion(Base):
    __tablename__ = "model_versions"

    model_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("model_registry.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version_no: Mapped[str] = mapped_column(String(32), nullable=False)
    entry_function: Mapped[str] = mapped_column(String(64), default="predict")
    input_schema: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_schema: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    dependencies: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    changelog: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(16), default="DEVELOPING")

    # Lifecycle stage: NONE / STAGING / PRODUCTION / ARCHIVED
    stage: Mapped[str] = mapped_column(String(16), default="NONE")

    # Source code (Python)
    source_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    python_version: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # Evaluation metrics (JSON: {"mae": 0.1, "rmse": 0.2, ...})
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    model: Mapped["ModelRegistry"] = relationship("ModelRegistry", back_populates="versions")
    calls: Mapped[list["ModelCall"]] = relationship(
        "ModelCall", back_populates="version", cascade="all, delete-orphan"
    )


class ModelCall(Base):
    __tablename__ = "model_calls"

    model_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("model_registry.id", ondelete="CASCADE"), index=True
    )
    version_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("model_versions.id", ondelete="SET NULL"), nullable=True
    )
    caller_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="SUCCESS")  # SUCCESS/FAILED/TIMEOUT
    input: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    version: Mapped["ModelVersion | None"] = relationship("ModelVersion", back_populates="calls")
