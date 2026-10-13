"""ORM models package. Importing this module registers all models on Base.metadata."""
from sqlalchemy.orm import DeclarativeMeta
from app.db.base import Base

from .auth import User, Role, Permission, AuditLog, user_roles, role_permissions  # noqa: F401
from .data import (  # noqa: F401
    DataSource,
    DataImport,
    DataPoint,
    TimeSeries,
    DataQualityLog,
)
from .model_lib import ModelRegistry, ModelVersion, ModelCall  # noqa: F401
from .metamodel import Metamodel, MetamodelVersion  # noqa: F401
from .kg import KgNode, KgEdge, KgLink  # noqa: F401
from .flow import ComponentDef, FlowProject, FlowRun  # noqa: F401
from .screen import ScreenConfig  # noqa: F401
from .system import SystemSetting  # noqa: F401
from .platform import Scenario, Alarm, FormConfig  # noqa: F401

__all__ = [
    "Base",
    "User",
    "Role",
    "Permission",
    "AuditLog",
    "user_roles",
    "role_permissions",
    "DataSource",
    "DataImport",
    "DataPoint",
    "TimeSeries",
    "DataQualityLog",
    "ModelRegistry",
    "ModelVersion",
    "ModelCall",
    "Metamodel",
    "MetamodelVersion",
    "KgNode",
    "KgEdge",
    "KgLink",
    "ComponentDef",
    "FlowProject",
    "FlowRun",
    "ScreenConfig",
    "SystemSetting",
    "Scenario",
    "Alarm",
    "FormConfig",
]
