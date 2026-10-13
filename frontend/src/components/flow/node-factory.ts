/**
 * 流程节点视觉工厂 —— 节点卡片与端口引脚的统一绘制。
 * 对齐海康 VM / ApexMotion 的节点卡：顶部品牌色头带 + 组件名 + 类别副标题、
 * 端口圆点带节点内侧标签、选中态主色描边 + 外圈光晕。
 *
 * X6 v2 已知坑（此处约定必须遵守）：
 * - 不用 Graph.registerEdge（ESM 下 undefined），边统一用内置 "edge" shape；
 * - rect 绝对尺寸用 x/y/width/height（refHeight/refWidth 数字会被解释为百分比）；
 * - 文本定位用 refX/refY；端口 line 布局策略参数是 start/end（不是 from/to）。
 */
import type { Node as X6Node } from "@antv/x6";
import type { ComponentDef } from "@/types/api";

/** 节点统一宽度 */
export const NODE_W = 200;

/** 控制语义端口（决定边类型与连线校验规则） */
export const CONTROL_PORTS = new Set(["in", "next", "true", "false", "loop", "exit"]);
export const isControlPort = (portId?: string) => !!portId && CONTROL_PORTS.has(portId);

export interface EditorNodeData extends Record<string, unknown> {
  componentCode: string;
  name: string;
  color: string;
  params: Record<string, unknown>;
  bindings: Record<string, string>;
}

/** 头部信息区（色带 + 名称 + 类别副标题）高度，端口区从其下方开始 */
const HEADER_H = 46;
/** 端口行高（节点高度按端口数自适应的基准） */
export const PORT_ROW = 22;
/** 端口区底部留白 */
const PORT_PAD_BOTTOM = 14;

/** 节点高度随端口数自适应：首行端口 y=48，行高 22 */
export function nodeHeight(comp: ComponentDef): number {
  const leftCount = (comp.refCode !== "start" ? 1 : 0) + (comp.inputs?.length ?? 0);
  const rightCount =
    (comp.kind === "single" && comp.refCode !== "end" ? 1 : 0) +
    (comp.kind === "condition" ? 2 : 0) +
    (comp.kind === "circulate" ? 2 : 0) +
    (comp.outputs?.length ?? 0);
  const rows = Math.max(leftCount, rightCount, 1);
  return Math.max(64, HEADER_H + (rows - 1) * PORT_ROW + PORT_PAD_BOTTOM + 2);
}

/**
 * 组件 → X6 端口。对齐 ApexMotion：端口=参数，左右两侧分布，
 * 圆点 r=5，标签 10px 置于节点内侧（左端口标签在右、右端口标签在左）。
 */
export function buildPorts(comp: ComponentDef, height: number) {
  const mk = (id: string, label: string, control: boolean, side: "left" | "right") => ({
    id,
    group: side,
    attrs: {
      circle: control
        ? { stroke: "#0d9488", fill: side === "right" ? "#0d9488" : "#ffffff", r: 5, strokeWidth: 1.6 }
        : { stroke: "#2563eb", fill: side === "right" ? "#2563eb" : "#ffffff", r: 5, strokeWidth: 1.6 },
      text: { text: label },
    },
    label: {
      position:
        side === "left"
          ? { name: "right", args: { dx: 9 } }
          : { name: "left", args: { dx: -9 } },
    },
  });

  const items: ReturnType<typeof mk>[] = [];
  if (comp.refCode !== "start") items.push(mk("in", "", true, "left"));
  for (const pin of comp.inputs ?? []) items.push(mk(pin.key, pin.label, false, "left"));
  if (comp.kind === "single" && comp.refCode !== "end") items.push(mk("next", "", true, "right"));
  if (comp.kind === "condition") {
    items.push(mk("true", "真", true, "right"));
    items.push(mk("false", "假", true, "right"));
  }
  if (comp.kind === "circulate") {
    items.push(mk("loop", "循环", true, "right"));
    items.push(mk("exit", "退出", true, "right"));
  }
  for (const o of comp.outputs ?? []) items.push(mk(o.key, o.label, false, "right"));

  const top = HEADER_H + 2;
  const bottom = Math.max(top + PORT_ROW, height - PORT_PAD_BOTTOM);

  return {
    groups: {
      left: {
        position: {
          name: "line",
          args: { start: { x: 0, y: top }, end: { x: 0, y: bottom } },
        },
        attrs: {
          circle: { magnet: true, strokeWidth: 1.6 },
          text: { fill: "#64748b", fontSize: 10, textAnchor: "start" },
        },
      },
      right: {
        position: {
          name: "line",
          args: { start: { x: NODE_W, y: top }, end: { x: NODE_W, y: bottom } },
        },
        attrs: {
          circle: { magnet: true, strokeWidth: 1.6 },
          text: { fill: "#64748b", fontSize: 10, textAnchor: "end" },
        },
      },
    },
    items,
  };
}

