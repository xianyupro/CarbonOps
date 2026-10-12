/**
 * 左侧组件库面板（拖拽源）
 * 按分类列出所有可拖拽组件，支持搜索过滤
 * 动态加载模型库中的 ONLINE 模型作为可拖拽组件
 */
"use client";

import * as React from "react";
import { ChevronDown, Search, Brain } from "lucide-react";
import { getComponentsByCategory } from "@/lib/canvas/registry";
import type { ComponentDefinition } from "@/lib/canvas/registry";
import { api, ApiError } from "@/lib/api";
import type { ModelRegistry } from "@/types/api";
import { cn } from "@/lib/utils";

interface ComponentPaletteProps {
  /** 外部控制宽度收起（可选，默认展开） */
  collapsed?: boolean;
}

/** 可折叠分类区块 */
function CollapsibleSection({
  label,
  defaultOpen = true,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {open ? <div className="px-2 pb-2">{children}</div> : null}
    </div>
  );
}

/** 单个可拖拽组件卡片 */
function PaletteItem({ def }: { def: ComponentDefinition }) {
  const Icon = def.icon;

  function onDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("componentType", def.type);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group flex cursor-grab items-start gap-2 rounded-md border border-transparent p-2 transition-colors hover:border-slate-700 hover:bg-slate-800 active:cursor-grabbing"
      title={def.description}
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-800 text-slate-300 group-hover:bg-slate-700 group-hover:text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-slate-200">
          {def.label}
        </div>
        <div className="truncate text-[10px] leading-tight text-slate-500">
          {def.description}
        </div>
      </div>
    </div>
  );
}

/** 模型组件卡片（特殊：携带 modelId） */
function ModelPaletteItem({ model }: { model: ModelRegistry }) {
  function onDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("componentType", "model");
    e.dataTransfer.setData("modelId", String(model.id));
    e.dataTransfer.setData("modelCode", model.code);
    e.dataTransfer.setData("modelName", model.name);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group flex cursor-grab items-start gap-2 rounded-md border border-transparent p-2 transition-colors hover:border-purple-700/50 hover:bg-slate-800 active:cursor-grabbing"
      title={model.description ?? model.name}
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-purple-900/30 text-purple-400 group-hover:bg-purple-800/40 group-hover:text-purple-300">
        <Brain className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-slate-200">
          {model.name}
        </div>
        <div className="truncate text-[10px] leading-tight text-slate-500">
          {model.industry} · {model.functionType}
        </div>
      </div>
    </div>
  );
}

export function ComponentPalette({ collapsed = false }: ComponentPaletteProps) {
  const [keyword, setKeyword] = React.useState("");
  const groups = React.useMemo(() => getComponentsByCategory(), []);
  const [models, setModels] = React.useState<ModelRegistry[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(true);

  // 加载模型库中 ONLINE 模型
  React.useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    api.models
      .list({ status: "ONLINE", pageSize: 50 })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res.list ?? []);
        setModels(list);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 过滤掉 model 分类（改用动态模型列表替代静态项）
  const staticGroups = React.useMemo(
    () => groups.filter((g) => g.category !== "model"),
    [groups]
  );

  const filtered = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return staticGroups;
    return staticGroups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.label.toLowerCase().includes(kw) ||
            it.description.toLowerCase().includes(kw) ||
            it.type.toLowerCase().includes(kw)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [staticGroups, keyword]);

  const filteredModels = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return models;
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(kw) ||
        m.code.toLowerCase().includes(kw) ||
        m.industry.toLowerCase().includes(kw)
    );
  }, [models, keyword]);

  if (collapsed) {
    return (
      <aside className="flex w-[44px] shrink-0 flex-col border-r border-slate-800 bg-slate-900" />
    );
  }

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-800 bg-slate-900">
      {/* 搜索框 */}
      <div className="border-b border-slate-800 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索组件"
            className="h-8 w-full rounded-md border border-slate-700 bg-slate-800 pl-7 pr-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* 组件列表 */}
      <div className="flex-1 overflow-y-auto">
        {/* 智能模型分类（动态加载） */}
        {(filteredModels.length > 0 || modelsLoading) && !keyword ? (
          <CollapsibleSection label="智能模型">
            <div className="flex flex-col gap-0.5">
              {modelsLoading ? (
                <div className="px-2 py-3 text-center text-[11px] text-slate-600">
                  加载模型中…
                </div>
              ) : (
                filteredModels.map((m) => (
                  <ModelPaletteItem key={m.id} model={m} />
                ))
              )}
            </div>
          </CollapsibleSection>
        ) : null}

        {/* 搜索结果中包含模型 */}
        {keyword && filteredModels.length > 0 ? (
          <CollapsibleSection label="智能模型">
            <div className="flex flex-col gap-0.5">
              {filteredModels.map((m) => (
                <ModelPaletteItem key={m.id} model={m} />
              ))}
            </div>
          </CollapsibleSection>
        ) : null}

        {/* 静态组件分类 */}
        {filtered.length === 0 && filteredModels.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            未找到匹配组件
          </div>
        ) : (
          filtered.map((g) => (
            <CollapsibleSection key={g.category} label={g.label}>
              <div className="flex flex-col gap-0.5">
                {g.items.map((def) => (
                  <PaletteItem key={def.type} def={def} />
                ))}
              </div>
            </CollapsibleSection>
          ))
        )}
      </div>

      <div className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-600">
        拖拽组件到画布
      </div>
    </aside>
  );
}
