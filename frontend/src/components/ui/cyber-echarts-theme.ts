"use client";

/**
 * ECharts 亮色主题（统一注册一次）。
 * 调用 registerCyberTheme() 后，
 * ReactECharts 用 theme="cyber" 自动获得亮色风格。
 */
import * as echarts from "echarts/core";

const CYBER_PALETTE = [
  "#0d9488", // 品牌青绿
  "#10b981", // 翠绿
  "#7c3aed", // 紫
  "#f59e0b", // 橙
  "#3b82f6", // 蓝
  "#ef4444", // 红
  "#06b6d4", // 青
  "#8b5cf6", // 淡紫
];

export const themeCyber = {
  color: CYBER_PALETTE,
  backgroundColor: "transparent",
  textStyle: {
    color: "#64748b",
    fontFamily:
      "JetBrains Mono, Fira Code, ui-monospace, Consolas, monospace",
  },
  title: {
    textStyle: { color: "#0f172a" },
    subtextStyle: { color: "#64748b" },
  },
  line: {
    itemStyle: { borderWidth: 2 },
    lineStyle: { width: 2 },
    symbolSize: 6,
    symbol: "circle",
    smooth: true,
  },
  bar: {
    itemStyle: {
      borderRadius: [4, 4, 0, 0],
    },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: "#cbd5e1" } },
    axisTick: { lineStyle: { color: "#cbd5e1" } },
    axisLabel: { color: "#64748b", fontSize: 11 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: true, lineStyle: { color: "#cbd5e1" } },
    axisTick: { show: true, lineStyle: { color: "#cbd5e1" } },
    axisLabel: { color: "#64748b", fontSize: 11 },
    splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
  },
  tooltip: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: "rgba(13,148,136,0.35)",
    borderWidth: 1,
    textStyle: { color: "#0f172a" },
    extraCssText:
      "backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 8px 24px rgba(15,23,42,0.12);",
  },
  legend: {
    textStyle: { color: "#64748b", fontSize: 11 },
  },
  grid: { borderColor: "#e2e8f0" },
  radar: {
    axisLine: { lineStyle: { color: "#cbd5e1" } },
    splitLine: { lineStyle: { color: "#e2e8f0" } },
    splitArea: { areaStyle: { color: ["rgba(16,185,129,0.05)", "rgba(16,185,129,0.02)"] } },
  },
  pie: {
    itemStyle: { borderRadius: 4, borderColor: "#ffffff", borderWidth: 2 },
    label: { color: "#0f172a" },
  },
  gauge: {
    axisLine: {
      lineStyle: {
        width: 12,
        color: [
          [0.6, "#10b981"],
          [0.9, "#f59e0b"],
          [1, "#ef4444"],
        ],
      },
    },
    title: { color: "#64748b" },
    detail: { color: "#0d9488" },
  },
};

let registered = false;

/** 在应用入口处调用一次（best-effort 幂等） */
export function registerCyberTheme(): void {
  if (registered || typeof window === "undefined") return;
  try {
    echarts.registerTheme("cyber", themeCyber);
    registered = true;
  } catch {
    // ignore
  }
}
