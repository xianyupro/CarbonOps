"""WebSocket endpoint for real-time point value push (Mock-driven)."""
import asyncio
import random
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.config import settings
from app.core.security import decode_token, TOKEN_TYPE_ACCESS
from app.db.session import SessionLocal
from app.models.data import DataPoint
from app.mock.generator import TimeSeriesGenerator
from app.mock.industrial import runtime

router = APIRouter()


@router.websocket("/realtime")
async def realtime(websocket: WebSocket, token: str = Query(default="")):
    """Push latest mock values for subscribed point ids every WS_PUSH_INTERVAL_SECONDS."""
    # Auth via query token
    payload = decode_token(token) if token else None
    if not payload or payload.get("type") != TOKEN_TYPE_ACCESS:
        await websocket.accept()
        await websocket.send_json({"code": 401, "msg": "未认证"})
        await websocket.close()
        return

    await websocket.accept()
    # parse point_ids from query (also accept ?point_ids=)
    raw_ids = websocket.query_params.get("point_ids", "")
    try:
        point_ids = [int(x) for x in raw_ids.split(",") if x.strip().isdigit()]
    except Exception:
        point_ids = []

    if not point_ids:
        await websocket.send_json({"type": "info", "msg": "未订阅任何点位"})

    # ensure generators exist
    db = SessionLocal()
    try:
        for pid in point_ids:
            if not runtime.get(pid):
                p = db.get(DataPoint, pid)
                if p:
                    runtime.register(p.id, TimeSeriesGenerator(
                        base=p.gen_base, amplitude=p.gen_amplitude, period_s=p.gen_period_s,
                        noise=p.gen_noise, trend=p.gen_trend, data_type=p.data_type, seed=p.id,
                    ))
    finally:
        db.close()

    interval = settings.WS_PUSH_INTERVAL_SECONDS
    try:
        while True:
            now = datetime.utcnow()
            for pid in point_ids:
                gen = runtime.get(pid)
                if not gen:
                    continue
                quality = TimeSeriesGenerator.quality_at(random.Random())
                value = None if quality == "MISSING" else gen.value_at(now)
                await websocket.send_json({
                    "type": "point",
                    "pointId": pid,
                    "timestamp": now.isoformat(),
                    "value": value,
                    "quality": quality,
                })
            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        return
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass
