"""初始化知识图谱数据。

1) 从 knowledgeT 库迁移有色冶炼通用工艺知识（节点/边，source_type='migration'）；
2) 叠加挥发窑专属子图：设备/工序/元素/监测点位节点，
   并用 kg_links 把图谱节点挂到平台资产（数据点位 / 元模型）。

幂等：已有迁移/挥发窑节点时跳过对应部分。

用法：
    cd backend && .venv/Scripts/python.exe scripts/import_kg_data.py
"""
import json
import sys
from pathlib import Path

import sqlite3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, func  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models.data import DataPoint  # noqa: E402
from app.models.kg import KgEdge, KgLink, KgNode  # noqa: E402
from app.models.metamodel import Metamodel  # noqa: E402

KNOWLEDGET_DB = Path(r"D:\xianyucode\knowledgeT\backend\instance\knowledgeT.db")


def migrate_knowledget(db) -> bool:
    """迁移 knowledgeT 全部节点与边。返回是否执行。"""
    if db.scalar(select(KgNode).where(KgNode.source_type == "migration")):
        print("knowledgeT 知识已迁移过，跳过")
        return False
    if not KNOWLEDGET_DB.exists():
        print(f"未找到 knowledgeT 库: {KNOWLEDGET_DB}")
        return False

    con = sqlite3.connect(str(KNOWLEDGET_DB))
    con.row_factory = sqlite3.Row
    old_id_map: dict[int, int] = {}
    for r in con.execute("SELECT * FROM knowledge_nodes"):
        n = KgNode(
            name=r["name"],
            category=r["category"],
            description=r["description"],
            properties=(json.loads(r["properties"]) if r["properties"] else None),
            source_type="migration",
            source_text=r["source_text"],
            source_location=r["source_location"],
        )
        db.add(n)
        db.flush()
        old_id_map[r["id"]] = n.id

    edge_count = 0
    for r in con.execute("SELECT * FROM knowledge_edges"):
        sid = old_id_map.get(r["source_node_id"])
        tid = old_id_map.get(r["target_node_id"])
        if not sid or not tid:
            continue
        db.add(KgEdge(
            source_node_id=sid, target_node_id=tid,
            relation_type=r["relation_type"], weight=r["weight"] or 1.0,
        ))
        edge_count += 1
    con.close()
    db.commit()
    print(f"knowledgeT 迁移完成：{len(old_id_map)} 节点 / {edge_count} 边")
    return True


