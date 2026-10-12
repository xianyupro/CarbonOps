"""Model library schemas (M3)."""
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict


# ---------- Model Registry ----------
class ModelRegistryCreate(BaseModel):
    name: str
    code: str
    industry: str = "通用"
    functionType: str
    processStage: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    provider: Optional[str] = None


class ModelRegistryUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    functionType: Optional[str] = None
    processStage: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    accuracy: Optional[float] = None
    provider: Optional[str] = None


# ---------- Model Version ----------
class ModelVersionBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    modelId: int
    versionNo: str
    entryFunction: str
    isCurrent: bool
    status: str
    stage: str = "NONE"
    changelog: Optional[str] = None
    createdAt: datetime


class ModelVersionDetail(BaseModel):
    """Full version info including source code and metrics."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    modelId: int
    versionNo: str
    entryFunction: str
    isCurrent: bool
    status: str
    stage: str = "NONE"
    changelog: Optional[str] = None
    sourceCode: Optional[str] = None
    pythonVersion: Optional[str] = None
    inputSchema: Optional[dict] = None
    outputSchema: Optional[dict] = None
    dependencies: Optional[dict] = None
    metrics: Optional[dict] = None
    createdAt: datetime


class ModelRegistryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    code: str
    industry: str
    functionType: str
    processStage: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    status: str
    callCount: int
    accuracy: float
    ownerId: Optional[int] = None
    provider: Optional[str] = None
    modelCard: Optional[dict] = None
    versionCount: int = 0
    latestVersion: Optional[str] = None
    createdAt: datetime


class ModelRegistryDetail(ModelRegistryOut):
    versions: List[ModelVersionBrief] = []


class ModelVersionCreate(BaseModel):
    versionNo: str
    entryFunction: Optional[str] = "predict"
    inputSchema: Optional[dict] = None
    outputSchema: Optional[dict] = None
    dependencies: Optional[dict] = None
    changelog: Optional[str] = None
    isCurrent: Optional[bool] = None
    sourceCode: Optional[str] = None
    pythonVersion: Optional[str] = None


class ModelVersionUpdate(BaseModel):
    changelog: Optional[str] = None
    entryFunction: Optional[str] = None
    inputSchema: Optional[dict] = None
    outputSchema: Optional[dict] = None
    dependencies: Optional[dict] = None


# ---------- Source Code ----------
class SourceCodeUpdate(BaseModel):
    sourceCode: str
    pythonVersion: Optional[str] = None


# ---------- Model Card ----------
class ModelCardUpdate(BaseModel):
    modelCard: dict


# ---------- Lifecycle Stage Transition (MLflow-style) ----------
class LifecycleTransition(BaseModel):
    """Transition a version's stage: NONE / STAGING / PRODUCTION / ARCHIVED."""
    stage: str  # NONE | STAGING | PRODUCTION | ARCHIVED


# ---------- Test Run ----------
class TestRunIn(BaseModel):
    """Execute model source code with a test input (safe sandboxed eval)."""
    sourceCode: Optional[str] = None  # if provided, run this code; else use saved
    input: dict = {}


class TestRunOut(BaseModel):
    success: bool
    output: Optional[dict] = None
    error: Optional[str] = None
    latencyMs: int
    stdout: Optional[str] = None


# ---------- Model Invoke ----------
class ModelInvokeIn(BaseModel):
    input: dict
    versionId: Optional[int] = None


class ModelInvokeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    modelId: int
    versionId: Optional[int] = None
    output: dict
    latencyMs: int
    status: str


# ---------- Model Call ----------
class ModelCallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    modelId: int
    versionId: Optional[int] = None
    callerId: Optional[int] = None
    latencyMs: int
    status: str
    input: Optional[dict] = None
    output: Optional[dict] = None
    createdAt: datetime


# ---------- Faceted Search ----------
class FacetBucket(BaseModel):
    value: str
    label: str
    count: int


class ModelFacets(BaseModel):
    """Aggregated counts for faceted filtering (like HuggingFace Hub sidebar)."""
    industry: List[FacetBucket] = []
    functionType: List[FacetBucket] = []
    status: List[FacetBucket] = []
    provider: List[FacetBucket] = []
    processStage: List[FacetBucket] = []
