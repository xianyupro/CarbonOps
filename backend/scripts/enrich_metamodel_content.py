"""元模型学术内容充实：把内容库（app.mock.metamodel_scholar）写入存量数据库。

执行内容（幂等，可重跑）：
1. 确保 metamodels 学术字段列存在（复用 migrate_add_scholar_fields）；
2. 按名称匹配元模型，填充学术内容（摘要/公式/变量表/V&V/文献/溯源）；
3. 每条命中记录追加一条「学术内容充实」版本快照（版本谱系可追溯）；
4. 为挥发窑相关元模型补建知识图谱节点（ref_type=METAMODEL + kg_links 挂链，
   「适用于」回转窑），消除模型卡关联图谱的「尚未注册」占位。

用法：
    cd backend && .venv/Scripts/python.exe scripts/enrich_metamodel_content.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.mock.metamodel_scholar import SCHOLAR, apply_scholar_content  # noqa: E402
from app.models.kg import KgEdge, KgLink, KgNode  # noqa: E402
from app.models.metamodel import Metamodel, MetamodelVersion  # noqa: E402
from app.schemas.metamodel import MetamodelOut  # noqa: E402

import migrate_add_scholar_fields  # noqa: E402

ENRICH_MARK = "学术内容充实"


def enrich_contents(db) -> int:
    """按名称匹配填充学术字段并写版本快照。返回更新条数。"""
    updated = 0
    for mm in db.execute(select(Metamodel)).scalars().all():
        if not apply_scholar_content(mm):
            continue
        has_enrich = db.scalar(
            select(MetamodelVersion.id)
            .where(MetamodelVersion.metamodel_id == mm.id)
            .where(MetamodelVersion.changelog.like(f"{ENRICH_MARK}%"))
        )
        if not has_enrich:
            db.add(
                MetamodelVersion(
                    metamodel_id=mm.id,
                    version_no=mm.version_no,
                    changelog=(
                        f"{ENRICH_MARK}：核心关系式/变量参数表/量化验证指标/参考文献/"
                        f"不确定性/数据溯源（元模型学术内容库 v1）"
                    ),
                    snapshot=MetamodelOut.model_validate(mm).model_dump(by_alias=True, mode="json"),
                    created_by="scholar_enrich",
                )
            )
        updated += 1
    db.commit()
    return updated


def register_kg_nodes(db) -> int:
    """为挥发窑相关元模型补建图谱节点（跳过已注册），挂「适用于」回转窑节点。"""
    kiln = db.scalar(
        select(KgNode).where(
            KgNode.source_type == "manual",
            KgNode.category == "设备",
            KgNode.name == "回转挥发窑",
        )
    )
    if not kiln:
        print("未找到回转挥发窑图谱节点（先运行 import_kg_data.py），跳过图谱注册")
        return 0
    created = 0
    mms = db.execute(
        select(Metamodel).where(
            (Metamodel.industry == "有色") | Metamodel.name.like("%挥发窑%")
        )
    ).scalars().all()
    for mm in mms:
        exists = db.scalar(
            select(KgNode.id).where(KgNode.ref_type == "METAMODEL", KgNode.ref_id == mm.id)
        )
        if exists:
            continue
        node = KgNode(
            name=mm.name,
            category="元模型",
            description=f"{mm.meta_code}：{(mm.purpose or '')[:120]}".strip("："),
            source_type="manual",
            ref_type="METAMODEL",
            ref_id=mm.id,
        )
        db.add(node)
        db.flush()
        db.add(KgEdge(source_node_id=node.id, target_node_id=kiln.id, relation_type="适用于"))
        db.add(
            KgLink(node_id=node.id, link_type="METAMODEL", link_id=mm.id,
                   description=f"元模型 {mm.meta_code}")
        )
        created += 1
    db.commit()
    return created


def main() -> None:
    migrate_add_scholar_fields.main()
    db = SessionLocal()
    try:
        updated = enrich_contents(db)
        kg_created = register_kg_nodes(db)
        print(f"学术内容充实完成：更新 {updated} 条元模型；新增图谱节点 {kg_created} 个")
    finally:
        db.close()


if __name__ == "__main__":
    main()