def add_kiln_subgraph(db) -> None:
    """挥发窑专属子图：设备/工序/元素节点 + 平台资产挂接。"""
    if db.scalar(select(KgNode).where(KgNode.source_type == "manual", KgNode.category == "设备", KgNode.name == "回转挥发窑")):
        print("挥发窑子图已存在，跳过")
        return

    def node(name, category, description, **kw) -> KgNode:
        n = KgNode(name=name, category=category, description=description,
                   source_type="manual", **kw)
        db.add(n)
        db.flush()
        return n

    def edge(s: KgNode, t: KgNode, rel: str, weight: float = 1.0) -> None:
        db.add(KgEdge(source_node_id=s.id, target_node_id=t.id, relation_type=rel, weight=weight))

    # --- 核心设备 ---
    kiln = node("回转挥发窑", "设备", "有色冶炼挥发工序核心装备：球团经窑内焙烧，有价金属挥发富集于烟气，渣自窑尾排出")
    kiln_head = node("窑头", "设备", "挥发窑高温端：燃烧器供热，烟气与挥发物由此导出")
    kiln_tail = node("窑尾", "设备", "挥发窑进料端：球团由此进入窑内，温度相对较低")
    feeder = node("圆盘给料机", "设备", "控制球团入窑量的给料设备，频率可调（控制点位：圆盘给料机频率）")
    main_motor = node("主电机", "设备", "驱动窑体回转的主传动电机（监测点位：电流/频率反馈）")
    waste_heat_boiler = node("余热锅炉", "设备", "回收高温烟气余热产生蒸汽（监测锅筒液位/压力/出入口温度）")
    esp = node("电收尘器", "设备", "静电除尘设备，收捕烟气中的烟尘与有价金属（监测出入口压力/温度）")
    fan = node("增压风机", "设备", "维持窑内负压与烟气流动（监测进出口阀门开度）")
    for d in (kiln_head, kiln_tail, feeder, main_motor, waste_heat_boiler, esp, fan):
        edge(d, kiln, "组成部件")

    # --- 工艺流程 ---
    process = node("挥发窑焙烧挥发工序", "工艺流程", "球团干燥预热→窑内焙烧挥发→烟气冷却收尘→余热利用的完整流程")
    steps = [
        node("给料", "工艺步骤", "圆盘给料机按设定频率将球团均匀送入窑尾"),
        node("焙烧挥发", "工艺步骤", "窑内高温区有价金属挥发进入烟气相，渣相完成铁酸盐化"),
        node("烟气冷却", "工艺步骤", "高温烟气经余热锅炉降温回收余热"),
        node("收尘", "工艺步骤", "电收尘器捕集烟尘，富含镉铅锌等有价的烟尘外送"),
        node("排放", "工艺步骤", "达标烟气经增压风机排放，CO浓度在线监测"),
    ]
    edge(kiln, process, "实现工艺")
    prev = None
    for s in steps:
        edge(process, s, "包含步骤")
        if prev:
            edge(prev, s, "前驱工序")
        prev = s
    edge(feeder, steps[0], "驱动")
    edge(kiln, steps[1], "实现工艺")
    edge(waste_heat_boiler, steps[2], "实现工艺")
    edge(esp, steps[3], "实现工艺")
    edge(fan, steps[4], "实现工艺")

    # --- 有价/杂质元素（来自现场数据成分列） ---
    elements = ["银(Ag)", "铅(Pb)", "铁(Fe)", "锌(Zn)", "钙(Ca)", "砷(As)", "铬(Cr)", "铜(Cu)", "铟(In)", "锑(Sb)", "铝(Al)", "硅(Si)"]
    el_nodes = {}
    for e in elements:
        sym = e[e.index("(") + 1:-1]
        el_nodes[e] = node(e, "杂质元素" if sym in ("As", "Cr", "Sb") else "有价元素",
                           f"挥发窑物料/烟尘中的{sym}元素，现场数据含其含量监测列")
        edge(el_nodes[e], steps[1], "挥发富集" if sym not in ("As", "Cr", "Sb") else "脱除对象")

    # --- 关键工艺参数 ---
    params = [
        ("窑尾温度", "窑尾烟气温度，燃烧与焙烧强度的关键标志（控制设定值可调）"),
        ("窑头温度", "窑头高温区温度，上/下两点监测"),
        ("CO浓度", "烟气一氧化碳浓度，燃烧完全度与安全监测指标"),
        ("给料机频率", "圆盘给料机运行频率，直接决定处理量"),
        ("锅筒液位", "余热锅炉锅筒液位，1#/2#/3# 三点监测"),
    ]
    param_nodes = {}
    for name, desc in params:
        param_nodes[name] = node(name, "工艺参数", desc)
        edge(param_nodes[name], kiln, "工况表征")
    edge(param_nodes["窑尾温度"], steps[1], "控制参数")
    edge(param_nodes["给料机频率"], steps[0], "控制参数")
    edge(param_nodes["CO浓度"], kiln_head, "监测")

    # --- 关联平台元模型（有色/含挥发窑的元模型注册为节点） ---
    mms = db.execute(
        select(Metamodel).where(
            (Metamodel.industry == "有色")
            | Metamodel.name.like("%挥发窑%")
        )
    ).scalars().all()
    for mm in mms[:20]:
        mn = node(
            mm.name, "元模型",
            f"{mm.meta_code}：{mm.purpose or ''}".strip("："),
            ref_type="METAMODEL", ref_id=mm.id,
        )
        edge(mn, kiln, "适用于")
        db.add(KgLink(node_id=mn.id, link_type="METAMODEL", link_id=mm.id,
                      description=f"元模型 {mm.meta_code}"))

    # --- 监测点位挂接（kg_links：图谱节点 ↔ 数据点位） ---
    def link_point(n: KgNode, point_name: str, desc: str) -> None:
        p = db.scalar(select(DataPoint).where(DataPoint.name == point_name).limit(1))
        if p:
            db.add(KgLink(node_id=n.id, link_type="DATA_POINT", link_id=p.id, description=desc))

    link_point(kiln_tail, "回转窑窑尾温度", "监测点位：回转窑窑尾温度")
    link_point(kiln_head, "回转窑窑头温度（上）", "监测点位：窑头温度（上）")
    link_point(feeder, "圆盘给料机电流", "监测点位：圆盘给料机电流")
    link_point(main_motor, "主电机电流信号", "监测点位：主电机电流")
    link_point(waste_heat_boiler, "余热锅炉锅筒压力", "监测点位：余热锅炉锅筒压力")
    link_point(esp, "电收尘器入口压力", "监测点位：电收尘器入口压力")
    link_point(fan, "增压风机进口阀门开度反馈值", "监测点位：增压风机进口阀门开度")

    db.commit()
    total = db.scalar(select(func.count()).select_from(KgNode))
    print(f"挥发窑子图完成；当前图谱共 {total} 节点")


def main() -> None:
    db = SessionLocal()
    try:
        migrate_knowledget(db)
        add_kiln_subgraph(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
