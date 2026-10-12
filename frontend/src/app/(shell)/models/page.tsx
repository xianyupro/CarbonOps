"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatNumber } from "@/lib/utils";
import {
  INDUSTRY_OPTIONS,
  MODEL_FUNCTION_BADGE,
  MODEL_FUNCTION_OPTIONS,
  MODEL_STATUS_BADGE,
} from "@/lib/constants";
import { ModelDetailSheet } from "@/components/data/model-detail-sheet";
import type {
  FacetBucket,
  ModelFacets,
  ModelFunctionType,
  ModelInvokeResult,
  ModelRegistry,
  ModelStatus,
} from "@/types/api";

const PAGE_SIZE = 20;

type SortBy = "createdAt" | "name" | "callCount" | "accuracy";

interface FormState {
  name: string;
  code: string;
  functionType: ModelFunctionType;
  industry: string;
  processStage: string;
  description: string;
  tags: string;
  provider: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  functionType: "OPTIMIZATION",
  industry: "通用",
  processStage: "",
  description: "",
  tags: "",
  provider: "",
};

const FACET_TITLES: Record<string, string> = {
  industry: "行业",
  functionType: "功能类型",
  provider: "提供单位",
  status: "状态",
};

export default function ModelsPage() {
  const hasRead = useAuthStore((s) => s.hasPermission("model:read"));
  const hasWrite = useAuthStore((s) => s.hasPermission("model:write"));

  const [items, setItems] = React.useState<ModelRegistry[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [keyword, setKeyword] = React.useState("");
  const [selectedIndustries, setSelectedIndustries] = React.useState<string[]>([]);
  const [selectedFunctionTypes, setSelectedFunctionTypes] = React.useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = React.useState<string[]>([]);
  const [sortBy, setSortBy] = React.useState<SortBy>("createdAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);

  const [facets, setFacets] = React.useState<ModelFacets | null>(null);

  // Create/Edit dialog
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ModelRegistry | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Detail sheet
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetModelId, setSheetModelId] = React.useState<number | null>(null);

  // Invoke dialog
  const [invokeTarget, setInvokeTarget] = React.useState<ModelRegistry | null>(null);
  const [invokeInput, setInvokeInput] = React.useState(
    JSON.stringify({ sample: "input" }, null, 2)
  );
  const [invokeResult, setInvokeResult] = React.useState<ModelInvokeResult | null>(null);
  const [invoking, setInvoking] = React.useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<ModelRegistry | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Load facets
  const loadFacets = React.useCallback(async () => {
    try {
      const f = await api.models.facets(keyword || undefined);
      setFacets(f);
    } catch {
      // silent
    }
  }, [keyword]);

  async function load(targetPage = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.models.list({
        page: targetPage,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        industry: selectedIndustries.join(",") || undefined,
        functionType: selectedFunctionTypes.join(",") || undefined,
        status: selectedStatuses.join(",") || undefined,
        provider: selectedProviders.join(",") || undefined,
        sortBy,
        sortOrder,
      });
      const list = Array.isArray(res) ? res : (res.list ?? []);
      const nextTotal = Array.isArray(res) ? list.length : (res.meta?.total ?? list.length);
      setItems(list);
      setTotal(nextTotal);
      if (targetPage > 1 && list.length === 0 && nextTotal > 0) {
        setPage(Math.max(1, Math.ceil(nextTotal / PAGE_SIZE)));
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "加载模型列表失败，请确认后端服务已启动"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Initial load + facets
  React.useEffect(() => {
    void load(1);
    void loadFacets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when facet filters or sort change
  React.useEffect(() => {
    setPage(1);
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndustries, selectedFunctionTypes, selectedStatuses, selectedProviders, sortBy, sortOrder]);

  React.useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Debounced facets reload on keyword change
  React.useEffect(() => {
    const timer = setTimeout(() => void loadFacets(), 400);
    return () => clearTimeout(timer);
  }, [keyword, loadFacets]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    void load(1);
  }

  function toggleFilter(value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(m: ModelRegistry) {
    setEditing(m);
    setForm({
      name: m.name,
      code: m.code,
      functionType: m.functionType,
      industry: m.industry || "通用",
      processStage: m.processStage ?? "",
      description: m.description ?? "",
      tags: (m.tags ?? []).join(", "),
      provider: m.provider ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  function openQuickView(m: ModelRegistry) {
    setSheetModelId(m.id);
    setSheetOpen(true);
  }

  function openInvoke(m: ModelRegistry) {
    setInvokeTarget(m);
    setInvokeInput(JSON.stringify({ sample: "input" }, null, 2));
    setInvokeResult(null);
  }

  async function submitForm() {
    setFormError(null);
    if (!form.name.trim()) { setFormError("请输入模型名称"); return; }
    if (!form.code.trim()) { setFormError("请输入模型编码"); return; }

    setSubmitting(true);
    try {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (editing) {
        await api.models.update(editing.id, {
          name: form.name.trim(),
          industry: form.industry,
          functionType: form.functionType,
          processStage: form.processStage || undefined,
          description: form.description || undefined,
          tags: tags.length > 0 ? tags : undefined,
          provider: form.provider || undefined,
        });
        toast.success("已更新模型");
      } else {
        await api.models.create({
          name: form.name.trim(),
          code: form.code.trim(),
          industry: form.industry,
          functionType: form.functionType,
          processStage: form.processStage || undefined,
          description: form.description || undefined,
          tags: tags.length > 0 ? tags : undefined,
          provider: form.provider || undefined,
        });
        toast.success("已创建模型");
      }
      setFormOpen(false);
      await load(page);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "保存失败，请重试";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInvoke() {
    if (!invokeTarget) return;
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(invokeInput); } catch { toast.error("输入不是有效的 JSON"); return; }
    setInvoking(true);
    setInvokeResult(null);
    try {
      const result = await api.models.invoke(invokeTarget.id, { input: parsed });
      setInvokeResult(result);
      toast.success(`推理完成（${result.latencyMs} ms）`);
      await load(page);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "推理调用失败");
    } finally {
      setInvoking(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.models.delete(deleteTarget.id);
      toast.success(`已删除 ${deleteTarget.name}`);
      setDeleteTarget(null);
      await load(page);
      void loadFacets();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPrev = page > 1;
  const showNext = page < totalPages;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="智能模型 · Model Library"
        icon={Boxes}
        title="模型库"
        description="工业碳排优化模型的登记、版本管理与推理调用"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { void load(page); void loadFacets(); }} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            {hasWrite ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建模型
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex gap-5">
        {/* Faceted Sidebar */}
        <aside className="hidden w-[200px] shrink-0 lg:block">
          {facets ? (
            <div className="space-y-5 sticky top-4">
              <FacetSection
                title="行业"
                buckets={facets.industry}
                selected={selectedIndustries}
                onToggle={(v) => toggleFilter(v, setSelectedIndustries)}
              />
              <FacetSection
                title="功能类型"
                buckets={facets.functionType}
                selected={selectedFunctionTypes}
                onToggle={(v) => toggleFilter(v, setSelectedFunctionTypes)}
              />
              <FacetSection
                title="提供单位"
                buckets={facets.provider}
                selected={selectedProviders}
                onToggle={(v) => toggleFilter(v, setSelectedProviders)}
              />
              <FacetSection
                title="状态"
                buckets={facets.status}
                selected={selectedStatuses}
                onToggle={(v) => toggleFilter(v, setSelectedStatuses)}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={`fs-${i}`} className="h-24 w-full" />
              ))}
            </div>
          )}
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Top Bar: Search + Sort */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <form onSubmit={onSearchSubmit} className="relative flex-1" role="search">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索名称 / 编码 / 描述…"
                  className="pl-9"
                  aria-label="搜索模型"
                />
              </form>
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                  <SelectTrigger className="h-9 w-[130px]" aria-label="排序字段">
                    <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">创建时间</SelectItem>
                    <SelectItem value="name">名称</SelectItem>
                    <SelectItem value="callCount">调用次数</SelectItem>
                    <SelectItem value="accuracy">准确率</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
                >
                  {sortOrder === "desc" ? "↓" : "↑"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active filters */}
          {(selectedIndustries.length > 0 || selectedFunctionTypes.length > 0 || selectedStatuses.length > 0 || selectedProviders.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">已选筛选:</span>
              {[
    ...selectedIndustries.map((v) => ({ group: "industry", value: v })),
    ...selectedFunctionTypes.map((v) => ({ group: "functionType", value: v })),
    ...selectedStatuses.map((v) => ({ group: "status", value: v })),
    ...selectedProviders.map((v) => ({ group: "provider", value: v })),
  ].map(({ group, value }) => (
                <Badge
                  key={`${group}-${value}`}
                  variant="muted"
                  className="cursor-pointer gap-1"
                  onClick={() => {
                    if (group === "industry") toggleFilter(value, setSelectedIndustries);
                    if (group === "functionType") toggleFilter(value, setSelectedFunctionTypes);
                    if (group === "status") toggleFilter(value, setSelectedStatuses);
                    if (group === "provider") toggleFilter(value, setSelectedProviders);
                  }}
                >
                  {value} ×
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs"
                onClick={() => {
                  setSelectedIndustries([]);
                  setSelectedFunctionTypes([]);
                  setSelectedStatuses([]);
                  setSelectedProviders([]);
                }}
              >
                清除全部
              </Button>
            </div>
          )}

          {/* Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24%]">模型信息</TableHead>
                  <TableHead>行业</TableHead>
                  <TableHead>功能类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="hidden xl:table-cell">提供单位</TableHead>
                  <TableHead className="w-[120px]">准确率</TableHead>
                  <TableHead className="text-right">调用</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead className="w-[60px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                      <TableCell className="hidden xl:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center">
                      <div className="flex flex-col items-center gap-2 text-sm text-destructive">
                        <Loader2 className="h-5 w-5" />
                        {error}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-2">
                      <EmptyState
                        icon={Boxes}
                        title="暂无模型"
                        description="可调整筛选条件，或点击右上角新建模型"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((m) => {
                    const fnMeta = MODEL_FUNCTION_BADGE[m.functionType] ?? {
                      label: m.functionType, variant: "outline" as const,
                    };
                    const stMeta = MODEL_STATUS_BADGE[m.status] ?? {
                      label: m.status, variant: "muted" as const,
                    };
                    const accPct = m.accuracy > 0 ? Math.round(m.accuracy * 100) : 0;
                    return (
                      <TableRow key={m.id} className="group">
                        <TableCell>
                          <Link
                            href={`/models/${m.id}`}
                            className="flex w-full items-start gap-2.5 text-left"
                          >
                            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <Boxes className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground group-hover:text-primary">
                                {m.name}
                              </div>
                              <div className="truncate font-mono text-xs text-muted-foreground">
                                {m.code}
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.industry || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={fnMeta.variant}>{fnMeta.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={stMeta.variant}>{stMeta.label}</Badge>
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                          {m.provider ?? "—"}
                        </TableCell>
                        <TableCell>
                          {m.accuracy > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${Math.min(100, accPct)}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {accPct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(m.callCount)}
                        </TableCell>
                        <TableCell>
                          {m.latestVersion ? (
                            <Badge variant="outline" className="font-mono">
                              {m.latestVersion}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => openQuickView(m)}>
                                <Eye className="h-4 w-4" />
                                快速预览
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/models/${m.id}`} className="flex items-center">
                                  <Boxes className="h-4 w-4" />
                                  查看详情
                                </Link>
                              </DropdownMenuItem>
                              {hasRead ? (
                                <DropdownMenuItem onSelect={() => openInvoke(m)}>
                                  <Play className="h-4 w-4" />
                                  调用推理
                                </DropdownMenuItem>
                              ) : null}
                              {hasWrite ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => openEdit(m)}>
                                    <Pencil className="h-4 w-4" />
                                    编辑
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={() => setDeleteTarget(m)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    删除
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                共 <span className="font-medium text-foreground">{total}</span> 条
                {loading ? "（加载中）" : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!showPrev || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  上一页
                </Button>
                <span className="px-2 font-mono">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!showNext || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Detail sheet (quick view) */}
      <ModelDetailSheet
        modelId={sheetModelId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onChanged={() => void load(page)}
      />

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑模型" : "新建模型"}</DialogTitle>
            <DialogDescription>
              {editing ? "修改模型基本信息。编码不可变更。" : "登记新的工业碳排模型，提交后默认为开发中状态。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="model-name">名称 *</Label>
                <Input id="model-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：回转窑能耗优化模型" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model-code">编码 *</Label>
                <Input id="model-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="如：KILN_OPT_01" className="font-mono" disabled={!!editing} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>功能类型</Label>
                <Select value={form.functionType} onValueChange={(v) => setForm((f) => ({ ...f, functionType: v as ModelFunctionType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODEL_FUNCTION_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>行业</Label>
                <Select value={form.industry} onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="model-stage">工序阶段</Label>
                <Input id="model-stage" value={form.processStage} onChange={(e) => setForm((f) => ({ ...f, processStage: e.target.value }))} placeholder="如：煅烧 / 冶炼" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model-provider">提供单位</Label>
                <Input id="model-provider" value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} placeholder="如：中南大学" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model-tags">标签</Label>
              <Input id="model-tags" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="逗号分隔" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model-desc">描述</Label>
              <Textarea id="model-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="描述模型用途、适用场景等" rows={3} />
            </div>
            {formError ? <p className="text-[0.8rem] font-medium text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>取消</Button>
            <Button onClick={() => void submitForm()} disabled={submitting}>
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" />保存中…</>) : editing ? "保存修改" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoke dialog */}
      <Dialog open={!!invokeTarget} onOpenChange={(o) => !o && setInvokeTarget(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>调用推理</DialogTitle>
            <DialogDescription>
              {invokeTarget ? `模型：${invokeTarget.name}（${invokeTarget.code}）` : "向模型发送输入并获取推理结果"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invoke-input">输入 JSON</Label>
              <Textarea id="invoke-input" value={invokeInput} onChange={(e) => setInvokeInput(e.target.value)} rows={6} className="font-mono text-xs" spellCheck={false} />
            </div>
            {invokeResult ? (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">推理结果</span>
                  <Badge variant="success">{invokeResult.status}</Badge>
                  <span className="font-mono text-muted-foreground">{invokeResult.latencyMs} ms</span>
                </div>
                <pre className="overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                  <code>{JSON.stringify(invokeResult.output, null, 2)}</code>
                </pre>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvokeTarget(null)} disabled={invoking}>关闭</Button>
            <Button onClick={() => void handleInvoke()} disabled={invoking}>
              {invoking ? (<><Loader2 className="h-4 w-4 animate-spin" />推理中…</>) : (<><Play className="h-4 w-4" />执行推理</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>确认删除模型</DialogTitle>
            <DialogDescription>
              此操作将永久删除模型「{deleteTarget?.name}」及其所有版本与调用记录，无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>取消</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? (<><Loader2 className="h-4 w-4 animate-spin" />删除中…</>) : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Facet Section Component ----------
function FacetSection({
  title,
  buckets,
  selected,
  onToggle,
}: {
  title: string;
  buckets: FacetBucket[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (buckets.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1">
        {buckets.slice(0, 8).map((b) => (
          <label
            key={b.value}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/50"
          >
            <Checkbox
              checked={selected.includes(b.value)}
              onCheckedChange={() => onToggle(b.value)}
              className="h-3.5 w-3.5"
            />
            <span className="flex-1 truncate">{b.label}</span>
            <span className="font-mono text-xs text-muted-foreground">{b.count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
