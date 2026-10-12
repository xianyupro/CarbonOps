"use client";

import * as React from "react";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Code,
  Eye,
  Gauge,
  LayoutGrid,
  LayoutPanelLeft,
  Loader2,
  MoreVertical,
  Pencil,
  PenTool,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { cn, formatDate } from "@/lib/utils";
import { INDUSTRY_OPTIONS } from "@/lib/constants";
import { StudioEditor } from "@/components/canvas/studio-editor";
import type { PageConfig as EditorPageConfig } from "@/lib/canvas/schema";
import { migratePageConfig } from "@/lib/canvas/schema";
import type {
  FormConfig,
  FormConfigDetail,
  FormConfigStatus,
} from "@/types/api";

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<
  FormConfigStatus,
  { label: string; variant: "muted" | "success" | "outline" }
> = {
  DRAFT: { label: "草稿", variant: "muted" },
  PUBLISHED: { label: "已发布", variant: "success" },
  ARCHIVED: { label: "已归档", variant: "outline" },
};

interface FormState {
  name: string;
  code: string;
  industry: string;
  scenario: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  industry: "通用",
  scenario: "",
  description: "",
};

/* ----------------------- pageConfig structural types ---------------------- */

interface PageComponentBinding {
  sourceCode?: string;
  point?: string;
  points?: string[];
  scenario?: string;
  agg?: string;
  window?: string;
}

interface PageComponent {
  id: string;
  type: "kpi" | "chart" | "gauge" | "alarm" | string;
  title: string;
  chartType?: string;
  position: { x: number; y: number; w: number; h: number };
  binding?: PageComponentBinding;
}

interface PageConfig {
  title?: string;
  layout?: string;
  style?: { background?: string; theme?: string };
  components?: PageComponent[];
}

const COMPONENT_TYPE_META: Record<
  string,
  { label: string; icon: React.ElementType }
> = {
  kpi: { label: "KPI", icon: Gauge },
  chart: { label: "图表", icon: BarChart3 },
  gauge: { label: "仪表", icon: Activity },
  alarm: { label: "告警", icon: Bell },
};

function parsePageConfig(raw: unknown): PageConfig | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as PageConfig;
}

function describeBinding(b?: PageComponentBinding): string {
  if (!b) return "";
  const parts: string[] = [];
  if (b.sourceCode) parts.push(`source: ${b.sourceCode}`);
  if (b.point) parts.push(`point: ${b.point}`);
  else if (Array.isArray(b.points) && b.points.length > 0)
    parts.push(`points: ${b.points.join(", ")}`);
  if (b.scenario) parts.push(`scenario: ${b.scenario}`);
  if (b.agg) parts.push(`agg: ${b.agg}`);
  if (b.window) parts.push(`window: ${b.window}`);
  return parts.join(" · ");
}

