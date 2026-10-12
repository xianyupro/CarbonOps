"use client";

/**
 * 元模型登记录入 —— 按《元模型交付模板》四类模型 × 8 节结构录入。
 * 左侧：四类模型选择卡 + 已登记列表（可编辑/删除）；
 * 右侧：分节表单（基本信息 / 适用范围 / 结构关系 / 变量参数 / 接口 / 交付 / 验证 / 版本）。
 */
import * as React from "react";
import { toast } from "sonner";
import {
  Boxes,
  Brain,
  Code2,
  FilePlus2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { api } from "@/lib/api";
import type {
  Metamodel,
  MetamodelDetail,
  MetamodelIoParam,
  MetamodelPayload,
  MetamodelRelation,
  MetamodelType,
} from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const MODEL_TYPES: {
  value: MetamodelType;
  label: string;
  icon: React.ElementType;
  desc: string;
}[] = [
  { value: "MECHANISM", label: "机理模型", icon: Boxes, desc: "方程/守恒/传递关系" },
  { value: "DATA_MODEL", label: "数据模型", icon: Brain, desc: "统计学习/回归/网络" },
  { value: "ALGORITHM", label: "算法模型", icon: Code2, desc: "运筹优化/进化/搜索" },
  { value: "KNOWLEDGE_RULE", label: "知识规则模型", icon: FilePlus2, desc: "规则库/模糊推理" },
];

const TYPE_LABEL: Record<string, string> = {
  MECHANISM: "机理模型",
  DATA_MODEL: "数据模型",
  ALGORITHM: "算法模型",
  KNOWLEDGE_RULE: "知识规则模型",
};

const STATUS_LABEL: Record<string, string> = {
  DEVELOPING: "开发中",
  TESTING: "测试中",
  ONLINE: "已上线",
  OFFLINE: "已下线",
};

const INDUSTRIES = ["通用", "有色", "石化", "钢铁"];
const IO_CATEGORIES = ["输入", "参数", "输出传参", "输出"];

/** 空白表单状态 */
function emptyForm(modelType: MetamodelType): MetamodelPayload {
  return {
    name: "",
    modelType,
    domain: "有色",
    hierarchy: "",
    purpose: "",
    methodStructure: "",
    versionNo: "1.0.0",
    maturity: "",
    keywords: [],
    scopeObject: "",
    sourceOwnership: "",
    authorMaintainer: "",
    namingRule: "1.0：域_对象_类别_任务_方法；编号 CSU-行业-类别-6位序号",
    sceneDomain: "",
    assumptions: "",
    limitsPrecision: "",
    structureFlow: ["", "", ""],
    coreRelations: [{ id: "E(1)", expression: "", note: "" }],
    ioParams: [],
    methodFlow: "",
    entryInterface: "",
    exceptionBehavior: "",
    envMaterials: "平台托管运行：Python 3.11 + FastAPI；无需独立部署包",
    sourceManifest: "",
    deliveryRepro: "",
    deployCombination: "",
    validationBaseline: "",
    validationLimits: "",
    status: "DEVELOPING",
    industry: "有色",
    processStage: "",
    tags: [],
    initialChangelog: "初始登记",
  };
}

export default function MetamodelRegistryPage() {
  const [modelType, setModelType] = React.useState<MetamodelType>("MECHANISM");
  const [form, setForm] = React.useState<MetamodelPayload>(emptyForm("MECHANISM"));
  const [editing, setEditing] = React.useState<Metamodel | null>(null);
  const [list, setList] = React.useState<Metamodel[]>([]);
  const [saving, setSaving] = React.useState(false);

  const loadList = React.useCallback(async () => {
    try {
      const res = await api.metamodels.list({ pageSize: 200, modelType });
      setList(res.list);
    } catch {
      /* 列表加载失败不阻塞表单 */
    }
  }, [modelType]);

  React.useEffect(() => {
    loadList();
  }, [loadList]);

  function set<K extends keyof MetamodelPayload>(key: K, value: MetamodelPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function switchType(t: MetamodelType) {
    setModelType(t);
    setEditing(null);
    setForm(emptyForm(t));
  }

  function startEdit(m: Metamodel) {
    setEditing(m);
    setForm({ ...m, initialChangelog: undefined });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!form.name?.trim()) {
      toast.error("请填写模型名称");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.metamodels.update(editing.id, form);
        toast.success(`已更新：${form.name}`);
      } else {
        await api.metamodels.create(form);
        toast.success(`已登记：${form.name}`);
      }
      setEditing(null);
      setForm(emptyForm(modelType));
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: Metamodel) {
    if (!window.confirm(`确认删除「${m.name}」？`)) return;
    try {
      await api.metamodels.delete(m.id);
      toast.success("已删除");
      if (editing?.id === m.id) {
        setEditing(null);
        setForm(emptyForm(modelType));
      }
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div>
        <h1 className="text-xl font-semibold">元模型登记录入</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          按《元模型交付模板》八节结构登记机理 / 数据 / 算法 / 知识规则四类元模型
        </p>
      </div>

      {/* 四类模型选择 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MODEL_TYPES.map((t) => {
          const Icon = t.icon;
          const active = modelType === t.value;
          return (
            <button
              key={t.value}
              onClick={() => switchType(t.value)}
              className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                active
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* ========== 表单 ========== */}
        <Card>
          <CardContent className="space-y-8 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {editing ? `编辑：${editing.metaCode}` : "登记新元模型"}
              </h2>
              <div className="flex gap-2">
                {editing && (
                  <Button variant="outline" size="sm" onClick={() => { setEditing(null); setForm(emptyForm(modelType)); }}>
                    <X className="mr-1 h-4 w-4" /> 取消编辑
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                  {editing ? "保存修改" : "登记入库"}
                </Button>
              </div>
            </div>

            <Section title="一、基本信息">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="模型名称 *">
                  <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="如：挥发窑炉衬传热机理模型" />
                </Field>
                <Field label="版本 / 状态">
                  <Input value={form.versionNo ?? ""} onChange={(e) => set("versionNo", e.target.value)} />
                </Field>
                <Field label="领域">
                  <Select value={form.domain ?? "有色"} onValueChange={(v) => set("domain", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="工序阶段">
                  <Input value={form.processStage ?? ""} onChange={(e) => set("processStage", e.target.value)} placeholder="如：焙烧 / 挥发" />
                </Field>
                <Field label="层级（如 设备输入输出模型）">
                  <Input value={form.hierarchy ?? ""} onChange={(e) => set("hierarchy", e.target.value)} />
                </Field>
                <Field label="对象 / 粒度">
                  <Input value={form.scopeObject ?? ""} onChange={(e) => set("scopeObject", e.target.value)} placeholder="如：回转挥发窑；单窑体稳态工况" />
                </Field>
                <Field label="功能 / 用途" className="md:col-span-2">
                  <Textarea rows={2} value={form.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} />
                </Field>
                <Field label="方法 / 结构">
                  <Input value={form.methodStructure ?? ""} onChange={(e) => set("methodStructure", e.target.value)} placeholder="如：稳态、确定性；等效参数" />
                </Field>
                <Field label="成熟 / 部署">
                  <Input value={form.maturity ?? ""} onChange={(e) => set("maturity", e.target.value)} />
                </Field>
                <Field label="关键词（逗号分隔）">
                  <Input
                    value={(form.keywords ?? []).join("，")}
                    onChange={(e) => set("keywords", e.target.value.split(/[，,]/).map((s) => s.trim()).filter(Boolean))}
                  />
                </Field>
                <Field label="状态">
                  <Select value={form.status ?? "DEVELOPING"} onValueChange={(v) => set("status", v as Metamodel["status"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="来源 / 权属">
                  <Input value={form.sourceOwnership ?? ""} onChange={(e) => set("sourceOwnership", e.target.value)} placeholder="如：中南大学" />
                </Field>
                <Field label="作者 / 维护">
                  <Input value={form.authorMaintainer ?? ""} onChange={(e) => set("authorMaintainer", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section title="二、适用范围与前提">
              <div className="space-y-4">
                <Field label="场景 / 有效域"><Textarea rows={2} value={form.sceneDomain ?? ""} onChange={(e) => set("sceneDomain", e.target.value)} /></Field>
                <Field label="假设 / 边界"><Textarea rows={2} value={form.assumptions ?? ""} onChange={(e) => set("assumptions", e.target.value)} placeholder="A1 …；A2 …；A3 …" /></Field>
                <Field label="限制 / 精度"><Textarea rows={2} value={form.limitsPrecision ?? ""} onChange={(e) => set("limitsPrecision", e.target.value)} /></Field>
              </div>
            </Section>

            <Section title="三、结构与核心关系">
              <div className="space-y-4">
                <Field label="流程标签链（依次填写各环节）">
                  <div className="space-y-2">
                    {(form.structureFlow ?? []).map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={s}
                          onChange={(e) => {
                            const arr = [...(form.structureFlow ?? [])];
                            arr[i] = e.target.value;
                            set("structureFlow", arr);
                          }}
                          placeholder={`环节 ${i + 1}，如：温度/流量 → NTU/ε → 守恒 → 出口温度`}
                        />
                        <Button variant="ghost" size="icon" onClick={() => set("structureFlow", (form.structureFlow ?? []).filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => set("structureFlow", [...(form.structureFlow ?? []), ""])}>
                      <Plus className="mr-1 h-4 w-4" /> 添加环节
                    </Button>
                  </div>
                </Field>
                <Field label="核心关系式">
                  <RelationEditor
                    rows={(form.coreRelations ?? []).map((r) => (typeof r === "string" ? { id: "E(?)", expression: r, note: "" } : r))}
                    onChange={(rows) => set("coreRelations", rows)}
                  />
                </Field>
              </div>
            </Section>

            <Section title="四、变量与参数定义">
              <IoParamEditor
                rows={form.ioParams ?? []}
                onChange={(rows) => set("ioParams", rows)}
              />
            </Section>

            <Section title="五、计算、推理与接口">
              <div className="space-y-4">
                <Field label="方法 / 流程"><Textarea rows={2} value={form.methodFlow ?? ""} onChange={(e) => set("methodFlow", e.target.value)} /></Field>
                <Field label="入口 / 响应"><Textarea rows={2} value={form.entryInterface ?? ""} onChange={(e) => set("entryInterface", e.target.value)} placeholder="如：predict(inputs, params) → dict" /></Field>
                <Field label="异常 / 性能"><Textarea rows={2} value={form.exceptionBehavior ?? ""} onChange={(e) => set("exceptionBehavior", e.target.value)} /></Field>
              </div>
            </Section>

            <Section title="六、源代码交付、部署与组合">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="环境 / 材料"><Textarea rows={2} value={form.envMaterials ?? ""} onChange={(e) => set("envMaterials", e.target.value)} /></Field>
                <Field label="源码清单"><Textarea rows={2} value={form.sourceManifest ?? ""} onChange={(e) => set("sourceManifest", e.target.value)} /></Field>
                <Field label="交付 / 复现"><Textarea rows={2} value={form.deliveryRepro ?? ""} onChange={(e) => set("deliveryRepro", e.target.value)} /></Field>
                <Field label="部署 / 组合"><Textarea rows={2} value={form.deployCombination ?? ""} onChange={(e) => set("deployCombination", e.target.value)} /></Field>
              </div>
            </Section>

            <Section title="七、验证与确认">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="基准 / 交叉"><Textarea rows={2} value={form.validationBaseline ?? ""} onChange={(e) => set("validationBaseline", e.target.value)} /></Field>
                <Field label="极限 / 确认"><Textarea rows={2} value={form.validationLimits ?? ""} onChange={(e) => set("validationLimits", e.target.value)} /></Field>
              </div>
            </Section>

            <Section title="八、版本记录">
              <Field label="登记说明（写入版本记录）">
                <Input value={form.initialChangelog ?? ""} onChange={(e) => set("initialChangelog", e.target.value)} />
              </Field>
            </Section>
          </CardContent>
        </Card>

        {/* ========== 已登记列表 ========== */}
        <Card className="h-fit">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">已登记（{TYPE_LABEL[modelType]}）</h3>
              <Badge variant="secondary">{list.length}</Badge>
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-y-auto scrollbar-thin">
              {list.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">暂无登记记录</p>
              )}
              {list.map((m) => (
                <div
                  key={m.id}
                  className={`group rounded-lg border p-3 text-sm ${
                    editing?.id === m.id ? "border-primary bg-accent" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{m.metaCode}</p>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(m)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs">{STATUS_LABEL[m.status] ?? m.status}</Badge>
                    {m.industry && <Badge variant="outline" className="text-xs">{m.industry}</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">v{m.versionNo}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------- 小组件 ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="panel-title-bar text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RelationEditor({
  rows,
  onChange,
}: {
  rows: MetamodelRelation[];
  onChange: (rows: MetamodelRelation[]) => void;
}) {
  function update(i: number, patch: Partial<MetamodelRelation>) {
    const arr = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange(arr);
  }
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="rounded-md border border-border p-3">
          <div className="flex gap-2">
            <Input
              className="w-24 font-mono"
              value={r.id}
              onChange={(e) => update(i, { id: e.target.value })}
              placeholder="E(1)"
            />
            <Input
              value={r.expression}
              onChange={(e) => update(i, { expression: e.target.value })}
              placeholder="关系式 / 规则表达"
            />
            <Button variant="ghost" size="icon" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            className="mt-2 text-xs"
            value={r.note ?? ""}
            onChange={(e) => update(i, { note: e.target.value })}
            placeholder="备注（可选）"
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { id: `E(${rows.length + 1})`, expression: "", note: "" }])}
      >
        <Plus className="mr-1 h-4 w-4" /> 添加关系式
      </Button>
    </div>
  );
}

function IoParamEditor({
  rows,
  onChange,
}: {
  rows: MetamodelIoParam[];
  onChange: (rows: MetamodelIoParam[]) => void;
}) {
  function update(i: number, patch: Partial<MetamodelIoParam>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="px-2 py-2 font-medium">类别</th>
            <th className="px-2 py-2 font-medium">变量名/符号</th>
            <th className="px-2 py-2 font-medium">类型/维度</th>
            <th className="px-2 py-2 font-medium">单位</th>
            <th className="px-2 py-2 font-medium">范围/必需性</th>
            <th className="px-2 py-2 font-medium">例值/缺省</th>
            <th className="px-2 py-2 font-medium">来源/含义</th>
            <th className="w-10 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              <td className="px-2 py-1.5">
                <Select value={r.category} onValueChange={(v) => update(i, { category: v })}>
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IO_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
              <td className="px-2 py-1.5"><Input className="h-8" value={r.symbol} onChange={(e) => update(i, { symbol: e.target.value })} /></td>
              <td className="px-2 py-1.5"><Input className="h-8" value={r.dtype} onChange={(e) => update(i, { dtype: e.target.value })} placeholder="float; 标量" /></td>
              <td className="px-2 py-1.5"><Input className="h-8 w-20" value={r.unit ?? ""} onChange={(e) => update(i, { unit: e.target.value })} /></td>
              <td className="px-2 py-1.5"><Input className="h-8" value={r.rangeRequired ?? ""} onChange={(e) => update(i, { rangeRequired: e.target.value })} placeholder=">0；必需" /></td>
              <td className="px-2 py-1.5"><Input className="h-8" value={r.exampleDefault ?? ""} onChange={(e) => update(i, { exampleDefault: e.target.value })} /></td>
              <td className="px-2 py-1.5"><Input className="h-8" value={r.sourceMeaning ?? ""} onChange={(e) => update(i, { sourceMeaning: e.target.value })} /></td>
              <td className="px-2 py-1.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-2 py-6 text-center text-xs text-muted-foreground">
                暂无变量定义，点击下方按钮添加
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="p-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...rows,
              { category: "输入", symbol: "", dtype: "float; 标量", dim: "1", unit: "", rangeRequired: "", exampleDefault: "", sourceMeaning: "" },
            ])
          }
        >
          <Plus className="mr-1 h-4 w-4" /> 添加变量
        </Button>
      </div>
    </div>
  );
}
