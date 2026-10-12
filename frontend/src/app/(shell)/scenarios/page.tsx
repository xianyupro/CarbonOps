"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Atom,
  Bell,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Container,
  Cpu,
  Eye,
  Plus,
  Sparkles,
  Factory,
  Flame,
  Gauge,
  Layers,
  Leaf,
  Loader2,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Workflow,
  Zap,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";
import { INDUSTRY_OPTIONS } from "@/lib/constants";
import type {
  Alarm,
  AlarmCategory,
  AlarmLevel,
  AlarmQuery,
  AlarmStatus,
  Scenario,
  ScenarioQuery,
  ScenarioStatus,
} from "@/types/api";

const SCENARIO_PAGE_SIZE = 12;
const ALARM_PAGE_SIZE = 15;

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "muted";

const SCENARIO_STATUS_BADGE: Record<
  ScenarioStatus,
  { label: string; variant: BadgeVariant }
> = {
  ACTIVE: { label: "运行中", variant: "success" },
  INACTIVE: { label: "已停用", variant: "muted" },
  TEMPLATE: { label: "模板", variant: "outline" },
};

const ALARM_LEVEL_BADGE: Record<
  AlarmLevel,
  { label: string; variant: BadgeVariant }
> = {
  CRITICAL: { label: "严重", variant: "destructive" },
  WARN: { label: "警告", variant: "warning" },
  INFO: { label: "提示", variant: "secondary" },
};

const ALARM_STATUS_BADGE: Record<
  AlarmStatus,
  { label: string; variant: BadgeVariant }
> = {
  ACTIVE: { label: "活跃", variant: "warning" },
  ACK: { label: "已确认", variant: "secondary" },
  RESOLVED: { label: "已解决", variant: "muted" },
};

const ALARM_CATEGORY_LABEL: Record<AlarmCategory, string> = {
  DATA: "数据",
  MODEL: "模型",
  CONTROL: "控制",
  SYSTEM: "系统",
};

const SCENARIO_ICONS: Record<string, React.ElementType> = {
  flame: Flame,
  factory: Factory,
  zap: Zap,
  gauge: Gauge,
  layers: Layers,
  leaf: Leaf,
  atom: Atom,
  building2: Building2,
  building: Building2,
  workflow: Workflow,
  cpu: Cpu,
  container: Container,
  boxes: Boxes,
};

function industryLabel(value: string): string {
  return INDUSTRY_OPTIONS.find((o) => o.value === value)?.label ?? (value || "—");
}

function scenarioIcon(name: string | null): React.ElementType {
  if (name && SCENARIO_ICONS[name]) return SCENARIO_ICONS[name];
  return Factory;
}

function scenarioCounts(config: Record<string, unknown> | null) {
  const sourceCodes = Array.isArray(config?.sourceCodes)
    ? (config!.sourceCodes as unknown[])
    : [];
  const modelCodes = Array.isArray(config?.modelCodes)
    ? (config!.modelCodes as unknown[])
    : [];
  return { sourceCount: sourceCodes.length, modelCount: modelCodes.length };
}

interface FormState {
  name: string;
  code: string;
  industry: string;
  description: string;
  icon: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  industry: "通用",
  description: "",
  icon: "",
};

