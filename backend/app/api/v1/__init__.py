"""v1 router aggregator."""
from fastapi import APIRouter
from app.api.v1 import (
    auth, data_sources, data_imports, data_points, data_query, data_quality,
    dashboard, users, model_lib, metamodels, kg, scenarios, alarms, studio,
    flows, screens, system_admin,
)

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["认证"])
router.include_router(users.router, prefix="/users", tags=["用户与权限"])
router.include_router(data_sources.router, prefix="/data-sources", tags=["数据管理-数据源"])
router.include_router(data_imports.router, prefix="/data-imports", tags=["数据管理-导入"])
router.include_router(data_points.router, prefix="/data-points", tags=["数据管理-点位"])
router.include_router(data_query.router, prefix="/data", tags=["数据管理-查询"])
router.include_router(data_quality.router, prefix="/data-quality", tags=["数据管理-质量"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["驾驶舱"])
router.include_router(model_lib.router, prefix="/models", tags=["模型库"])
router.include_router(metamodels.router, prefix="/metamodels", tags=["数据基座-元模型"])
router.include_router(kg.router, prefix="/kg", tags=["元模型平台-知识图谱"])
router.include_router(flows.router, prefix="/flows", tags=["组件平台-控制流"])
router.include_router(screens.router, prefix="/screens", tags=["驾驶舱-大屏"])
router.include_router(system_admin.router, prefix="/system-admin", tags=["系统管理-扩展"])
router.include_router(scenarios.router, prefix="/scenarios", tags=["行业场景"])
router.include_router(alarms.router, prefix="/alarms", tags=["告警中心"])
router.include_router(studio.router, prefix="/forms", tags=["组态开发"])
