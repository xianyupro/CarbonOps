"""Metamodel schemas — 对应《元模型交付模板》8 节结构。

入参（Create/Update）沿用本代码库惯例使用 camelCase 字段名；
出参（Out）字段为 snake_case + to_camel 别名，序列化时 by_alias 输出 camelCase。
"""
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CoreRelation(BaseModel):
    id: str = "E(1)"
    expression: str = ""
    note: Optional[str] = None


class IoParam(BaseModel):
    category: str = "输入"          # 输入 / 参数 / 输出传参 / 输出
    symbol: str = ""                # 变量名 / 符号
    dtype: str = ""                 # 类型/维度，如 "float；标量"
    dim: str = "1"
    unit: str = ""
    rangeRequired: str = ""         # 范围 / 必需性
    exampleDefault: str = ""        # 例值 / 缺省情况
    sourceMeaning: str = ""         # 来源 / 含义


class MetamodelCreate(BaseModel):
    name: str
    modelType: str                                   # MECHANISM/DATA_MODEL/ALGORITHM/KNOWLEDGE_RULE
    metaCode: Optional[str] = None                   # 留空则按规则自动生成
    domain: Optional[str] = None
    hierarchy: Optional[str] = None
    purpose: Optional[str] = None
    methodStructure: Optional[str] = None
    versionNo: str = "1.0.0"
    maturity: Optional[str] = None
    keywords: Optional[List[str]] = None
    scopeObject: Optional[str] = None
    sourceOwnership: Optional[str] = None
    authorMaintainer: Optional[str] = None
    namingRule: Optional[str] = None
    sceneDomain: Optional[str] = None
    assumptions: Optional[str] = None
    limitsPrecision: Optional[str] = None
    structureFlow: Optional[List[str]] = None
    coreRelations: Optional[List[CoreRelation]] = None
    ioParams: Optional[List[IoParam]] = None
    methodFlow: Optional[str] = None
    entryInterface: Optional[str] = None
    exceptionBehavior: Optional[str] = None
    envMaterials: Optional[str] = None
    sourceManifest: Optional[str] = None
    deliveryRepro: Optional[str] = None
    deployCombination: Optional[str] = None
    validationBaseline: Optional[str] = None
    validationLimits: Optional[str] = None
    status: str = "DEVELOPING"
    industry: str = "通用"
    processStage: Optional[str] = None
    tags: Optional[List[str]] = None
    provider: Optional[str] = None
    accuracy: Optional[float] = None
    initialChangelog: Optional[str] = None


class MetamodelUpdate(BaseModel):
    name: Optional[str] = None
    modelType: Optional[str] = None
    domain: Optional[str] = None
    hierarchy: Optional[str] = None
    purpose: Optional[str] = None
    methodStructure: Optional[str] = None
    versionNo: Optional[str] = None
    maturity: Optional[str] = None
    keywords: Optional[List[str]] = None
    scopeObject: Optional[str] = None
    sourceOwnership: Optional[str] = None
    authorMaintainer: Optional[str] = None
    namingRule: Optional[str] = None
    sceneDomain: Optional[str] = None
    assumptions: Optional[str] = None
    limitsPrecision: Optional[str] = None
    structureFlow: Optional[List[str]] = None
    coreRelations: Optional[List[CoreRelation]] = None
    ioParams: Optional[List[IoParam]] = None
    methodFlow: Optional[str] = None
    entryInterface: Optional[str] = None
    exceptionBehavior: Optional[str] = None
    envMaterials: Optional[str] = None
    sourceManifest: Optional[str] = None
    deliveryRepro: Optional[str] = None
    deployCombination: Optional[str] = None
    validationBaseline: Optional[str] = None
    validationLimits: Optional[str] = None
    status: Optional[str] = None
    industry: Optional[str] = None
    processStage: Optional[str] = None
    tags: Optional[List[str]] = None
    provider: Optional[str] = None
    accuracy: Optional[float] = None


class MetamodelOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True,
        protected_namespaces=(),
    )
    id: int
    meta_code: str
    model_type: str
    name: str
    domain: Optional[str] = None
    hierarchy: Optional[str] = None
    purpose: Optional[str] = None
    method_structure: Optional[str] = None
    version_no: str
    maturity: Optional[str] = None
    keywords: Optional[list] = None
    scope_object: Optional[str] = None
    source_ownership: Optional[str] = None
    author_maintainer: Optional[str] = None
    naming_rule: Optional[str] = None
    scene_domain: Optional[str] = None
    assumptions: Optional[str] = None
    limits_precision: Optional[str] = None
    structure_flow: Optional[list] = None
    core_relations: Optional[list] = None
    io_params: Optional[list] = None
    method_flow: Optional[str] = None
    entry_interface: Optional[str] = None
    exception_behavior: Optional[str] = None
    env_materials: Optional[str] = None
    source_manifest: Optional[str] = None
    delivery_repro: Optional[str] = None
    deploy_combination: Optional[str] = None
    validation_baseline: Optional[str] = None
    validation_limits: Optional[str] = None
    status: str
    industry: str
    process_stage: Optional[str] = None
    tags: Optional[list] = None
    provider: Optional[str] = None
    call_count: int = 0
    accuracy: Optional[float] = None
    legacy_model_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class MetamodelVersionOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True
    )
    id: int
    metamodel_id: int
    version_no: str
    changelog: Optional[str] = None
    snapshot: Optional[dict] = None
    created_by: Optional[str] = None
    created_at: datetime


class MetamodelVersionCreate(BaseModel):
    versionNo: str
    changelog: Optional[str] = None


class FacetBucket(BaseModel):
    value: str
    label: str
    count: int
