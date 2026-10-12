"""Dashboard aggregation."""
import random
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User, AuditLog
from app.models.data import DataSource, DataPoint, DataQualityLog, TimeSeries
from app.models.model_lib import ModelRegistry, ModelCall
from app.models.platform import Scenario, Alarm

router = APIRouter()

# 行业碳排放系数 (tCO₂e per source per day)
_INDUSTRY_EMISSION_FACTORS = {
    "有色": 12.5,
    "石化": 15.8,
    "钢铁": 22.3,
    "通用": 8.0,
}
_DEFAULT_FACTOR = 8.0
# 能耗折算系数: tCO₂e → tce (标准煤)
_ENERGY_COEFFICIENT = 0.65


def _compute_carbon_kpi(db: Session, industry: Optional[str] = None) -> dict:
    """Simulate carbon KPI metrics based on existing data."""
    # Base query for data sources
    src_query = select(DataSource)
    if industry:
        src_query = src_query.where(DataSource.industry == industry)
    sources = db.execute(src_query).scalars().all()
    source_count = len(sources)

    # Aggregate CARBON_ACCOUNTING model outputs for base emissions
    carbon_calls = db.execute(
        select(ModelCall.output)
        .join(ModelRegistry, ModelCall.model_id == ModelRegistry.id)
        .where(ModelRegistry.function_type == "CARBON_ACCOUNTING")
    ).scalars().all()

    model_carbon = 0.0
    for output in carbon_calls:
        if output and isinstance(output, dict):
            val = output.get("carbon_emission_kg")
            if val and isinstance(val, (int, float)):
                model_carbon += val

    # Compute total emissions: model data + source-based estimation
    if industry:
        factor = _INDUSTRY_EMISSION_FACTORS.get(industry, _DEFAULT_FACTOR)
    else:
        # Weighted average across all industries
        total_factor = sum(
            _INDUSTRY_EMISSION_FACTORS.get(s.industry or "通用", _DEFAULT_FACTOR)
            for s in sources
        ) if sources else _DEFAULT_FACTOR
        factor = total_factor / max(len(sources), 1) if sources else _DEFAULT_FACTOR

    base_emissions = source_count * factor * 30  # 30-day base
    total_emissions = round(base_emissions + model_carbon / 1000, 1)  # kg→t

    # Reduction rate based on online optimization models
    online_opt_models = db.scalar(
        select(func.count()).select_from(ModelRegistry).where(
            ModelRegistry.status == "ONLINE",
            ModelRegistry.function_type.in_(["OPTIMIZATION", "PROCESS_CONTROL"]),
        )
    ) or 0
    reduction_rate = round(min(0.12 + online_opt_models * 0.015, 0.35), 4)
    total_reduction = round(total_emissions * reduction_rate, 1)

    # Energy consumption
    total_energy = round(total_emissions * _ENERGY_COEFFICIENT, 1)

    # Emission intensity
    emission_intensity = round(total_emissions / max(source_count, 1), 2)

    # 7-day trend
    rng = random.Random(hash((industry or "all", total_emissions)) & 0xFFFFFFFF)
    trend = []
    now = datetime.utcnow()
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        daily_factor = 0.12 + rng.uniform(-0.03, 0.03)
        trend.append({
            "date": day.strftime("%m-%d"),
            "value": round(total_emissions * daily_factor, 1),
        })

    return {
        "totalEmissions": total_emissions,
        "totalReduction": total_reduction,
        "totalEnergy": total_energy,
        "emissionIntensity": emission_intensity,
        "reductionRate": round(reduction_rate * 100, 1),
        "emissionsTrend": trend,
    }


def _get_alarm_summary(db: Session) -> dict:
    """Aggregate alarm counts by level, category, and status."""
    total = db.scalar(select(func.count()).select_from(Alarm)) or 0
    active = db.scalar(select(func.count()).select_from(Alarm).where(Alarm.status == "ACTIVE")) or 0
    acked = db.scalar(select(func.count()).select_from(Alarm).where(Alarm.status == "ACK")) or 0
    resolved = db.scalar(select(func.count()).select_from(Alarm).where(Alarm.status == "RESOLVED")) or 0

    # By level
    level_rows = db.execute(
        select(Alarm.level, func.count()).group_by(Alarm.level)
    ).all()
    by_level = {"CRITICAL": 0, "WARN": 0, "INFO": 0}
    for r in level_rows:
        by_level[r[0]] = r[1]

    # By category
    category_rows = db.execute(
        select(Alarm.category, func.count()).group_by(Alarm.category)
    ).all()
    by_category = {"DATA": 0, "MODEL": 0, "CONTROL": 0, "SYSTEM": 0}
    for r in category_rows:
        by_category[r[0]] = r[1]

    return {
        "total": total,
        "active": active,
        "acked": acked,
        "resolved": resolved,
        "byLevel": by_level,
        "byCategory": by_category,
    }


