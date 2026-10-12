"""Database seed: RBAC matrix + presets + time-series backfill.

Idempotent: only runs when the `users` table is empty.
"""
from __future__ import annotations
import random
from datetime import datetime, timedelta
from sqlalchemy import select, func, insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.auth import User, Role, Permission
from app.models.data import DataSource, DataPoint, TimeSeries, DataQualityLog
from app.models.model_lib import ModelRegistry, ModelVersion, ModelCall
from app.models.platform import Scenario, Alarm, FormConfig
from app.mock.generator import TimeSeriesGenerator
from app.mock.industrial import load_presets, runtime
from app.mock.model_catalog import get_catalog_models

# (code, name, module)
_PERMISSIONS = [
    # User & role management
    ("system:user:read", "查看用户", "system"),
    ("system:user:write", "管理用户", "system"),
    ("system:user:delete", "删除用户", "system"),
    ("system:role:read", "查看角色", "system"),
    ("system:role:write", "管理角色", "system"),
    ("system:audit:read", "查看操作日志", "system"),
    # Data management (M2)
    ("data:source:read", "查看数据源", "data"),
    ("data:source:write", "管理数据源", "data"),
    ("data:source:delete", "删除数据源", "data"),
    ("data:import:read", "查看数据导入", "data"),
    ("data:import:write", "上传数据", "data"),
    ("data:import:delete", "删除导入记录", "data"),
    ("data:point:read", "查看点位", "data"),
    ("data:point:write", "管理点位", "data"),
    ("data:query", "查询时序数据", "data"),
    ("data:quality:read", "查看数据质量", "data"),
    # Model / studio / scenarios (reserved for later modules)
    ("model:read", "查看模型", "model"),
    ("model:write", "管理模型", "model"),
    ("orchestration:read", "查看模型编排", "model"),
    ("orchestration:write", "管理模型编排", "model"),
    ("studio:read", "查看组态", "studio"),
    ("studio:write", "管理组态", "studio"),
    ("scenario:read", "查看场景", "scenario"),
]

_BUILTIN_ROLES = {
    "admin": {
        "name": "超级管理员",
        "description": "拥有系统全部权限",
        "permissions": "*",  # all
    },
    "engineer": {
        "name": "工程师",
        "description": "数据与模型读写，不可管理用户/角色",
        "permissions": [
            "data:source:read", "data:source:write", "data:source:delete",
            "data:import:read", "data:import:write", "data:import:delete",
            "data:point:read", "data:point:write",
            "data:query", "data:quality:read",
            "model:read", "model:write",
            "orchestration:read", "orchestration:write",
            "studio:read", "studio:write",
            "scenario:read",
            "system:audit:read",
        ],
    },
    "viewer": {
        "name": "只读用户",
        "description": "仅可查看，不可写",
        "permissions": [
            "data:source:read", "data:import:read", "data:point:read",
            "data:query", "data:quality:read",
            "model:read", "orchestration:read",
            "studio:read", "scenario:read",
        ],
    },
}

_BUILTIN_USERS = [
    ("admin", "admin123", "admin@carbonops.io", "管理员", ["admin"]),
    ("engineer", "engineer123", "eng@carbonops.io", "工程师", ["engineer"]),
    ("viewer", "viewer123", "viewer@carbonops.io", "访客", ["viewer"]),
]


