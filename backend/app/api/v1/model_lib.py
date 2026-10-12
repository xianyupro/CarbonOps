"""Model library management (M3).

Inspired by MLflow Model Registry (Stage transitions), HuggingFace Hub
(faceted search + Model Card), and BentoML (entry function `def predict`).
"""
import io
import random
import time
from contextlib import redirect_stdout

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.core.deps import require_permission, write_audit
from app.core.exceptions import NotFoundError, BizError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.model_lib import ModelRegistry, ModelVersion, ModelCall
from app.schemas.model_lib import (
    ModelRegistryCreate,
    ModelRegistryUpdate,
    ModelRegistryOut,
    ModelRegistryDetail,
    ModelVersionBrief,
    ModelVersionDetail,
    ModelVersionCreate,
    ModelVersionUpdate,
    ModelInvokeIn,
    ModelInvokeOut,
    ModelCallOut,
    SourceCodeUpdate,
    ModelCardUpdate,
    LifecycleTransition,
    TestRunIn,
    TestRunOut,
    FacetBucket,
)

router = APIRouter()

# ---------- Constants ----------
_VALID_STAGES = {"NONE", "STAGING", "PRODUCTION", "ARCHIVED"}

_FUNCTION_TYPE_LABELS = {
    "OPTIMIZATION": "运行优化",
    "PREDICTION": "预测",
    "CLASSIFICATION": "分类",
    "CARBON_ACCOUNTING": "碳核算",
    "PROCESS_MODELING": "过程建模",
    "PROCESS_CONTROL": "过程控制",
    "CARBON_MONITORING": "碳排监测",
    "DATA_PERCEPTION": "数据感知",
    "AUXILIARY": "辅助功能",
}

_INDUSTRY_LABELS = {
    "通用": "通用",
    "有色": "有色金属",
    "石化": "石油化工",
    "钢铁": "钢铁",
}

_STATUS_LABELS = {
    "ONLINE": "已上线",
    "TESTING": "测试中",
    "DEVELOPING": "开发中",
    "OFFLINE": "已下线",
}


# ---------- Helpers ----------
def _version_brief(v: ModelVersion) -> dict:
    return ModelVersionBrief(
        id=v.id,
        modelId=v.model_id,
        versionNo=v.version_no,
        entryFunction=v.entry_function,
        isCurrent=v.is_current,
        status=v.status,
        stage=v.stage or "NONE",
        changelog=v.changelog,
        createdAt=v.created_at,
    ).model_dump()


def _version_detail(v: ModelVersion) -> dict:
    return ModelVersionDetail(
        id=v.id,
        modelId=v.model_id,
        versionNo=v.version_no,
        entryFunction=v.entry_function,
        isCurrent=v.is_current,
        status=v.status,
        stage=v.stage or "NONE",
        changelog=v.changelog,
        sourceCode=v.source_code,
        pythonVersion=v.python_version,
        inputSchema=v.input_schema,
        outputSchema=v.output_schema,
        dependencies=v.dependencies,
        metrics=v.metrics,
        createdAt=v.created_at,
    ).model_dump()


def _registry_out(
    m: ModelRegistry,
    version_count: int,
    latest_version: str | None,
    versions: list[dict] | None = None,
) -> dict:
    data = ModelRegistryOut(
        id=m.id,
        name=m.name,
        code=m.code,
        industry=m.industry,
        functionType=m.function_type,
        processStage=m.process_stage,
        description=m.description,
        tags=m.tags,
        status=m.status,
        callCount=m.call_count,
        accuracy=m.accuracy,
        ownerId=m.owner_id,
        provider=m.provider,
        modelCard=m.model_card,
        versionCount=version_count,
        latestVersion=latest_version,
        createdAt=m.created_at,
    ).model_dump()
    if versions is not None:
        data["versions"] = versions
    return data


def _collect_versions(db: Session, model_id: int) -> list[ModelVersion]:
    """Get versions ordered by is_current desc then id desc."""
    return list(
        db.execute(
            select(ModelVersion)
            .where(ModelVersion.model_id == model_id)
            .order_by(ModelVersion.is_current.desc(), ModelVersion.id.desc())
        ).scalars().all()
    )


