"""系统管理扩展（系统设置 / 数据库管理 / 定时任务）。"""
import os
import sqlite3
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pydantic.alias_generators import to_camel
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_permission, write_audit
from app.core.exceptions import BizError, NotFoundError
from app.core.response import ok
from app.db.session import get_db, engine
from app.models.auth import User
from app.models.system import SystemSetting

router = APIRouter()

BACKUP_DIR = Path("backups")
DB_PATH = Path("carbonops.db")

DEFAULT_SETTINGS = {
    "platform.name": "全流程低碳运行智能监测与调控系统平台",
    "platform.dimension": "",
    "data.retention_days": "365",
    "collect.ws_push_seconds": str(settings.WS_PUSH_INTERVAL_SECONDS),
    "collect.backfill_days": str(settings.TS_BACKFILL_DAYS),
    "backup.auto": "off",
    "backup.keep_count": "10",
}


# ---------- 系统设置 ----------
class SettingsUpdate(BaseModel):
    items: dict[str, str]


@router.get("/settings")
def get_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("system:user:read")),
):
    rows = db.execute(select(SystemSetting)).scalars().all()
    values = {r.key: r.value for r in rows}
    # 缺省项自动补齐
    for k, v in DEFAULT_SETTINGS.items():
        values.setdefault(k, v)
    return ok(values)


@router.put("/settings")
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("system:user:read", "studio:write")),
):
    for k, v in payload.items.items():
        row = db.scalar(select(SystemSetting).where(SystemSetting.key == k))
        if row:
            row.value = v
        else:
            db.add(SystemSetting(key=k, value=v, description=""))
    db.commit()
    write_audit(db, user, "UPDATE", resource="system_settings", detail=str(payload.items)[:200])
    return ok({"done": True})


# ---------- 数据库管理 ----------
@router.get("/db/stats")
def db_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("system:user:read")),
):
    tables = [
        r[0]
        for r in db.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        ).all()
    ]
    rows = []
    for t in tables:
        cnt = db.execute(text(f"SELECT COUNT(*) FROM [{t}]")).scalar()
        rows.append({"table": t, "rows": int(cnt)})
    size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
    return ok({
        "fileSize": size,
        "tables": rows,
        "backupDir": str(BACKUP_DIR),
    })


@router.get("/db/backups")
def list_backups(_: User = Depends(require_permission("system:user:read"))):
    BACKUP_DIR.mkdir(exist_ok=True)
    items = []
    for f in sorted(BACKUP_DIR.glob("*.db"), reverse=True):
        items.append({"name": f.name, "size": f.stat().st_size, "modifiedAt": datetime.fromtimestamp(f.stat().st_mtime).isoformat()})
    return ok(items)


@router.post("/db/backups")
def create_backup(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("studio:write")),
):
    """SQLite 在线备份（backup API，不锁库）。"""
    BACKUP_DIR.mkdir(exist_ok=True)
    name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    src = sqlite3.connect(str(DB_PATH))
    dst = sqlite3.connect(str(BACKUP_DIR / name))
    src.backup(dst)
    dst.close()
    src.close()
    write_audit(db, user, "CREATE", resource="db_backup", detail=name)
    return ok({"name": name, "size": (BACKUP_DIR / name).stat().st_size})


@router.delete("/db/backups/{name}")
def delete_backup(
    name: str,
    user: User = Depends(require_permission("studio:write")),
):
    if "/" in name or "\\" in name or not name.endswith(".db"):
        raise BizError("非法文件名")
    f = BACKUP_DIR / name
    if not f.exists():
        raise NotFoundError("备份不存在")
    f.unlink()
    write_audit(db, user, "DELETE", resource="db_backup", detail=name)
    return ok({"done": True})


@router.get("/db/backups/{name}/download")
def download_backup(
    name: str,
    _: User = Depends(require_permission("system:user:read")),
):
    if "/" in name or "\\" in name or not name.endswith(".db"):
        raise BizError("非法文件名")
    f = BACKUP_DIR / name
    if not f.exists():
        raise NotFoundError("备份不存在")
    return FileResponse(str(f), filename=name, media_type="application/octet-stream")


# ---------- 定时任务 ----------
@router.get("/tasks")
def list_tasks(_: User = Depends(require_permission("system:user:read"))):
    tasks = [
        {
            "key": "ws_push",
            "name": "实时数据 WebSocket 推送",
            "cycle": f"每 {settings.WS_PUSH_INTERVAL_SECONDS} 秒",
            "enabled": True,
            "description": "向在线客户端推送监测点位最新值",
        },
        {
            "key": "seed_backfill",
            "name": "启动时时序回填检查",
            "cycle": f"每次启动（回填 {settings.TS_BACKFILL_DAYS} 天）",
            "enabled": settings.SEED_ON_STARTUP,
            "description": "启动时对无数据的点位生成历史序列（幂等）",
        },
        {
            "key": "backup_auto",
            "name": "数据库自动备份",
            "cycle": "未启用（在系统设置中开启）",
            "enabled": DEFAULT_SETTINGS.get("backup.auto") == "on",
            "description": "按周期对 SQLite 数据库做在线备份",
        },
    ]
    return ok(tasks)
