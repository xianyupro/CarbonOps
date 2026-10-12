"""控制流执行引擎（仿真执行模式）。

借鉴 ApexMotion 的语义并按 Web 场景简化：
- 沿控制边链式推进（Start 节点入度 0 开始），同一出口多条线顺序分叉
- condition 节点：表达式求值选 真/假 出口
- circulate 节点：循环 N 轮（调度层面重放循环体）
- 绑定解析优先级：常量 → "$变量" → "节点Id.输出引脚"（未绑定取默认值）
- 仿真边界：设备调控类输出只记录不下发；元模型调用计入调用统计
"""
from __future__ import annotations

import re
import time
from datetime import datetime, timedelta
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.data import DataPoint, TimeSeries
from app.models.flow import ComponentDef, FlowRun
from app.models.metamodel import Metamodel
from app.models.platform import Alarm

def _eval_condition(expression: str, value: Any) -> bool:
    """安全的条件表达式求值：仅允许 value 标识符、数字、比较与逻辑运算符。"""
    expr = (expression or "value > 0").strip()
    # 注意：不能加 \b —— 运算符(>/==)后面常跟空格，词边界会匹配失败
    pattern = re.compile(r"\s*(>=|<=|==|!=|and|or|>|<|\(|\)|-?\d+(?:\.\d+)?|value)")
    tokens: list[str] = []
    pos = 0
    while pos < len(expr):
        m = pattern.match(expr, pos)
        if not m:
            raise ValueError(f"条件表达式含非法字符: {expr[pos:pos+10]!r}")
        tok = m.group(1)
        if tok == "value":
            tokens.append(repr(float(value) if value is not None else 0.0))
        else:
            tokens.append(tok)
        pos = m.end()
    result = eval(" ".join(tokens), {"__builtins__": {}}, {})  # noqa: S307 - 白名单化后求值
    return bool(result)


def _to_series(raw: Any) -> list[tuple[datetime | None, float]]:
    """把输入统一为 [(ts, value)] 数组；跳过缺失/非数值采样。"""
    if isinstance(raw, list) and raw:
        out: list[tuple[datetime | None, float]] = []
        for item in raw:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                try:
                    out.append((item[0], float(item[1])))
                except (TypeError, ValueError):
                    continue
            elif isinstance(item, (int, float)):
                out.append((None, float(item)))
        return out
    return []


