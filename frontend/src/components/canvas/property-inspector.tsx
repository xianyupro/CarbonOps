/**
 * 右侧属性检查器（Schema 驱动表单）
 * 读取选中组件的 propSchema，按字段类型渲染编辑控件
 */
"use client";

import * as React from "react";
import { ChevronDown, Link2, Plus, Trash2, X } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { getComponentDef } from "@/lib/canvas/registry";
import type { PropField } from "@/lib/canvas/registry";
import type { BindingDefinition, ComponentInstance, ModelBinding, AggType } from "@/lib/canvas/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** mock 数据源列表（用于 binding 编辑器） */
const MOCK_SOURCES = [
  {
    code: "volatile_kiln",
    name: "挥发窑数据源",
    points: ["temperature", "pressure", "coal_ratio", "air_volume", "efficiency"],
  },
  {
    code: "ethylene_cracker",
    name: "乙烯裂解炉",
    points: ["cot_temperature", "feed_flow", "steam_ratio", "coil_outlet_t"],
  },
  {
    code: "steelmaking",
    name: "钢铁全流程",
    points: ["blast_temp", "hot_metal_temp", "oxygen_flow", "carbon_intensity"],
  },
  {
    code: "generic_demo",
    name: "通用演示",
    points: ["value1", "value2", "energy_consumption", "output_rate"],
  },
];

/** 聚合方式选项 */
const AGG_OPTIONS = [
  { label: "原始值", value: "raw" },
  { label: "平均值", value: "avg" },
  { label: "求和", value: "sum" },
  { label: "最大值", value: "max" },
  { label: "最小值", value: "min" },
];

/** 模型参数列表（根据模型编码推断） */
const MODEL_PARAMS: Record<string, string[]> = {
  default: ["temperature", "pressure", "flow_rate", "coal_ratio"],
  kiln: ["kiln_temp", "coal_feed", "air_flow", "rotation_speed"],
  cracker: ["cot_temp", "feed_flow", "steam_ratio"],
};

function getModelParams(code: string): string[] {
  const key = Object.keys(MODEL_PARAMS).find((k) => code.toLowerCase().includes(k));
  return key ? MODEL_PARAMS[key] : MODEL_PARAMS.default;
}

/* ----------------------------- 可折叠分组区块 ----------------------------- */

function GroupSection({
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
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {open ? <div className="space-y-3 px-3 pb-3">{children}</div> : null}
    </div>
  );
}

/* -------------------------------- 绑定字段 -------------------------------- */