_PRESET_MODELS = [
    # 有色 - 挥发窑燃烧优化
    {"name": "挥发窑燃烧优化模型", "code": "VOLATILE_KILN_OPT", "industry": "有色",
     "functionType": "OPTIMIZATION", "processStage": "焙烧", "description": "基于窑温、风量、煤比的多变量优化",
     "tags": ["燃烧", "能效"], "status": "ONLINE", "accuracy": 0.94},
    # 石化 - 乙烯裂解深度
    {"name": "乙烯裂解深度预测模型", "code": "ETHYLENE_CRACKER_PRED", "industry": "石化",
     "functionType": "PREDICTION", "processStage": "裂解", "description": "预测裂解深度与收率分布",
     "tags": ["收率", "裂解深度"], "status": "ONLINE", "accuracy": 0.91},
    # 钢铁 - 高炉碳排核算
    {"name": "高炉碳排放核算模型", "code": "BLAST_FURNACE_CARBON", "industry": "钢铁",
     "functionType": "CARBON_ACCOUNTING", "processStage": "炼铁", "description": "基于物料平衡的碳排放核算",
     "tags": ["碳排", "物料平衡"], "status": "ONLINE", "accuracy": 0.97},
    # 钢铁 - 转炉终点预测
    {"name": "转炉终点温度预测模型", "code": "CONVERTER_ENDPOINT_PRED", "industry": "钢铁",
     "functionType": "PREDICTION", "processStage": "炼钢", "description": "转炉吹炼终点温度与碳含量预测",
     "tags": ["终点", "温度"], "status": "TESTING", "accuracy": 0.88},
    # 通用 - 能效分级
    {"name": "工业能效分级模型", "code": "ENERGY_EFFICIENCY_CLS", "industry": "通用",
     "functionType": "CLASSIFICATION", "processStage": "通用", "description": "基于多维能耗指标的能效等级分类",
     "tags": ["能效", "分级"], "status": "ONLINE", "accuracy": 0.92},
    # 通用 - 运行参数优化
    {"name": "运行参数综合优化模型", "code": "PROCESS_PARAM_OPT", "industry": "通用",
     "functionType": "OPTIMIZATION", "processStage": "通用", "description": "全流程运行参数综合寻优",
     "tags": ["优化", "参数"], "status": "DEVELOPING", "accuracy": 0.0},
]


_PRESET_SCENARIOS = [
    {"code": "VOLATILE_KILN_SCENARIO", "name": "有色·挥发窑燃烧优化", "industry": "有色",
     "description": "基于挥发窑温度、风量、煤比等多维数据的燃烧效率优化场景，集成实时监测与模型调控",
     "config": {"sourceCodes": ["volatile_kiln"], "modelCodes": ["VOLATILE_KILN_OPT"]},
     "status": "ACTIVE", "icon": "flame"},
    {"code": "ETHYLENE_CRACKER_SCENARIO", "name": "石化·乙烯裂解深度调控", "industry": "石化",
     "description": "乙烯裂解炉出口温度监测、裂解深度预测与清焦预警一体化场景",
     "config": {"sourceCodes": ["ethylene_cracker"], "modelCodes": ["ETHYLENE_CRACKER_PRED"]},
     "status": "ACTIVE", "icon": "factory"},
    {"code": "STEEL_MAKING_SCENARIO", "name": "钢铁·全流程碳排监控", "industry": "钢铁",
     "description": "覆盖焦化-烧结-炼铁-炼钢-轧钢全工序的碳排放流图与碳标签管理",
     "config": {"sourceCodes": ["steelmaking"], "modelCodes": ["BLAST_FURNACE_CARBON", "CONVERTER_ENDPOINT_PRED"]},
     "status": "ACTIVE", "icon": "zap"},
    {"code": "GENERAL_ENERGY_SCENARIO", "name": "通用·工业能效诊断", "industry": "通用",
     "description": "基于多维能耗指标的能效分级诊断与优化建议场景",
     "config": {"sourceCodes": ["generic_demo"], "modelCodes": ["ENERGY_EFFICIENCY_CLS"]},
     "status": "TEMPLATE", "icon": "gauge"},
]


