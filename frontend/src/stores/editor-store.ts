/**
 * 组态编辑器状态管理（Zustand + immer）
 * 管理 pageConfig、组件树、选中状态、撤销重做
 */
"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import type { ComponentInstance, ComponentType, PageConfig, ThemeTemplate, ModelBinding } from "@/lib/canvas/schema";
import { createEmptyPageConfig } from "@/lib/canvas/schema";
import { COMPONENT_REGISTRY } from "@/lib/canvas/registry";

interface EditorStore {
  // === 文档状态 ===
  formId: number | null;
  formName: string;
  pageConfig: PageConfig;
  dirty: boolean;

  // === 编辑器 UI 状态 ===
  mode: "edit" | "preview";
  selectedComponentId: string | null;
  zoom: number;

  // === 历史（撤销/重做） ===
  history: PageConfig[];
  historyIndex: number;

  // === 操作 ===
  loadConfig: (formId: number, name: string, config: PageConfig) => void;
  setMode: (mode: "edit" | "preview") => void;
  selectComponent: (id: string | null) => void;
  setZoom: (zoom: number) => void;

  addComponent: (type: ComponentType, position: { x: number; y: number }) => string;
  addModelComponent: (model: { id: number; code: string; name: string }, position: { x: number; y: number }) => string;
  updateModelBinding: (id: string, binding: ModelBinding) => void;
  removeComponent: (id: string) => void;
  duplicateComponent: (id: string) => void;
  updateComponentPosition: (id: string, position: ComponentInstance["position"]) => void;
  updateComponentProp: (id: string, key: string, value: unknown) => void;
  updateComponentTitle: (id: string, title: string) => void;
  updateComponentBinding: (
    id: string,
    propKey: string,
    binding: ComponentInstance["bindings"][string]
  ) => void;
  updateCanvas: (canvas: Partial<PageConfig["canvas"]>) => void;
  applyTheme: (theme: ThemeTemplate) => void;

  /** 图层操作 */
  toggleVisible: (id: string) => void;
  toggleLock: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  moveLayer: (id: string, direction: "up" | "down") => void;

  /** 保存成功后将 dirty 标记清零（不触碰 pageConfig 与历史） */
  clearDirty: () => void;

  // === 撤销/重做 ===
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  reset: () => void;
}

const MAX_HISTORY = 50;

function pushHistory(state: { history: PageConfig[]; historyIndex: number; pageConfig: PageConfig }) {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(state.pageConfig)) as PageConfig);
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  } else {
    state.historyIndex = newHistory.length - 1;
  }
  state.history = newHistory;
}

