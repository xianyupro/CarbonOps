/**
 * 图层面板（右侧）
 * 逆序列出所有组件，支持可见性/锁定切换、选中、置顶/置底
 */
"use client";

import { useEditorStore } from "@/stores/editor-store";
import { getComponentDef } from "@/lib/canvas/registry";
import { Eye, EyeOff, Lock, Unlock, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ComponentInstance } from "@/lib/canvas/schema";

function LayerRow({ comp }: { comp: ComponentInstance }) {
  const mode = useEditorStore((s) => s.mode);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  const toggleVisible = useEditorStore((s) => s.toggleVisible);
  const toggleLock = useEditorStore((s) => s.toggleLock);

  const def = getComponentDef(comp.type);
  const Icon = def.icon;
  const isSelected = selectedComponentId === comp.id;
  const isEditMode = mode === "edit";
  const isHidden = comp.visible === false;

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "text-slate-600 hover:bg-accent/60",
        isHidden && !isSelected && "text-slate-600"
      )}
    >
      {/* 可见性切换 */}
      {isEditMode ? (
        <button
          type="button"
          onClick={() => toggleVisible(comp.id)}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors",
            isHidden
              ? "text-slate-600 hover:text-slate-500"
              : "text-slate-500 hover:text-foreground"
          )}
          title={isHidden ? "显示" : "隐藏"}
        >
          {isHidden ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}

      {/* 组件图标 */}
      <div className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-500">
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* 组件标题（可点击选中） */}
      <button
        type="button"
        onClick={() => selectComponent(comp.id)}
        className="min-w-0 flex-1 truncate text-left"
        title={comp.title}
      >
        {comp.title}
      </button>

      {/* 锁定切换 */}
      {isEditMode ? (
        <button
          type="button"
          onClick={() => toggleLock(comp.id)}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors",
            comp.locked
              ? "text-amber-400 hover:text-amber-300"
              : "text-slate-600 opacity-0 hover:text-slate-500 group-hover:opacity-100"
          )}
          title={comp.locked ? "解锁" : "锁定"}
        >
          {comp.locked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <Unlock className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}
    </div>
  );
}

export function LayerPanel() {
  const components = useEditorStore((s) => s.pageConfig.components);
  const mode = useEditorStore((s) => s.mode);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const bringToFront = useEditorStore((s) => s.bringToFront);
  const sendToBack = useEditorStore((s) => s.sendToBack);

  // 逆序显示（最上层在顶部）
  const layers = [...components].reverse();
  const isEditMode = mode === "edit";

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-l border-border bg-card">
      {/* 面板标题 */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            图层
          </span>
        </div>
        <Badge variant="muted" className="font-mono text-[10px]">
          {components.length}
        </Badge>
      </div>

      {/* 组件列表 */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {layers.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            暂无组件
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {layers.map((comp) => (
              <LayerRow key={comp.id} comp={comp} />
            ))}
          </div>
        )}
      </div>

      {/* 选中组件的层级操作（仅编辑模式） */}
      {isEditMode && selectedComponentId ? (
        <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
          <button
            type="button"
            onClick={() => bringToFront(selectedComponentId)}
            className="flex-1 rounded bg-muted px-2 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-200 hover:text-foreground"
          >
            置顶
          </button>
          <button
            type="button"
            onClick={() => sendToBack(selectedComponentId)}
            className="flex-1 rounded bg-muted px-2 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-200 hover:text-foreground"
          >
            置底
          </button>
        </div>
      ) : null}
    </aside>
  );
}
