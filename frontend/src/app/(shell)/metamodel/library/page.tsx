"use client";

/**
 * 元模型库 —— 四类元模型的检索、详情查看、导入导出。
 */
import * as React from "react";
import { toast } from "sonner";
import {
  Boxes,
  Brain,
  Code2,
  Download,
  FilePlus2,
  FileUp,
  Loader2,
  Network,
  RefreshCw,
  Search,
} from "lucide-react";

import { api } from "@/lib/api";
import type {
  Metamodel,
  MetamodelDetail,
  MetamodelFacets,
  MetamodelType,
} from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function MetamodelLibraryPage() {
  const [list, setList] = React.useState<Metamodel[]>([]);
  const [facets, setFacets] = React.useState<MetamodelFacets | null>(null);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [keyword, setKeyword] = React.useState("");
  const [modelType, setModelType] = React.useState<string>("all");
  const [industry, setIndustry] = React.useState<string>("all");
  const [status, setStatus] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(false);
  const [detail, setDetail] = React.useState<MetamodelDetail | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.metamodels.list({
        page,
        pageSize: 20,
        keyword: keyword || undefined,
        modelType: modelType !== "all" ? modelType : undefined,
        industry: industry !== "all" ? industry : undefined,
        status: status !== "all" ? status : undefined,
      });
      setList(res.list);
      setTotal(res.meta.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, keyword, modelType, industry, status]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    api.metamodels.facets().then(setFacets).catch(() => {});
  }, []);

  async function openDetail(id: number) {
    try {
      setDetail(await api.metamodels.get(id));
    } catch {
      toast.error("详情加载失败");
    }
  }

  function download(format: "json" | "excel") {
    const url = api.metamodels.exportUrl(format, modelType !== "all" ? modelType : undefined);
    window.open(url, "_blank");
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : parsed.metamodels;
      if (!Array.isArray(items)) throw new Error("JSON 需为数组或含 metamodels 字段");
      const res = await api.metamodels.importJson(items);
      toast.success(`导入完成：新增 ${res.created}，更新 ${res.updated}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败");
    }
  }

  const typeCount = (t: string) =>
    facets?.modelType.find((b) => b.value === t)?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">元模型库</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            四类元模型的登记资产：检索查看、模板化导入导出
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".json" hidden onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp className="mr-1 h-4 w-4" /> 导入 JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => download("excel")}>
            <Download className="mr-1 h-4 w-4" /> 导出 Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => download("json")}>
            <Download className="mr-1 h-4 w-4" /> 导出 JSON
          </Button>
        </div>
      </div>

      {/* 四类统计卡 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["MECHANISM", "DATA_MODEL", "ALGORITHM", "KNOWLEDGE_RULE"] as MetamodelType[]).map(
          (t) => (
            <button
              key={t}
              onClick={() => {
                setModelType(modelType === t ? "all" : t);
                setPage(1);
              }}
              className={`flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                modelType === t ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div>
                <p className="text-sm font-medium">{TYPE_LABEL[t]}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{typeCount(t)}</p>
              </div>
              <Network className="h-8 w-8 text-muted-foreground/40" />
            </button>
          )
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          {/* 筛选栏 */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Tabs value={modelType} onValueChange={(v) => { setModelType(v); setPage(1); }}>
              <TabsList>
                <TabsTrigger value="all">全部</TabsTrigger>
                {Object.entries(TYPE_LABEL).map(([v, l]) => (
                  <TabsTrigger key={v} value={v}>{l}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-56 pl-8"
                  placeholder="搜索名称 / 编号 / 用途…"
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={industry} onValueChange={(v) => { setIndustry(v); setPage(1); }}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部行业</SelectItem>
                  {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={load}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 列表 */}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">模型编号</th>
                  <th className="px-3 py-2.5 font-medium">名称</th>
                  <th className="px-3 py-2.5 font-medium">类别</th>
                  <th className="px-3 py-2.5 font-medium">领域/工序</th>
                  <th className="px-3 py-2.5 font-medium">版本</th>
                  <th className="px-3 py-2.5 font-medium">状态</th>
                  <th className="px-3 py-2.5 font-medium">调用</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr
                    key={m.id}
                    className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/50"
                    onClick={() => openDetail(m.id)}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{m.metaCode}</td>
                    <td className="max-w-[280px] truncate px-3 py-2.5 font-medium">{m.name}</td>
                    <td className="px-3 py-2.5"><Badge variant="secondary">{TYPE_LABEL[m.modelType]}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {m.industry}{m.processStage ? ` · ${m.processStage}` : ""}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">v{m.versionNo}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={m.status === "ONLINE" ? "default" : "outline"}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{m.callCount}</td>
                  </tr>
                ))}
                {list.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-sm text-muted-foreground">
                      没有匹配的元模型
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>共 {total} 条</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                上一页
              </Button>
              <span className="px-2 leading-8">第 {page} 页</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 详情侧栏 */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-[560px] overflow-y-auto sm:max-w-[560px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base">
              {detail?.name}
              {detail && <Badge variant="secondary">{TYPE_LABEL[detail.modelType]}</Badge>}
            </SheetTitle>
            {detail && (
              <p className="font-mono text-xs text-muted-foreground">
                {detail.metaCode} · v{detail.versionNo} · {STATUS_LABEL[detail.status]}
              </p>
            )}
          </SheetHeader>
          {detail && (
            <div className="mt-4 space-y-5 px-4 pb-8">
              <DetailSection title="一、基本信息">
                <DetailGrid
                  rows={[
                    ["领域/层级", [detail.domain, detail.hierarchy].filter(Boolean).join(" · ")],
                    ["功能/用途", detail.purpose],
                    ["方法/结构", detail.methodStructure],
                    ["对象/粒度", detail.scopeObject],
                    ["关键词", (detail.keywords ?? []).join("、")],
                    ["来源/权属", detail.sourceOwnership],
                    ["作者/维护", detail.authorMaintainer],
                  ]}
                />
              </DetailSection>
              <DetailSection title="二、适用范围与前提">
                <DetailGrid
                  rows={[
                    ["场景/有效域", detail.sceneDomain],
                    ["假设/边界", detail.assumptions],
                    ["限制/精度", detail.limitsPrecision],
                  ]}
                />
              </DetailSection>
              {(detail.structureFlow?.length || detail.coreRelations?.length) ? (
                <DetailSection title="三、结构与核心关系">
                  {detail.structureFlow?.length ? (
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      {detail.structureFlow.map((s, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          <Badge variant="outline">{s}</Badge>
                          {i < (detail.structureFlow?.length ?? 0) - 1 && (
                            <span className="text-muted-foreground">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    {(detail.coreRelations ?? []).map((r, i) => (
                      <div key={i} className="rounded-md border border-border bg-muted/30 p-2.5">
                        <span className="font-mono text-xs font-semibold text-primary">{r.id}</span>
                        <p className="mt-1 font-mono text-xs leading-relaxed">{r.expression}</p>
                        {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
                      </div>
                    ))}
                  </div>
                </DetailSection>
              ) : null}
              {detail.ioParams?.length ? (
                <DetailSection title="四、变量与参数定义">
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                          <th className="px-2 py-1.5 font-medium">类别</th>
                          <th className="px-2 py-1.5 font-medium">符号</th>
                          <th className="px-2 py-1.5 font-medium">类型</th>
                          <th className="px-2 py-1.5 font-medium">单位</th>
                          <th className="px-2 py-1.5 font-medium">范围/必需</th>
                          <th className="px-2 py-1.5 font-medium">来源/含义</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.ioParams.map((p, i) => (
                          <tr key={i} className="border-b border-border/60 last:border-0">
                            <td className="px-2 py-1.5">{p.category}</td>
                            <td className="px-2 py-1.5 font-mono">{p.symbol}</td>
                            <td className="px-2 py-1.5">{p.dtype}</td>
                            <td className="px-2 py-1.5">{p.unit || "—"}</td>
                            <td className="px-2 py-1.5">{p.rangeRequired || "—"}</td>
                            <td className="px-2 py-1.5">{p.sourceMeaning || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DetailSection>
              ) : null}
              <DetailSection title="五、计算、推理与接口">
                <DetailGrid
                  rows={[
                    ["方法/流程", detail.methodFlow],
                    ["入口/响应", detail.entryInterface],
                    ["异常/性能", detail.exceptionBehavior],
                  ]}
                />
              </DetailSection>
              <DetailSection title="六、源代码交付、部署与组合">
                <DetailGrid
                  rows={[
                    ["环境/材料", detail.envMaterials],
                    ["源码清单", detail.sourceManifest],
                    ["交付/复现", detail.deliveryRepro],
                    ["部署/组合", detail.deployCombination],
                  ]}
                />
              </DetailSection>
              <DetailSection title="七、验证与确认">
                <DetailGrid
                  rows={[
                    ["基准/交叉", detail.validationBaseline],
                    ["极限/确认", detail.validationLimits],
                  ]}
                />
              </DetailSection>
              {(detail.versions?.length ?? 0) > 0 && (
                <DetailSection title="八、版本记录">
                  <div className="space-y-1.5">
                    {detail.versions!.map((v) => (
                      <div key={v.id} className="flex items-start gap-2 text-xs">
                        <Badge variant="outline" className="font-mono">v{v.versionNo}</Badge>
                        <span className="text-muted-foreground">{v.changelog}</span>
                        <span className="ml-auto shrink-0 text-muted-foreground/70">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="panel-title-bar text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function DetailGrid({ rows }: { rows: [string, string | null | undefined][] }) {
  const visible = rows.filter(([, v]) => v);
  if (visible.length === 0) return <p className="text-xs text-muted-foreground">（未填写）</p>;
  return (
    <dl className="space-y-2">
      {visible.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[96px_1fr] gap-2 text-xs">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="leading-relaxed">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
