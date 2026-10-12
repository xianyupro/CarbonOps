/**
 * 行业主题面板（右侧）
 * 列出所有内置主题模板，点击应用并预览色彩
 */
"use client";

import { THEME_TEMPLATES } from "@/lib/canvas/schema";
import type { ThemeTemplate } from "@/lib/canvas/schema";
import { useEditorStore } from "@/stores/editor-store";
import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

function ThemeCard({
  theme,
  active,
  onApply,
}: {
  theme: ThemeTemplate;
  active: boolean;
  onApply: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-md border p-2 text-left transition-colors",
        active
          ? "border-blue-500 bg-slate-800"
          : "border-transparent bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800"
      )}
    >
      {/* 色彩预览条：background / primaryColor / accentColor */}
      <div className="flex h-8 w-14 shrink-0 overflow-hidden rounded ring-1 ring-slate-700">
        <div className="h-full flex-1" style={{ background: theme.background }} />
        <div className="h-full flex-1" style={{ background: theme.primaryColor }} />
        <div className="h-full flex-1" style={{ background: theme.accentColor }} />
      </div>

      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">
        {theme.name}
      </span>

      {active ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" />
      ) : null}
    </button>
  );
}

export function ThemePanel() {
  const applyTheme = useEditorStore((s) => s.applyTheme);
  const background = useEditorStore((s) => s.pageConfig.canvas.background);

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-l border-slate-800 bg-slate-900">
      {/* 面板标题 */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 px-3 py-2">
        <Palette className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          行业主题
        </span>
      </div>

      {/* 主题列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          {THEME_TEMPLATES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              active={theme.background === background}
              onApply={() => applyTheme(theme)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
