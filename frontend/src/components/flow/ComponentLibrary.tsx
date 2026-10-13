"use client";

/**
 * 左侧组件库 —— 对齐工业组态软件的物料面板：
 * 分类头可折叠（chevron 旋转）、条目 = 品牌色竖条 + 名称 + 一行描述截断 + 拖拽把手。
 */
import * as React from "react";
import { ChevronDown, GripVertical, LayoutGrid } from "lucide-react";
import type { ComponentDef, ComponentRegistry } from "@/types/api";

interface Props {
  registry: ComponentRegistry | null;
  onAdd: (comp: ComponentDef) => void;
}

export function ComponentLibrary({ registry, onAdd }: Props) {
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set());

  const toggle = (cat: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const entries = Object.entries(registry?.groups ?? {});
  const total = entries.reduce((n, [, comps]) => n + comps.length, 0);

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* 面板头 */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <LayoutGrid className="h-3.5 w-3.5 text-teal-600" />
        <span className="text-xs font-semibold">组件库</span>
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {total}
        </span>
      </div>

      {/* 分类列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {entries.map(([cat, comps]) => {
          const isCollapsed = collapsed.has(cat);
          return (
            <div key={cat} className="mb-1.5">
              <button
                type="button"
                onClick={() => toggle(cat)}
                className="flex w-full items-center gap-1 rounded px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent"
                aria-expanded={!isCollapsed}
              >
                <ChevronDown
                  className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                />
                <span className="truncate">{cat}</span>
                <span className="ml-auto font-mono font-normal tabular-nums">{comps.length}</span>
              </button>

              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {comps.map((c) => (
                    <div
                      key={c.code}
                      title={c.description ?? `${c.category} · ${c.name}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-component", c.code);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => onAdd(c)}
                      className="group relative flex cursor-grab items-center gap-1.5 rounded-md border border-transparent py-1.5 pl-3.5 pr-1.5 transition-colors hover:border-border hover:bg-accent/70 active:cursor-grabbing"
                    >
                      {/* 品牌色竖条 */}
                      <span
                        aria-hidden
                        className="absolute left-1 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full"
                        style={{ background: c.uiConfig?.color ?? "#64748b" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium leading-4">{c.name}</p>
                        <p className="truncate text-[10px] leading-[13px] text-muted-foreground">
                          {c.description || c.category}
                        </p>
                      </div>
                      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {entries.length === 0 && (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">组件库加载中…</p>
        )}
      </div>

      {/* 底部提示 */}
      <div className="border-t border-border px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        拖入画布放置 · 点击添加到视野中心
      </div>
    </aside>
  );
}