# Alarms are defined with an `hoursAgo` offset; actual created_at is computed at seed time.
_PRESET_ALARMS = [
    {"hoursAgo": 2, "level": "CRITICAL", "category": "DATA", "sourceType": "data_source",
     "title": "挥发窑温度超出阈值", "content": "挥发窑二段温度 1380℃ 超过上限 1350℃，持续 5 分钟", "status": "ACTIVE"},
    {"hoursAgo": 6, "level": "WARN", "category": "SYSTEM", "sourceType": "data_source",
     "title": "数据源连接中断", "content": "乙烯裂解 OPC-UA 数据源连接中断，已尝试自动重连 3 次", "status": "ACTIVE"},
    {"hoursAgo": 10, "level": "WARN", "category": "MODEL", "sourceType": "model",
     "title": "模型推理延迟过高", "content": "转炉终点预测模型平均推理延迟 420ms，超过阈值 300ms", "status": "ACK"},
    {"hoursAgo": 20, "level": "CRITICAL", "category": "MODEL", "sourceType": "model",
     "title": "碳排强度接近限值", "content": "高炉工序碳排放强度 1.82 tCO₂/t，接近配额上限 2.0 tCO₂/t", "status": "ACTIVE"},
    {"hoursAgo": 28, "level": "WARN", "category": "DATA", "sourceType": "data_source",
     "title": "数据完整率低于80%", "content": "烧结工序数据完整率 76.3%，低于阈值 80%", "status": "ACK"},
    {"hoursAgo": 36, "level": "INFO", "category": "DATA", "sourceType": "data_source",
     "title": "点位数据异常波动", "content": "高炉热风温度出现短时波动，已自动标记并复核", "status": "RESOLVED"},
    {"hoursAgo": 48, "level": "WARN", "category": "CONTROL", "sourceType": "scenario",
     "title": "控制策略下发失败", "content": "挥发窑煤比优化建议下发失败，已回退至上一稳定策略", "status": "RESOLVED"},
    {"hoursAgo": 60, "level": "INFO", "category": "SYSTEM", "sourceType": None,
     "title": "系统例行巡检完成", "content": "数据采集与模型服务例行巡检完成，全部正常", "status": "RESOLVED"},
    {"hoursAgo": 72, "level": "CRITICAL", "category": "DATA", "sourceType": "data_source",
     "title": "裂解炉出口温度骤降", "content": "乙烯裂解炉 COT 温度骤降 40℃，疑似进料中断", "status": "RESOLVED"},
    {"hoursAgo": 90, "level": "WARN", "category": "MODEL", "sourceType": "model",
     "title": "模型精度漂移", "content": "能效分级模型近期准确率降至 85%，建议触发再训练", "status": "ACK"},
    {"hoursAgo": 120, "level": "INFO", "category": "CONTROL", "sourceType": "scenario",
     "title": "优化策略生效通知", "content": "挥发窑燃烧优化策略生效，预计节能 3.2%", "status": "RESOLVED"},
    {"hoursAgo": 150, "level": "WARN", "category": "SYSTEM", "sourceType": None,
     "title": "磁盘空间预警", "content": "时序数据库所在磁盘使用率 88%，请及时清理或扩容", "status": "RESOLVED"},
]


def _form_page_config(title: str, source_code: str) -> dict:
    """Build a simple representative page config (component tree + layout + bindings)."""
    return {
        "title": title,
        "layout": "grid",
        "style": {"background": "#0f172a", "theme": "dark"},
        "components": [
            {"id": "c1", "type": "kpi", "title": "实时温度", "position": {"x": 0, "y": 0, "w": 4, "h": 2},
             "binding": {"sourceCode": source_code, "point": "temperature", "agg": "latest"}},
            {"id": "c2", "type": "chart", "title": "温度趋势", "chartType": "line",
             "position": {"x": 4, "y": 0, "w": 8, "h": 4},
             "binding": {"sourceCode": source_code, "points": ["temperature", "pressure"], "window": "1h"}},
            {"id": "c3", "type": "gauge", "title": "燃烧效率", "position": {"x": 0, "y": 2, "w": 4, "h": 3},
             "binding": {"sourceCode": source_code, "point": "efficiency"}},
            {"id": "c4", "type": "alarm", "title": "活跃告警", "position": {"x": 0, "y": 5, "w": 12, "h": 3},
             "binding": {"scenario": source_code}},
        ],
    }


