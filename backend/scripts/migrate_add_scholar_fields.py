"""元模型学术深化：为 metamodels 表补 4 个学术字段（幂等，可重跑）。

新增列：
    validation_metrics  JSON  量化验证指标 [{metric, value, unit, dataset, note}]
    uncertainty         TEXT  不确定度/置信水平说明
    training_data       TEXT  训练与验证数据来源
    references          JSON  参考文献 [{authors, title, venue, year, doi}]

新库由 Base.metadata.create_all 直接建列；本脚本只处理已存在的旧库。

用法：
    cd backend && .venv/Scripts/python.exe scripts/migrate_add_scholar_fields.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402

from app.db.session import engine  # noqa: E402

COLUMNS = [
    ("validation_metrics", "JSON"),
    ("uncertainty", "TEXT"),
    ("training_data", "TEXT"),
    ("references", "JSON"),
]


def main() -> None:
    cols = [r[1] for r in engine.connect().execute(text("PRAGMA table_info(metamodels)"))]
    missing = [(name, ddl) for name, ddl in COLUMNS if name not in cols]
    if not missing:
        print("metamodels 学术字段已齐全，无需迁移")
        return
    with engine.begin() as conn:
        for name, ddl in missing:
            # references 是 SQL 保留字（FOREIGN KEY ... REFERENCES），标识符必须加引号
            conn.execute(text(f'ALTER TABLE metamodels ADD COLUMN "{name}" {ddl}'))
            print(f"已添加列 metamodels.{name} {ddl}")
    print(f"迁移完成：共补 {len(missing)} 列")


if __name__ == "__main__":
    main()
