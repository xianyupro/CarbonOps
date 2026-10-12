"""Data management schemas (M2)."""
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict


# ---------- Data Source ----------
class DataSourceBase(BaseModel):
    name: str
    code: str
    protocol: str  # OPC_UA / MODBUS / MQTT / HTTP
    host: Optional[str] = None
    port: Optional[int] = None
    config: Optional[dict] = None
    industry: str = "通用"
    collectIntervalMs: int = 5000
    description: Optional[str] = None


class DataSourceCreate(DataSourceBase):
    pass


class DataSourceUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    config: Optional[dict] = None
    industry: Optional[str] = None
    collectIntervalMs: Optional[int] = None
    description: Optional[str] = None
    status: Optional[str] = None


class DataPointBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    unit: Optional[str] = None
    dataType: str
    processStage: Optional[str] = None
    device: Optional[str] = None


class DataSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    code: str
    protocol: str
    host: Optional[str] = None
    port: Optional[int] = None
    config: Optional[dict] = None
    status: str
    industry: str
    collectIntervalMs: int
    lastCollectedAt: Optional[datetime] = None
    description: Optional[str] = None
    pointCount: int = 0
    createdAt: datetime


class DataSourceDetail(DataSourceOut):
    points: List[DataPointBrief] = []


# ---------- Data Point ----------
class DataPointBase(BaseModel):
    sourceId: int
    code: str
    name: str
    unit: Optional[str] = None
    dataType: str = "NUMBER"
    tags: Optional[List[str]] = None
    industry: str = "通用"
    processStage: Optional[str] = None
    device: Optional[str] = None
    description: Optional[str] = None


class DataPointCreate(DataPointBase):
    pass


class DataPointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sourceId: int
    code: str
    name: str
    unit: Optional[str] = None
    dataType: str
    tags: Optional[List[str]] = None
    industry: str
    processStage: Optional[str] = None
    device: Optional[str] = None
    genBase: float
    genAmplitude: float
    genPeriodS: float
    genNoise: float
    description: Optional[str] = None


# ---------- Data Import ----------
class DataImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    fileType: str
    fileSize: int
    status: str
    totalRows: int
    importedRows: int
    errorMsg: Optional[str] = None
    uploadedBy: Optional[int] = None
    createdAt: datetime


# ---------- Query ----------
class DataQueryIn(BaseModel):
    pointIds: List[int]
    start: datetime
    end: datetime
    interval: Optional[str] = None  # e.g. "1 minute","5 minute","1 hour","1 day" (SQLite strftime)
    agg: str = "NONE"  # NONE/AVG/MAX/MIN/SUM


class SeriesPoint(BaseModel):
    t: datetime
    v: Optional[float] = None


class SeriesOut(BaseModel):
    pointId: int
    series: List[SeriesPoint] = []


class LatestOut(BaseModel):
    pointId: int
    value: Optional[float] = None
    timestamp: Optional[datetime] = None
    quality: str = "GOOD"


class DimensionOut(BaseModel):
    industry: List[str] = []
    processStage: List[str] = []
    device: List[str] = []
    dataType: List[str] = []


# ---------- Quality ----------
class QualityOverviewItem(BaseModel):
    sourceId: int
    sourceName: str
    industry: str
    accessRate: float
    completenessRate: float
    anomalyRate: float
    pointCount: int


class QualityTrendPoint(BaseModel):
    recordedAt: datetime
    accessRate: float
    completenessRate: float
    anomalyRate: float


class HeatmapCell(BaseModel):
    pointId: int
    pointName: str
    hour: int
    rate: float


class PreviewRow(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
