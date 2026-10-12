"""导入 1 号挥发窑现场数据（8 天 × 58 列 CSV）到数据基座。

- 新建数据源「1号挥发窑（现场数据）」
- 每个数据列登记为一个点位（ARRAY 列标记 data_type=ARRAY，存 value_text）
- 时序批量入库（~180 万行，分块 executemany）
- 幂等：该数据源已有点位且时序非空时跳过（--force 重建）

用法：
    cd backend && .venv/Scripts/python.exe scripts/import_kiln_data.py [--force]
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, func, text  # noqa: E402

from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.data import DataPoint, DataSource, TimeSeries  # noqa: E402

ARRAY_RE = re.compile(r"\[\[.*\]\]")


def load_frames(files: list[Path]) -> pd.DataFrame:
    """逐行解析 CSV。温度场数组列未加引号（内含逗号），先摘出 [[...]] 再切分。"""
    header: list[str] | None = None
    rows: list[list[str]] = []
    for f in files:
        with open(f, encoding="utf-8-sig") as fh:
            for line in fh:
                line = line.rstrip("\r\n")
                if not line.strip():
                    continue
                arr = None
                m = ARRAY_RE.search(line)
                if m:
                    arr = m.group(0)
                    line = line[: m.start()] + "__ARR__" + line[m.end() :]
                fields = [x.strip() for x in line.split(",")]
                if header is None:
                    header = fields
                    continue
                if fields and fields[0] == "日期":
                    continue  # 后续文件的表头行
                if len(fields) < len(header):
                    fields += [""] * (len(header) - len(fields))
                elif len(fields) > len(header):
                    fields = fields[: len(header)]
                if arr is not None:
                    fields[fields.index("__ARR__")] = arr
                rows.append(fields)
    return pd.DataFrame(rows, columns=header or [])

DATA_DIR = Path(
    r"D:\工作项目\中南大学-韩洁-全流程低碳运行智能监测与调控系统平台\1号挥发窑数据"
)
SOURCE_NAME = "1号挥发窑（现场数据）"

# 列前缀 → (工序, 设备)
PREFIX_META = {
    "监测": ("挥发窑工况", "挥发窑本体"),
    "控制01": ("挥发窑控制", "给料/窑温控制回路"),
    "计算点01": ("挥发窑计算点", "边缘计算服务"),
}

# 特殊列单位
UNIT_HINTS = {
    "温度": "℃", "压力": "kPa", "流量": "Nm³/h", "频率": "Hz",
    "电流": "A", "液位": "mm", "料位": "mm", "开度": "%",
    "浓度": "%", "热值": "kJ/kg", "含水率": "%", "CO浓度": "%",
}


def _unit_for(col: str) -> str:
    for key, unit in UNIT_HINTS.items():
        if key in col:
            return unit
    return None


def ensure_value_text_column() -> None:
    """SQLite 轻量迁移：time_series 补 value_text 列。"""
    cols = [r[1] for r in engine.connect().execute(text("PRAGMA table_info(time_series)"))]
    if "value_text" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE time_series ADD COLUMN value_text TEXT"))
        print("已为 time_series 添加 value_text 列")


def main(force: bool = False) -> None:
    ensure_value_text_column()
    db = SessionLocal()
    try:
        source = db.scalar(select(DataSource).where(DataSource.name == SOURCE_NAME))
        if source is None:
            source = DataSource(
                name=SOURCE_NAME, code="KILN_01_FIELD", protocol="OPC_UA", status="CONNECTED",
                description="1号挥发窑现场采集数据（2026-05-13 ~ 2026-05-20，58 列，含工况/控制/计算点）",
                industry="有色",
            )
            db.add(source)
            db.flush()
            print(f"已创建数据源 #{source.id} {SOURCE_NAME}")

        point_count = db.scalar(
            select(func.count()).select_from(DataPoint).where(DataPoint.source_id == source.id)
        )
        ts_count = db.scalar(
            select(func.count()).select_from(TimeSeries)
            .join(DataPoint, DataPoint.id == TimeSeries.point_id)
            .where(DataPoint.source_id == source.id)
        )
        if point_count and ts_count and not force:
            print(f"数据源已有 {point_count} 点位 / {ts_count} 条时序，跳过（--force 重建）")
            return
        if force:
            db.query(TimeSeries).filter(
                TimeSeries.point_id.in_(
                    select(DataPoint.id).where(DataPoint.source_id == source.id)
                )
            ).delete(synchronize_session=False)
            db.query(DataPoint).filter(DataPoint.source_id == source.id).delete()
            db.commit()
            print("已清空旧点位与时序（force）")

        # 读取全部 CSV
        files = sorted(DATA_DIR.glob("*/1号挥发窑.csv"))
        if not files:
            print(f"未找到数据文件: {DATA_DIR}")
            return
        df = load_frames(files)
        df["ts"] = pd.to_datetime(
            df["日期"].astype(str) + " " + df["时间"].astype(str), format="%Y-%m-%d %H:%M:%S"
        )
        value_cols = [c for c in df.columns if c not in ("日期", "时间", "ts")]
        print(f"共 {len(files)} 天 {len(df)} 行，{len(value_cols)} 个数据列")

        # 登记点位
        points = {}
        for col in value_cols:
            sample = df[col].dropna().head(20)
            is_array = any(isinstance(v, str) and v.strip().startswith("[[") for v in sample)
            is_bool_col = sample.map(lambda v: isinstance(v, bool)).all() if len(sample) else False
            prefix = col.split(".")[0]
            stage, device = PREFIX_META.get(prefix, ("挥发窑工况", "挥发窑本体"))
            dtype = "ARRAY" if is_array else ("BOOLEAN" if is_bool_col else "NUMBER")
            p = DataPoint(
                source_id=source.id,
                code=col,
                name=col.split(".", 1)[1] if "." in col else col,
                unit=None if is_array or is_bool_col else _unit_for(col),
                data_type=dtype,
                industry="有色",
                process_stage=stage,
                device=device,
                description=f"1号挥发窑现场点位（{col}）",
            )
            db.add(p)
            points[col] = p
        db.flush()
        print(f"已登记 {len(points)} 个点位")

        # 批量写时序
        buffer: list[tuple] = []
        total = 0
        ts_values = df["ts"].tolist()
        for col in value_cols:
            p = points[col]
            series = df[col]
            for i, raw in enumerate(series):
                if pd.isna(raw):
                    continue
                if isinstance(raw, str):
                    s = raw.strip()
                    if not s or s in (",", "''"):
                        continue
                    if s.startswith("[["):
                        buffer.append((p.id, ts_values[i].to_pydatetime(), None, s, "GOOD"))
                    elif s in ("True", "False"):
                        buffer.append((p.id, ts_values[i].to_pydatetime(), 1.0 if s == "True" else 0.0, None, "GOOD"))
                    else:
                        try:
                            buffer.append((p.id, ts_values[i].to_pydatetime(), float(s), None, "GOOD"))
                        except ValueError:
                            buffer.append((p.id, ts_values[i].to_pydatetime(), None, s, "GOOD"))
                elif isinstance(raw, bool):
                    buffer.append((p.id, ts_values[i].to_pydatetime(), 1.0 if raw else 0.0, None, "GOOD"))
                else:
                    buffer.append((p.id, ts_values[i].to_pydatetime(), float(raw), None, "GOOD"))

                if len(buffer) >= 20000:
                    db.execute(
                        TimeSeries.__table__.insert(),
                        [
                            {"point_id": b[0], "timestamp": b[1], "value": b[2], "value_text": b[3], "quality": b[4]}
                            for b in buffer
                        ],
                    )
                    total += len(buffer)
                    print(f"  已写入 {total} 条…")
                    buffer = []
        if buffer:
            db.execute(
                TimeSeries.__table__.insert(),
                [
                    {"point_id": b[0], "timestamp": b[1], "value": b[2], "value_text": b[3], "quality": b[4]}
                    for b in buffer
                ],
            )
            total += len(buffer)
        db.commit()
        print(f"导入完成：{len(points)} 点位 / {total} 条时序记录")
    finally:
        db.close()


if __name__ == "__main__":
    main(force="--force" in sys.argv)
