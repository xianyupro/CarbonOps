"""Data-management business logic: import processing & time-series query."""
from __future__ import annotations
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import BizError, NotFoundError
from app.models.data import DataImport, DataPoint, DataSource, TimeSeries
from app.mock.generator import TimeSeriesGenerator
from app.utils.parser import parse_bytes, df_to_points


# ---------------- offline import ----------------

def save_upload(content: bytes, filename: str) -> tuple[str, int, str]:
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(filename).suffix
    stored = f"{uuid.uuid4().hex}{ext}"
    path = upload_dir / stored
    path.write_bytes(content)
    return str(path), len(content), ext.lstrip(".").upper()


def process_import(db: Session, imp: DataImport, content: bytes) -> None:
    """Parse file -> create points -> write time-series. Marks status COMPLETED/FAILED."""
    try:
        columns, rows, df = parse_bytes(content, imp.filename)
        # create an implicit data source for the import if needed (reuse a 'LOCAL' source)
        src = db.get(DataSource, imp.source_id) if imp.source_id else None
        if src is None:
            src = DataSource(
                name=f"离线导入-{imp.filename}",
                code=f"IMPORT_{imp.id}",
                protocol="HTTP",
                industry="通用",
                status="CONNECTED",
                description=f"由离线导入 {imp.filename} 生成",
            )
            db.add(src)
            db.flush()
            imp.source_id = src.id

        # remove old points for this source (idempotent within re-import)
        existing = db.execute(select(DataPoint).where(DataPoint.source_id == src.id)).scalars().all()
        for p in existing:
            db.delete(p)
        db.flush()

        point_defs = df_to_points(df, src.id)
        created_points: list[DataPoint] = []
        for pd in point_defs:
            p = DataPoint(**{
                "source_id": pd["source_id"],
                "code": pd["code"],
                "name": pd["name"],
                "unit": pd["unit"],
                "data_type": pd["data_type"],
                "industry": pd["industry"],
                "process_stage": pd["process_stage"],
                "device": pd["device"],
                "gen_base": pd["gen_base"],
                "gen_amplitude": pd["gen_amplitude"],
                "gen_period_s": pd["gen_period_s"],
                "gen_noise": pd["gen_noise"],
            })
            db.add(p)
            created_points.append(p)
        db.flush()

        # write time-series from dataframe (only NUMBER columns)
        inserted = 0
        ts_rows: list[dict] = []
        code_to_point = {p.code: p for p in created_points}
        for _, row in df.iterrows():
            ts = row.get("timestamp")
            if ts is None or (hasattr(ts, "isoformat") is False and not isinstance(ts, datetime)):
                continue
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts)
                except Exception:
                    continue
            for col in df.columns:
                if col == "timestamp" or col not in code_to_point:
                    continue
                val = row[col]
                try:
                    val = float(val)
                except Exception:
                    val = None
                ts_rows.append(
                    {
                        "point_id": code_to_point[col].id,
                        "timestamp": ts,
                        "value": val,
                        "quality": "GOOD" if val is not None else "MISSING",
                    }
                )
                inserted += 1
                if len(ts_rows) >= 5000:
                    db.execute(TimeSeries.__table__.insert(), ts_rows)
                    ts_rows.clear()
        if ts_rows:
            db.execute(TimeSeries.__table__.insert(), ts_rows)

        imp.status = "COMPLETED"
        imp.total_rows = int(df.shape[0])
        imp.imported_rows = inserted
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        imp = db.get(DataImport, imp.id)
        if imp:
            imp.status = "FAILED"
            imp.error_msg = str(e)[:500]
            db.commit()
        raise


# ---------------- time-series query ----------------

def query_series(
    db: Session,
    point_ids: list[int],
    start: datetime,
    end: datetime,
    interval: str | None,
    agg: str,
) -> list[dict]:
    """Return [{point_id, series:[{t,v}]}] for the given points/time-range."""
    result: list[dict] = []
    if agg.upper() in {"NONE", ""} or not interval:
        for pid in point_ids:
            stmt = (
                select(TimeSeries.timestamp, TimeSeries.value)
                .where(
                    TimeSeries.point_id == pid,
                    TimeSeries.timestamp >= start,
                    TimeSeries.timestamp <= end,
                )
                .order_by(TimeSeries.timestamp)
            )
            rows = db.execute(stmt).all()
            result.append({"pointId": pid, "series": [{"t": r[0], "v": r[1]} for r in rows]})
        return result

    # Aggregated: bucket by SQLite strftime + agg func
    agg_fn = {"AVG": func.avg, "MAX": func.max, "MIN": func.min, "SUM": func.sum}.get(agg.upper(), func.avg)
    fmt = _sqlite_timefmt(interval)
    for pid in point_ids:
        bucket = func.strftime(fmt, TimeSeries.timestamp).label("bucket")
        stmt = (
            select(bucket, agg_fn(TimeSeries.value))
            .where(
                TimeSeries.point_id == pid,
                TimeSeries.timestamp >= start,
                TimeSeries.timestamp <= end,
            )
            .group_by(bucket)
            .order_by(bucket)
        )
        rows = db.execute(stmt).all()
        series = []
        for r in rows:
            try:
                t = datetime.strptime(r[0], "%Y-%m-%d %H:%M")
            except Exception:
                try:
                    t = datetime.strptime(r[0], "%Y-%m-%d %H:%M:%S")
                except Exception:
                    t = datetime.strptime(r[0], "%Y-%m-%d") if r[0] else None
            series.append({"t": t, "v": round(r[1], 3) if r[1] is not None else None})
        result.append({"pointId": pid, "series": series})
    return result


def _sqlite_timefmt(interval: str) -> str:
    i = interval.strip().lower()
    return {
        "minute": "%Y-%m-%d %H:%M",
        "1 minute": "%Y-%m-%d %H:%M",
        "5 minute": "%Y-%m-%d %H:%M",
        "hour": "%Y-%m-%d %H:00",
        "1 hour": "%Y-%m-%d %H:00",
        "day": "%Y-%m-%d",
        "1 day": "%Y-%m-%d",
        "month": "%Y-%m",
    }.get(i, "%Y-%m-%d %H:%M")


def latest_values(db: Session, point_ids: list[int]) -> list[dict]:
    out: list[dict] = []
    for pid in point_ids:
        stmt = (
            select(TimeSeries.timestamp, TimeSeries.value, TimeSeries.quality)
            .where(TimeSeries.point_id == pid)
            .order_by(TimeSeries.timestamp.desc())
            .limit(1)
        )
        r = db.execute(stmt).first()
        if r:
            out.append({"pointId": pid, "value": r[1], "timestamp": r[0], "quality": r[2]})
        else:
            out.append({"pointId": pid, "value": None, "timestamp": None, "quality": "MISSING"})
    return out