@router.get("/overview")
def overview(
    industry: Optional[str] = Query(None, description="Filter by industry"),
    processStage: Optional[str] = Query(None, description="Filter by process stage"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # --- Data source stats (with optional industry filter) ---
    src_count_q = select(func.count()).select_from(DataSource)
    point_count_q = select(func.count()).select_from(DataPoint).join(
        DataSource, DataPoint.source_id == DataSource.id
    )
    online_q = select(func.count()).select_from(DataSource).where(
        DataSource.status == "CONNECTED"
    )
    if industry:
        src_count_q = src_count_q.where(DataSource.industry == industry)
        point_count_q = point_count_q.where(DataSource.industry == industry)
        online_q = online_q.where(DataSource.industry == industry)

    source_count = db.scalar(src_count_q) or 0
    point_count = db.scalar(point_count_q) or 0
    online = db.scalar(online_q) or 0

    # --- Model stats ---
    model_q = select(func.count()).select_from(ModelRegistry)
    model_online_q = select(func.count()).select_from(ModelRegistry).where(
        ModelRegistry.status == "ONLINE"
    )
    if industry:
        model_q = model_q.where(ModelRegistry.industry == industry)
        model_online_q = model_online_q.where(ModelRegistry.industry == industry)
    model_total = db.scalar(model_q) or 0
    model_online = db.scalar(model_online_q) or 0
    model_call_count = db.scalar(select(func.sum(ModelRegistry.call_count))) or 0

    # --- Scenario stats ---
    scenario_q = select(func.count()).select_from(Scenario)
    scenario_active_q = select(func.count()).select_from(Scenario).where(
        Scenario.status == "ACTIVE"
    )
    if industry:
        scenario_q = scenario_q.where(Scenario.industry == industry)
        scenario_active_q = scenario_active_q.where(Scenario.industry == industry)
    scenario_count = db.scalar(scenario_q) or 0
    scenario_active = db.scalar(scenario_active_q) or 0

    # --- Industry distribution ---
    industry_rows = db.execute(
        select(DataSource.industry, func.count()).group_by(DataSource.industry)
    ).all()
    industry_dist = [
        {"name": r[0] or "未分类", "value": r[1]} for r in industry_rows
    ]

    # --- Source status distribution ---
    status_rows = db.execute(
        select(DataSource.status, func.count()).group_by(DataSource.status)
    ).all()
    status_dist = [
        {"name": r[0], "value": r[1]} for r in status_rows
    ]

    # --- Average quality (latest per source) ---
    quality_rows = db.execute(
        select(DataQualityLog.source_id, DataQualityLog.access_rate,
               DataQualityLog.completeness_rate, DataQualityLog.anomaly_rate)
        .order_by(DataQualityLog.recorded_at.desc())
    ).all()
    seen = set()
    avg_access, avg_complete, avg_anomaly, q_count = 0.0, 0.0, 0.0, 0
    for r in quality_rows:
        if r[0] in seen:
            continue
        seen.add(r[0])
        avg_access += r[1]
        avg_complete += r[2]
        avg_anomaly += r[3]
        q_count += 1
    if q_count:
        avg_access /= q_count
        avg_complete /= q_count
        avg_anomaly /= q_count

    # --- Carbon KPI ---
    carbon_kpi = _compute_carbon_kpi(db, industry)

    # --- Alarm summary ---
    alarm_summary = _get_alarm_summary(db)

    # --- Recent audit logs (top 8) ---
    recent_logs = db.execute(
        select(AuditLog).order_by(AuditLog.id.desc()).limit(8)
    ).scalars().all()
    recent_activity = [
        {
            "id": log.id,
            "username": log.username,
            "action": log.action,
            "detail": log.detail,
            "createdAt": log.created_at.isoformat() if log.created_at else None,
        }
        for log in recent_logs
    ]

    return ok({
        "dataSourceCount": source_count,
        "pointCount": point_count,
        "onlineSourceCount": online,
        "modelOnlineCount": model_online,
        "modelTotalCount": model_total,
        "modelCallCount": model_call_count,
        "scenarioCount": scenario_count,
        "scenarioActive": scenario_active,
        "industryDist": industry_dist,
        "statusDist": status_dist,
        "avgAccessRate": round(avg_access, 4),
        "avgCompletenessRate": round(avg_complete, 4),
        "avgAnomalyRate": round(avg_anomaly, 4),
        "carbonKpi": carbon_kpi,
        "alarmSummary": alarm_summary,
        "recentActivity": recent_activity,
    })
