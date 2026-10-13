"""工业元模型 API（数据基座 - 元模型登记/导入导出）。

对应《元模型交付模板》四类模型（机理/数据/算法/知识规则）的统一 8 节结构。
"""
import json
from datetime import datetime

import json as _json
from fastapi import APIRouter, Depends, Query, Response
from pydantic.alias_generators import to_snake
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission, write_audit
from app.core.exceptions import BizError, NotFoundError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.kg import KgEdge, KgLink, KgNode
from app.models.metamodel import (
    MODEL_TYPE_LABELS,
    Metamodel,
    MetamodelVersion,
)
from app.schemas.kg import KgEdgeOut, KgNodeOut
from app.schemas.metamodel import (
    FacetBucket,
    MetamodelCreate,
    MetamodelOut,
    MetamodelUpdate,
    MetamodelVersionCreate,
    MetamodelVersionOut,
)
from app.utils.pagination import paginate

router = APIRouter()

_INDUSTRIES = ("通用", "有色", "石化", "钢铁")
_STATUSES = ("DEVELOPING", "TESTING", "ONLINE", "OFFLINE")
_STATUS_LABELS = {
    "DEVELOPING": "开发中",
    "TESTING": "测试中",
    "ONLINE": "已上线",
    "OFFLINE": "已下线",
}
_TYPE_CODES = {
    "MECHANISM": "MEC",
    "DATA_MODEL": "DAT",
    "ALGORITHM": "ALG",
    "KNOWLEDGE_RULE": "KRL",
}
_INDUSTRY_CODES = {"通用": "GEN", "有色": "NFM", "石化": "PET", "钢铁": "IRN"}


def _gen_meta_code(db: Session, model_type: str, industry: str) -> str:
    """编号规则：提供方(4)-行业(3)-类别(3)-6 位序号，如 CSU-NFM-MEC-000001。"""
    prefix = f"CSU-{_INDUSTRY_CODES.get(industry, 'GEN')}-{_TYPE_CODES.get(model_type, 'GEN')}"
    seq = db.scalar(
        select(func.count()).select_from(Metamodel).where(Metamodel.meta_code.like(f"{prefix}-%"))
    )
    return f"{prefix}-{(seq or 0) + 1:06d}"


def _snapshot(m: Metamodel) -> dict:
    return _mm_out(m)


def _mm_out(m: Metamodel) -> dict:
    """ORM → camelCase dict（datetime 转字符串以便快照可 JSON 化）。"""
    return MetamodelOut.model_validate(m).model_dump(by_alias=True, mode="json")


def _apply_payload(m: Metamodel, data: dict) -> None:
    """把 camelCase 的 payload 字典应用到 ORM（camel→snake，忽略 JSON 结构字段）。"""
    for k, v in data.items():
        setattr(m, to_snake(k), v)


