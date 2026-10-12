"""Pagination helpers."""
from math import ceil
from typing import Callable, Any
from sqlalchemy import select, func
from sqlalchemy.orm import Session


def paginate(
    db: Session,
    stmt,
    page: int = 1,
    page_size: int = 20,
    scaler: Callable[[Any], Any] | None = None,
):
    """Execute a select statement with limit/offset and return a page envelope dict.

    `stmt` should be a `select(Entity)` statement (with whatever filters/order already applied).
    """
    page = max(1, page)
    page_size = max(1, min(500, page_size))

    # Count total rows using a subquery of the same statement (without limit/offset)
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = db.scalar(count_stmt) or 0

    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()
    if scaler is not None:
        rows = [scaler(r) for r in rows]

    return {
        "list": rows,
        "meta": {
            "page": page,
            "pageSize": page_size,
            "total": total,
            "totalPages": ceil(total / page_size) if total else 0,
        },
    }
