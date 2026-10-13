"use client";

/**
 * 元模型学术检索中心 —— 平台学术资产的核心检索界面。
 * 布局：检索英雄区（统一检索 + 四类速览）→ 左侧分面栏 → 学术卡片流。
 * 详情：学术模型卡（摘要/公式/变量表/引用格式/关联图谱/版本谱系）。
 */
import * as React from "react";
import { toast } from "sonner";
import {
  Boxes,
  Brain,
  Code2,
  Copy,
  Download,
  FilePlus2,
  FileUp,
  Layers,
  Loader2,
  Quote,
  RefreshCw,
  Search,
} from "lucide-react";

import { api } from "@/lib/api";
import type {
  KgGraph,
  Metamodel,
  MetamodelDetail,
  MetamodelFacets,
  MetamodelType,
} from "@/types/api";
import KnowledgeGraphCanvas, {
  GraphEdge,
  GraphNode,
} from "@/components/kg/knowledge-graph-canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TYPE_META: Record<
  MetamodelType,
  { label: string; icon: React.ElementType; code: string }
> = {
  MECHANISM: { label: "机理模型", icon: Boxes, code: "MEC" },
  DATA_MODEL: { label: "数据模型", icon: Brain, code: "DAT" },
  ALGORITHM: { label: "算法模型", icon: Code2, code: "ALG" },
  KNOWLEDGE_RULE: { label: "知识规则模型", icon: FilePlus2, code: "KRL" },
};

