/**
 * Grid 模式画布（react-grid-layout）
 * 负责组件的拖拽布局、选中、删除、以及从组件库拖入新组件
 */
"use client";

import * as React from "react";
import { WidthProvider, Responsive, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { X } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { WidgetRenderer } from "@/components/canvas/widgets";
import type { ComponentType } from "@/lib/canvas/schema";
import { cn } from "@/lib/utils";

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLS = 12;
const ROW_HEIGHT = 60;
const MARGIN: [number, number] = [8, 8];
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
const COLS_MAP = { lg: COLS, md: COLS, sm: COLS, xs: COLS, xxs: COLS } as const;

export function CanvasGrid() {
  const pageConfig = useEditorStore((s) => s.pageConfig);
  const mode = useEditorStore((s) => s.mode);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  const addComponent = useEditorStore((s) => s.addComponent);
  const addModelComponent = useEditorStore((s) => s.addModelComponent);
  const removeComponent = useEditorStore((s) => s.removeComponent);
  const updateComponentPosition = useEditorStore((s) => s.updateComponentPosition);

  const isEdit = mode === "edit";

  const components = pageConfig.components;

  // 拖拽悬停视觉反馈
  const [dragOver, setDragOver] = React.useState(false);

  // 由组件实例派生 RGL layout
  const layout = React.useMemo<Layout[]>(
    () =>
      components.map((c) => ({
        i: c.id,
        x: c.position.x,
        y: c.position.y,
        w: c.position.w,
        h: c.position.h,
        minW: 1,
        minH: 1,
      })),
    [components]
  );

  const layouts = React.useMemo(() => {
    const obj: Record<string, Layout[]> = {};
    (Object.keys(COLS_MAP) as (keyof typeof COLS_MAP)[]).forEach((bp) => {
      obj[bp] = layout;
    });
    return obj;
  }, [layout]);

  function onLayoutChange(current: Layout[]) {
    // 仅在编辑模式同步位置，且只更新真正变化的项，避免循环
    if (!isEdit) return;
    current.forEach((item) => {
      const comp = components.find((c) => c.id === item.i);
      if (!comp) return;
      const next = { x: item.x, y: item.y, w: item.w, h: item.h };
      const prev = comp.position;
      if (
        next.x !== prev.x ||
        next.y !== prev.y ||
        next.w !== prev.w ||
        next.h !== prev.h
      ) {
        updateComponentPosition(item.i, next);
      }
    });
  }

  // 在 dragover / dragenter 上必须无条件调用 preventDefault，
  // 浏览器才会允许后续的 drop 事件触发。dataTransfer.types 在不同浏览器
  // 中行为不一致，不能用作条件判断。
  function onDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragOver) setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // 仅当离开整个 drop 区域时才清除高亮
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setDragOver(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const type = e.dataTransfer.getData("componentType") as ComponentType;
    if (!type) return;

    const rect = e.currentTarget.getBoundingClientRect();
    // 始终使用 clientX/Y 相对于 drop target 的坐标，避免 offsetX 相对于子元素的问题
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const marginX = MARGIN[0];
    const marginY = MARGIN[1];
    const colWidth = (rect.width - (COLS + 1) * marginX) / COLS;
    const stepX = colWidth + marginX;
    const stepY = ROW_HEIGHT + marginY;

    const x = Math.max(0, Math.min(COLS - 1, Math.floor(px / stepX)));
    const y = Math.max(0, Math.floor(py / stepY));

    if (type === "model") {
      const modelId = parseInt(e.dataTransfer.getData("modelId"), 10);
      const modelCode = e.dataTransfer.getData("modelCode");
      const modelName = e.dataTransfer.getData("modelName") || modelCode;
      if (modelId) {
        addModelComponent({ id: modelId, code: modelCode, name: modelName }, { x, y });
      }
    } else {
      addComponent(type, { x, y });
    }
  }

  function onCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    // 点击空白处取消选中。仅当点击目标是画布外层本身时触发
    // （子组件的 onClick 已调用 stopPropagation 阻止冒泡）。
    if (!isEdit) return;
    selectComponent(null);
  }

  return (
    <div className="flex h-full w-full overflow-auto p-4">
      <div
        className={cn(
          "relative h-full min-h-[400px] w-full rounded-lg shadow-inner transition-colors",
          dragOver && "ring-2 ring-blue-500 ring-offset-2"
        )}
        style={{ backgroundColor: pageConfig.canvas.background }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onCanvasClick}
      >
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={BREAKPOINTS as unknown as Record<string, number>}
          cols={COLS_MAP as unknown as Record<string, number>}
          rowHeight={ROW_HEIGHT}
          margin={MARGIN}
          containerPadding={[0, 0]}
          isDraggable={isEdit}
          isResizable={isEdit}
          isBounded={false}
          compactType="vertical"
          preventCollision={false}
          draggableHandle=".drag-handle"
          onLayoutChange={onLayoutChange}
        >
          {components.map((c) => {
            const selected = isEdit && selectedComponentId === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  "group relative",
                  selected && "ring-2 ring-blue-500 ring-offset-0",
                  !isEdit && "pointer-events-none",
                )}
                onClick={(e) => {
                  // Click handler on the wrapping div.
                  // react-grid-layout is configured with
                  // draggableHandle=".drag-handle", so mousedown on the
                  // widget body itself will NOT start a drag and will be
                  // followed by a normal click event.
                  if (!isEdit) return;
                  e.stopPropagation();
                  selectComponent(c.id);
                }}
              >
                {/* Drag handle — a small grab area at the top of the card.
                    Only this area is captured by react-grid-layout for
                    dragging, leaving the rest of the card free for click
                    selection and widget interaction. */}
                {isEdit ? (
                  <div
                    className="drag-handle absolute inset-x-0 top-0 z-10 flex h-5 cursor-move items-center justify-center gap-1 rounded-t bg-blue-500/0 text-slate-500 opacity-0 transition hover:bg-blue-500/20 hover:text-blue-300 hover:opacity-100 group-hover:opacity-100"
                    title="拖动移动"
                  >
                    <span className="block h-0.5 w-6 rounded bg-current" />
                  </div>
                ) : null}

                {/* In edit mode, widget content is made pointer-event-
                    transparent so the wrapping div's onClick fires
                    regardless of nested ECharts/SVG/buttons. */}
                <div
                  className={cn(
                    "h-full w-full overflow-hidden",
                    isEdit && "pointer-events-none"
                  )}
                >
                  <WidgetRenderer component={c} />
                </div>

                {/* 删除按钮 */}
                {isEdit && selected ? (
                  <button
                    type="button"
                    className="absolute right-1 top-6 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeComponent(c.id);
                    }}
                    title="删除组件"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </ResponsiveGridLayout>

        {components.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            {dragOver ? "松开鼠标即可添加组件" : "从左侧拖拽组件到此处开始搭建"}
          </div>
        ) : null}
      </div>
    </div>
  );
}
