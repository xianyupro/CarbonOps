/**
 * 组态编辑器主容器（全屏覆盖）
 * 三栏布局：组件库 | 画布 | 属性检查器，外加顶部工具栏
 * 底部图层浮动面板 + 主题浮动面板 + 版本管理
 */
"use client";

import * as React from "react";
import {
  ArrowLeft,
  Eye,
  History,
  Layers,
  Loader2,
  Palette,
  Pencil,
  Redo2,
  Rocket,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/editor-store";
import { ComponentPalette } from "@/components/canvas/component-palette";
import { CanvasGrid } from "@/components/canvas/canvas-grid";
import { PropertyInspector } from "@/components/canvas/property-inspector";
import { LayerPanel } from "@/components/canvas/layer-panel";
import { ThemePanel } from "@/components/canvas/theme-panel";
import { VersionDialog } from "@/components/canvas/version-dialog";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { PageConfig } from "@/lib/canvas/schema";
import { cn } from "@/lib/utils";

export interface StudioEditorProps {
  formId: number;
  formName: string;
  initialPageConfig: PageConfig;
  onClose: () => void;
  /** 自定义保存目标（如大屏 screen_configs）；提供时保存走该回调，且隐藏发布/版本功能 */
  onSave?: (pageConfig: PageConfig) => Promise<void>;
}

export function StudioEditor({
  formId,
  formName,
  initialPageConfig,
  onClose,
  onSave,
}: StudioEditorProps) {
  const loadConfig = useEditorStore((s) => s.loadConfig);
  const reset = useEditorStore((s) => s.reset);

  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const dirty = useEditorStore((s) => s.dirty);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const pageConfig = useEditorStore((s) => s.pageConfig);
  const clearDirty = useEditorStore((s) => s.clearDirty);

  const historyIndex = useEditorStore((s) => s.historyIndex);
  const historyLen = useEditorStore((s) => s.history.length);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLen - 1;

  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);

  // 浮动面板开关
  const [showLayers, setShowLayers] = React.useState(false);
  const [showThemes, setShowThemes] = React.useState(false);
  const [showVersions, setShowVersions] = React.useState(false);

  // 初始化（仅挂载时）
  React.useEffect(() => {
    loadConfig(formId, formName, initialPageConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (onSave) {
        await onSave(pageConfig);
      } else {
        await api.forms.update(formId, {
          pageConfig: pageConfig as unknown as Record<string, unknown>,
        });
      }
      clearDirty();
      toast.success("已保存");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await api.forms.publish(formId);
      clearDirty();
      toast.success(`已发布 ${res.versionNo}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* 顶部工具栏 */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
        {/* 左侧：返回 + 名称 */}
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-600 hover:bg-muted hover:text-foreground"
          onClick={handleClose}
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Button>

        <div className="h-5 w-px bg-slate-200" />

        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-700">
            {formName}
          </span>
          {dirty ? (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-orange-400"
              title="有未保存的修改"
            />
          ) : null}
        </div>

        {/* 中间：模式切换 + 撤销重做 + 辅助面板 */}
        <div className="mx-auto flex items-center gap-3">
          <div className="flex items-center rounded-md border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={cn(
                "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                mode === "edit"
                  ? "bg-slate-600 text-foreground"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Pencil className="h-3 w-3" />
              编辑
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={cn(
                "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                mode === "preview"
                  ? "bg-slate-600 text-foreground"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Eye className="h-3 w-3" />
              预览
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-600 hover:bg-muted"
            disabled={!canUndo}
            onClick={undo}
            title="撤销"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-600 hover:bg-muted"
            disabled={!canRedo}
            onClick={redo}
            title="重做"
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          {/* 辅助面板切换（仅编辑模式） */}
          {mode === "edit" ? (
            <>
              <div className="h-5 w-px bg-slate-200" />
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1 text-slate-600 hover:bg-muted",
                  showLayers && "bg-primary text-primary-foreground"
                )}
                onClick={() => {
                  setShowLayers((v) => !v);
                  setShowThemes(false);
                }}
                title="图层管理"
              >
                <Layers className="h-3.5 w-3.5" />
                图层
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1 text-slate-600 hover:bg-muted",
                  showThemes && "bg-primary text-primary-foreground"
                )}
                onClick={() => {
                  setShowThemes((v) => !v);
                  setShowLayers(false);
                }}
                title="行业主题"
              >
                <Palette className="h-3.5 w-3.5" />
                主题
              </Button>
            </>
          ) : null}

          {!onSave ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-slate-600 hover:bg-muted"
              onClick={() => setShowVersions(true)}
              title="版本管理"
            >
              <History className="h-3.5 w-3.5" />
              版本
            </Button>
          ) : null}
        </div>

        {/* 右侧：缩放 + 保存 + 发布 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border bg-muted">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center text-slate-500 hover:text-foreground"
              onClick={() => setZoom(zoom - 0.1)}
              title="缩小"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 text-center font-mono text-[11px] text-slate-600">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center text-slate-500 hover:text-foreground"
              onClick={() => setZoom(zoom + 0.1)}
              title="放大"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="border-border bg-transparent text-slate-700 hover:bg-muted hover:text-foreground"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存
          </Button>
          {!onSave ? (
            <Button
              size="sm"
              disabled={publishing}
              onClick={() => void handlePublish()}
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              发布
            </Button>
          ) : null}
        </div>
      </header>

      {/* 三栏主体 */}
      <div className="relative flex min-h-0 flex-1">
        <ComponentPalette />

        {/* 画布区域 */}
        <main className="relative min-w-0 flex-1 overflow-hidden bg-slate-50">
          <div
            className="h-full w-full"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            <CanvasGrid />
          </div>

          {/* 预览水印 */}
          {mode === "preview" ? (
            <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
              <div className="mt-3 rounded-full bg-blue-600/20 px-3 py-1 text-[11px] font-medium text-blue-300 ring-1 ring-blue-500/40">
                预览模式
              </div>
            </div>
          ) : null}

          {/* 浮动图层面板 */}
          {showLayers && mode === "edit" ? (
            <div className="absolute bottom-4 left-4 z-20">
              <LayerPanel />
            </div>
          ) : null}

          {/* 浮动主题面板 */}
          {showThemes && mode === "edit" ? (
            <div className="absolute bottom-4 left-4 z-20">
              <ThemePanel />
            </div>
          ) : null}
        </main>

        <PropertyInspector />
      </div>

      {/* 版本管理弹窗 */}
      <VersionDialog
        formId={formId}
        formName={formName}
        open={showVersions}
        onOpenChange={setShowVersions}
      />
    </div>
  );
}

export default StudioEditor;