export const useEditorStore = create<EditorStore>()(
  immer((set, get) => ({
    formId: null,
    formName: "",
    pageConfig: createEmptyPageConfig(),
    dirty: false,
    mode: "edit",
    selectedComponentId: null,
    zoom: 1,
    history: [],
    historyIndex: -1,

    loadConfig: (formId, name, config) =>
      set((state) => {
        state.formId = formId;
        state.formName = name;
        state.pageConfig = JSON.parse(JSON.stringify(config)) as PageConfig;
        state.dirty = false;
        state.mode = "edit";
        state.selectedComponentId = null;
        state.zoom = 1;
        // 初始化历史
        state.history = [JSON.parse(JSON.stringify(config)) as PageConfig];
        state.historyIndex = 0;
      }),

    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
        if (mode === "preview") state.selectedComponentId = null;
      }),

    selectComponent: (id) =>
      set((state) => {
        state.selectedComponentId = id;
      }),

    setZoom: (zoom) =>
      set((state) => {
        state.zoom = Math.max(0.3, Math.min(2, zoom));
      }),

    addComponent: (type, position) => {
      const id = nanoid(8);
      set((state) => {
        pushHistory(state);
        const def = COMPONENT_REGISTRY[type];
        const instance: ComponentInstance = {
          id,
          type,
          title: def.label,
          position: {
            x: Math.round(position.x / 2) * 2, // 偶数对齐
            y: Math.round(position.y),
            w: def.defaultSize.w,
            h: def.defaultSize.h,
          },
          props: { ...def.defaultProps },
          bindings: {},
          visible: true,
        };
        state.pageConfig.components.push(instance);
        state.selectedComponentId = id;
        state.dirty = true;
      });
      return id;
    },

    addModelComponent: (model, position) => {
      const id = nanoid(8);
      set((state) => {
        pushHistory(state);
        const def = COMPONENT_REGISTRY.model;
        const instance: ComponentInstance = {
          id,
          type: "model",
          title: model.name,
          position: {
            x: Math.round(position.x / 2) * 2,
            y: Math.round(position.y),
            w: def.defaultSize.w,
            h: def.defaultSize.h,
          },
          props: { ...def.defaultProps },
          bindings: {},
          modelBinding: {
            modelId: model.id,
            modelCode: model.code,
            inputMappings: {},
          },
          visible: true,
        };
        state.pageConfig.components.push(instance);
        state.selectedComponentId = id;
        state.dirty = true;
      });
      return id;
    },

    updateModelBinding: (id, binding) =>
      set((state) => {
        pushHistory(state);
        const comp = state.pageConfig.components.find((c) => c.id === id);
        if (comp) {
          comp.modelBinding = binding;
          state.dirty = true;
        }
      }),

    removeComponent: (id) =>
      set((state) => {
        pushHistory(state);
        state.pageConfig.components = state.pageConfig.components.filter((c) => c.id !== id);
        if (state.selectedComponentId === id) state.selectedComponentId = null;
        state.dirty = true;
      }),

    duplicateComponent: (id) =>
      set((state) => {
        const orig = state.pageConfig.components.find((c) => c.id === id);
        if (!orig) return;
        pushHistory(state);
        const newId = nanoid(8);
        const clone: ComponentInstance = {
          ...JSON.parse(JSON.stringify(orig)),
          id: newId,
          title: `${orig.title} 副本`,
          position: { ...orig.position, x: orig.position.x + 1, y: orig.position.y + 1 },
        };
        state.pageConfig.components.push(clone);
        state.selectedComponentId = newId;
        state.dirty = true;
      }),

    updateComponentPosition: (id, position) =>
      set((state) => {
        const comp = state.pageConfig.components.find((c) => c.id === id);
        if (comp) {
          comp.position = position;
          state.dirty = true;
        }
      }),

    updateComponentProp: (id, key, value) =>
      set((state) => {
        pushHistory(state);
        const comp = state.pageConfig.components.find((c) => c.id === id);
        if (comp) {
          comp.props[key] = value;
          state.dirty = true;
        }
      }),

    updateComponentTitle: (id, title) =>
      set((state) => {
        const comp = state.pageConfig.components.find((c) => c.id === id);
        if (comp) {
          comp.title = title;
          state.dirty = true;
        }
      }),

    updateComponentBinding: (id, propKey, binding) =>
      set((state) => {
        pushHistory(state);
        const comp = state.pageConfig.components.find((c) => c.id === id);
        if (comp) {
          comp.bindings[propKey] = binding;
          state.dirty = true;
        }
      }),

    updateCanvas: (canvas) =>
      set((state) => {
        pushHistory(state);
        Object.assign(state.pageConfig.canvas, canvas);
        state.dirty = true;
      }),

    applyTheme: (theme) =>
      set((state) => {
        pushHistory(state);
        state.pageConfig.canvas.background = theme.background;
        state.pageConfig.canvas.theme = theme.background === "#f8fafc" ? "light" : "dark";
        // 批量更新组件颜色属性
        state.pageConfig.components.forEach((comp) => {
          if (comp.props.color) comp.props.color = theme.primaryColor;
          if (comp.props.fillColor) comp.props.fillColor = theme.primaryColor;
          if (comp.props.textColor) comp.props.textColor = theme.textColor;
        });
        state.dirty = true;
      }),

    toggleVisible: (id) =>
      set((state) => {
        const comp = state.pageConfig.components.find((c) => c.id === id);
        if (comp) {
          comp.visible = comp.visible === false ? true : false;
          state.dirty = true;
        }
      }),

    toggleLock: (id) =>
      set((state) => {
        const comp = state.pageConfig.components.find((c) => c.id === id);
        if (comp) {
          comp.locked = !comp.locked;
          state.dirty = true;
        }
      }),

    bringToFront: (id) =>
      set((state) => {
        const idx = state.pageConfig.components.findIndex((c) => c.id === id);
        if (idx >= 0 && idx < state.pageConfig.components.length - 1) {
          pushHistory(state);
          const [item] = state.pageConfig.components.splice(idx, 1);
          state.pageConfig.components.push(item);
          state.dirty = true;
        }
      }),

    sendToBack: (id) =>
      set((state) => {
        const idx = state.pageConfig.components.findIndex((c) => c.id === id);
        if (idx > 0) {
          pushHistory(state);
          const [item] = state.pageConfig.components.splice(idx, 1);
          state.pageConfig.components.unshift(item);
          state.dirty = true;
        }
      }),

    moveLayer: (id, direction) =>
      set((state) => {
        const idx = state.pageConfig.components.findIndex((c) => c.id === id);
        const target = direction === "up" ? idx + 1 : idx - 1;
        if (idx >= 0 && target >= 0 && target < state.pageConfig.components.length) {
          pushHistory(state);
          const tmp = state.pageConfig.components[idx];
          state.pageConfig.components[idx] = state.pageConfig.components[target];
          state.pageConfig.components[target] = tmp;
          state.dirty = true;
        }
      }),

    clearDirty: () =>
      set((state) => {
        state.dirty = false;
      }),

    undo: () =>
      set((state) => {
        if (state.historyIndex <= 0) return;
        state.historyIndex -= 1;
        state.pageConfig = JSON.parse(JSON.stringify(state.history[state.historyIndex])) as PageConfig;
        state.dirty = true;
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex += 1;
        state.pageConfig = JSON.parse(JSON.stringify(state.history[state.historyIndex])) as PageConfig;
        state.dirty = true;
      }),

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    reset: () =>
      set((state) => {
        state.formId = null;
        state.formName = "";
        state.pageConfig = createEmptyPageConfig();
        state.dirty = false;
        state.mode = "edit";
        state.selectedComponentId = null;
        state.zoom = 1;
        state.history = [];
        state.historyIndex = -1;
      }),
  }))
);