def _dashboard_page_config() -> dict:
    """Build the default dashboard recipe in PageConfig v2.0 format."""
    return {
        "version": "2.0",
        "layout": "grid",
        "canvas": {"background": "#0f172a", "theme": "dark", "gridSize": 8},
        "components": [
            {
                "id": "d1", "type": "kpi", "title": "实时温度",
                "position": {"x": 0, "y": 0, "w": 3, "h": 2},
                "props": {"unit": "℃", "decimals": 1, "color": "#f97316", "showTrend": True},
                "bindings": {"value": {"kind": "point", "sourceCode": "volatile_kiln", "point": "temperature", "agg": "raw"}},
            },
            {
                "id": "d2", "type": "kpi", "title": "燃烧效率",
                "position": {"x": 3, "y": 0, "w": 3, "h": 2},
                "props": {"unit": "%", "decimals": 1, "color": "#22c55e", "showTrend": True},
                "bindings": {"value": {"kind": "point", "sourceCode": "volatile_kiln", "point": "efficiency", "agg": "raw"}},
            },
            {
                "id": "d3", "type": "gauge", "title": "能效等级",
                "position": {"x": 6, "y": 0, "w": 3, "h": 3},
                "props": {"min": 0, "max": 100, "unit": "分", "thresholds": "60,85"},
                "bindings": {"value": {"kind": "point", "sourceCode": "generic_demo", "point": "efficiency", "agg": "avg"}},
            },
            {
                "id": "d4", "type": "kpi", "title": "乙烯收率",
                "position": {"x": 9, "y": 0, "w": 3, "h": 2},
                "props": {"unit": "%", "decimals": 2, "color": "#3b82f6", "showTrend": True},
                "bindings": {"value": {"kind": "point", "sourceCode": "ethylene_cracker", "point": "yield_rate", "agg": "raw"}},
            },
            {
                "id": "d5", "type": "chart", "title": "温度趋势",
                "position": {"x": 0, "y": 2, "w": 6, "h": 4},
                "props": {"chartType": "line", "timeWindow": "1h", "showLegend": True, "color": "#f97316"},
                "bindings": {"series": {"kind": "point", "sourceCode": "volatile_kiln", "point": "temperature", "agg": "avg"}},
            },
            {
                "id": "d6", "type": "alarm", "title": "活跃告警",
                "position": {"x": 6, "y": 3, "w": 6, "h": 3},
                "props": {"maxItems": 5, "filterLevel": "all"},
                "bindings": {},
            },
            {
                "id": "d7", "type": "chart", "title": "能耗对比",
                "position": {"x": 0, "y": 6, "w": 6, "h": 4},
                "props": {"chartType": "bar", "timeWindow": "24h", "showLegend": True, "color": "#8b5cf6"},
                "bindings": {"series": {"kind": "point", "sourceCode": "steelmaking", "point": "temperature", "agg": "sum"}},
            },
            {
                "id": "d8", "type": "status", "title": "系统状态",
                "position": {"x": 6, "y": 6, "w": 2, "h": 2},
                "props": {"onColor": "#22c55e", "offColor": "#ef4444", "label": "运行中"},
                "bindings": {"value": {"kind": "static", "value": 1}},
            },
            {
                "id": "d9", "type": "text", "title": "说明",
                "position": {"x": 8, "y": 6, "w": 4, "h": 2},
                "props": {"text": "此区域内容由低代码组态编辑器配置，点击「编辑驾驶舱」自定义", "fontSize": 13, "color": "#94a3b8", "bold": False},
                "bindings": {},
            },
        ],
    }


_PRESET_FORMS = [
    {"code": "KILN_DASHBOARD", "name": "挥发窑监测面板", "industry": "有色",
     "scenario": "VOLATILE_KILN_SCENARIO", "status": "PUBLISHED", "versionNo": "v2",
     "pageConfig": _form_page_config("挥发窑监测面板", "volatile_kiln")},
    {"code": "CRACKER_OVERVIEW", "name": "裂解炉总览", "industry": "石化",
     "scenario": "ETHYLENE_CRACKER_SCENARIO", "status": "PUBLISHED", "versionNo": "v1",
     "pageConfig": _form_page_config("裂解炉总览", "ethylene_cracker")},
    {"code": "CARBON_FLOW", "name": "全流程碳流图", "industry": "钢铁",
     "scenario": "STEEL_MAKING_SCENARIO", "status": "DRAFT", "versionNo": "v1",
     "pageConfig": _form_page_config("全流程碳流图", "steelmaking")},
    {"code": "DASHBOARD_DEFAULT", "name": "驾驶舱默认配方", "industry": "通用",
     "scenario": None, "status": "PUBLISHED", "versionNo": "v1",
     "pageConfig": _dashboard_page_config()},
]