function BindingField({
  component,
  field,
}: {
  component: ComponentInstance;
  field: PropField;
}) {
  const updateComponentBinding = useEditorStore((s) => s.updateComponentBinding);
  const binding = component.bindings[field.key];

  const [editing, setEditing] = React.useState(false);
  const [tempSource, setTempSource] = React.useState(binding?.sourceCode ?? "");
  const [tempPoint, setTempPoint] = React.useState(binding?.point ?? "");
  const [tempAgg, setTempAgg] = React.useState<AggType>(binding?.agg ?? "raw");

  const sourceMeta = MOCK_SOURCES.find((s) => s.code === tempSource);
  const pointOptions = sourceMeta?.points ?? [];

  function openEditor() {
    setTempSource(binding?.sourceCode ?? MOCK_SOURCES[0].code);
    setTempPoint(binding?.point ?? "");
    setTempAgg(binding?.agg ?? "raw");
    setEditing(true);
  }

  function confirmBinding() {
    const next: BindingDefinition = {
      kind: "point",
      sourceCode: tempSource || undefined,
      point: tempPoint || undefined,
      agg: tempAgg,
    };
    updateComponentBinding(component.id, field.key, next);
    setEditing(false);
  }

  function clearBinding() {
    updateComponentBinding(component.id, field.key, { kind: "static", value: undefined });
    setEditing(false);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-600">{field.label}</Label>

      {!editing ? (
        <div className="rounded-md border border-border bg-muted/50 p-2">
          {binding && binding.sourceCode ? (
            <div className="space-y-0.5 text-xs">
              <div className="truncate text-slate-600">
                <span className="text-slate-500">数据源：</span>
                <span className="font-mono text-blue-300">{binding.sourceCode}</span>
                {binding.agg && binding.agg !== "raw" ? (
                  <span className="ml-1.5 inline-flex items-center rounded bg-purple-700/40 px-1 py-px font-mono text-[10px] text-purple-200">
                    {binding.agg}
                  </span>
                ) : null}
              </div>
              <div className="truncate text-slate-600">
                <span className="text-slate-500">点位：</span>
                <span className="font-mono text-emerald-300">{binding.point ?? "—"}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Link2 className="h-3 w-3" />
              未绑定数据
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 flex-1 border-slate-300 bg-transparent px-2 text-[11px] text-slate-700 hover:bg-slate-200"
              onClick={openEditor}
            >
              编辑绑定
            </Button>
            {binding && binding.sourceCode ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-slate-500 hover:text-red-300"
                onClick={clearBinding}
              >
                清除
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-md border border-blue-700/60 bg-muted/80 p-2">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              数据源
            </span>
            <Select value={tempSource} onValueChange={(v) => { setTempSource(v); setTempPoint(""); }}>
              <SelectTrigger className="h-7 border-slate-300 bg-card text-xs">
                <SelectValue placeholder="选择数据源" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_SOURCES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              点位
            </span>
            <Select value={tempPoint} onValueChange={setTempPoint}>
              <SelectTrigger className="h-7 border-slate-300 bg-card text-xs">
                <SelectValue placeholder="选择点位" />
              </SelectTrigger>
              <SelectContent>
                {pointOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              聚合方式
            </span>
            <Select value={tempAgg} onValueChange={(v) => setTempAgg(v as AggType)}>
              <SelectTrigger className="h-7 border-slate-300 bg-card text-xs">
                <SelectValue placeholder="选择聚合方式" />
              </SelectTrigger>
              <SelectContent>
                {AGG_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-6 flex-1 bg-blue-600 px-2 text-[11px] hover:bg-blue-500"
              onClick={confirmBinding}
            >
              确定
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] text-slate-500"
              onClick={() => setEditing(false)}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- 模型配置区块 ------------------------------ */

function ModelConfigSection({ component }: { component: ComponentInstance }) {
  const updateModelBinding = useEditorStore((s) => s.updateModelBinding);
  const modelBinding = component.modelBinding;

  const [showAddForm, setShowAddForm] = React.useState(false);
  const [newParam, setNewParam] = React.useState("");
  const [newSource, setNewSource] = React.useState(MOCK_SOURCES[0].code);
  const [newPoint, setNewPoint] = React.useState("");

  const sourceMeta = MOCK_SOURCES.find((s) => s.code === newSource);
  const pointOptions = sourceMeta?.points ?? [];

  if (!modelBinding) {
    return (
      <div className="border-b border-border p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          模型配置
        </div>
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-slate-500">
          请从左侧组件库拖入一个模型
        </div>
      </div>
    );
  }

  const paramHints = getModelParams(modelBinding.modelCode);
  const mappingEntries = Object.entries(modelBinding.inputMappings ?? {});

  function removeMapping(paramName: string) {
    if (!modelBinding) return;
    const next: ModelBinding = {
      ...modelBinding,
      inputMappings: { ...modelBinding.inputMappings },
    };
    delete next.inputMappings[paramName];
    updateModelBinding(component.id, next);
  }

  function addMapping() {
    if (!modelBinding || !newParam.trim()) return;
    const next: ModelBinding = {
      ...modelBinding,
      inputMappings: {
        ...modelBinding.inputMappings,
        [newParam.trim()]: { sourceCode: newSource, point: newPoint },
      },
    };
    updateModelBinding(component.id, next);
    setNewParam("");
    setNewSource(MOCK_SOURCES[0].code);
    setNewPoint("");
    setShowAddForm(false);
  }

  return (
    <div className="border-b border-border p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        模型配置
      </div>

      {/* 模型信息 */}
      <div className="mb-3 space-y-0.5 text-xs">
        <div className="truncate text-slate-600">
          <span className="text-slate-500">模型编码：</span>
          <span className="font-mono text-blue-300">{modelBinding.modelCode}</span>
        </div>
        {modelBinding.versionNo ? (
          <div className="truncate text-slate-500">
            <span className="text-slate-500">版本：</span>
            <span className="font-mono">{modelBinding.versionNo}</span>
          </div>
        ) : null}
      </div>

      {/* 输入参数映射 */}
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">
        输入参数映射
      </div>
      <div className="space-y-1">
        {mappingEntries.length === 0 ? (
          <div className="rounded border border-border bg-muted/40 px-2 py-1.5 text-[11px] text-slate-500">
            暂无映射
          </div>
        ) : (
          mappingEntries.map(([paramName, mapping]) => (
            <div
              key={paramName}
              className="flex items-start justify-between gap-1 rounded border border-border bg-muted/50 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1 space-y-0.5 text-[11px]">
                <div className="truncate">
                  <span className="text-slate-500">参数：</span>
                  <span className="font-mono text-amber-300">{paramName}</span>
                </div>
                <div className="truncate text-slate-600">
                  <span className="text-slate-500">源：</span>
                  <span className="font-mono text-blue-300">{mapping.sourceCode}</span>
                </div>
                <div className="truncate text-slate-600">
                  <span className="text-slate-500">点：</span>
                  <span className="font-mono text-emerald-300">{mapping.point}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeMapping(paramName)}
                className="mt-0.5 shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-red-300"
                title="删除映射"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* 添加映射表单 */}
      {showAddForm ? (
        <div className="mt-2 space-y-1.5 rounded-md border border-blue-700/60 bg-muted/80 p-2">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              参数名
            </span>
            <Select value={newParam} onValueChange={setNewParam}>
              <SelectTrigger className="h-7 border-slate-300 bg-card text-xs">
                <SelectValue placeholder="选择参数" />
              </SelectTrigger>
              <SelectContent>
                {paramHints
                  .filter((p) => !modelBinding.inputMappings?.[p])
                  .map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              数据源
            </span>
            <Select
              value={newSource}
              onValueChange={(v) => {
                setNewSource(v);
                setNewPoint("");
              }}
            >
              <SelectTrigger className="h-7 border-slate-300 bg-card text-xs">
                <SelectValue placeholder="选择数据源" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_SOURCES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              点位
            </span>
            <Select value={newPoint} onValueChange={setNewPoint}>
              <SelectTrigger className="h-7 border-slate-300 bg-card text-xs">
                <SelectValue placeholder="选择点位" />
              </SelectTrigger>
              <SelectContent>
                {pointOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-6 flex-1 bg-blue-600 px-2 text-[11px] hover:bg-blue-500"
              onClick={addMapping}
              disabled={!newParam}
            >
              确认
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] text-slate-500"
              onClick={() => setShowAddForm(false)}
            >
              取消
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 h-6 w-full border-slate-300 bg-transparent px-2 text-[11px] text-slate-700 hover:bg-slate-200"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-3 w-3" />
          添加映射
        </Button>
      )}
    </div>
  );
}

/* ------------------------------- 单字段渲染 ------------------------------- */

function FieldRenderer({
  component,
  field,
}: {
  component: ComponentInstance;
  field: PropField;
}) {
  const updateComponentProp = useEditorStore((s) => s.updateComponentProp);
  const value = component.props[field.key] ?? field.default;

  if (field.type === "binding") {
    return <BindingField component={component} field={field} />;
  }

  function setVal(v: unknown) {
    updateComponentProp(component.id, field.key, v);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-600">{field.label}</Label>

      {field.type === "text" ? (
        <Input
          value={String(value ?? "")}
          onChange={(e) => setVal(e.target.value)}
          className="h-7 border-border bg-muted text-xs text-slate-100"
        />
      ) : null}

      {field.type === "number" ? (
        <Input
          type="number"
          value={value === undefined || value === null ? "" : Number(value)}
          onChange={(e) => setVal(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-7 border-border bg-muted text-xs text-slate-100"
        />
      ) : null}

      {field.type === "color" ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(value ?? "#000000")}
            onChange={(e) => setVal(e.target.value)}
            className="h-7 w-9 shrink-0 cursor-pointer rounded border border-border bg-muted p-0.5"
          />
          <span className="font-mono text-xs text-slate-500">
            {String(value ?? "")}
          </span>
        </div>
      ) : null}

      {field.type === "select" ? (
        <Select value={String(value ?? "")} onValueChange={setVal}>
          <SelectTrigger className="h-7 border-border bg-muted text-xs text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {field.description ? (
        <p className="text-[10px] leading-tight text-slate-500">{field.description}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------ 属性检查器主体 ----------------------------- */

export function PropertyInspector() {
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const components = useEditorStore((s) => s.pageConfig.components);
  const updateComponentTitle = useEditorStore((s) => s.updateComponentTitle);
  const removeComponent = useEditorStore((s) => s.removeComponent);

  const component = React.useMemo(
    () => components.find((c) => c.id === selectedComponentId) ?? null,
    [components, selectedComponentId]
  );

  const def = component ? getComponentDef(component.type) : null;

  // 按分组聚合字段（必须在条件返回之前调用 hooks）
  const groups = React.useMemo(() => {
    if (!def) return [];
    const map = new Map<string, PropField[]>();
    def.propSchema.forEach((f) => {
      const g = f.group ?? "其他";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    });
    return Array.from(map.entries());
  }, [def]);

  if (!component || !def) {
    return (
      <aside className="flex w-[280px] shrink-0 flex-col border-l border-border bg-card">
        <div className="border-b border-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          属性
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
          <Link2 className="h-8 w-8 opacity-30" />
          <div className="font-medium text-slate-500">请选择一个组件</div>
          <div className="text-xs text-slate-600">
            在画布上点击组件以编辑其属性
          </div>
        </div>
      </aside>
    );
  }

  const Icon = def.icon;

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-border bg-card">
      <div className="border-b border-border px-3 py-2.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          属性
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 组件标识 + 标题 */}
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-muted text-slate-600">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-slate-700">
                {def.label}
              </div>
              <div className="truncate font-mono text-[10px] text-slate-500">
                {component.id}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">标题</Label>
            <Input
              value={component.title}
              onChange={(e) => updateComponentTitle(component.id, e.target.value)}
              className="h-7 border-border bg-muted text-xs text-slate-100"
            />
          </div>
        </div>

        {/* 模型配置（仅模型组件） */}
        {component.type === "model" ? (
          <ModelConfigSection component={component} />
        ) : null}

        {/* 分组属性 */}
        {groups.map(([groupName, fields]) => (
          <GroupSection key={groupName} label={groupName}>
            {fields.map((field) => (
              <FieldRenderer
                key={field.key}
                component={component}
                field={field}
              />
            ))}
          </GroupSection>
        ))}
      </div>

      {/* 底部删除 */}
      <div className="border-t border-border p-3">
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => removeComponent(component.id)}
        >
          <Trash2 className="h-4 w-4" />
          删除组件
        </Button>
      </div>
    </aside>
  );
}
