"""知识图谱（Knowledge Graph）——元模型平台层的图数据模型。

设计源自 knowledgeT 项目（nodes/edges 两表 + 自由字符串分类），
并泛化出 kg_links：把图谱节点挂接到平台资产（数据点位/元模型/场景）。
"""
from sqlalchemy import Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class KgNode(Base):
    __tablename__ = "kg_nodes"

    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    properties: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # manual / ai / migration / derived
    source_type: Mapped[str] = mapped_column(String(16), default="manual")
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)      # 原文引用（溯源）
    source_location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # 关联平台资产（可选）：METAMODEL / DATA_POINT / SCENARIO
    ref_type: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)

    outgoing_edges: Mapped[list["KgEdge"]] = relationship(
        "KgEdge", foreign_keys="KgEdge.source_node_id", back_populates="source_node",
        cascade="all, delete-orphan",
    )
    incoming_edges: Mapped[list["KgEdge"]] = relationship(
        "KgEdge", foreign_keys="KgEdge.target_node_id", back_populates="target_node",
        cascade="all, delete-orphan",
    )


class KgEdge(Base):
    __tablename__ = "kg_edges"
    __table_args__ = (Index("ix_kg_edges_source", "source_node_id"), Index("ix_kg_edges_target", "target_node_id"))

    source_node_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False
    )
    target_node_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False
    )
    relation_type: Mapped[str] = mapped_column(String(100), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    properties: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    source_node: Mapped["KgNode"] = relationship("KgNode", foreign_keys=[source_node_id], back_populates="outgoing_edges")
    target_node: Mapped["KgNode"] = relationship("KgNode", foreign_keys=[target_node_id], back_populates="incoming_edges")


class KgLink(Base):
    """图谱节点 ↔ 平台资产 关联（数据点位 / 元模型 / 场景 / 文档）。"""
    __tablename__ = "kg_links"

    node_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kg_nodes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    link_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)  # DATA_POINT/METAMODEL/SCENARIO/DOCUMENT
    link_id: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