def _mock_output(rng: random.Random, function_type: str) -> dict:
    if function_type == "OPTIMIZATION":
        return {
            "optimized_params": {
                "param1": round(rng.uniform(60, 95), 2),
                "param2": round(rng.uniform(100, 300), 2),
                "param3": round(rng.uniform(0.5, 2.0), 3),
            },
            "improvement_pct": round(rng.uniform(3, 15), 2),
        }
    if function_type == "PREDICTION":
        return {
            "predicted_value": round(rng.uniform(40, 600), 2),
            "confidence": round(rng.uniform(0.85, 0.99), 4),
            "horizon": "24h",
        }
    if function_type == "CLASSIFICATION":
        categories = ["A", "B", "C", "D"]
        primary = rng.choice(categories)
        alts = [c for c in categories if c != primary]
        return {
            "category": primary,
            "confidence": round(rng.uniform(0.8, 0.98), 4),
            "alternatives": alts,
        }
    if function_type == "CARBON_ACCOUNTING":
        return {
            "carbon_emission_kg": round(rng.uniform(100, 5000), 2),
            "scope": "Scope1",
            "breakdown": {
                "fuel_combustion": round(rng.uniform(50, 2500), 2),
                "process_emission": round(rng.uniform(40, 2000), 2),
                "electricity": round(rng.uniform(10, 500), 2),
            },
        }
    return {"result": round(rng.uniform(0, 100), 2)}


def _seed_permissions(db: Session) -> dict[str, Permission]:
    perms: dict[str, Permission] = {}
    for code, name, module in _PERMISSIONS:
        existing = db.scalar(select(Permission).where(Permission.code == code))
        if existing:
            perms[code] = existing
            continue
        p = Permission(code=code, name=name, module=module)
        db.add(p)
        db.flush()
        perms[code] = p
    return perms


def _seed_roles(db: Session, perms: dict[str, Permission]) -> dict[str, Role]:
    roles: dict[str, Role] = {}
    all_codes = list(perms.keys())
    for code, spec in _BUILTIN_ROLES.items():
        role = db.scalar(select(Role).where(Role.code == code))
        if not role:
            role = Role(code=code, name=spec["name"], description=spec["description"], is_builtin=True)
            db.add(role)
            db.flush()
        wanted = all_codes if spec["permissions"] == "*" else spec["permissions"]
        role.permissions = [perms[c] for c in wanted if c in perms]
        roles[code] = role
    return roles


def _seed_users(db: Session, roles: dict[str, Role]) -> None:
    for username, pwd, email, display, role_codes in _BUILTIN_USERS:
        if db.scalar(select(User).where(User.username == username)):
            continue
        u = User(
            username=username,
            email=email,
            display_name=display,
            password_hash=hash_password(pwd),
            is_active=True,
        )
        u.roles = [roles[c] for c in role_codes if c in roles]
        db.add(u)
    db.commit()


def _seed_data_sources(db: Session) -> None:
    """Create data sources/points from presets (only if none exist)."""
    if db.scalar(select(func.count()).select_from(DataSource)):
        return
    presets = load_presets()
    for preset in presets:
        src = DataSource(
            name=preset["name"],
            code=preset["code"],
            protocol=preset["protocol"],
            host=preset.get("host"),
            port=preset.get("port"),
            config=None,
            status="DISCONNECTED",
            industry=preset.get("industry", "通用"),
            collect_interval_ms=preset.get("collect_interval_ms", 5000),
            description=preset.get("description"),
        )
        db.add(src)
        db.flush()
        for p in preset.get("points", []):
            point = DataPoint(
                source_id=src.id,
                code=p["code"],
                name=p["name"],
                unit=p.get("unit"),
                data_type=p.get("data_type", "NUMBER"),
                tags=None,
                industry=preset.get("industry", "通用"),
                process_stage=p.get("process_stage"),
                device=p.get("device"),
                gen_base=p.get("gen_base", 50.0),
                gen_amplitude=p.get("gen_amplitude", 10.0),
                gen_period_s=p.get("gen_period_s", 3600.0),
                gen_noise=p.get("gen_noise", 1.0),
                gen_trend=p.get("gen_trend", 0.0),
                description=p.get("description"),
            )
            db.add(point)
    db.commit()


