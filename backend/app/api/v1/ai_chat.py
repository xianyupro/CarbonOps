"""AI 智能助手 API —— 会话管理与 SSE 流式对话。

对话接口返回 text/event-stream，事件格式：
  data: {"content": "增量文本"}  …  data: {"error": "错误信息"}  data: [DONE]
"""
import json
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, write_audit
from app.core.exceptions import BizError, NotFoundError
from app.core.response import ok
from app.db.session import SessionLocal, get_db
from app.models.ai_chat import AiChatMessage, AiChatSession
from app.models.auth import User
from app.schemas.ai_chat import (
    AiChatMessageOut,
    AiChatSend,
    AiChatSessionCreate,
    AiChatSessionOut,
    AiChatSessionRename,
)
from app.services import ai_chat_service
from app.services.ai_chat_service import ai_available

router = APIRouter()


def _session_out(s: AiChatSession) -> dict:
    return AiChatSessionOut.model_validate(s).model_dump(by_alias=True, mode="json")


def _message_out(m: AiChatMessage) -> dict:
    return AiChatMessageOut.model_validate(m).model_dump(by_alias=True, mode="json")


def _get_owned_session(db: Session, session_id: int, user: User) -> AiChatSession:
    s = db.get(AiChatSession, session_id)
    if not s or s.user_id != user.id:
        raise NotFoundError("会话不存在")
    return s


# ---------- 状态 ----------
@router.get("/status")
def status(_: User = Depends(get_current_user)):
    """AI 通道可用性与当前模型。"""
    return ok({"available": ai_available(), "model": settings.DEEPSEEK_MODEL})


# ---------- 会话管理 ----------
@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sessions = (
        db.execute(
            select(AiChatSession)
            .where(AiChatSession.user_id == user.id)
            .order_by(AiChatSession.updated_at.desc())
        )
        .scalars()
        .all()
    )
    return ok([_session_out(s) for s in sessions])


@router.post("/sessions")
def create_session(
    payload: AiChatSessionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = AiChatSession(user_id=user.id, title=(payload.title or "新对话").strip()[:200])
    db.add(s)
    db.commit()
    return ok(_session_out(s))


@router.get("/sessions/{session_id}")
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = _get_owned_session(db, session_id, user)
    messages = (
        db.execute(
            select(AiChatMessage).where(AiChatMessage.session_id == s.id).order_by(AiChatMessage.id)
        )
        .scalars()
        .all()
    )
    return ok({"session": _session_out(s), "messages": [_message_out(m) for m in messages]})


@router.put("/sessions/{session_id}/title")
def rename_session(
    session_id: int,
    payload: AiChatSessionRename,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = _get_owned_session(db, session_id, user)
    title = payload.title.strip()
    if not title:
        raise BizError("标题不能为空")
    s.title = title[:200]
    db.commit()
    return ok(_session_out(s))


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = _get_owned_session(db, session_id, user)
    db.delete(s)
    db.commit()
    write_audit(db, user, "DELETE", resource="ai_chat_session", detail=s.title)
    return ok({"deleted": True})


# ---------- 流式对话 ----------
@router.post("/sessions/{session_id}/chat")
async def session_chat(
    session_id: int,
    payload: AiChatSend,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = _get_owned_session(db, session_id, user)
    content = (payload.content or "").strip()
    if not content:
        raise BizError("消息内容不能为空")
    if not ai_available():
        raise BizError(
            "未配置 DEEPSEEK_API_KEY，AI 助手不可用；可在后端 .env 中配置后重试",
            code=4001,
        )

    # 落库用户消息 + 首条消息作为会话标题
    db.add(AiChatMessage(session_id=s.id, role="user", content=content))
    if s.title in ("", "新对话"):
        s.title = content[:50]
    s.updated_at = datetime.utcnow()
    db.commit()

    history = (
        db.execute(
            select(AiChatMessage).where(AiChatMessage.session_id == s.id).order_by(AiChatMessage.id)
        )
        .scalars()
        .all()
    )
    api_messages = ai_chat_service.build_api_messages(db, history)

    async def generate():
        full = ""
        error: str | None = None
        try:
            async for delta in ai_chat_service.stream_chat(api_messages):
                full += delta
                yield f"data: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"
        except BizError as e:
            error = e.msg
        except Exception as e:  # 网络/解析等未知异常
            error = f"AI 调用失败: {e}"
            json.dumps(error)  # 确保 error 文本可序列化

        if error:
            yield f"data: {json.dumps({'error': error}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

        # 流结束后用独立会话保存助手消息（请求级 db 依赖可能已关闭）
        if full:
            local = SessionLocal()
            try:
                local.add(AiChatMessage(session_id=s.id, role="assistant", content=full))
                row = local.get(AiChatSession, s.id)
                if row:
                    row.updated_at = datetime.utcnow()
                local.commit()
            except Exception:
                local.rollback()
                logger.exception("保存 AI 消息失败 session=%s", s.id)
            finally:
                local.close()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