/** 选中态视觉切换：主色描边 + halo 光晕环（其余节点恢复默认细描边） */
export function applySelectedVisual(node: X6Node, selected: boolean) {
  const color = node.getData<EditorNodeData>()?.color ?? "#475569";
  node.setAttrByPath("body/stroke", selected ? color : color + "55");
  node.setAttrByPath("body/strokeWidth", selected ? 2 : 1.2);
  node.setAttrByPath("halo/display", selected ? "block" : "none");
}

export function createFlowNode(comp: ComponentDef, x: number, y: number, id: string): X6Node.Metadata {
  const color = comp.uiConfig?.color ?? "#475569";
  const kindLabel =
    comp.kind === "condition" ? "分支" : comp.kind === "circulate" ? "循环" : "单步";
  const height = nodeHeight(comp);
  return {
    id,
    shape: "rect",
    x,
    y,
    width: NODE_W,
    height,
    // 自定义 markup：外圈光晕(默认隐藏) + 卡体 + 顶部品牌色头带 + 名称 + 类别
    markup: [
      { tagName: "rect", selector: "halo" },
      { tagName: "rect", selector: "body", attrs: { class: "flow-node-body" } },
      { tagName: "rect", selector: "band" },
      { tagName: "text", selector: "label" },
      { tagName: "text", selector: "sub" },
    ],
    attrs: {
      halo: {
        // 外扩 5px 的光晕环：绝对尺寸（节点高度创建时已知，禁用 refHeight 数字）
        x: -5,
        y: -5,
        width: NODE_W + 10,
        height: height + 10,
        rx: 12,
        ry: 12,
        fill: "none",
        stroke: color,
        strokeWidth: 6,
        strokeOpacity: 0.18,
        display: "none",
      },
      body: {
        fill: "#ffffff",
        stroke: color + "55",
        strokeWidth: 1.2,
        rx: 9,
        ry: 9,
        filter: "drop-shadow(0 2px 5px rgba(15, 23, 42, 0.10))",
      },
      band: {
        // 内嵌 6px 头带（避免与卡片圆角冲突）；绝对坐标，不用 refWidth/refHeight
        x: 1.2,
        y: 1.2,
        width: NODE_W - 2.4,
        height: 6,
        rx: 3,
        ry: 3,
        fill: color,
      },
      label: {
        text: comp.name,
        refX: 14,
        refY: 23,
        fill: "#1e293b",
        fontSize: 12,
        fontWeight: 600,
        textAnchor: "start",
        textVerticalAnchor: "middle",
      },
      sub: {
        text: `${comp.category} · ${kindLabel}`,
        refX: 14,
        refY: 39,
        fill: "#94a3b8",
        fontSize: 9.5,
        textAnchor: "start",
        textVerticalAnchor: "middle",
      },
    },
    // X6 端口类型对 line 策略的 args 标注不全，运行时支持
    ports: buildPorts(comp, height) as never,
    data: {
      componentCode: comp.code,
      name: comp.name,
      color,
      params: Object.fromEntries(
        (comp.paramsSchema ?? []).map((p) => [p.key, p.default ?? null])
      ) as Record<string, unknown>,
      bindings: {} as Record<string, string>,
    } satisfies EditorNodeData,
  };
}