def _backfill_time_series(db: Session) -> None:
    """Generate historical time-series for every data point."""
    if db.scalar(select(func.count()).select_from(TimeSeries)):
        return

    points = db.execute(select(DataPoint)).scalars().all()
    if not points:
        return

    now = datetime.utcnow()
    start = now - timedelta(days=settings.TS_BACKFILL_DAYS)
    interval = max(1, settings.TS_BACKFILL_INTERVAL_SECONDS)
    step = timedelta(seconds=interval)

    total_batches = 0
    for point in points:
        gen = TimeSeriesGenerator(
            base=point.gen_base,
            amplitude=point.gen_amplitude,
            period_s=point.gen_period_s,
            noise=point.gen_noise,
            trend=point.gen_trend,
            data_type=point.data_type,
            seed=point.id,
        )
        qgen = TimeSeriesGenerator(data_type="NUMBER", seed=point.id * 7 + 1)
        rows: list[dict] = []
        t = start
        while t <= now:
            quality = qgen.quality_at(__import__("random").Random((int(t.timestamp()) * 31) ^ point.id))
            if quality == "MISSING":
                value = None
            else:
                value = gen.value_at(t)
                if quality == "BAD":
                    # inject occasional spike
                    value = (value or 0) * 1.4 if __import__("random").random() < 0.5 else value
            rows.append({"point_id": point.id, "timestamp": t, "value": value, "quality": quality})
            t = t + step
        # bulk insert in chunks
        for i in range(0, len(rows), 5000):
            db.execute(insert(TimeSeries), rows[i : i + 5000])
        total_batches += 1
    db.commit()

    # register live generators + compute initial quality snapshot
    _register_live_generators(db)
    _snapshot_quality(db)


def _register_live_generators(db: Session) -> None:
    points = db.execute(select(DataPoint)).scalars().all()
    for point in points:
        gen = TimeSeriesGenerator(
            base=point.gen_base,
            amplitude=point.gen_amplitude,
            period_s=point.gen_period_s,
            noise=point.gen_noise,
            trend=point.gen_trend,
            data_type=point.data_type,
            seed=point.id,
        )
        runtime.register(point.id, gen)


def _snapshot_quality(db: Session) -> None:
    """Compute one quality row per data source based on existing time_series."""
    sources = db.execute(select(DataSource)).scalars().all()
    for src in sources:
        point_ids = [p.id for p in db.execute(select(DataPoint).where(DataPoint.source_id == src.id)).scalars().all()]
        if not point_ids:
            continue
        total = db.scalar(
            select(func.count()).select_from(TimeSeries).where(TimeSeries.point_id.in_(point_ids))
        ) or 0
        good = db.scalar(
            select(func.count()).select_from(TimeSeries).where(
                TimeSeries.point_id.in_(point_ids), TimeSeries.quality == "GOOD"
            )
        ) or 0
        bad = db.scalar(
            select(func.count()).select_from(TimeSeries).where(
                TimeSeries.point_id.in_(point_ids), TimeSeries.quality == "BAD"
            )
        ) or 0
        completeness = round(good / total, 4) if total else 0.0
        anomaly = round(bad / total, 4) if total else 0.0
        db.add(
            DataQualityLog(
                source_id=src.id,
                recorded_at=datetime.utcnow(),
                access_rate=0.985,
                completeness_rate=completeness,
                anomaly_rate=anomaly,
                detail={"pointCount": len(point_ids), "total": total},
            )
        )
    db.commit()


