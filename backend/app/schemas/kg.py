"""Knowledge graph schemas."""
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class KgNodeCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    properties: Optional[dict] = None
    sourceText: Optional[str] = None
    sourceLocation: Optional[str] = None
    refType: Optional[str] = None
    refId: Optional[int] = None


class KgNodeUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    properties: Optional[dict] = None
    sourceText: Optional[str] = None
    sourceLocation: Optional[str] = None


class KgNodeOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True,
        protected_namespaces=(),
    )
    id: int
    name: str
    description: Optional[str] = None
    category: str
    properties: Optional[dict] = None
    source_type: str
    source_text: Optional[str] = None
    source_location: Optional[str] = None
    ref_type: Optional[str] = None
    ref_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class KgEdgeCreate(BaseModel):
    sourceNodeId: int
    targetNodeId: int
    relationType: str
    weight: float = 1.0


class KgEdgeOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True
    )
    id: int
    source_node_id: int
    target_node_id: int
    relation_type: str
    weight: float = 1.0


class KgLinkOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True
    )
    id: int
    node_id: int
    link_type: str
    link_id: int
    description: Optional[str] = None


class KgGraph(BaseModel):
    nodes: list[KgNodeOut]
    edges: list[KgEdgeOut]


class KgNodeDetail(BaseModel):
    node: KgNodeOut
    outgoing: list[KgEdgeOut]
    incoming: list[KgEdgeOut]
    neighbors: list[KgNodeOut]
    links: list[KgLinkOut]


class KgPathResult(BaseModel):
    found: bool
    nodes: list[KgNodeOut] = []
    edges: list[KgEdgeOut] = []


class KgExtractResult(BaseModel):
    nodes_created: int
    edges_created: int
    nodes: list[KgNodeOut] = []
    edges: list[KgEdgeOut] = []
