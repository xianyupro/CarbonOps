"""Data management models (M2)."""
from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DataSource(Base):
    __tablename__ = "data_sources"

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    protocol: Mapped[str] = mapped_column(String(32), nullable=False)  # OPC_UA / MODBUS / MQTT / HTTP
    host: Mapped[str | None] = mapped_column(String(128), nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="DISCONNECTED")  # CONNECTED/DISCONNECTED/ERROR
    industry: Mapped[str] = mapped_column(String(32), default="通用")  # 有色/石化/钢铁/通用
    collect_interval_ms: Mapped[int] = mapped_column(Integer, default=5000)
    last_collected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    points: Mapped[list["DataPoint"]] = relationship(
        "DataPoint", back_populates="source", cascade="all, delete-orphan"
    )


class DataImport(Base):
    __tablename__ = "data_imports"

    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(16), nullable=False)  # CSV/EXCEL/JSON/XML/OPCUA_HIST
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="PARSING")  # PARSING/COMPLETED/FAILED
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    imported_rows: Mapped[int] = mapped_column(Integer, default=0)
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    source_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True)

    uploader = relationship("User", back_populates="imports")  # type: ignore # noqa: F821


class DataPoint(Base):
    __tablename__ = "data_points"

    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("data_sources.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    data_type: Mapped[str] = mapped_column(String(16), default="NUMBER")  # NUMBER/STRING/BOOLEAN
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    industry: Mapped[str] = mapped_column(String(32), default="通用")
    process_stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    device: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Mock generation parameters (so the generator can reproduce values)
    gen_base: Mapped[float] = mapped_column(Float, default=50.0)
    gen_amplitude: Mapped[float] = mapped_column(Float, default=10.0)
    gen_period_s: Mapped[float] = mapped_column(Float, default=3600.0)
    gen_noise: Mapped[float] = mapped_column(Float, default=1.0)
    gen_trend: Mapped[float] = mapped_column(Float, default=0.0)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    source: Mapped["DataSource"] = relationship("DataSource", back_populates="points")


class TimeSeries(Base):
    __tablename__ = "time_series"

    point_id: Mapped[int] = mapped_column(Integer, ForeignKey("data_points.id", ondelete="CASCADE"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    # 非数值型采样（ARRAY 曲线/字符串状态）存这里，数值仍走 value
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality: Mapped[str] = mapped_column(String(8), default="GOOD")  # GOOD/BAD/MISSING

    __table_args__ = (Index("ix_time_series_point_ts", "point_id", "timestamp"),)


class DataQualityLog(Base):
    __tablename__ = "data_quality_logs"

    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("data_sources.id", ondelete="CASCADE"), index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    access_rate: Mapped[float] = mapped_column(Float, default=0.0)
    completeness_rate: Mapped[float] = mapped_column(Float, default=0.0)
    anomaly_rate: Mapped[float] = mapped_column(Float, default=0.0)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