def _seed_models(db: Session) -> None:
    """Seed preset models + catalog models + versions + calls (idempotent by model code)."""
    engineer = db.scalar(select(User).where(User.username == "engineer"))
    owner_id = engineer.id if engineer else None

    # ----- 1. 保留原有 6 个 preset 模型（被 scenarios 引用） -----
    for idx, spec in enumerate(_PRESET_MODELS):
        if db.scalar(select(ModelRegistry).where(ModelRegistry.code == spec["code"])):
            continue

        m = ModelRegistry(
            name=spec["name"],
            code=spec["code"],
            industry=spec["industry"],
            function_type=spec["functionType"],
            process_stage=spec["processStage"],
            description=spec["description"],
            tags=spec["tags"],
            status=spec["status"],
            call_count=0,
            accuracy=spec.get("accuracy", 0.0),
            owner_id=owner_id,
            provider="系统预置",
        )
        db.add(m)
        db.flush()

        rng = random.Random(1000 + idx)
        version_objs: list[ModelVersion] = []

        # ONLINE/TESTING models get 1-2 versions; DEVELOPING models get none
        if spec["status"] in ("ONLINE", "TESTING"):
            v1 = ModelVersion(
                model_id=m.id,
                version_no="v1.0.0",
                entry_function="predict",
                changelog="初始版本",
                is_current=True,
                status=spec["status"],
                stage="PRODUCTION" if spec["status"] == "ONLINE" else "STAGING",
                python_version="3.11",
                source_code=_default_source_code(spec["name"], spec["functionType"]),
            )
            db.add(v1)
            db.flush()
            version_objs.append(v1)

            # ~50% of models get a second older version (not current)
            if rng.random() < 0.5:
                v0 = ModelVersion(
                    model_id=m.id,
                    version_no="v0.9.0",
                    entry_function="predict",
                    changelog="迭代优化",
                    is_current=False,
                    status="OFFLINE",
                    stage="ARCHIVED",
                    python_version="3.10",
                )
                db.add(v0)
                db.flush()
                version_objs.append(v0)

            current_version = version_objs[0]
            call_n = rng.randint(3, 5)
            for _ in range(call_n):
                output = _mock_output(rng, m.function_type)
                call = ModelCall(
                    model_id=m.id,
                    version_id=current_version.id,
                    caller_id=owner_id,
                    latency_ms=rng.randint(50, 500),
                    status="SUCCESS",
                    input={"mock": True},
                    output=output,
                )
                db.add(call)
            m.call_count = call_n
    db.commit()

    # ----- 2. 导入附件1的 120 个模型 -----
    catalog = get_catalog_models()
    for idx, spec in enumerate(catalog):
        if db.scalar(select(ModelRegistry).where(ModelRegistry.code == spec["code"])):
            continue

        m = ModelRegistry(
            name=spec["name"],
            code=spec["code"],
            industry=spec["industry"],
            function_type=spec["functionType"],
            process_stage=spec["processStage"],
            description=spec["description"],
            tags=spec["tags"],
            status=spec["status"],
            call_count=0,
            accuracy=spec.get("accuracy", 0.0),
            owner_id=owner_id,
            provider=spec.get("provider"),
        )
        db.add(m)
        db.flush()

        rng = random.Random(2000 + idx)

        # ONLINE models get a current version with source code
        if spec["status"] == "ONLINE":
            v1 = ModelVersion(
                model_id=m.id,
                version_no="v1.0.0",
                entry_function="predict",
                changelog="初始发布版本",
                is_current=True,
                status="ONLINE",
                stage=spec["stage"],
                python_version=spec.get("pythonVersion", "3.11"),
                source_code=spec.get("sourceCode"),
            )
            db.add(v1)
            db.flush()

            # 生成少量调用记录
            call_n = rng.randint(2, 8)
            for _ in range(call_n):
                output = _mock_output(rng, m.function_type)
                call = ModelCall(
                    model_id=m.id,
                    version_id=v1.id,
                    caller_id=owner_id,
                    latency_ms=rng.randint(30, 400),
                    status="SUCCESS",
                    input={"mock": True},
                    output=output,
                )
                db.add(call)
            m.call_count = call_n

        elif spec["status"] == "DEVELOPING" and spec["stage"] == "STAGING":
            # 开发中模型有一个 STAGING 版本
            v1 = ModelVersion(
                model_id=m.id,
                version_no="v0.1.0",
                entry_function="predict",
                changelog="开发中预览版本",
                is_current=True,
                status="DEVELOPING",
                stage="STAGING",
                python_version=spec.get("pythonVersion", "3.11"),
                source_code=spec.get("sourceCode"),
            )
            db.add(v1)
            db.flush()
        # 待开发 (NONE) 模型暂无版本

    db.commit()


