"""AI 三元组提取服务 —— 知识图谱的 AI 生产通道。

调用 DeepSeek（OpenAI 兼容协议）从工业文本中提取 (实体, 关系, 实体) 三元组。
未配置 API key 时抛 BizError，前端给出可读提示；图谱其余功能不受影响。
"""
import json
import logging

import httpx

from app.core.config import settings
from app.core.exceptions import BizError

logger = logging.getLogger("carbonops.kg_ai")

_SYSTEM_PROMPT = """你是面向有色金属冶炼工业的知识图谱构建专家。给定一段工艺文本，提取其中的实体与关系，输出严格的 JSON。

实体 category 从以下选择（可适度新增贴合文本的类型）：
工艺流程、工艺步骤、工艺参数、性能指标、原料、产品、副产物、杂质元素、设备、区域、岗位、领域概念、环保措施、安全措施

关系 relation_type 从以下选择（可新增）：
包含、包含步骤、前驱工序、后续工艺、使用原料、产出、涉及杂质、依赖参数、控制参数、衡量指标、影响、脱除、去除、替代工艺、关联工艺、位于、监测、调控

输出格式（不要输出任何其他文字）：
{"nodes": [{"name": "...", "category": "...", "description": "...", "source_text": "支撑该实体的原文句子"}],
 "edges": [{"source": "实体1名称", "target": "实体2名称", "relation_type": "...", "weight": 1.0}]}

要求：
1. 只提取文本中明确提及的内容，不要编造；
2. source_text 必须摘自原文；
3. 实体名称保持原文写法（如 砷(As)、回转挥发窑）；
4. 尽量多提取有意义的关系，孤立的实体价值低。"""


def ai_available() -> bool:
    return bool(settings.DEEPSEEK_API_KEY)


async def extract_triples(text: str) -> dict:
    """调用 DeepSeek 提取三元组，返回 {"nodes": [...], "edges": [...]}。

    兼容 OpenAI chat.completions 协议；失败时抛 BizError。
    """
    if not ai_available():
        raise BizError(
            "未配置 DEEPSEEK_API_KEY，AI 提取通道不可用；可在后端 .env 中配置后重试",
            code=4001,
        )
    if not text or not text.strip():
        raise BizError("提取文本为空")

    # 分块：每块约 3000 字，避免超出上下文
    chunks = [text[i : i + 3000] for i in range(0, len(text), 3000)][:6]
    nodes: list[dict] = []
    edges: list[dict] = []
    seen_names: set[str] = set()

    async with httpx.AsyncClient(timeout=90) as client:
        for chunk in chunks:
            try:
                resp = await client.post(
                    f"{settings.DEEPSEEK_BASE_URL}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}"},
                    json={
                        "model": settings.DEEPSEEK_MODEL,
                        "messages": [
                            {"role": "system", "content": _SYSTEM_PROMPT},
                            {"role": "user", "content": chunk},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 4000,
                        "response_format": {"type": "json_object"},
                    },
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
                data = json.loads(content)
            except httpx.HTTPStatusError as e:
                logger.warning("DeepSeek HTTP %s: %s", e.response.status_code, e.response.text[:200])
                raise BizError(f"AI 服务返回错误: {e.response.status_code}")
            except (httpx.HTTPError, KeyError, json.JSONDecodeError) as e:
                logger.warning("DeepSeek 调用失败: %s", e)
                continue  # 单块失败跳过，不整体失败

            for n in data.get("nodes", []):
                name = (n.get("name") or "").strip()
                if not name or name in seen_names:
                    continue
                seen_names.add(name)
                nodes.append(
                    {
                        "name": name,
                        "category": (n.get("category") or "领域概念").strip(),
                        "description": n.get("description") or "",
                        "source_text": n.get("source_text") or "",
                    }
                )
            edges.extend(data.get("edges", []))

    if not nodes:
        raise BizError("AI 未从文本中提取到有效实体，请更换或扩充文本")

    # 过滤掉指向不存在实体的边
    edges = [
        e for e in edges
        if e.get("source") in seen_names and e.get("target") in seen_names and e.get("relation_type")
    ]
    return {"nodes": nodes, "edges": edges}