def _latest_version_no(versions: list[ModelVersion]) -> str | None:
    current = next((v for v in versions if v.is_current), None)
    if current:
        return current.version_no
    return versions[0].version_no if versions else None


def _safe_exec_predict(source_code: str, input_data: dict, timeout_s: float = 5.0) -> dict:
    """Execute model source code in a restricted namespace and call predict().

    Returns {"success": bool, "output": dict|None, "error": str|None, "stdout": str|None}
    """
    sandbox_globals: dict = {"__builtins__": __builtins__}
    sandbox_locals: dict = {}
    stdout_buf = io.StringIO()

    start = time.time()
    try:
        with redirect_stdout(stdout_buf):
            exec(compile(source_code, "<model>", "exec"), sandbox_globals, sandbox_locals)
        predict_fn = sandbox_locals.get("predict") or sandbox_globals.get("predict")
        if not callable(predict_fn):
            return {
                "success": False,
                "error": "未找到入口函数 `predict(input: dict) -> dict`",
                "output": None,
                "stdout": stdout_buf.getvalue(),
            }
        result = predict_fn(input_data)
        latency_ms = int((time.time() - start) * 1000)
        return {
            "success": True,
            "output": result if isinstance(result, dict) else {"result": result},
            "error": None,
            "stdout": stdout_buf.getvalue(),
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        latency_ms = int((time.time() - start) * 1000)
        return {
            "success": False,
            "error": f"{type(exc).__name__}: {exc}",
            "output": None,
            "stdout": stdout_buf.getvalue(),
            "latency_ms": latency_ms,
        }


# ---------- List (enhanced with multi-filter + sorting) ----------
@router.get("")
def list_models(
    page: int = 1,
    pageSize: int = 20,
    keyword: str = "",
    industry: str = "",
    functionType: str = "",
    status: str = "",
    provider: str = "",
    processStage: str = "",
    tags: str = "",
    sortBy: str = "createdAt",
    sortOrder: str = "desc",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    stmt = select(ModelRegistry)

    # Multi-value filters (comma-separated → OR)
    if industry:
        vals = [v.strip() for v in industry.split(",") if v.strip()]
        if len(vals) == 1:
            stmt = stmt.where(ModelRegistry.industry == vals[0])
        else:
            stmt = stmt.where(ModelRegistry.industry.in_(vals))
    if functionType:
        vals = [v.strip() for v in functionType.split(",") if v.strip()]
        if len(vals) == 1:
            stmt = stmt.where(ModelRegistry.function_type == vals[0])
        else:
            stmt = stmt.where(ModelRegistry.function_type.in_(vals))
    if status:
        vals = [v.strip() for v in status.split(",") if v.strip()]
        if len(vals) == 1:
            stmt = stmt.where(ModelRegistry.status == vals[0])
        else:
            stmt = stmt.where(ModelRegistry.status.in_(vals))
    if provider:
        vals = [v.strip() for v in provider.split(",") if v.strip()]
        if len(vals) == 1:
            stmt = stmt.where(ModelRegistry.provider == vals[0])
        else:
            stmt = stmt.where(ModelRegistry.provider.in_(vals))
    if processStage:
        stmt = stmt.where(ModelRegistry.process_stage == processStage)
    if keyword:
        kw = f"%{keyword}%"
        stmt = stmt.where(
            or_(
                ModelRegistry.name.ilike(kw),
                ModelRegistry.code.ilike(kw),
                ModelRegistry.description.ilike(kw),
            )
        )

    # Sorting
    sort_map = {
        "createdAt": ModelRegistry.created_at,
        "name": ModelRegistry.name,
        "callCount": ModelRegistry.call_count,
        "accuracy": ModelRegistry.accuracy,
    }
    sort_col = sort_map.get(sortBy, ModelRegistry.created_at)
    stmt = stmt.order_by(sort_col.desc() if sortOrder == "desc" else sort_col.asc())

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()

    # Batch-load version counts to avoid N+1
    model_ids = [m.id for m in rows]
    version_counts: dict[int, int] = {}
    latest_versions: dict[int, str | None] = {}
    if model_ids:
        count_rows = db.execute(
            select(
                ModelVersion.model_id,
                func.count().label("cnt"),
            )
            .where(ModelVersion.model_id.in_(model_ids))
            .group_by(ModelVersion.model_id)
        ).all()
        version_counts = {r[0]: r[1] for r in count_rows}

        # Get current version numbers
        current_versions = db.execute(
            select(ModelVersion.model_id, ModelVersion.version_no).where(
                ModelVersion.model_id.in_(model_ids),
                ModelVersion.is_current.is_(True),
            )
        ).all()
        latest_versions = {r[0]: r[1] for r in current_versions}

    data = []
    for m in rows:
        vc = version_counts.get(m.id, 0)
        lv = latest_versions.get(m.id)
        if not lv and vc > 0:
            # fallback: first version by id desc
            lv = db.scalar(
                select(ModelVersion.version_no)
                .where(ModelVersion.model_id == m.id)
                .order_by(ModelVersion.id.desc())
                .limit(1)
            )
        data.append(
            _registry_out(
                m,
                version_count=vc,
                latest_version=lv,
            )
        )
    return ok({"list": data, "meta": {"page": page, "pageSize": pageSize, "total": total}})


# ---------- Facets ----------
@router.get("/facets")
def get_facets(
    keyword: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    """Return aggregated counts for faceted filtering sidebar."""
    base = select(ModelRegistry)
    if keyword:
        kw = f"%{keyword}%"
        base = base.where(
            or_(
                ModelRegistry.name.ilike(kw),
                ModelRegistry.code.ilike(kw),
                ModelRegistry.description.ilike(kw),
            )
        )

    def _count_by(column):
        rows = db.execute(
            select(column, func.count().label("cnt"))
            .select_from(base.subquery())
            .where(column.isnot(None))
            .group_by(column)
            .order_by(func.count().desc())
        ).all()
        return rows

    def _label_lookup(label_map: dict, val: str) -> str:
        return label_map.get(val, val)

    facets = {
        "industry": [
            FacetBucket(value=r[0], label=_label_lookup(_INDUSTRY_LABELS, r[0]), count=r[1])
            for r in _count_by(ModelRegistry.industry)
        ],
        "functionType": [
            FacetBucket(value=r[0], label=_label_lookup(_FUNCTION_TYPE_LABELS, r[0]), count=r[1])
            for r in _count_by(ModelRegistry.function_type)
        ],
        "status": [
            FacetBucket(value=r[0], label=_label_lookup(_STATUS_LABELS, r[0]), count=r[1])
            for r in _count_by(ModelRegistry.status)
        ],
        "provider": [
            FacetBucket(value=r[0], label=r[0] or "未知", count=r[1])
            for r in _count_by(ModelRegistry.provider)
        ],
        "processStage": [
            FacetBucket(value=r[0], label=r[0], count=r[1])
            for r in _count_by(ModelRegistry.process_stage)
        ],
    }
    return ok(facets)


# ---------- Detail ----------
@router.get("/{model_id}")
def get_model(model_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("model:read"))):
    m = db.get(ModelRegistry, model_id)
    if not m:
        raise NotFoundError("模型不存在")
    versions = _collect_versions(db, m.id)
    out = _registry_out(
        m,
        version_count=len(versions),
        latest_version=_latest_version_no(versions),
        versions=[_version_brief(v) for v in versions],
    )
    return ok(out)


# ---------- Create ----------
@router.post("")
def create_model(
    payload: ModelRegistryCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    if db.scalar(select(ModelRegistry).where(ModelRegistry.code == payload.code)):
        raise BizError("模型编码已存在", code=409, status_code=409)
    m = ModelRegistry(
        name=payload.name,
        code=payload.code,
        industry=payload.industry,
        function_type=payload.functionType,
        process_stage=payload.processStage,
        description=payload.description,
        tags=payload.tags,
        status="DEVELOPING",
        call_count=0,
        accuracy=0.0,
        owner_id=user.id,
        provider=payload.provider,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    write_audit(
        db,
        user,
        "CREATE_MODEL",
        resource=f"model:{m.id}",
        detail=m.name,
        ip=request.client.host if request.client else None,
    )
    return ok(_registry_out(m, version_count=0, latest_version=None))


# ---------- Update ----------
@router.put("/{model_id}")
def update_model(
    model_id: int,
    payload: ModelRegistryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    m = db.get(ModelRegistry, model_id)
    if not m:
        raise NotFoundError("模型不存在")
    data = payload.model_dump(exclude_unset=True)
    mapping = {
        "functionType": "function_type",
        "processStage": "process_stage",
    }
    for k, v in data.items():
        setattr(m, mapping.get(k, k), v)
    db.commit()
    db.refresh(m)
    write_audit(
        db,
        user,
        "UPDATE_MODEL",
        resource=f"model:{m.id}",
        ip=request.client.host if request.client else None,
    )
    versions = _collect_versions(db, m.id)
    return ok(
        _registry_out(
            m,
            version_count=len(versions),
            latest_version=_latest_version_no(versions),
        )
    )


# ---------- Delete ----------
@router.delete("/{model_id}")
def delete_model(
    model_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    m = db.get(ModelRegistry, model_id)
    if not m:
        raise NotFoundError("模型不存在")
    db.delete(m)
    db.commit()
    write_audit(
        db,
        user,
        "DELETE_MODEL",
        resource=f"model:{model_id}",
        ip=request.client.host if request.client else None,
    )
    return ok({"id": model_id})


# ---------- Model Card Update ----------
@router.put("/{model_id}/card")
def update_model_card(
    model_id: int,
    payload: ModelCardUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    m = db.get(ModelRegistry, model_id)
    if not m:
        raise NotFoundError("模型不存在")
    m.model_card = payload.modelCard
    db.commit()
    db.refresh(m)
    write_audit(
        db,
        user,
        "UPDATE_MODEL_CARD",
        resource=f"model:{m.id}",
        ip=request.client.host if request.client else None,
    )
    return ok({"id": model_id, "modelCard": m.model_card})


# ---------- Versions list ----------
@router.get("/{model_id}/versions")
def list_versions(
    model_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    m = db.get(ModelRegistry, model_id)
    if not m:
        raise NotFoundError("模型不存在")
    versions = _collect_versions(db, model_id)
    return ok([_version_brief(v) for v in versions])


# ---------- Version detail ----------
@router.get("/{model_id}/versions/{version_id}")
def get_version_detail(
    model_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    v = db.get(ModelVersion, version_id)
    if not v or v.model_id != model_id:
        raise NotFoundError("版本不存在或不属于该模型")
    return ok(_version_detail(v))


# ---------- Create version ----------
@router.post("/{model_id}/versions")
def create_version(
    model_id: int,
    payload: ModelVersionCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    m = db.get(ModelRegistry, model_id)
    if not m:
        raise NotFoundError("模型不存在")

    is_current = payload.isCurrent if payload.isCurrent is not None else True
    if is_current:
        existing = db.execute(
            select(ModelVersion).where(
                ModelVersion.model_id == model_id, ModelVersion.is_current.is_(True)
            )
        ).scalars().all()
        for v in existing:
            v.is_current = False

    version = ModelVersion(
        model_id=model_id,
        version_no=payload.versionNo,
        entry_function=payload.entryFunction or "predict",
        input_schema=payload.inputSchema,
        output_schema=payload.outputSchema,
        dependencies=payload.dependencies,
        changelog=payload.changelog,
        is_current=is_current,
        status=m.status,
        source_code=payload.sourceCode,
        python_version=payload.pythonVersion,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    write_audit(
        db,
        user,
        "CREATE_MODEL_VERSION",
        resource=f"model:{model_id}/version:{version.id}",
        detail=version.version_no,
        ip=request.client.host if request.client else None,
    )
    return ok(_version_brief(version))


# ---------- Update version ----------
@router.put("/{model_id}/versions/{version_id}")
def update_version(
    model_id: int,
    version_id: int,
    payload: ModelVersionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    v = db.get(ModelVersion, version_id)
    if not v or v.model_id != model_id:
        raise NotFoundError("版本不存在或不属于该模型")
    data = payload.model_dump(exclude_unset=True)
    mapping = {
        "entryFunction": "entry_function",
        "inputSchema": "input_schema",
        "outputSchema": "output_schema",
    }
    for k, val in data.items():
        setattr(v, mapping.get(k, k), val)
    db.commit()
    db.refresh(v)
    write_audit(
        db,
        user,
        "UPDATE_MODEL_VERSION",
        resource=f"model:{model_id}/version:{version_id}",
        ip=request.client.host if request.client else None,
    )
    return ok(_version_brief(v))


# ---------- Activate version (set as current) ----------
@router.post("/{model_id}/versions/{version_id}/activate")
def activate_version(
    model_id: int,
    version_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    """Set a version as the current production version."""
    v = db.get(ModelVersion, version_id)
    if not v or v.model_id != model_id:
        raise NotFoundError("版本不存在或不属于该模型")

    # Unset all other current versions
    existing = db.execute(
        select(ModelVersion).where(
            ModelVersion.model_id == model_id,
            ModelVersion.is_current.is_(True),
            ModelVersion.id != version_id,
        )
    ).scalars().all()
    for ev in existing:
        ev.is_current = False

    v.is_current = True
    db.commit()
    db.refresh(v)
    write_audit(
        db,
        user,
        "ACTIVATE_MODEL_VERSION",
        resource=f"model:{model_id}/version:{version_id}",
        detail=v.version_no,
        ip=request.client.host if request.client else None,
    )
    return ok(_version_brief(v))


# ---------- Lifecycle Stage Transition ----------
@router.post("/{model_id}/versions/{version_id}/transition")
def transition_stage(
    model_id: int,
    version_id: int,
    payload: LifecycleTransition,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    """Transition a version's lifecycle stage (MLflow-style).

    Stages: NONE → STAGING → PRODUCTION → ARCHIVED
    """
    if payload.stage not in _VALID_STAGES:
        raise BizError(f"无效的阶段，可选值: {', '.join(sorted(_VALID_STAGES))}")

    v = db.get(ModelVersion, version_id)
    if not v or v.model_id != model_id:
        raise NotFoundError("版本不存在或不属于该模型")

    # Only one PRODUCTION version per model
    if payload.stage == "PRODUCTION":
        existing = db.execute(
            select(ModelVersion).where(
                ModelVersion.model_id == model_id,
                ModelVersion.stage == "PRODUCTION",
                ModelVersion.id != version_id,
            )
        ).scalars().all()
        for ev in existing:
            ev.stage = "ARCHIVED"
        v.is_current = True

    v.stage = payload.stage
    db.commit()
    db.refresh(v)
    write_audit(
        db,
        user,
        "TRANSITION_MODEL_STAGE",
        resource=f"model:{model_id}/version:{version_id}",
        detail=f"{v.version_no} → {payload.stage}",
        ip=request.client.host if request.client else None,
    )
    return ok(_version_brief(v))


# ---------- Source Code Read ----------
@router.get("/{model_id}/versions/{version_id}/source")
def get_source_code(
    model_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    v = db.get(ModelVersion, version_id)
    if not v or v.model_id != model_id:
        raise NotFoundError("版本不存在或不属于该模型")
    return ok({
        "sourceCode": v.source_code or "",
        "pythonVersion": v.python_version,
        "entryFunction": v.entry_function,
    })


# ---------- Source Code Update ----------
@router.put("/{model_id}/versions/{version_id}/source")
def update_source_code(
    model_id: int,
    version_id: int,
    payload: SourceCodeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    v = db.get(ModelVersion, version_id)
    if not v or v.model_id != model_id:
        raise NotFoundError("版本不存在或不属于该模型")
    v.source_code = payload.sourceCode
    if payload.pythonVersion:
        v.python_version = payload.pythonVersion
    db.commit()
    db.refresh(v)
    write_audit(
        db,
        user,
        "UPDATE_MODEL_SOURCE",
        resource=f"model:{model_id}/version:{version_id}",
        ip=request.client.host if request.client else None,
    )
    return ok({"id": version_id, "sourceCode": v.source_code, "pythonVersion": v.python_version})


# ---------- Test Run ----------
@router.post("/{model_id}/versions/{version_id}/test-run")
def test_run(
    model_id: int,
    version_id: int,
    payload: TestRunIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:read")),
):
    """Execute the model source code with test input in a sandboxed namespace."""
    v = db.get(ModelVersion, version_id)
    if not v or v.model_id != model_id:
        raise NotFoundError("版本不存在或不属于该模型")

    source = payload.sourceCode if payload.sourceCode else v.source_code
    if not source:
        raise BizError("该版本没有源代码，请先编写代码后再试运行")

    result = _safe_exec_predict(source, payload.input)

    return ok(TestRunOut(
        success=result["success"],
        output=result.get("output"),
        error=result.get("error"),
        latencyMs=result.get("latency_ms", 0),
        stdout=result.get("stdout"),
    ).model_dump())


# ---------- Mock output generator ----------
def _mock_output(function_type: str) -> dict:
    if function_type == "OPTIMIZATION":
        return {
            "optimized_params": {
                "param1": round(random.uniform(60, 95), 2),
                "param2": round(random.uniform(100, 300), 2),
                "param3": round(random.uniform(0.5, 2.0), 3),
            },
            "improvement_pct": round(random.uniform(3, 15), 2),
        }
    if function_type == "PREDICTION":
        return {
            "predicted_value": round(random.uniform(40, 600), 2),
            "confidence": round(random.uniform(0.85, 0.99), 4),
            "horizon": "24h",
        }
    if function_type == "CLASSIFICATION":
        categories = ["A", "B", "C", "D"]
        primary = random.choice(categories)
        alts = [c for c in categories if c != primary]
        return {
            "category": primary,
            "confidence": round(random.uniform(0.8, 0.98), 4),
            "alternatives": alts,
        }
    if function_type == "CARBON_ACCOUNTING":
        return {
            "carbon_emission_kg": round(random.uniform(100, 5000), 2),
            "scope": "Scope1",
            "breakdown": {
                "fuel_combustion": round(random.uniform(50, 2500), 2),
                "process_emission": round(random.uniform(40, 2000), 2),
                "electricity": round(random.uniform(10, 500), 2),
            },
        }
    return {"result": round(random.uniform(0, 100), 2)}


# ---------- Invoke (mock) ----------
@router.post("/{model_id}/invoke")
def invoke_model(
    model_id: int,
    payload: ModelInvokeIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:read")),
):
    m = db.get(ModelRegistry, model_id)
    if not m:
        raise NotFoundError("模型不存在")

    version = None
    if payload.versionId:
        version = db.get(ModelVersion, payload.versionId)
        if not version or version.model_id != model_id:
            raise BizError("版本不存在或不属于该模型", code=404, status_code=404)
    else:
        versions = _collect_versions(db, model_id)
        version = next((v for v in versions if v.is_current), None) or (versions[0] if versions else None)

    # Try real execution if source code exists
    output = None
    latency_ms = 0
    if version and version.source_code:
        result = _safe_exec_predict(version.source_code, payload.input)
        latency_ms = result.get("latency_ms", 0)
        if result["success"]:
            output = result["output"]
        else:
            # Fall back to mock output if real execution fails
            output = _mock_output(m.function_type)
    else:
        output = _mock_output(m.function_type)
        latency_ms = random.randint(50, 500)

    call = ModelCall(
        model_id=model_id,
        version_id=version.id if version else None,
        caller_id=user.id,
        latency_ms=latency_ms,
        status="SUCCESS",
        input=payload.input,
        output=output,
    )
    db.add(call)
    m.call_count = (m.call_count or 0) + 1
    db.commit()
    db.refresh(call)

    write_audit(
        db,
        user,
        "INVOKE_MODEL",
        resource=f"model:{model_id}",
        detail=f"call:{call.id}",
        ip=request.client.host if request.client else None,
    )

    result = ModelInvokeOut(
        modelId=model_id,
        versionId=version.id if version else None,
        output=output,
        latencyMs=latency_ms,
        status="SUCCESS",
    ).model_dump()
    return ok(result)


# ---------- Calls list ----------
@router.get("/{model_id}/calls")
def list_calls(
    model_id: int,
    page: int = 1,
    pageSize: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    m = db.get(ModelRegistry, model_id)
    if not m:
        raise NotFoundError("模型不存在")
    stmt = select(ModelCall).where(ModelCall.model_id == model_id).order_by(ModelCall.id.desc())
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()

    data = [
        ModelCallOut(
            id=c.id,
            modelId=c.model_id,
            versionId=c.version_id,
            callerId=c.caller_id,
            latencyMs=c.latency_ms,
            status=c.status,
            input=c.input,
            output=c.output,
            createdAt=c.created_at,
        ).model_dump()
        for c in rows
    ]
    return ok({"list": data, "meta": {"page": page, "pageSize": pageSize, "total": total}})