function Pager({
  page,
  total,
  pageSize,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  pageSize: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
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
          disabled={page <= 1 || loading}
          onClick={onPrev}
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
          disabled={page >= totalPages || loading}
          onClick={onNext}
        >
          下一页
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function ScenariosPage() {
  const router = useRouter();
  const canScenario = useAuthStore((s) => s.hasPermission("scenario:read"));
  const canAlarmAction = useAuthStore((s) =>
    s.hasPermission("data:source:write")
  );

  // Scenarios state
  const [scenarios, setScenarios] = React.useState<Scenario[]>([]);
  const [scenarioTotal, setScenarioTotal] = React.useState(0);
  const [scenarioLoading, setScenarioLoading] = React.useState(true);
  const [scenarioError, setScenarioError] = React.useState<string | null>(null);
  const [scenarioKeyword, setScenarioKeyword] = React.useState("");
  const [scenarioIndustry, setScenarioIndustry] = React.useState("");
  const [scenarioStatus, setScenarioStatus] = React.useState("");
  const [scenarioPage, setScenarioPage] = React.useState(1);

  // Alarms state
  const [alarms, setAlarms] = React.useState<Alarm[]>([]);
  const [alarmTotal, setAlarmTotal] = React.useState(0);
  const [alarmLoading, setAlarmLoading] = React.useState(true);
  const [alarmError, setAlarmError] = React.useState<string | null>(null);
  const [alarmLevel, setAlarmLevel] = React.useState("");
  const [alarmCategory, setAlarmCategory] = React.useState("");
  const [alarmStatus, setAlarmStatus] = React.useState("");
  const [alarmPage, setAlarmPage] = React.useState(1);

  // Scenario form / delete dialog
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Scenario | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<Scenario | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function loadScenarios(targetPage = scenarioPage) {
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const res = await api.scenarios.list({
        page: targetPage,
        pageSize: SCENARIO_PAGE_SIZE,
        keyword: scenarioKeyword || undefined,
        industry: scenarioIndustry || undefined,
        status: (scenarioStatus || undefined) as ScenarioStatus | undefined,
      } as ScenarioQuery);
      const list = Array.isArray(res) ? res : (res.list ?? []);
      const nextTotal = Array.isArray(res)
        ? list.length
        : (res.meta?.total ?? list.length);
      setScenarios(list);
      setScenarioTotal(nextTotal);
      if (targetPage > 1 && list.length === 0 && nextTotal > 0) {
        setScenarioPage(Math.max(1, Math.ceil(nextTotal / SCENARIO_PAGE_SIZE)));
      }
    } catch (err) {
      setScenarioError(
        err instanceof ApiError
          ? err.message
          : "加载场景列表失败，请确认后端服务已启动"
      );
      setScenarios([]);
    } finally {
      setScenarioLoading(false);
    }
  }

  async function loadAlarms(targetPage = alarmPage) {
    setAlarmLoading(true);
    setAlarmError(null);
    try {
      const res = await api.alarms.list({
        page: targetPage,
        pageSize: ALARM_PAGE_SIZE,
        level: (alarmLevel || undefined) as AlarmLevel | undefined,
        category: (alarmCategory || undefined) as AlarmCategory | undefined,
        status: (alarmStatus || undefined) as AlarmStatus | undefined,
      } as AlarmQuery);
      const list = Array.isArray(res) ? res : (res.list ?? []);
      const nextTotal = Array.isArray(res)
        ? list.length
        : (res.meta?.total ?? list.length);
      setAlarms(list);
      setAlarmTotal(nextTotal);
      if (targetPage > 1 && list.length === 0 && nextTotal > 0) {
        setAlarmPage(Math.max(1, Math.ceil(nextTotal / ALARM_PAGE_SIZE)));
      }
    } catch (err) {
      setAlarmError(
        err instanceof ApiError
          ? err.message
          : "加载告警列表失败，请确认后端服务已启动"
      );
      setAlarms([]);
    } finally {
      setAlarmLoading(false);
    }
  }

  // Initial parallel load
  React.useEffect(() => {
    void Promise.all([loadScenarios(1), loadAlarms(1)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scenario filter changes -> reset to page 1
  React.useEffect(() => {
    if (scenarioPage === 1) {
      void loadScenarios(1);
    } else {
      setScenarioPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioIndustry, scenarioStatus]);

  // Scenario page change -> reload
  React.useEffect(() => {
    void loadScenarios(scenarioPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioPage]);

  // Alarm filter changes -> reset to page 1
  React.useEffect(() => {
    if (alarmPage === 1) {
      void loadAlarms(1);
    } else {
      setAlarmPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmLevel, alarmCategory, alarmStatus]);

  // Alarm page change -> reload
  React.useEffect(() => {
    void loadAlarms(alarmPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmPage]);

  function onScenarioSearch(e: React.FormEvent) {
    e.preventDefault();
    if (scenarioPage === 1) {
      void loadScenarios(1);
    } else {
      setScenarioPage(1);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(s: Scenario) {
    setEditing(s);
    setForm({
      name: s.name,
      code: s.code,
      industry: s.industry || "通用",
      description: s.description ?? "",
      icon: s.icon ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm() {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("请输入场景名称");
      return;
    }
    if (!form.code.trim()) {
      setFormError("请输入场景编码");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await api.scenarios.update(editing.id, {
          name: form.name.trim(),
          industry: form.industry,
          description: form.description || undefined,
          icon: form.icon || undefined,
        });
        toast.success("已更新场景");
      } else {
        await api.scenarios.create({
          name: form.name.trim(),
          code: form.code.trim(),
          industry: form.industry,
          description: form.description || undefined,
          icon: form.icon || undefined,
        });
        toast.success("已创建场景");
      }
      setFormOpen(false);
      await loadScenarios(scenarioPage);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "保存失败，请重试";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.scenarios.delete(deleteTarget.id);
      toast.success(`已删除 ${deleteTarget.name}`);
      setDeleteTarget(null);
      await loadScenarios(scenarioPage);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAck(a: Alarm) {
    if (a.status !== "ACTIVE") {
      toast.error("该告警当前状态无法确认");
      return;
    }
    try {
      await api.alarms.ack(a.id);
      toast.success("已确认告警");
      await loadAlarms(alarmPage);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "确认告警失败");
    }
  }

  async function handleResolve(a: Alarm) {
    if (a.status === "RESOLVED") {
      toast.error("该告警已解决");
      return;
    }
    try {
      await api.alarms.resolve(a.id);
      toast.success("已解决告警");
      await loadAlarms(alarmPage);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "解决告警失败");
    }
  }

  const activeCount = alarms.filter((a) => a.status === "ACTIVE").length;
  const ackCount = alarms.filter((a) => a.status === "ACK").length;
  const resolvedCount = alarms.filter((a) => a.status === "RESOLVED").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="应用编排 · Scenarios"
        icon={Factory}
        title="行业场景"
        description="按行业组织的开箱即用低碳场景模板，与实时告警中心"
      />

      <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium">通过向导快速搭建一个新场景</span>
          <span className="text-xs text-muted-foreground">— 组态开发 → 云边端协同 → 模型自适应迁移</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/scenarios/zinc")}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            查看演示场景
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={() => router.push("/scenarios/new")}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            新增场景
          </Button>
        </div>
      </div>

      <Tabs defaultValue="scenarios" className="gap-4">
        <TabsList>
          <TabsTrigger value="scenarios">场景库</TabsTrigger>
          <TabsTrigger value="alarms">告警中心</TabsTrigger>
        </TabsList>

        {/* ============================== Tab 1: 场景库 ============================== */}
        <TabsContent
          value="scenarios"
          className="mt-0 flex flex-col gap-4"
        >
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadScenarios(scenarioPage)}
              disabled={scenarioLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${scenarioLoading ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
            {canScenario ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建场景
              </Button>
            ) : null}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <form
                onSubmit={onScenarioSearch}
                className="relative flex-1"
                role="search"
              >
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={scenarioKeyword}
                  onChange={(e) => setScenarioKeyword(e.target.value)}
                  placeholder="搜索名称 / 编码 / 描述…"
                  className="pl-9"
                  aria-label="搜索场景"
                />
              </form>
              <div className="flex gap-3">
                <Select
                  value={scenarioIndustry || "ALL"}
                  onValueChange={(v) =>
                    setScenarioIndustry(v === "ALL" ? "" : v)
                  }
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
                  value={scenarioStatus || "ALL"}
                  onValueChange={(v) =>
                    setScenarioStatus(v === "ALL" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-[130px]" aria-label="状态">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">全部状态</SelectItem>
                    <SelectItem value="ACTIVE">运行中</SelectItem>
                    <SelectItem value="INACTIVE">已停用</SelectItem>
                    <SelectItem value="TEMPLATE">模板</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Scenario grid */}
          <Card>
            <CardContent className="p-4">
              {scenarioLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={`sk-${i}`}
                      className="flex flex-col gap-3 rounded-lg border p-4"
                    >
                      <div className="flex justify-between">
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-5 w-6" />
                      </div>
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : scenarioError ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-destructive">
                  <Loader2 className="h-5 w-5" />
                  {scenarioError}
                </div>
              ) : scenarios.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="暂无场景"
                  description="可调整筛选条件，或点击右上角新建场景"
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {scenarios.map((s) => {
                    const stMeta =
                      SCENARIO_STATUS_BADGE[s.status] ?? {
                        label: s.status,
                        variant: "muted" as BadgeVariant,
                      };
                    const Icon = scenarioIcon(s.icon);
                    const { sourceCount, modelCount } = scenarioCounts(
                      s.config
                    );
                    return (
                      <Card key={s.id} className="shadow-sm">
                        <CardContent className="flex min-h-[210px] flex-col gap-3 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline">
                                {industryLabel(s.industry)}
                              </Badge>
                              <Badge variant={stMeta.variant}>
                                {stMeta.label}
                              </Badge>
                            </div>
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
                              <DropdownMenuContent
                                align="end"
                                className="w-44"
                              >
                                <DropdownMenuItem
                                  onSelect={() => openEdit(s)}
                                >
                                  <Eye className="h-4 w-4" />
                                  查看详情
                                </DropdownMenuItem>
                                {canScenario ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={() => openEdit(s)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                      编辑
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onSelect={() => setDeleteTarget(s)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      删除
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-lg font-semibold text-foreground">
                                {s.name}
                              </div>
                              <div className="truncate font-mono text-xs text-muted-foreground">
                                {s.code}
                              </div>
                            </div>
                          </div>

                          <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                            {s.description || "暂无描述"}
                          </p>

                          <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                            <span>
                              数据源 {sourceCount} · 模型 {modelCount}
                            </span>
                            <span>{formatDate(s.createdAt)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
            <Pager
              page={scenarioPage}
              total={scenarioTotal}
              pageSize={SCENARIO_PAGE_SIZE}
              loading={scenarioLoading}
              onPrev={() =>
                setScenarioPage((p) => Math.max(1, p - 1))
              }
              onNext={() => setScenarioPage((p) => p + 1)}
            />
          </Card>
        </TabsContent>

        {/* ============================== Tab 2: 告警中心 ============================== */}
        <TabsContent value="alarms" className="mt-0 flex flex-col gap-4">
          {/* Stats */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="warning">活跃 {activeCount}</Badge>
            <Badge variant="secondary">已确认 {ackCount}</Badge>
            <Badge variant="muted">已解决 {resolvedCount}</Badge>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex flex-1 flex-wrap gap-3">
                <Select
                  value={alarmLevel || "ALL"}
                  onValueChange={(v) =>
                    setAlarmLevel(v === "ALL" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-[130px]" aria-label="级别">
                    <SelectValue placeholder="级别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">全部级别</SelectItem>
                    <SelectItem value="CRITICAL">严重</SelectItem>
                    <SelectItem value="WARN">警告</SelectItem>
                    <SelectItem value="INFO">提示</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={alarmCategory || "ALL"}
                  onValueChange={(v) =>
                    setAlarmCategory(v === "ALL" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-[130px]" aria-label="类别">
                    <SelectValue placeholder="类别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">全部类别</SelectItem>
                    <SelectItem value="DATA">数据</SelectItem>
                    <SelectItem value="MODEL">模型</SelectItem>
                    <SelectItem value="CONTROL">控制</SelectItem>
                    <SelectItem value="SYSTEM">系统</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={alarmStatus || "ALL"}
                  onValueChange={(v) =>
                    setAlarmStatus(v === "ALL" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-[130px]" aria-label="状态">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">全部状态</SelectItem>
                    <SelectItem value="ACTIVE">活跃</SelectItem>
                    <SelectItem value="ACK">已确认</SelectItem>
                    <SelectItem value="RESOLVED">已解决</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadAlarms(alarmPage)}
                disabled={alarmLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${alarmLoading ? "animate-spin" : ""}`}
                />
                刷新
              </Button>
            </CardContent>
          </Card>

          {/* Alarm table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">级别</TableHead>
                  <TableHead>告警</TableHead>
                  <TableHead className="w-[90px]">类别</TableHead>
                  <TableHead className="w-[100px]">状态</TableHead>
                  <TableHead className="w-[150px]">创建时间</TableHead>
                  <TableHead className="w-[80px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alarmLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`ask-${i}`}>
                      <TableCell>
                        <Skeleton className="h-5 w-14" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-12" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-14" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-8" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : alarmError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center">
                      <div className="flex flex-col items-center gap-2 text-sm text-destructive">
                        <Loader2 className="h-5 w-5" />
                        {alarmError}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : alarms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-2">
                      <EmptyState
                        icon={Bell}
                        title="暂无告警"
                        description="当前筛选条件下没有告警记录"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  alarms.map((a) => {
                    const lvMeta =
                      ALARM_LEVEL_BADGE[a.level] ?? {
                        label: a.level,
                        variant: "secondary" as BadgeVariant,
                      };
                    const stMeta =
                      ALARM_STATUS_BADGE[a.status] ?? {
                        label: a.status,
                        variant: "muted" as BadgeVariant,
                      };
                    const catLabel =
                      ALARM_CATEGORY_LABEL[a.category] ?? a.category;
                    const showAck = a.status === "ACTIVE" && canAlarmAction;
                    const showResolve =
                      a.status !== "RESOLVED" && canAlarmAction;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Badge variant={lvMeta.variant}>
                            {lvMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {a.title}
                            </div>
                            {a.content ? (
                              <div className="truncate text-xs text-muted-foreground">
                                {a.content}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{catLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={stMeta.variant}>
                            {stMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(a.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {showAck || showResolve ? (
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
                              <DropdownMenuContent
                                align="end"
                                className="w-40"
                              >
                                {showAck ? (
                                  <DropdownMenuItem
                                    onSelect={() => void handleAck(a)}
                                  >
                                    <ShieldCheck className="h-4 w-4" />
                                    确认告警
                                  </DropdownMenuItem>
                                ) : null}
                                {showResolve ? (
                                  <DropdownMenuItem
                                    onSelect={() => void handleResolve(a)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    标记解决
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <Pager
              page={alarmPage}
              total={alarmTotal}
              pageSize={ALARM_PAGE_SIZE}
              loading={alarmLoading}
              onPrev={() => setAlarmPage((p) => Math.max(1, p - 1))}
              onNext={() => setAlarmPage((p) => p + 1)}
            />
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================== Create / Edit dialog ============================== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? "编辑场景" : "新建场景"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "修改场景基本信息。编码不可变更。"
                : "创建新的行业碳排场景，提交后默认为运行中状态。"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="scenario-name">名称 *</Label>
              <Input
                id="scenario-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="如：回转窑低碳运行场景"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scenario-code">编码 *</Label>
              <Input
                id="scenario-code"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="如：KILN_LOW_CARBON"
                className="font-mono"
                disabled={!!editing}
              />
            </div>

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
              <Label htmlFor="scenario-icon">图标（可选）</Label>
              <Input
                id="scenario-icon"
                value={form.icon}
                onChange={(e) =>
                  setForm((f) => ({ ...f, icon: e.target.value }))
                }
                placeholder="lucide 图标名，如 flame / factory / zap / gauge"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scenario-desc">描述</Label>
              <Textarea
                id="scenario-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="可选，描述场景用途、适用行业等"
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
            <Button
              onClick={() => void submitForm()}
              disabled={submitting}
            >
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

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>确认删除场景</DialogTitle>
            <DialogDescription>
              此操作将永久删除场景「{deleteTarget?.name}」，无法撤销。
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
    </div>
  );
}