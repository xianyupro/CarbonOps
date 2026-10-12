"""知识图谱 API（元模型平台 · 图数据展示与交互）。

数据面：全量拉图（前端力导向渲染）、节点/边 CRUD、邻域详情、分类统计、
检索、BFS 最短路；AI 面：文本 → DeepSeek 三元组提取 → 入库。
"""
from collections import deque

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission, write_audit
from app.core.exceptions import BizError, NotFoundError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.kg import KgEdge, KgLink, KgNode
from app.schemas.kg import (
    KgEdgeCreate,
    KgEdgeOut,
    KgGraph,
    KgLinkOut,
    KgNodeCreate,
    KgNodeDetail,
    KgNodeOut,
    KgNodeUpdate,
    KgPathResult,
)
from app.services import kg_ai_service
from app.services.kg_ai_service import extract_triples

router = APIRouter()


# ---------- 图数据 ----------
@router.get("/graph")
def get_graph(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    """全量图谱（千级节点内一次拉取，前端内存计算布局/路径）。"""
    nodes = db.execute(select(KgNode)).scalars().all()
    edges = db.execute(select(KgEdge)).scalars().all()
    return ok(
        KgGraph(
            nodes=[KgNodeOut.model_validate(n).model_dump(by_alias=True, mode="json") for n in nodes],
            edges=[KgEdgeOut.model_validate(e).model_dump(by_alias=True, mode="json") for e in edges],
        ).model_dump(by_alias=True, mode="json")
    )


@router.get("/categories")
def categories(db: Session = Depends(get_db), _: User = Depends(require_permission("model:read"))):
    rows = db.execute(select(KgNode.category, func.count()).group_by(KgNode.category)).all()
    return ok([{"value": c, "count": n} for c, n in rows])


@router.get("/search")
def search(
    q: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    kw = f"%{q.strip()}%"
    nodes = (
        db.execute(
            select(KgNode).where(or_(KgNode.name.like(kw), KgNode.description.like(kw))).limit(20)
        )
        .scalars()
        .all()
    )
    return ok([KgNodeOut.model_validate(n).model_dump(by_alias=True, mode="json") for n in nodes])


# ---------- 节点 CRUD ----------
@router.get("/nodes")
def list_nodes(
    page: int = 1,
    pageSize: int = 20,
    category: str = "",
    keyword: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    stmt = select(KgNode)
    if category:
        stmt = stmt.where(KgNode.category == category)
    if keyword:
        stmt = stmt.where(or_(KgNode.name.like(f"%{keyword}%"), KgNode.description.like(f"%{keyword}%")))
    stmt = stmt.order_by(KgNode.id)
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()
    return ok({
        "list": [KgNodeOut.model_validate(n).model_dump(by_alias=True, mode="json") for n in rows],
        "meta": {"page": page, "pageSize": pageSize, "total": total},
    })


@router.post("/nodes")
def create_node(
    payload: KgNodeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    n = KgNode(
        name=payload.name.strip(),
        category=payload.category.strip() or "领域概念",
        description=payload.description,
        properties=payload.properties,
        source_type="manual",
        source_text=payload.sourceText,
        source_location=payload.sourceLocation,
        ref_type=payload.refType,
        ref_id=payload.refId,
    )
    db.add(n)
    db.commit()
    write_audit(db, user, "CREATE", resource="kg_node", detail=n.name)
    return ok(KgNodeOut.model_validate(n).model_dump(by_alias=True, mode="json"))


@router.put("/nodes/{node_id}")
def update_node(
    node_id: int,
    payload: KgNodeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:write")),
):
    n = db.get(KgNode, node_id)
    if not n:
        raise NotFoundError("节点不存在")
    for k, v in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(n, k, v)
    db.commit()
    return ok(KgNodeOut.model_validate(n).model_dump(by_alias=True, mode="json"))


@router.delete("/nodes/{node_id}")
def delete_node(
    node_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    n = db.get(KgNode, node_id)
    if not n:
        raise NotFoundError("节点不存在")
    name = n.name
    db.delete(n)  # 级联删除出入边
    db.commit()
    write_audit(db, user, "DELETE", resource="kg_node", detail=name)
    return ok({"done": True})


# ---------- 边 ----------
@router.post("/edges")
def create_edge(
    payload: KgEdgeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:write")),
):
    if payload.sourceNodeId == payload.targetNodeId:
        raise BizError("起点与终点不能相同")
    for nid in (payload.sourceNodeId, payload.targetNodeId):
        if not db.get(KgNode, nid):
            raise NotFoundError(f"节点 {nid} 不存在")
    e = KgEdge(
        source_node_id=payload.sourceNodeId,
        target_node_id=payload.targetNodeId,
        relation_type=payload.relationType.strip() or "关联",
        weight=payload.weight,
    )
    db.add(e)
    db.commit()
    return ok(KgEdgeOut.model_validate(e).model_dump(by_alias=True, mode="json"))


@router.delete("/edges/{edge_id}")
def delete_edge(
    edge_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:write")),
):
    e = db.get(KgEdge, edge_id)
    if not e:
        raise NotFoundError("关系不存在")
    db.delete(e)
    db.commit()
    return ok({"done": True})


# ---------- 邻域详情 ----------
@router.get("/node/{node_id}/detail")
def node_detail(
    node_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    n = db.get(KgNode, node_id)
    if not n:
        raise NotFoundError("节点不存在")
    outgoing = db.execute(select(KgEdge).where(KgEdge.source_node_id == node_id)).scalars().all()
    incoming = db.execute(select(KgEdge).where(KgEdge.target_node_id == node_id)).scalars().all()
    neighbor_ids = {e.source_node_id for e in incoming} | {e.target_node_id for e in outgoing}
    neighbors = (
        db.execute(select(KgNode).where(KgNode.id.in_(neighbor_ids))).scalars().all()
        if neighbor_ids
        else []
    )
    links = db.execute(select(KgLink).where(KgLink.node_id == node_id)).scalars().all()
    return ok(
        KgNodeDetail(
            node=KgNodeOut.model_validate(n),
            outgoing=[KgEdgeOut.model_validate(e) for e in outgoing],
            incoming=[KgEdgeOut.model_validate(e) for e in incoming],
            neighbors=[KgNodeOut.model_validate(x) for x in neighbors],
            links=[KgLinkOut.model_validate(l) for l in links],
        ).model_dump(by_alias=True, mode="json")
    )


# ---------- 路径查询（BFS 最短路） ----------
@router.get("/path")
def find_path(
    source: int,
    target: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("model:read")),
):
    edges = db.execute(select(KgEdge)).scalars().all()
    adj: dict[int, list[tuple[int, int]]] = {}
    for e in edges:
        adj.setdefault(e.source_node_id, []).append((e.target_node_id, e.id))

    prev: dict[int, tuple[int, int]] = {}  # node -> (prev_node, via_edge)
    visited = {source}
    q: deque[int] = deque([source])
    while q:
        cur = q.popleft()
        if cur == target:
            break
        for nxt, eid in adj.get(cur, []):
            if nxt not in visited:
                visited.add(nxt)
                prev[nxt] = (cur, eid)
                q.append(nxt)

    if target not in visited:
        return ok(KgPathResult(found=False).model_dump(mode="json"))

    node_ids, edge_ids = [target], []
    cur = target
    while cur != source:
        p, eid = prev[cur]
        edge_ids.append(eid)
        node_ids.append(p)
        cur = p
    node_ids.reverse()
    edge_ids.reverse()

    nodes = db.execute(select(KgNode).where(KgNode.id.in_(node_ids))).scalars().all()
    order = {nid: i for i, nid in enumerate(node_ids)}
    nodes.sort(key=lambda n: order[n.id])
    edges = db.execute(select(KgEdge).where(KgEdge.id.in_(edge_ids))).scalars().all()
    return ok(
        KgPathResult(
            found=True,
            nodes=[KgNodeOut.model_validate(n) for n in nodes],
            edges=[KgEdgeOut.model_validate(e) for e in edges],
        ).model_dump(by_alias=True, mode="json")
    )


# ---------- AI 提取通道 ----------
@router.get("/ai/status")
def ai_status(_: User = Depends(require_permission("model:read"))):
    return ok({"available": kg_ai_service.ai_available(), "model": __import__("app.core.config", fromlist=["settings"]).settings.DEEPSEEK_MODEL})


@router.post("/extract")
async def extract_from_text(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("model:write")),
):
    """文本 → AI 三元组提取 → 入库（source_type='ai'，保留原文溯源）。"""
    text = (payload.get("text") or "").strip()
    if not text:
        raise BizError("请提供要提取的文本")

    result = await extract_triples(text)

    name_to_id: dict[str, int] = {}
    created_nodes: list[KgNode] = []
    for n in result["nodes"]:
        # 同名节点复用（跨块去重 & 与既有图谱合并）
        existing = db.scalar(select(KgNode).where(KgNode.name == n["name"]))
        if existing:
            name_to_id[n["name"]] = existing.id
            continue
        node = KgNode(
            name=n["name"],
            category=n["category"],
            description=n.get("description") or None,
            source_type="ai",
            source_text=n.get("source_text") or None,
        )
        db.add(node)
        db.flush()
        name_to_id[n["name"]] = node.id
        created_nodes.append(node)

    created_edges = []
    seen_pairs: set[tuple[int, int, str]] = {
        (e.source_node_id, e.target_node_id, e.relation_type)
        for e in db.execute(select(KgEdge)).scalars().all()
    }
    for e in result["edges"]:
        sid = name_to_id.get(e.get("source", ""))
        tid = name_to_id.get(e.get("target", ""))
        if not sid or not tid:
            continue
        key = (sid, tid, e["relation_type"])
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        edge = KgEdge(
            source_node_id=sid, target_node_id=tid,
            relation_type=e["relation_type"], weight=float(e.get("weight") or 1.0),
        )
        db.add(edge)
        db.flush()
        created_edges.append(edge)

    db.commit()
    write_audit(db, user, "CREATE", resource="kg_extract",
                detail=f"nodes={len(created_nodes)}, edges={len(created_edges)}")
    return ok({
        "nodesCreated": len(created_nodes),
        "edgesCreated": len(created_edges),
        "nodes": [KgNodeOut.model_validate(n).model_dump(by_alias=True, mode="json") for n in created_nodes],
        "edges": [KgEdgeOut.model_validate(e).model_dump(by_alias=True, mode="json") for e in created_edges],
    })
