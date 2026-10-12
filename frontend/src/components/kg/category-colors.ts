"use client";

/** 知识图谱分类配色（亮色主题）与通用工具。 */

/** 分类 → 颜色；未匹配回退 slate */
export const CATEGORY_COLORS: Record<string, string> = {
  工艺流程: "#0891b2",
  工艺步骤: "#2563eb",
  工艺参数: "#059669",
  性能指标: "#dc2626",
  原料: "#7c3aed",
  领域概念: "#db2777",
  副产物: "#ea580c",
  产品: "#0d9488",
  杂质元素: "#d97706",
  有价元素: "#ca8a04",
  设备: "#4f46e5",
  区域: "#65a30d",
  岗位: "#0369a1",
  元模型: "#0f766e",
};

export const FALLBACK_COLOR = "#64748b";

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_COLOR;
}

/** 分类全集（固定顺序：已知分类在前，其余按出现顺序追加） */
export function collectCategories(
  nodes: { category: string; id: number }[]
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
  const known = Object.keys(CATEGORY_COLORS).filter((c) => counts.has(c));
  const extra = [...counts.keys()].filter((c) => !CATEGORY_COLORS[c]);
  return [...known, ...extra]
    .map((value) => ({ value, count: counts.get(value)! }))
    .sort((a, b) => b.count - a.count);
}