def _default_source_code(name: str, function_type: str) -> str:
    """Generate a simple Python source code template for preset models."""
    return f'''"""模型：{name}"""
from __future__ import annotations
from typing import Any


def predict(input: dict[str, Any]) -> dict[str, Any]:
    """模型推理入口函数。"""
    # TODO: 实现模型推理逻辑
    return {{"status": "ok", "message": "模型推理逻辑待实现"}}
'''


def _seed_scenarios(db: Session) -> None:
    """Seed preset scenarios (idempotent by code)."""
    engineer = db.scalar(select(User).where(User.username == "engineer"))
    owner_id = engineer.id if engineer else None

    for spec in _PRESET_SCENARIOS:
        if db.scalar(select(Scenario).where(Scenario.code == spec["code"])):
            continue
        db.add(
            Scenario(
                code=spec["code"],
                name=spec["name"],
                industry=spec["industry"],
                description=spec["description"],
                config=spec["config"],
                status=spec["status"],
                icon=spec["icon"],
                owner_id=owner_id,
            )
        )
    db.commit()


def _seed_alarms(db: Session) -> None:
    """Seed preset alarms (only if the alarms table is empty)."""
    if db.scalar(select(func.count()).select_from(Alarm)):
        return
    engineer = db.scalar(select(User).where(User.username == "engineer"))
    acked_by = engineer.id if engineer else None
    now = datetime.utcnow()
    for spec in _PRESET_ALARMS:
        status = spec["status"]
        acked_at = None
        if status in ("ACK", "RESOLVED"):
            acked_at = now - timedelta(hours=spec["hoursAgo"] - 1)
        db.add(
            Alarm(
                level=spec["level"],
                category=spec["category"],
                source_type=spec["sourceType"],
                source_id=None,
                title=spec["title"],
                content=spec["content"],
                status=status,
                acked_by=acked_by if status in ("ACK", "RESOLVED") else None,
                acked_at=acked_at,
                created_at=now - timedelta(hours=spec["hoursAgo"]),
            )
        )
    db.commit()


def _seed_forms(db: Session) -> None:
    """Seed preset form configs (idempotent by code)."""
    engineer = db.scalar(select(User).where(User.username == "engineer"))
    created_by = engineer.id if engineer else None

    for spec in _PRESET_FORMS:
        if db.scalar(select(FormConfig).where(FormConfig.code == spec["code"])):
            continue
        db.add(
            FormConfig(
                code=spec["code"],
                name=spec["name"],
                industry=spec["industry"],
                scenario=spec["scenario"],
                description=None,
                page_config=spec["pageConfig"],
                status=spec["status"],
                version_no=spec["versionNo"],
                created_by=created_by,
            )
        )
    db.commit()


def run_seed(db: Session) -> None:
    """Entry point: seed RBAC + data + time-series + models if DB is empty."""
    has_users = db.scalar(select(func.count()).select_from(User))
    perms = _seed_permissions(db)
    roles = _seed_roles(db, perms)
    db.commit()
    if not has_users:
        _seed_users(db, roles)
    _seed_data_sources(db)
    _backfill_time_series(db)
    _seed_models(db)
    _seed_scenarios(db)
    _seed_alarms(db)
    _seed_forms(db)