export default function StudioPage() {
  const hasWrite = useAuthStore((s) => s.hasPermission("studio:write"));

  const [items, setItems] = React.useState<FormConfig[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [keyword, setKeyword] = React.useState("");
  const [industry, setIndustry] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("");
  const [page, setPage] = React.useState(1);

  // Create/Edit dialog
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FormConfig | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Detail preview sheet
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetTarget, setSheetTarget] = React.useState<FormConfig | null>(null);

  // Publish confirmation
  const [publishTarget, setPublishTarget] = React.useState<FormConfig | null>(
    null
  );
  const [publishing, setPublishing] = React.useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<FormConfig | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);

  // Visual editor (full screen)
  const [editorTarget, setEditorTarget] = React.useState<FormConfig | null>(null);
  const [editorConfig, setEditorConfig] = React.useState<EditorPageConfig | null>(null);

  async function load(targetPage = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.forms.list({
        page: targetPage,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        industry: industry || undefined,
        status: (status || undefined) as FormConfigStatus | undefined,
      });
      const list = Array.isArray(res) ? res : (res.list ?? []);
      const nextTotal = Array.isArray(res)
        ? list.length
        : (res.meta?.total ?? list.length);
      setItems(list);
      setTotal(nextTotal);
      if (targetPage > 1 && list.length === 0 && nextTotal > 0) {
        setPage(Math.max(1, Math.ceil(nextTotal / PAGE_SIZE)));
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "加载组态工程列表失败，请确认后端服务已启动"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  React.useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when filters change (reset to page 1)
  React.useEffect(() => {
    if (page === 1) {
      void load(1);
    } else {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry, status]);

  React.useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (page === 1) {
      void load(1);
    } else {
      setPage(1);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(f: FormConfig) {
    setEditing(f);
    setForm({
      name: f.name,
      code: f.code,
      industry: f.industry || "通用",
      scenario: f.scenario ?? "",
      description: f.description ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  function openPreview(f: FormConfig) {
    setSheetTarget(f);
    setSheetOpen(true);
  }

  async function openEditor(f: FormConfig) {
    try {
      const detail = await api.forms.get(f.id);
      setEditorConfig(migratePageConfig(detail.pageConfig));
      setEditorTarget(f);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "加载工程配置失败");
    }
  }

  async function submitForm() {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("请输入工程名称");
      return;
    }
    if (!form.code.trim()) {
      setFormError("请输入工程编码");
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await api.forms.update(editing.id, {
          name: form.name.trim(),
          industry: form.industry,
          scenario: form.scenario || undefined,
          description: form.description || undefined,
        });
        toast.success("已更新组态工程");
      } else {
        await api.forms.create({
          name: form.name.trim(),
          code: form.code.trim(),
          industry: form.industry,
          scenario: form.scenario || undefined,
          description: form.description || undefined,
        });
        toast.success("已创建组态工程");
      }
      setFormOpen(false);
      await load(page);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "保存失败，请重试";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmPublish() {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      const res = await api.forms.publish(publishTarget.id);
      toast.success(`已发布 ${res.versionNo}`);
      setPublishTarget(null);
      await load(page);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.forms.delete(deleteTarget.id);
      toast.success(`已删除 ${deleteTarget.name}`);
      setDeleteTarget(null);
      await load(page);
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
        eyebrow="应用编排 · Studio"
        icon={LayoutPanelLeft}
        title="组态开发"
        description="工业组态画面、设备拓扑与可视化大屏的工程管理"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(page)}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
            {hasWrite ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建工程
              </Button>
            ) : null}
          </>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <form
            onSubmit={onSearchSubmit}
            className="relative flex-1"
            role="search"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索名称 / 编码 / 描述…"
              className="pl-9"
              aria-label="搜索组态工程"
            />
          </form>
          <div className="flex gap-3">
            <Select
              value={industry || "ALL"}
              onValueChange={(v) => setIndustry(v === "ALL" ? "" : v)}
            >
              <SelectTrigger className="w-[150px]" aria-label="行业">
                <SelectValue placeholder="行业" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部行业</SelectItem>
                {INDUSTRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status || "ALL"}
              onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}
            >
              <SelectTrigger className="w-[130px]" aria-label="状态">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="PUBLISHED">已发布</SelectItem>
                <SelectItem value="ARCHIVED">已归档</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">工程信息</TableHead>
              <TableHead>行业</TableHead>
              <TableHead>关联场景</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>版本</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="w-[60px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell>
                    <Skeleton className="h-5 w-44" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-14" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-14" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-14" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-10" />
                  </TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-sm text-destructive">
                    <Loader2 className="h-5 w-5" />
                    {error}
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-2">
                  <EmptyState
                    icon={PenTool}
                    title="暂无组态工程"
                    description="可调整筛选条件，或点击右上角新建工程"
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((f) => {
                const stMeta = STATUS_BADGE[f.status] ?? {
                  label: f.status,
                  variant: "muted" as const,
                };
                return (
                  <TableRow key={f.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2.5 text-left"
                        onClick={() => openPreview(f)}
                      >
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <PenTool className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground hover:text-primary">
                            {f.name}
                          </div>
                          <div className="truncate font-mono text-xs text-muted-foreground">
                            {f.code}
                          </div>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.industry || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.scenario || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stMeta.variant}>{stMeta.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {f.versionNo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(f.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={() => openPreview(f)}>
                            <Eye className="h-4 w-4" />
                            查看预览
                          </DropdownMenuItem>
                          {hasWrite ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => openEditor(f)}>
                                <Sparkles className="h-4 w-4" />
                                可视化编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openEdit(f)}>
                                <Pencil className="h-4 w-4" />
                                编辑信息
                              </DropdownMenuItem>
                              {f.status === "DRAFT" ? (
                                <DropdownMenuItem
                                  onSelect={() => setPublishTarget(f)}
                                >
                                  <Rocket className="h-4 w-4" />
                                  发布
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setDeleteTarget(f)}
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

      {/* Detail preview sheet */}
      <FormDetailSheet
        target={sheetTarget}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={(f) => {
          setSheetOpen(false);
          void openEditor(f);
        }}
      />

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? "编辑组态工程" : "新建组态工程"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "修改工程基本信息。编码不可变更。"
                : "创建新的组态工程，提交后默认为草稿状态。"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-name">名称 *</Label>
                <Input
                  id="form-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="如：回转窑运行监控大屏"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-code">编码 *</Label>
                <Input
                  id="form-code"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="如：KILN_DASHBOARD"
                  className="font-mono"
                  disabled={!!editing}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>行业</Label>
                <Select
                  value={form.industry}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, industry: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择行业" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-scenario">关联场景</Label>
                <Input
                  id="form-scenario"
                  value={form.scenario}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scenario: e.target.value }))
                  }
                  placeholder="可选，如：煅烧 / 裂解 / 碳流"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="form-desc">描述</Label>
              <Textarea
                id="form-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="可选，描述工程用途、适用场景等"
                rows={3}
              />
            </div>

            {formError ? (
              <p className="text-[0.8rem] font-medium text-destructive">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button onClick={() => void submitForm()} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  保存中…
                </>
              ) : editing ? (
                "保存修改"
              ) : (
                "创建"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish confirmation */}
      <Dialog
        open={!!publishTarget}
        onOpenChange={(o) => !o && setPublishTarget(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>确认发布组态工程</DialogTitle>
            <DialogDescription>
              确认发布组态工程「{publishTarget?.name}」？发布后将由草稿转为已发布，并生成新版本号。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPublishTarget(null)}
              disabled={publishing}
            >
              取消
            </Button>
            <Button onClick={() => void confirmPublish()} disabled={publishing}>
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  发布中…
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  确认发布
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>确认删除组态工程</DialogTitle>
            <DialogDescription>
              此操作将永久删除组态工程「{deleteTarget?.name}」，无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  删除中…
                </>
              ) : (
                "确认删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-screen visual editor */}
      {editorTarget && editorConfig ? (
        <StudioEditor
          formId={editorTarget.id}
          formName={editorTarget.name}
          initialPageConfig={editorConfig}
          onClose={() => {
            setEditorTarget(null);
            setEditorConfig(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------ Detail Sheet ------------------------------ */

interface FormDetailSheetProps {
  target: FormConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (form: FormConfig) => void;
}

function FormDetailSheet({
  target,
  open,
  onOpenChange,
  onEdit,
}: FormDetailSheetProps) {
  const hasWrite = useAuthStore((s) => s.hasPermission("studio:write"));
  const [detail, setDetail] = React.useState<FormConfigDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !target) {
      setDetail(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await api.forms.get(target.id);
        if (active) setDetail(data);
      } catch (err) {
        if (active) {
          toast.error(
            err instanceof ApiError ? err.message : "加载组态详情失败"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, target]);

  const headerForm = detail ?? target;
  const stMeta = headerForm
    ? STATUS_BADGE[headerForm.status] ?? {
        label: headerForm.status,
        variant: "muted" as const,
      }
    : null;
  const pageConfig = detail ? parsePageConfig(detail.pageConfig) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[720px] lg:max-w-[720px]">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <SheetTitle className="text-lg">
              {loading && !detail ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                headerForm?.name ?? "组态工程详情"
              )}
            </SheetTitle>
            {headerForm && stMeta ? (
              <>
                <Badge variant={stMeta.variant}>{stMeta.label}</Badge>
                <Badge variant="outline" className="font-mono">
                  {headerForm.versionNo}
                </Badge>
              </>
            ) : null}
          </div>
          <SheetDescription className="font-mono">
            {headerForm?.code ?? ""}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !detail ? (
          <EmptyState
            className="mt-10"
            title="未加载详情"
            description="请关闭后重试"
          />
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="编码" value={detail.code} mono />
              <InfoRow label="行业" value={detail.industry || "—"} />
              <InfoRow label="关联场景" value={detail.scenario || "—"} />
              <InfoRow label="创建时间" value={formatDate(detail.createdAt)} />
            </div>

            {detail.description ? (
              <>
                <Separator />
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    描述
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {detail.description}
                  </p>
                </div>
              </>
            ) : null}

            <Separator />

            <Tabs defaultValue="preview" className="w-full">
              <TabsList>
                <TabsTrigger value="preview">
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    画面预览
                  </span>
                </TabsTrigger>
                <TabsTrigger value="json">
                  <span className="flex items-center gap-1.5">
                    <Code className="h-3.5 w-3.5" />
                    JSON 配置
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="mt-3">
                <PagePreview pageConfig={pageConfig} />
              </TabsContent>

              <TabsContent value="json" className="mt-3">
                {detail.pageConfig ? (
                  <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto max-h-[420px]">
                    <code>{JSON.stringify(detail.pageConfig, null, 2)}</code>
                  </pre>
                ) : (
                  <EmptyState
                    icon={Code}
                    title="暂无 JSON 配置"
                    description="该工程尚未保存画面配置"
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {hasWrite && detail ? (
            <Button onClick={() => onEdit?.(detail)}>
              <Sparkles className="h-4 w-4" />
              可视化编辑
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={
          mono
            ? "font-mono text-sm text-foreground"
            : "text-sm text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}

function PagePreview({ pageConfig }: { pageConfig: PageConfig | null }) {
  const components =
    pageConfig?.components && Array.isArray(pageConfig.components)
      ? pageConfig.components
      : [];

  if (components.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="暂无画面组件"
        description="该工程尚未配置任何可视化组件"
      />
    );
  }

  const bg = pageConfig?.style?.background;
  const hasBg = typeof bg === "string" && bg.trim() !== "";

  return (
    <div
      className={cn(
        "grid grid-cols-12 auto-rows-[64px] gap-2 rounded-lg p-3",
        !hasBg && "bg-muted"
      )}
      style={hasBg ? { backgroundColor: bg } : undefined}
    >
      {components.map((c) => {
        const meta = COMPONENT_TYPE_META[c.type] ?? {
          label: c.type,
          icon: LayoutGrid,
        };
        const Icon = meta.icon;
        const binding = describeBinding(c.binding);
        const pos = c.position ?? { x: 0, y: 0, w: 1, h: 1 };
        return (
          <div
            key={c.id}
            className={cn(
              "flex flex-col justify-between gap-1 rounded-md border p-2 text-xs",
              hasBg
                ? "border-white/15 bg-white/10 text-white/90"
                : "border-border bg-background text-foreground"
            )}
            style={{
              gridColumn: `${pos.x + 1} / span ${pos.w}`,
              gridRow: `${pos.y + 1} / span ${pos.h}`,
            }}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="truncate font-medium">
                {c.title || "未命名组件"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant={hasBg ? "secondary" : "outline"}
                className="text-[10px]"
              >
                {meta.label}
              </Badge>
              {c.chartType ? (
                <span className="opacity-60">{c.chartType}</span>
              ) : null}
            </div>
            {binding ? (
              <div
                className={cn(
                  "truncate font-mono text-[10px]",
                  hasBg ? "text-white/70" : "text-muted-foreground"
                )}
              >
                {binding}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}