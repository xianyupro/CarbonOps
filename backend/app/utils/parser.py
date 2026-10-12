"""Offline data file parser: CSV / Excel / JSON / XML.

Returns (columns, rows, point_candidates) where each row is a list aligned with `columns`.
The first column is assumed to be the timestamp column.
"""
from __future__ import annotations
import io
import json
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any
import pandas as pd


def detect_file_type(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".csv"):
        return "CSV"
    if lower.endswith((".xlsx", ".xls")):
        return "EXCEL"
    if lower.endswith(".json"):
        return "JSON"
    if lower.endswith((".xml",)):
        return "XML"
    return "CSV"


def parse_bytes(content: bytes, filename: str) -> tuple[list[str], list[list[Any]], pd.DataFrame]:
    """Parse uploaded file content into (columns, rows, dataframe).

    The dataframe's first column is named 'timestamp' and parsed as datetime.
    """
    ftype = detect_file_type(filename)
    raw = content.decode("utf-8-sig", errors="ignore") if ftype in {"CSV", "JSON", "XML"} else None

    if ftype == "CSV":
        df = pd.read_csv(io.StringIO(raw))
    elif ftype == "EXCEL":
        df = pd.read_excel(io.BytesIO(content))
    elif ftype == "JSON":
        data = json.loads(raw)
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict):
            # support {"timestamp": {...}} mapping OR plain object of arrays
            df = pd.DataFrame(data)
        else:
            raise ValueError("Unsupported JSON structure")
    elif ftype == "XML":
        root = ET.fromstring(raw)
        records: list[dict] = []
        for child in root:
            if child.tag.lower() in {"record", "row", "item"}:
                records.append({sub.tag: sub.text for sub in child})
        df = pd.DataFrame(records)
    else:
        df = pd.read_csv(io.StringIO(raw))

    if df.shape[1] == 0 or df.shape[0] == 0:
        raise ValueError("文件为空或格式不正确")

    # Normalize first column as timestamp
    first_col = df.columns[0]
    df = df.rename(columns={first_col: "timestamp"})
    try:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    except Exception:
        pass

    columns = [str(c) for c in df.columns]
    # Convert rows to JSON-serializable lists
    rows: list[list[Any]] = []
    for _, row in df.head(100).iterrows():
        rows.append([_coerce(v) for v in row.tolist()])
    return columns, rows, df


def _coerce(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, float):
        if pd.isna(v):
            return None
        return v
    if pd.isna(v):
        return None
    if isinstance(v, (datetime,)):
        return v.isoformat()
    if hasattr(v, "isoformat"):
        try:
            return v.isoformat()
        except Exception:
            return str(v)
    return v


def df_to_points(df: pd.DataFrame, source_id: int) -> list[dict]:
    """Derive data_point definitions from dataframe columns (excluding timestamp)."""
    points = []
    for col in df.columns:
        if col == "timestamp":
            continue
        series = df[col]
        numeric = pd.to_numeric(series, errors="coerce")
        is_number = numeric.notna().sum() > len(series) * 0.5
        data_type = "NUMBER" if is_number else "STRING"
        base = float(numeric.mean()) if is_number and not numeric.isna().all() else 0.0
        points.append(
            {
                "source_id": source_id,
                "code": str(col),
                "name": str(col),
                "unit": None,
                "data_type": data_type,
                "industry": "通用",
                "process_stage": None,
                "device": None,
                "gen_base": base,
                "gen_amplitude": 1.0,
                "gen_period_s": 3600.0,
                "gen_noise": 0.1,
            }
        )
    return points