class FlowEngine:
    """单次执行的引擎实例（每 Run 一个，配置进实例而非全局）。"""

    def __init__(self, db: Session, graph: dict, variables: dict[str, Any] | None = None):
        self.db = db
        self.graph = graph
        self.variables = dict(variables or {})
        self.node_outputs: dict[str, dict[str, Any]] = {}
        self.logs: list[dict] = []
        self._executed: set[str] = set()
        self._running: set[str] = set()

        self.nodes: dict[str, dict] = {n["id"]: n for n in graph.get("nodes", [])}
        self.edges: list[dict] = graph.get("edges", [])
        self.components: dict[str, ComponentDef] = {
            c.code: c for c in db.execute(select(ComponentDef)).scalars().all()
        }

    # ---------- 绑定解析 ----------
    def _resolve_param(self, node: dict, key: str, schema: dict) -> tuple[Any, str | None]:
        """返回 (值, 来源描述)。优先级：绑定 > 手填常量 > 默认值。"""
        binding = (node.get("bindings") or {}).get(key)
        params = node.get("params") or {}
        if binding:
            if binding.startswith("$"):
                var_name = binding[1:]
                if var_name in self.variables:
                    return self.variables[var_name], f"变量 {var_name}"
                raise ValueError(f"流程变量 {var_name} 不存在")
            # "节点Id.输出引脚"
            if "." in binding:
                src_node, out_key = binding.split(".", 1)
                if src_node not in self.node_outputs:
                    # 惰性求值：数据源型节点（工件/常量/点位）无控制入边时按需执行
                    if src_node in self.nodes and src_node not in self._running:
                        self._execute_node(src_node)
                    else:
                        raise ValueError(f"绑定源节点 {src_node} 尚未执行")
                src_outputs = self.node_outputs.get(src_node)
                if src_outputs is None or out_key not in src_outputs:
                    raise ValueError(f"绑定源 {src_node}.{out_key} 无效")
                return (
                    src_outputs[out_key],
                    f"← {self.nodes.get(src_node, {}).get('name', src_node)}.{out_key}",
                )
            raise ValueError(f"绑定协议不合法: {binding}")
        val = params.get(key, schema.get("default"))
        if val is None and schema.get("required"):
            raise ValueError(f"必填参数 {schema.get('label', key)} 未填写")
        return val, None

    # ---------- 节点执行 ----------
    def _execute_node(self, node_id: str) -> None:
        if node_id in self._running:
            raise ValueError(f"节点 {node_id} 存在循环依赖")
        node = self.nodes[node_id]
        comp = self.components.get(node.get("componentCode", ""))
        if comp is None:
            raise ValueError(f"未注册组件: {node.get('componentCode')}")

        log: dict[str, Any] = {
            "nodeId": node_id,
            "name": node.get("name") or comp.name,
            "componentCode": comp.code,
            "state": "RUNNING",
            "startedAt": datetime.utcnow().isoformat(timespec="seconds"),
            "durationMs": 0,
            "inputs": {},
            "outputs": {},
            "error": None,
        }
        self.logs.append(log)
        self._running.add(node_id)
        t0 = time.perf_counter()
        try:
            resolved: dict[str, Any] = {}
            for schema in comp.params_schema or []:
                val, src = self._resolve_param(node, schema["key"], schema)
                resolved[schema["key"]] = val
                log["inputs"][schema["key"]] = {
                    "value": val, "source": src or "手动填写",
                }
            for pin in comp.inputs or []:
                val, src = self._resolve_param(node, pin["key"], {})
                resolved[pin["key"]] = val
                log["inputs"][pin["key"]] = {"value": self._brief(val), "source": src or "未连接"}

            outputs = self._run_component(comp, resolved, node)
            self.node_outputs[node_id] = outputs
            log["outputs"] = {k: self._brief(v) for k, v in outputs.items()}
            log["state"] = "SUCCESS"
        except Exception as e:  # 引擎级容错：单节点失败 → 整轮失败（简化版三级容错）
            log["state"] = "FAILED"
            log["error"] = str(e)
            raise
        finally:
            self._running.discard(node_id)
            self._executed.add(node_id)
            log["durationMs"] = int((time.perf_counter() - t0) * 1000)

    @staticmethod
    def _brief(v: Any) -> Any:
        """日志里的值摘要（长数组截断）。"""
        if isinstance(v, list) and len(v) > 8:
            return {"_type": "array", "length": len(v), "preview": v[:5]}
        if isinstance(v, float):
            return round(v, 6)
        return v

    # ---------- 内置运行时 ----------
    def _run_component(self, comp: ComponentDef, p: dict[str, Any], node: dict) -> dict[str, Any]:
        runtime, ref = comp.runtime, comp.ref_code

        if runtime == "builtin" and ref == "start":
            return {}
        if runtime == "builtin" and ref == "end":
            return {}
        if runtime == "builtin" and ref == "constant":
            return {"value": float(p.get("value") or 0)}
        if runtime == "builtin" and ref == "loop":
            return {"round": 1}

        if runtime == "builtin" and ref == "point_read":
            return self._run_point_read(p)
        if runtime == "analysis" and ref == "stats":
            return self._run_stats(p)
        if runtime == "analysis" and ref == "moving_avg":
            return self._run_moving_avg(p)
        if runtime == "analysis" and ref == "threshold":
            return self._run_threshold(p)
        if runtime == "analysis" and ref == "correlation":
            return self._run_correlation(p)
        if runtime == "metamodel" and ref == "infer":
            return self._run_metamodel(p)
        if runtime == "output" and ref == "regulation":
            return {"accepted": True}
        if runtime == "output" and ref == "alarm":
            return self._run_alarm(p)

        if runtime == "builtin" and ref == "process_sim":
            return self._run_process_sim(comp, p)

        # 仿真兜底：未实现运行时输出空
        return {}

    # ---------- 各组件实现 ----------
    def _run_point_read(self, p: dict) -> dict[str, Any]:
        point_id = p.get("pointId")
        if not point_id:
            raise ValueError("未选择数据点位")
        pt = self.db.get(DataPoint, int(point_id))
        if not pt:
            raise ValueError(f"点位 {point_id} 不存在")
        history = int(p.get("history") or 50)
        rows = self.db.execute(
            select(TimeSeries)
            .where(TimeSeries.point_id == pt.id)
            .order_by(TimeSeries.timestamp.desc())
            .limit(history)
        ).scalars().all()
        rows.reverse()
        latest = rows[-1] if rows else None
        series = [
            [r.timestamp.isoformat(timespec="seconds"), r.value if r.value is not None else r.value_text]
            for r in rows
        ]
        return {
            "value": latest.value if latest and latest.value is not None else None,
            "series": series,
            "timestamp": latest.timestamp.isoformat(timespec="seconds") if latest else None,
        }

    def _run_stats(self, p: dict) -> dict[str, Any]:
        s = _to_series(p.get("series"))
        if len(s) < 2:
            raise ValueError("统计摘要需要至少 2 个时序点")
        values = np.array([v for _, v in s], dtype=float)
        # 趋势：一阶差分斜率（每步平均变化）
        trend = float(np.polyfit(np.arange(len(values)), values, 1)[0]) if len(values) > 2 else 0.0
        return {
            "mean": float(values.mean()),
            "max": float(values.max()),
            "min": float(values.min()),
            "std": float(values.std()),
            "trend": trend,
        }

    def _run_moving_avg(self, p: dict) -> dict[str, Any]:
        s = _to_series(p.get("series"))
        if not s:
            raise ValueError("滑动滤波需要时序输入")
        window = max(2, min(500, int(p.get("window") or 10)))
        values = np.array([v for _, v in s], dtype=float)
        kernel = np.ones(window) / window
        smoothed = np.convolve(values, kernel, mode="same")
        out = []
        for i, item in enumerate(s):
            ts = item[0] if item[0] is not None else i
            out.append([ts, float(smoothed[i])])
        return {"series": out}

    def _run_threshold(self, p: dict) -> dict[str, Any]:
        value = p.get("value")
        if value is None:
            raise ValueError("阈值判定缺少输入值")
        value = float(value)
        limit = float(p.get("limit") or 0)
        direction = p.get("direction") or "above"
        exceeded = value > limit if direction == "above" else value < limit
        margin = value - limit if direction == "above" else limit - value
        return {"exceeded": bool(exceeded), "margin": float(margin)}

    def _run_correlation(self, p: dict) -> dict[str, Any]:
        a = np.array([v for _, v in _to_series(p.get("seriesA"))], dtype=float)
        b = np.array([v for _, v in _to_series(p.get("seriesB"))], dtype=float)
        n = min(len(a), len(b))
        if n < 3:
            raise ValueError("相关性分析需要至少 3 个对齐点")
        a, b = a[:n], b[:n]
        if a.std() == 0 or b.std() == 0:
            return {"r": 0.0}
        return {"r": float(np.corrcoef(a, b)[0, 1])}

    def _run_metamodel(self, p: dict) -> dict[str, Any]:
        mm_id = p.get("metamodelId")
        if not mm_id:
            raise ValueError("未选择元模型")
        mm = self.db.get(Metamodel, int(mm_id))
        if not mm:
            raise ValueError(f"元模型 {mm_id} 不存在")
        features = p.get("features")
        # 仿真执行：透传特征并生成稳定伪结果（计入调用统计）
        mm.call_count = (mm.call_count or 0) + 1
        self.db.commit()
        base = 0.0
        if isinstance(features, (int, float)):
            base = float(features)
        elif isinstance(features, dict):
            nums = [v for v in features.values() if isinstance(v, (int, float))]
            base = sum(nums) / len(nums) if nums else 0.0
        elif isinstance(features, list):
            flat = [v for _, v in _to_series(features)]
            base = sum(flat) / len(flat) if flat else 0.0
        return {
            "result": {
                "metamodel": mm.meta_code,
                "name": mm.name,
                "mode": "simulation",
                "inputDigest": self._brief(features),
                "output": round(base * 0.98 + 1.2, 4),
            },
            "confidence": 0.92,
        }

    def _run_process_sim(self, comp: Any, p: dict) -> dict[str, Any]:
        """工艺工序仿真：从数值输入推导合理输出，工件类输出带阶段标记。"""
        import zlib

        num_in = [float(v) for v in p.values() if isinstance(v, (int, float))]
        base = sum(num_in) / len(num_in) if num_in else 1.0
        out: dict[str, Any] = {}
        for pin in comp.outputs or []:
            key = pin["key"]
            dtype = pin.get("dtype")
            if dtype == "number":
                factor = 0.85 + (zlib.crc32(key.encode()) % 30) / 100
                out[key] = round(base * factor, 4)
            elif dtype == "bool":
                out[key] = True
            else:
                out[key] = {"stage": comp.name, "workpiece": True, "simulated": True}
        return out

    def _run_alarm(self, p: dict) -> dict[str, Any]:
        trigger = p.get("trigger")
        fired = bool(trigger) if isinstance(trigger, bool) else float(trigger or 0) != 0
        if not fired:
            return {"alarmId": None}
        level = p.get("level") or "WARNING"
        alarm = Alarm(
            level="CRITICAL" if level == "CRITICAL" else ("INFO" if level == "INFO" else "WARN"),
            category="CONTROL",
            source_type="flow",
            title="控制流触发报警",
            content=p.get("message") or "参数越限",
            status="ACTIVE",
        )
        self.db.add(alarm)
        self.db.commit()
        return {"alarmId": alarm.id}

    # ---------- 调度 ----------
    def _control_targets(self, node_id: str, port: str = "next") -> list[str]:
        """沿控制边找到后继节点（kind=control）。port: next/true/false/loop/exit。"""
        outs = [
            e["target"] for e in self.edges
            if e.get("kind", "control") == "control"
            and e["source"] == node_id
            and (e.get("sourcePort") or "next") == port
        ]
        return [t for t in outs if t in self.nodes]

    def _condition_of(self, node_id: str) -> bool:
        node = self.nodes[node_id]
        comp = self.components[node["componentCode"]]
        expr = next(
            (s for s in comp.params_schema or [] if s["key"] == "expression"), {}
        ).get("expression", "value > 0")
        val, _ = self._resolve_param(node, "value", {})
        return _eval_condition(expr or "value > 0", val)

    def run_from(self, node_id: str, depth: int = 0) -> None:
        """从指定节点沿控制边推进（链式；分叉递归；循环/条件按语义路由）。"""
        if depth > 64:
            raise ValueError("控制流嵌套过深（>64），请检查流程结构")
        visited_in_round: set[str] = set()
        cur: str | None = node_id
        while cur:
            if cur in visited_in_round:
                raise ValueError("检测到无循环组件管理的控制环，请用「循环执行」组件包裹")
            visited_in_round.add(cur)

            comp = self.components.get(self.nodes[cur].get("componentCode", ""))
            if comp is None:
                raise ValueError(f"未注册组件: {self.nodes[cur].get('componentCode')}")

            if comp.ref_code == "condition":
                self._execute_node(cur)
                branch = "true" if self._condition_of(cur) else "false"
                targets = self._control_targets(cur, branch)
                for t in targets:
                    self.run_from(t, depth + 1)
                return

            if comp.ref_code == "loop":
                self._execute_node(cur)
                rounds = int((self.nodes[cur].get("params") or {}).get("count") or 3)
                body = self._control_targets(cur, "loop")
                exit_to = self._control_targets(cur, "exit")
                for r in range(rounds):
                    self.node_outputs[cur] = {"round": r + 1}
                    for t in body:
                        self.run_from(t, depth + 1)
                for t in exit_to:
                    self.run_from(t, depth + 1)
                return

            self._execute_node(cur)
            targets = self._control_targets(cur, "next")
            if not targets:
                return
            # 单链继续；多分叉依次执行
            for extra in targets[1:]:
                self.run_from(extra, depth + 1)
            cur = targets[0]

    def start(self) -> None:
        starts = [
            n["id"] for n in self.nodes.values()
            if self.components.get(n.get("componentCode", ""), None)
            and self.components[n["componentCode"]].ref_code == "start"
        ] or [
            n_id for n_id, n in self.nodes.items()
            if not any(
                e["target"] == n_id and e.get("kind", "control") == "control"
                for e in self.edges
            )
        ]
        if not starts:
            raise ValueError("流程没有可执行的起始节点")
        for s in starts:
            self.run_from(s)