const TYPE_LABEL = Object.fromEntries(
  Object.entries(TYPE_META).map(([k, v]) => [k, v.label])
) as Record<string, string>;

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
  const [pages, setPages] = React.useState(1);
  const [keyword, setKeyword] = React.useState("");
  const [modelType, setModelType] = React.useState<string>("all");
  const [industry, setIndustry] = React.useState<string>("all");
  const [status, setStatus] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState("createdAt");
  const [loading, setLoading] = React.useState(true);
  const [detail, setDetail] = React.useState<MetamodelDetail | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.metamodels.list({
        page,
        pageSize: 12,
        keyword: keyword || undefined,
        modelType: modelType !== "all" ? modelType : undefined,
        industry: industry !== "all" ? industry : undefined,
        status: status !== "all" ? status : undefined,
        sortBy,
        sortOrder: "desc",
      });
      setList(res.list);
      setTotal(res.meta.total);
      setPages(res.meta.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, keyword, modelType, industry, status, sortBy]);

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
    window.open(
      api.metamodels.exportUrl(format, modelType !== "all" ? modelType : undefined),
      "_blank"
    );
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items: Record<string, unknown>[] = Array.isArray(parsed)
        ? parsed
        : parsed.metamodels;
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
    <div className="space-y-4">
      {/* ===== 检索英雄区 ===== */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/[0.06] to-transparent px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-cyber text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                ② 元模型平台 · METAMODEL REPOSITORY
              </p>
              <h1 className="mt-0.5 text-lg font-bold">
                元模型学术检索中心
                <span className="ml-2 font-cyber text-xs font-normal text-muted-foreground">
                  共 {String(total).padStart(3, "0")} 项登记资产
                </span>
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept=".json" hidden onChange={handleImportFile} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <FileUp className="mr-1 h-3.5 w-3.5" /> 导入
              </Button>
              <Button variant="outline" size="sm" onClick={() => download("excel")}>
                <Download className="mr-1 h-3.5 w-3.5" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => download("json")}>
                <Download className="mr-1 h-3.5 w-3.5" /> JSON
              </Button>
            </div>
          </div>

          {/* 统一检索行 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[280px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9 text-sm"
                placeholder="统一检索：名称 / 模型编号 / 功能用途 / 领域…"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
              <SelectTrigger className="h-10 w-40">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">按登记时间</SelectItem>
                <SelectItem value="name">按名称</SelectItem>
                <SelectItem value="callCount">按调用量</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={load}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* 四类速览 */}
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(Object.keys(TYPE_META) as MetamodelType[]).map((t) => {
              const meta = TYPE_META[t];
              const Icon = meta.icon;
              const active = modelType === t;
              return (
                <button
                  key={t}
                  onClick={() => {
                    setModelType(modelType === t ? "all" : t);
                    setPage(1);
                  }}
                  className={`flex items-center gap-2.5 border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-primary bg-accent"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-sm ${
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{meta.label}</span>
                    <span className="font-cyber text-[10px] text-muted-foreground">
                      {meta.code} · {String(typeCount(t)).padStart(3, "0")} 项
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== 主体：分面栏 + 卡片流 ===== */}
      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit space-y-5 border border-border bg-card p-4 lg:sticky lg:top-2">
          <FacetGroup
            title="行业"
            buckets={(facets?.industry ?? []).map((f) => ({ v: f.value, c: f.count }))}
            active={industry}
            onPick={(v) => {
              setIndustry(industry === v ? "all" : v);
              setPage(1);
            }}
          />
          <FacetGroup
            title="状态"
            buckets={(facets?.status ?? []).map((f) => ({
              v: f.value,
              c: f.count,
              label: STATUS_LABEL[f.value] ?? f.value,
            }))}
            active={status}
            onPick={(v) => {
              setStatus(status === v ? "all" : v);
              setPage(1);
            }}
          />
          <div>
            <p className="panel-title-bar mb-2 text-[11px] font-semibold text-muted-foreground">
              检索说明
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              点击卡片查看学术模型卡：摘要 / 核心关系式 / 变量表 / 引用格式 / 关联图谱 / 版本谱系。
            </p>
          </div>
        </aside>

        <div className="space-y-3">
          {loading && list.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 检索中…
            </div>
          ) : list.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              没有匹配的元模型
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {list.map((m) => (
                <ModelCard key={m.id} m={m} onOpen={() => openDetail(m.id)} />
              ))}
            </div>
          )}

          {total > 12 && (
            <div className="flex items-center justify-between font-cyber text-xs text-muted-foreground">
              <span>
                PAGE {page} / {pages} · {total} RECORDS
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 学术模型卡详情 */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto scrollbar-thin p-0 sm:max-w-4xl">
          {detail && <ModelCardDetail detail={detail} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============ 学术卡片 ============ */

function ModelCard({ m, onOpen }: { m: Metamodel; onOpen: () => void }) {
  const meta = TYPE_META[m.modelType as MetamodelType];
  const Icon = meta?.icon ?? Layers;
  return (
    <button
      onClick={onOpen}
      className="group flex h-full flex-col border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-cyber text-[10px] tracking-wider text-muted-foreground">
          {m.metaCode}
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {TYPE_LABEL[m.modelType]}
        </Badge>
      </div>
      <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
        {m.name}
      </h3>
      <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
        {m.purpose || "（未填写功能用途）"}
      </p>
      {(m.keywords?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {m.keywords!.slice(0, 3).map((k) => (
            <span key={k} className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {k}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-2 font-cyber text-[10px] text-muted-foreground">
        <span>v{m.versionNo}</span>
        <span>{m.industry}</span>
        <span className="ml-auto">CALL {String(m.callCount).padStart(3, "0")}</span>
        {m.accuracy != null && (
          <span className="text-primary">ACC {(m.accuracy * 100).toFixed(0)}%</span>
        )}
      </div>
    </button>
  );
}

/* ============ 学术模型卡详情 ============ */

function ModelCardDetail({ detail }: { detail: MetamodelDetail }) {
  const [copied, setCopied] = React.useState(false);
  const citation = `${detail.metaCode}. ${detail.name}: ${
    TYPE_LABEL[detail.modelType] ?? "元模型"
  } v${detail.versionNo}[EB/OL]. 元模型学术检索中心, ${detail.createdAt?.slice(0, 4) ?? "2026"}.`;

  async function copyCitation() {
    try {
      await navigator.clipboard.writeText(citation.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("复制失败");
    }
  }

  return (
    <div className="space-y-5 p-6">
      <header className="border-b-2 border-foreground/80 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TYPE_LABEL[detail.modelType]}</Badge>
          <Badge variant={detail.status === "ONLINE" ? "default" : "outline"}>
            {STATUS_LABEL[detail.status]}
          </Badge>
          <span className="font-cyber text-[11px] text-muted-foreground">
            {detail.metaCode} · v{detail.versionNo} · {detail.createdAt?.slice(0, 10)}
          </span>
        </div>
        <h2 className="mt-2 text-xl font-bold leading-snug">{detail.name}</h2>
        <p className="mt-1 font-cyber text-[11px] text-muted-foreground">
          {detail.domain}
          {detail.processStage ? ` · ${detail.processStage}` : ""} ·{" "}
          {detail.authorMaintainer || detail.sourceOwnership || "平台登记"}
        </p>
        <div className="mt-3 flex items-start gap-2 bg-muted/50 p-2.5">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 break-all font-cyber text-[10px] leading-relaxed text-muted-foreground">
            {citation.trim()}
          </p>
          <Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-[10px]" onClick={copyCitation}>
            {copied ? "已复制" : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </header>

      {detail.purpose && (
        <Section title="摘 要">
          <p className="text-sm leading-relaxed">{detail.purpose}</p>
          {(detail.keywords?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detail.keywords!.map((k) => (
                <Badge key={k} variant="outline" className="text-[10px]">
                  {k}
                </Badge>
              ))}
            </div>
          )}
        </Section>
      )}

      {(detail.sceneDomain || detail.assumptions || detail.limitsPrecision) && (
        <Section title="适用范围与前提">
          <dl className="space-y-1.5 text-xs">
            <Row k="场景/有效域" v={detail.sceneDomain} />
            <Row k="假设/边界" v={detail.assumptions} />
            <Row k="限制/精度" v={detail.limitsPrecision} />
          </dl>
        </Section>
      )}

      {(detail.structureFlow?.length || detail.coreRelations?.length) ? (
        <Section title="结构与核心关系">
          {detail.structureFlow?.length ? (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {detail.structureFlow.map((s, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="border border-primary/40 bg-accent px-2 py-0.5 text-xs font-medium">
                    {s}
                  </span>
                  {i < detail.structureFlow!.length - 1 && (
                    <span className="text-muted-foreground">→</span>
                  )}
                </span>
              ))}
            </div>
          ) : null}
          <div className="space-y-2">
            {(detail.coreRelations ?? []).map((r, i) => (
              <div key={i} className="border-l-2 border-primary bg-muted/40 py-2 pl-3">
                <span className="font-cyber text-xs font-bold text-primary">{r.id}</span>
                <p className="mt-1 break-all font-cyber text-xs leading-relaxed">{r.expression}</p>
                {r.note && <p className="mt-1 text-[11px] text-muted-foreground">{r.note}</p>}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {detail.ioParams?.length ? (
        <Section title="变量与参数定义">
          <div className="overflow-x-auto border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <th className="px-2 py-1.5">类别</th>
                  <th className="px-2 py-1.5">符号</th>
                  <th className="px-2 py-1.5">类型</th>
                  <th className="px-2 py-1.5">单位</th>
                  <th className="px-2 py-1.5">范围/必需</th>
                  <th className="px-2 py-1.5">来源/含义</th>
                </tr>
              </thead>
              <tbody>
                {detail.ioParams.map((p, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0 even:bg-muted/20">
                    <td className="px-2 py-1.5">{p.category}</td>
                    <td className="px-2 py-1.5 font-cyber">{p.symbol}</td>
                    <td className="px-2 py-1.5">{p.dtype}</td>
                    <td className="px-2 py-1.5">{p.unit || "—"}</td>
                    <td className="px-2 py-1.5">{p.rangeRequired || "—"}</td>
                    <td className="px-2 py-1.5">{p.sourceMeaning || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {(detail.methodFlow || detail.entryInterface || detail.exceptionBehavior) && (
        <Section title="计算、推理与接口">
          <dl className="space-y-1.5 text-xs">
            <Row k="方法/流程" v={detail.methodFlow} />
            <Row k="入口/响应" v={detail.entryInterface} mono />
            <Row k="异常/性能" v={detail.exceptionBehavior} />
          </dl>
        </Section>
      )}

      {(detail.validationBaseline || detail.validationLimits) && (
        <Section title="验证与确认">
          <dl className="space-y-1.5 text-xs">
            <Row k="基准/交叉" v={detail.validationBaseline} />
            <Row k="极限/确认" v={detail.validationLimits} />
          </dl>
        </Section>
      )}

      <MetamodelKgMini metamodelId={detail.id} />

      {(detail.versions?.length ?? 0) > 0 && (
        <Section title="版本谱系">
          <ol className="space-y-2 border-l border-border pl-4">
            {detail.versions!.map((v) => (
              <li key={v.id} className="relative text-xs">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full border border-primary bg-card" />
                <span className="font-cyber font-semibold text-primary">v{v.versionNo}</span>
                <span className="ml-2 text-muted-foreground">{v.changelog}</span>
                <span className="ml-2 text-[10px] text-muted-foreground/60">
                  {new Date(v.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}

/* ============ 关联知识图谱小图 ============ */

function MetamodelKgMini({ metamodelId }: { metamodelId: number }) {
  const [data, setData] = React.useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    centerName: string;
  } | null>(null);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    let stopped = false;
    api.kg
      .graph()
      .then((g: KgGraph) => {
        if (stopped) return;
        const center = g.nodes.find(
          (n) => n.refType === "METAMODEL" && n.refId === metamodelId
        );
        if (!center) {
          setMissing(true);
          return;
        }
        const neighborIds = new Set<number>([center.id]);
        const edges = g.edges.filter((e) => {
          if (e.sourceNodeId === center.id) {
            neighborIds.add(e.targetNodeId);
            return true;
          }
          if (e.targetNodeId === center.id) {
            neighborIds.add(e.sourceNodeId);
            return true;
          }
          return false;
        });
        const nodes = g.nodes.filter((n) => neighborIds.has(n.id));
        setData({
          nodes: nodes.map((n) => ({ ...n, color: undefined })),
          edges: edges.map((e) => ({ ...e, source: e.sourceNodeId, target: e.targetNodeId })),
          centerName: center.name,
        });
      })
      .catch(() => setMissing(true));
    return () => {
      stopped = true;
    };
  }, [metamodelId]);

  if (missing) {
    return (
      <p className="rounded-md bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
        该元模型尚未注册到知识图谱（在「元模型平台·知识图谱」中按行业自动登记）
      </p>
    );
  }
  if (!data) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        图谱加载中…
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <KnowledgeGraphCanvas
        nodes={data.nodes}
        edges={data.edges}
        width={496}
        height={210}
        selectedNodeId={null}
      />
      <p className="border-t border-border bg-muted/40 px-2.5 py-1 text-[10px] text-muted-foreground">
        「{data.centerName}」的一跳关联 · {data.nodes.length} 节点 / {data.edges.length} 关系
      </p>
    </div>
  );
}

/* ============ 通用小件 ============ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-cyber text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ k, v, mono = false }: { k: string; v?: string | null; mono?: boolean }) {
  if (!v) return null;
  return (
    <div className="grid grid-cols-[92px_1fr] gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={mono ? "break-all font-cyber leading-relaxed" : "leading-relaxed"}>{v}</dd>
    </div>
  );
}

function FacetGroup({
  title,
  buckets,
  active,
  onPick,
}: {
  title: string;
  buckets: { v: string; c: number; label?: string }[];
  active: string;
  onPick: (v: string) => void;
}) {
  if (buckets.length === 0) return null;
  return (
    <div>
      <p className="panel-title-bar mb-2 text-[11px] font-semibold text-muted-foreground">{title}</p>
      <div className="space-y-0.5">
        {buckets.map((b) => {
          const isActive = active === b.v;
          return (
            <button
              key={b.v}
              onClick={() => onPick(isActive ? "all" : b.v)}
              className={`flex w-full items-center justify-between px-2 py-1 text-xs transition-colors ${
                isActive ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              <span className="truncate">{b.label ?? b.v}</span>
              <span className="font-cyber tabular-nums">{String(b.c).padStart(2, "0")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
