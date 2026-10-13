"""AI 助手对话服务 —— 基于 DeepSeek（OpenAI 兼容协议）的流式对话通道。

与 kg_ai_service 同一套配置（DEEPSEEK_*）；未配置 API key 时抛 BizError，
前端给出可读提示。system prompt 注入平台资产统计，使助手具备平台状态感知。
"""
import json
import logging

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import BizError
from app.models.ai_chat import AiChatMessage
from app.models.data import DataPoint, DataSource
from app.models.kg import KgNode
from app.models.metamodel import Metamodel
from app.models.platform import Alarm

logger = logging.getLogger("carbonops.ai_chat")

# 送入模型的上下文窗口：最近 N 条消息
HISTORY_LIMIT = 20


def ai_available() -> bool:
    return bool(settings.DEEPSEEK_API_KEY)


def build_system_prompt(db: Session) -> str:
    """构建带平台资产统计感知的系统提示词。"""
    source_count = db.scalar(select(func.count()).select_from(DataSource)) or 0
    point_count = db.scalar(select(func.count()).select_from(DataPoint)) or 0
    active_alarms = (
        db.scalar(select(func.count()).select_from(Alarm).where(Alarm.status != "RESOLVED")) or 0
    )
    metamodel_count = db.scalar(select(func.count()).select_from(Metamodel)) or 0
    kg_node_count = db.scalar(select(func.count()).select_from(KgNode)) or 0

    return f"""你是 CarbonOps 智能助手，服务于「全流程低碳运行智能监测与调控系统平台」，是面向工业碳减排领域的专业 AI 顾问。

你的能力与职责：
1. **低碳领域问答** — 工业碳排放核算、能耗监测、清洁生产、余热回收、碳交易等专业知识；
2. **平台使用指导** — 平台按四层架构组织：①数据基座（数据源/导入/点位/质量）→ ②元模型平台（元模型/知识图谱）→ ③组件平台（模型库/控制流）→ ④驾驶舱中心（可视化/数字孪生/告警）；
3. **数据分析建议** — 结合平台资产状况，建议用户如何查询数据、配置模型、搭建监控画面；
4. **行业场景咨询** — 钢铁、有色、石化、建材、电力等行业的低碳运行策略。

当前平台资产概况（回答时可参考）：
- 数据源 {source_count} 个，采集点位 {point_count} 个
- 元模型 {metamodel_count} 个，知识图谱节点 {kg_node_count} 个
- 未闭环告警 {active_alarms} 条

回答要求：
- 用专业但易懂的中文，适当使用 Markdown（加粗、列表、表格、代码块）；
- 涉及数据/操作建议时，指引用户到对应模块（如「数据基座 → 数据查询」）；
- 不确定的内容如实说明，不要编造平台中不存在的功能。"""


def build_api_messages(db: Session, history: list[AiChatMessage]) -> list[dict]:
    """system prompt + 最近 HISTORY_LIMIT 条历史消息。"""
    recent = history[-HISTORY_LIMIT:]
    return [
        {"role": "system", "content": build_system_prompt(db)},
        *[{"role": m.role, "content": m.content} for m in recent],
    ]


async def stream_chat(api_messages: list[dict]):
    """调用 DeepSeek 流式接口，逐段 yield 增量文本。

    失败时抛 BizError（HTTP 错误）或原样抛出网络异常，由调用方兜底。
    """
    if not ai_available():
        raise BizError(
            "未配置 DEEPSEEK_API_KEY，AI 助手不可用；可在后端 .env 中配置后重试",
            code=4001,
        )

    async with httpx.AsyncClient(timeout=180) as client:
        async with client.stream(
            "POST",
            f"{settings.DEEPSEEK_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}"},
            json={
                "model": settings.DEEPSEEK_MODEL,
                "messages": api_messages,
                "stream": True,
                "temperature": 0.7,
            },
        ) as resp:
            if resp.status_code != 200:
                body = (await resp.aread()).decode("utf-8", errors="replace")[:200]
                logger.warning("DeepSeek HTTP %s: %s", resp.status_code, body)
                raise BizError(f"AI 服务返回错误: {resp.status_code}")

            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if not payload or payload == "[DONE]":
                    if payload == "[DONE]":
                        break
                    continue
                try:
                    delta = json.loads(payload)["choices"][0]["delta"].get("content")
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
                if delta:
                    yield delta