# ---------- List / Facets ----------
@router.get("")
def list_metamodels(
    page: int = 1,
    pageSize: int = 20,
    keyword: str = "",
    modelType: str = "",
    industry: str = "",
    status: str = "",
    sortBy: str = "createdAt",
    sortOrder: str = "desc",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    stmt = select(Metamodel)
    if modelType:
        vals = [v.strip() for v in modelType.split(",") if v.strip()]
        stmt = stmt.where(Metamodel.model_type.in_(vals))
    if industry:
        vals = [v.strip() for v in industry.split(",") if v.strip()]
        stmt = stmt.where(Metamodel.industry.in_(vals))
    if status:
        vals = [v.strip() for v in status.split(",") if v.strip()]
        stmt = stmt.where(Metamodel.status.in_(vals))
    if keyword:
        kw = f"%{keyword.strip()}%"
        stmt = stmt.where(
            or_(
                Metamodel.name.like(kw),
                Metamodel.meta_code.like(kw),
                Metamodel.purpose.like(kw),
                Metamodel.domain.like(kw),
            )
        )
    sort_col = {
        "createdAt": Metamodel.created_at,
        "name": Metamodel.name,
        "callCount": Metamodel.call_count,
    }.get(sortBy, Metamodel.created_at)
    stmt = stmt.order_by(sort_col.desc() if sortOrder == "desc" else sort_col.asc())
    return ok(paginate(db, stmt, page=page, page_size=pageSize, scaler=_mm_out))


@router.get("/facets")
def facets(db: Session = Depends(get_db), _: User = Depends(require_permission("model:read"))):
    def _buckets(col, labels: dict) -> list:
        rows = db.execute(select(col, func.count()).group_by(col)).all()
        return [
            FacetBucket(value=v, label=labels.get(v, v), count=c).model_dump() for v, c in rows
        ]

    return ok(
        {
            "modelType": _buckets(Metamodel.model_type, MODEL_TYPE_LABELS),
            "industry": _buckets(Metamodel.industry, {}),
            "status": _buckets(Metamodel.status, _STATUS_LABELS),
        }
    )


# ---------- Export（放在 /{id} 之前避免路由遮蔽） ----------
@router.get("/export")
def export_metamodels(
    format: str = Query("json", pattern="^(json|excel)$"),
    modelType: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    stmt = select(Metamodel)
    if modelType:
        stmt = stmt.where(Metamodel.model_type.in_([v.strip() for v in modelType.split(",")]))
    rows = db.execute(stmt).scalars().all()
    data = [_mm_out(m) for m in rows]

    if format == "json":
        payload = {
            "exportedAt": datetime.utcnow().isoformat(),
            "count": len(data),
            "metamodels": data,
        }
        return Response(
            content=_json.dumps(payload, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=metamodels.json"},
        )

    # Excel 台账（一行一个元模型，复杂 JSON 列序列化为字符串）
    import io

    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "元模型台账"
    flat_cols = [
        ("metaCode", "模型编号"), ("modelType", "模型类别"), ("name", "名称"),
        ("domain", "领域"), ("hierarchy", "层级"), ("purpose", "功能/用途"),
        ("methodStructure", "方法/结构"), ("versionNo", "版本"), ("status", "状态"),
        ("industry", "行业"), ("provider", "提供单位"), ("keywords", "关键词"),
        ("sceneDomain", "场景/有效域"), ("assumptions", "假设/边界"),
        ("limitsPrecision", "限制/精度"), ("methodFlow", "方法/流程"),
        ("entryInterface", "入口/响应"), ("validationBaseline", "基准/交叉"),
        ("validationMetrics", "验证指标"), ("uncertainty", "不确定度"),
        ("trainingData", "训练/验证数据"), ("references", "参考文献"),
    ]
    ws.append([c[1] for c in flat_cols])
    for m in data:
        row = []
        for key, _ in flat_cols:
            v = m.get(key)
            if isinstance(v, (list, dict)):
                v = json.dumps(v, ensure_ascii=False)
            row.append(v)
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=metamodels.xlsx"},
    )


@router.post("/import")
def import_metamodels(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    """批量导入元模型。payload: {"metamodels": [...]}（字段与导出 JSON 一致）。"""
    items = payload.get("metamodels")
    if not isinstance(items, list) or not items:
        raise BizError("导入数据为空或格式不正确（需要 metamodels 数组）")
    created, updated = 0, 0
    for item in items:
        if not item.get("name") or not item.get("modelType"):
            raise BizError("每条元模型至少需要 name 和 modelType")
        meta_code = item.get("metaCode")
        existing = (
            db.scalar(select(Metamodel).where(Metamodel.meta_code == meta_code))
            if meta_code
            else None
        )
        fields = {
            k: v
            for k, v in item.items()
            if k not in ("metaCode", "initialChangelog", "id", "createdAt", "updatedAt", "versions")
            and v is not None
        }
        if existing:
            _apply_payload(existing, fields)
            updated += 1
            m = existing
        else:
            if not meta_code:
                meta_code = _gen_meta_code(db, item["modelType"], item.get("industry") or "通用")
            m = Metamodel(meta_code=meta_code)
            _apply_payload(m, fields)
            db.add(m)
            created += 1
        db.flush()
        db.add(
            MetamodelVersion(
                metamodel_id=m.id,
                version_no=m.version_no,
                changelog="导入登记" if not existing else "导入更新",
                snapshot=_snapshot(m),
                created_by=user.username,
            )
        )
    db.commit()
    write_audit(db, user, "IMPORT", resource="metamodel", detail=f"created={created}, updated={updated}")
    return ok({"created": created, "updated": updated})


# ---------- CRUD ----------
@router.post("")
def create_metamodel(
    payload: MetamodelCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    if payload.modelType not in MODEL_TYPE_LABELS:
        raise BizError(f"modelType 必须是 {', '.join(MODEL_TYPE_LABELS)}")
    meta_code = payload.metaCode or _gen_meta_code(db, payload.modelType, payload.industry)
    if db.scalar(select(Metamodel).where(Metamodel.meta_code == meta_code)):
        raise BizError(f"模型编号已存在: {meta_code}")
    m = Metamodel(meta_code=meta_code)
    _apply_payload(
        m,
        payload.model_dump(
            exclude={"metaCode", "coreRelations", "ioParams", "references", "validationMetrics", "initialChangelog"}
        ),
    )
    if payload.coreRelations is not None:
        m.core_relations = [r.model_dump() for r in payload.coreRelations]
    if payload.ioParams is not None:
        m.io_params = [p.model_dump() for p in payload.ioParams]
    if payload.references is not None:
        m.references = [r.model_dump() for r in payload.references]
    if payload.validationMetrics is not None:
        m.validation_metrics = [v.model_dump() for v in payload.validationMetrics]
    db.add(m)
    db.flush()
    db.add(
        MetamodelVersion(
            metamodel_id=m.id,
            version_no=m.version_no,
            changelog=payload.initialChangelog or "初始登记",
            snapshot=_mm_out(m),
            created_by=user.username,
        )
    )
    db.commit()
    write_audit(db, user, "CREATE", resource="metamodel", detail=meta_code)
    return ok(_mm_out(m))


@router.get("/{mm_id}")
def get_metamodel(
    mm_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    m = db.get(Metamodel, mm_id)
    if not m:
        raise NotFoundError("元模型不存在")
    data = _mm_out(m)
    data["versions"] = [
        MetamodelVersionOut.model_validate(v).model_dump(by_alias=True, mode="json")
        for v in m.versions
    ]
    return ok(data)


@router.get("/{mm_id}/kg-neighborhood")
def kg_neighborhood(
    mm_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    """元模型关联图谱一跳邻域（kg_links/ref 反查，替代前端全量拉图）。"""
    m = db.get(Metamodel, mm_id)
    if not m:
        raise NotFoundError("元模型不存在")
    center_ids = set(
        db.execute(
            select(KgLink.node_id).where(KgLink.link_type == "METAMODEL", KgLink.link_id == mm_id)
        ).scalars().all()
    )
    center_ids.update(
        db.execute(
            select(KgNode.id).where(KgNode.ref_type == "METAMODEL", KgNode.ref_id == mm_id)
        ).scalars().all()
    )
    if not center_ids:
        return ok({"nodes": [], "edges": [], "centerIds": []})
    edges = (
        db.execute(
            select(KgEdge).where(
                KgEdge.source_node_id.in_(center_ids) | KgEdge.target_node_id.in_(center_ids)
            )
        ).scalars().all()
    )
    node_ids = set(center_ids)
    for e in edges:
        node_ids.add(e.source_node_id)
        node_ids.add(e.target_node_id)
    nodes = (
        db.execute(select(KgNode).where(KgNode.id.in_(node_ids))).scalars().all()
    )
    return ok(
        {
            "nodes": [KgNodeOut.model_validate(n).model_dump(by_alias=True, mode="json") for n in nodes],
            "edges": [KgEdgeOut.model_validate(e).model_dump(by_alias=True, mode="json") for e in edges],
            "centerIds": sorted(center_ids),
        }
    )


@router.put("/{mm_id}")
def update_metamodel(
    mm_id: int,
    payload: MetamodelUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    m = db.get(Metamodel, mm_id)
    if not m:
        raise NotFoundError("元模型不存在")
    changes = payload.model_dump(
        exclude_unset=True,
        exclude={"coreRelations", "ioParams", "references", "validationMetrics"},
    )
    for k, v in changes.items():
        setattr(m, k, v)
    if payload.coreRelations is not None:
        m.core_relations = [r.model_dump() for r in payload.coreRelations]
    if payload.ioParams is not None:
        m.io_params = [p.model_dump() for p in payload.ioParams]
    if payload.references is not None:
        m.references = [r.model_dump() for r in payload.references]
    if payload.validationMetrics is not None:
        m.validation_metrics = [v.model_dump() for v in payload.validationMetrics]
    db.flush()
    # 版本号变化时自动生成新版本快照
    if payload.versionNo and payload.versionNo != m.version_no:
        db.add(
            MetamodelVersion(
                metamodel_id=m.id,
                version_no=m.version_no,
                changelog=f"更新至 {m.version_no}",
                snapshot=_mm_out(m),
                created_by=user.username,
            )
        )
    db.commit()
    write_audit(db, user, "UPDATE", resource="metamodel", detail=m.meta_code)
    return ok(_mm_out(m))


@router.delete("/{mm_id}")
def delete_metamodel(
    mm_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    m = db.get(Metamodel, mm_id)
    if not m:
        raise NotFoundError("元模型不存在")
    code = m.meta_code
    db.delete(m)
    db.commit()
    write_audit(db, user, "DELETE", resource="metamodel", detail=code)
    return ok({"done": True})


# ---------- Versions ----------
@router.get("/{mm_id}/versions")
def list_versions(
    mm_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    m = db.get(Metamodel, mm_id)
    if not m:
        raise NotFoundError("元模型不存在")
    return ok(
        [
            MetamodelVersionOut.model_validate(v).model_dump(by_alias=True, mode="json")
            for v in m.versions
        ]
    )


@router.post("/{mm_id}/versions")
def create_version(
    mm_id: int,
    payload: MetamodelVersionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    m = db.get(Metamodel, mm_id)
    if not m:
        raise NotFoundError("元模型不存在")
    v = MetamodelVersion(
        metamodel_id=mm_id,
        version_no=payload.versionNo,
        changelog=payload.changelog,
        snapshot=_mm_out(m),
        created_by=user.username,
    )
    m.version_no = payload.versionNo
    db.add(v)
    db.commit()
    return ok(MetamodelVersionOut.model_validate(v).model_dump(mode="json"))
