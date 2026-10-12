"""Platform schemas (M4/M5/M6): scenario, alarm, form config."""
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict


# ---------- Scenario ----------
class ScenarioCreate(BaseModel):
    code: str
    name: str
    industry: str = "通用"
    description: Optional[str] = None
    config: Optional[dict] = None
    icon: Optional[str] = None


class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[dict] = None
    status: Optional[str] = None
    icon: Optional[str] = None


class ScenarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    industry: str
    description: Optional[str] = None
    config: Optional[dict] = None
    status: str
    icon: Optional[str] = None
    ownerId: Optional[int] = None
    createdAt: datetime


class ScenarioDetail(ScenarioOut):
    """Detail view returns the full config payload (inherited from ScenarioOut)."""

    pass


# ---------- Alarm ----------
class AlarmOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    level: str
    category: str
    sourceType: Optional[str] = None
    sourceId: Optional[int] = None
    title: str
    content: Optional[str] = None
    status: str
    ackedBy: Optional[int] = None
    ackedAt: Optional[datetime] = None
    createdAt: datetime


class AlarmAckIn(BaseModel):
    """Optional empty body for acknowledge / resolve actions."""

    pass


# ---------- FormConfig (Studio) ----------
class FormConfigCreate(BaseModel):
    code: str
    name: str
    industry: str = "通用"
    scenario: Optional[str] = None
    description: Optional[str] = None
    pageConfig: Optional[dict] = None


class FormConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    pageConfig: Optional[dict] = None
    status: Optional[str] = None


class FormConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    industry: str
    scenario: Optional[str] = None
    description: Optional[str] = None
    status: str
    versionNo: str
    createdBy: Optional[int] = None
    createdAt: datetime


class FormConfigDetail(FormConfigOut):
    """Detail view returns the full pageConfig payload."""

    pageConfig: Optional[dict] = None
