"""元模型 AI 服务 —— AI 深度介入元模型业务的三个通道。

1. 目录感知：把平台已登记的元模型目录注入聊天 system prompt（build_catalog_context）；
2. 生成草稿：自然语言描述 → 完整八节结构元模型 JSON（generate_draft，不落库）；
3. 分析解读：对已登记元模型生成结构化解读报告（analyze，只读）。

统一走 DeepSeek（OpenAI 兼容协议，同 kg_ai_service / ai_chat_service）。
"""
import json
import logging

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import BizError
from app.models.metamodel import MODEL_TYPE_LABELS, Metamodel

logger = logging.getLogger("carbonops.metamodel_ai")

# 聊天目录最多注入条数，避免超出上下文
CATALOG_LIMIT = 20


def ai_available() -> bool:
    return bool(settings.DEEPSEEK_API_KEY)


async def _chat_json(system_prompt: str, user_prompt: str, temperature: float = 0.4) -> dict:
    """调用 DeepSeek 返回 JSON 对象。失败抛 BizError。"""
    if not ai_available():
        raise BizError(
            "未配置 DEEPSEEK_API_KEY，AI 通道不可用；可在后端 .env 中配置后重试",
            code=4001,
        )
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{settings.DEEPSEEK_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}"},
                json={
                    "model": settings.DEEPSEEK_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": 4000,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    except httpx.HTTPStatusError as e:
        logger.warning("DeepSeek HTTP %s: %s", e.response.status_code, e.response.text[:200])
        raise BizError(f"AI 服务返回错误: {e.response.status_code}")
    except (httpx.HTTPError, KeyError, json.JSONDecodeError) as e:
        logger.warning("DeepSeek 调用失败: %s", e)
        raise BizError("AI 返回内容无法解析，请调整描述后重试")


# ---------- 1. 目录感知（聊天 system prompt 注入） ----------

def build_catalog_context(db: Session) -> str:
    """已登记元模型目录（截断），供聊天 system prompt 使用。"""
    rows = db.execute(
        select(Metamodel).order_by(Metamodel.id.desc()).limit(CATALOG_LIMIT)
    ).scalars().all()
    if not rows:
        return "（平台暂无已登记元模型）"
    lines = []
    for m in rows:
        io_count = len(m.io_params or [])
        purpose = (m.purpose or "").strip().replace("\n", " ")[:40]
        lines.append(
            f"- {m.meta_code} {m.name}（{MODEL_TYPE_LABELS.get(m.model_type, m.model_type)}·"
            f"{m.industry}·{m.status}，{io_count} 个参数）：{purpose}"
        )
    total = db.scalar(select(func.count()).select_from(Metamodel))
    suffix = f"\n（共 {total} 个，仅列出最近 {len(rows)} 个）" if total and total > len(rows) else ""
    return "\n".join(lines) + suffix


# ---------- 2. 生成草稿 ----------

_DRAFT_SYSTEM_PROMPT = """你是工业元模型登记专家，精通《元模型交付模板》的八节结构。
根据用户的自然语言描述，生成一个完整、专业的工业元模型 JSON 草稿。

modelType 必须是以下之一：
- MECHANISM 机理模型（方程/守恒/传递关系）
- DATA_MODEL 数据模型（统计学习/回归/网络）
- ALGORITHM 算法模型（运筹优化/进化/搜索）
- KNOWLEDGE_RULE 知识规则模型（规则库/模糊推理）

输出严格 JSON（camelCase 键，不要输出任何其他文字）：
{
  "name": "模型名称，命名如 XX机理模型",
  "modelType": "MECHANISM|DATA_MODEL|ALGORITHM|KNOWLEDGE_RULE",
  "domain": "通用|有色|石化|钢铁 之一",
  "hierarchy": "层级，如 设备输入输出模型",
  "purpose": "功能/用途，1-2 句",
  "methodStructure": "方法/结构特征，如 稳态、确定性；等效参数",
  "versionNo": "1.0.0",
  "maturity": "成熟度，如 试验室验证 / 工业试点",
  "keywords": ["关键词", "..."],
  "scopeObject": "对象/粒度，如 回转挥发窑；单窑体稳态工况",
  "sourceOwnership": "来源/权属，如 平台生成",
  "authorMaintainer": "AI 辅助生成",
  "namingRule": "1.0：域_对象_类别_任务_方法；编号 CSU-行业-类别-6位序号",
  "sceneDomain": "场景/有效域描述",
  "assumptions": "A1 …；A2 …；A3 …（假设/边界，至少 2 条）",
  "limitsPrecision": "限制/精度说明",
  "structureFlow": ["环节1（如 输入变量→中间量）", "环节2", "环节3"],
  "coreRelations": [{"id": "E(1)", "expression": "数学/逻辑关系式", "note": "符号说明"}],
  "ioParams": [{"category": "输入|参数|输出传参|输出", "symbol": "如 T_in", "dtype": "float; 标量",
                "dim": "1", "unit": "℃", "rangeRequired": "取值范围；必需/可选",
                "exampleDefault": "示例值；无缺省", "sourceMeaning": "物理含义/来源"}],
  "methodFlow": "计算/推理流程描述",
  "entryInterface": "如 predict(inputs, params) → dict",
  "exceptionBehavior": "异常处理/性能说明",
  "envMaterials": "平台托管运行：Python 3.11 + FastAPI；无需独立部署包",
  "sourceManifest": "模块清单说明",
  "deliveryRepro": "交付/复现说明",
  "deployCombination": "部署/组合方式",
  "validationBaseline": "基准/交叉验证方式",
  "validationLimits": "极限/确认条件",
  "status": "DEVELOPING",
  "industry": "通用|有色|石化|钢铁 之一",
  "processStage": "工序阶段",
  "tags": ["标签"],
  "initialChangelog": "AI 辅助生成初始草稿"
}

要求：
1. ioParams 至少 3 条且必须覆盖输入与输出，category 只能取：输入/参数/输出传参/输出；
2. coreRelations 至少 1 条，expression 用真实数学表达式（可用 LaTeX 记号）；
3. 用户描述中未提及的字段按行业惯例合理补全，不要留空；
4. 物理量单位、取值范围要符合行业常识。"""


def _normalize_draft(raw: dict, fallback_type: str | None) -> dict:
    """校验并规整 AI 草稿：必填字段、枚举值、数组结构。"""
    name = (raw.get("name") or "").strip()
    if not name:
        raise BizError("AI 生成的草稿缺少模型名称，请补充描述后重试")

    model_type = raw.get("modelType") or fallback_type or "MECHANISM"
    if model_type not in MODEL_TYPE_LABELS:
        model_type = fallback_type or "MECHANISM"

    io_params = raw.get("ioParams")
    if not isinstance(io_params, list):
        io_params = []
    clean_io = []
    for p in io_params:
        if not isinstance(p, dict) or not p.get("symbol"):
            continue
        cat = p.get("category") or "输入"
        if cat not in ("输入", "参数", "输出传参", "输出"):
            cat = "输入"
        clean_io.append({**p, "category": cat})
    if not clean_io:
        raise BizError("AI 生成的草稿缺少变量参数定义，请补充描述后重试")

    relations = raw.get("coreRelations")
    if not isinstance(relations, list) or not relations:
        relations = [{"id": "E(1)", "expression": "", "note": ""}]
    clean_rel = []
    for i, r in enumerate(relations, 1):
        if isinstance(r, str):
            r = {"id": f"E({i})", "expression": r, "note": ""}
        if isinstance(r, dict) and r.get("expression"):
            clean_rel.append({"id": r.get("id") or f"E({i})", "expression": r["expression"], "note": r.get("note") or ""})

    flow = raw.get("structureFlow")
    if not isinstance(flow, list):
        flow = []
    flow = [str(s) for s in flow if str(s).strip()] or ["输入处理", "核心计算", "输出构造"]

    keywords = raw.get("keywords")
    keywords = [str(k) for k in keywords if str(k).strip()] if isinstance(keywords, list) else []

    return {
        "name": name[:160],
        "modelType": model_type,
        "domain": raw.get("domain") if raw.get("domain") in ("通用", "有色", "石化", "钢铁") else "通用",
        "hierarchy": raw.get("hierarchy") or "",
        "purpose": raw.get("purpose") or "",
        "methodStructure": raw.get("methodStructure") or "",
        "versionNo": raw.get("versionNo") or "1.0.0",
        "maturity": raw.get("maturity") or "",
        "keywords": keywords,
        "scopeObject": raw.get("scopeObject") or "",
        "sourceOwnership": raw.get("sourceOwnership") or "平台生成",
        "authorMaintainer": raw.get("authorMaintainer") or "AI 辅助生成",
        "namingRule": raw.get("namingRule") or "1.0：域_对象_类别_任务_方法；编号 CSU-行业-类别-6位序号",
        "sceneDomain": raw.get("sceneDomain") or "",
        "assumptions": raw.get("assumptions") or "",
        "limitsPrecision": raw.get("limitsPrecision") or "",
        "structureFlow": flow,
        "coreRelations": clean_rel,
        "ioParams": clean_io,
        "methodFlow": raw.get("methodFlow") or "",
        "entryInterface": raw.get("entryInterface") or "",
        "exceptionBehavior": raw.get("exceptionBehavior") or "",
        "envMaterials": raw.get("envMaterials") or "平台托管运行：Python 3.11 + FastAPI；无需独立部署包",
        "sourceManifest": raw.get("sourceManifest") or "",
        "deliveryRepro": raw.get("deliveryRepro") or "",
        "deployCombination": raw.get("deployCombination") or "",
        "validationBaseline": raw.get("validationBaseline") or "",
        "validationLimits": raw.get("validationLimits") or "",
        "status": "DEVELOPING",
        "industry": raw.get("industry") if raw.get("industry") in ("通用", "有色", "石化", "钢铁") else "通用",
        "processStage": raw.get("processStage") or "",
        "tags": [str(t) for t in raw.get("tags", []) if str(t).strip()] if isinstance(raw.get("tags"), list) else [],
        "initialChangelog": raw.get("initialChangelog") or "AI 辅助生成初始草稿",
    }


async def generate_draft(db: Session, description: str, model_type: str | None = None) -> dict:
    """自然语言 → 元模型草稿（camelCase，与登记表单 MetamodelPayload 同构）。不落库。"""
    if not description or not description.strip():
        raise BizError("请提供元模型描述")
    # 注入同类型已有模型，帮助 AI 避免重复/贴合命名惯例
    existing = db.execute(
        select(Metamodel.name, Metamodel.meta_code)
        .where(Metamodel.model_type == (model_type or Metamodel.model_type))
        .order_by(Metamodel.id.desc())
        .limit(5)
    ).all()
    exist_note = "；".join(f"{c} {n}" for n, c in existing) if existing else "（暂无）"
    user_prompt = (
        f"当前登记类型：{model_type or '未指定（请按描述选择最合适的类型）'}\n"
        f"平台已有的同类型元模型（避免重复，命名风格保持一致）：{exist_note}\n\n"
        f"用户描述：\n{description.strip()[:2000]}"
    )
    raw = await _chat_json(_DRAFT_SYSTEM_PROMPT, user_prompt)
    return _normalize_draft(raw, model_type)


# ---------- 3. 分析解读 ----------

_ANALYZE_SYSTEM_PROMPT = """你是工业元模型评审专家。给定一个按《元模型交付模板》八节结构登记的元模型 JSON，
输出一份中文 Markdown 解读报告，必须包含以下小节（用 ## 二级标题）：

## 模型概览（用途、类别、对象粒度，3-4 句）
## 适用场景与边界（结合场景/假设/限制，指出什么工况下可用、什么工况不可用）
## 变量与关系解读（关键输入输出参数的物理含义、核心关系式的意义）
## 完整度评估（逐节检查信息缺失情况，给出 ✅/⚠️ 标记与补全建议）
## 接入建议（如何配置输入输出接入平台数据基座，入口接口如何调用）
## 风险与改进（外推风险、维护建议）

要求：专业、具体、直接引用模型中的参数符号与数值；不要空话套话；总长 600-900 字。"""


async def analyze(db: Session, m: Metamodel) -> str:
    """对已登记元模型生成解读报告（markdown 字符串）。"""
    payload = {
        "基本信息": {
            "编号": m.meta_code, "名称": m.name,
            "类别": MODEL_TYPE_LABELS.get(m.model_type, m.model_type),
            "行业": m.industry, "状态": m.status, "版本": m.version_no,
            "层级": m.hierarchy, "对象粒度": m.scope_object,
            "用途": m.purpose, "方法结构": m.method_structure,
        },
        "适用范围": {"场景有效域": m.scene_domain, "假设边界": m.assumptions, "限制精度": m.limits_precision},
        "结构关系": {"流程标签链": m.structure_flow, "核心关系式": m.core_relations},
        "变量参数": m.io_params,
        "接口与交付": {
            "方法流程": m.method_flow, "入口响应": m.entry_interface,
            "异常性能": m.exception_behavior, "交付复现": m.delivery_repro,
        },
        "验证": {"基准交叉": m.validation_baseline, "极限确认": m.validation_limits},
    }
    user_prompt = json.dumps(payload, ensure_ascii=False, default=str)[:8000]
    if not ai_available():
        raise BizError(
            "未配置 DEEPSEEK_API_KEY，AI 通道不可用；可在后端 .env 中配置后重试",
            code=4001,
        )
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{settings.DEEPSEEK_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}"},
                json={
                    "model": settings.DEEPSEEK_MODEL,
                    "messages": [
                        {"role": "system", "content": _ANALYZE_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.4,
                    "max_tokens": 3000,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        logger.warning("DeepSeek HTTP %s: %s", e.response.status_code, e.response.text[:200])
        raise BizError(f"AI 服务返回错误: {e.response.status_code}")
    except (httpx.HTTPError, KeyError) as e:
        logger.warning("DeepSeek 调用失败: %s", e)
        raise BizError("AI 解读生成失败，请稍后重试")
