"use client";

import * as React from "react";
import {
  Activity,
  Settings,
  Boxes,
  Database,
  Gauge,
  Leaf,
  Loader2,
  TrendingDown,
  Zap,
  Flame,
  Factory,
  PlayCircle,
  Sparkles,
  ArrowDown,
  ArrowUp,
  Minus,
  BellRing,
  ChevronRight,
  LayoutPanelLeft,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { INDUSTRY_OPTIONS } from "@/lib/constants";
import type {
  DashboardActivityItem,
  DashboardDistItem,
  DashboardOverview,
  FormConfig,
} from "@/types/api";
import { useAuthStore } from "@/stores/auth-store";
import { CarbonKpiCard } from "@/components/dashboard/carbon-kpi-card";
import { AlarmOverviewSection } from "@/components/dashboard/alarm-overview";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { IndustrySceneShowcase } from "@/components/dashboard/industry-scene-showcase";
import { StudioEditor } from "@/components/canvas/studio-editor";
import { migratePageConfig, type PageConfig as EditorPageConfig } from "@/lib/canvas/schema";

/**
 * ECharts is browser-only; load it lazily inside the component (not via
 * `next/dynamic`, which sometimes produces an "undefined" chunk path for
 * ESM-only modules in dev mode).
 */
const ReactECharts = React.lazy(async () => {
  const mod = await import("echarts-for-react");
  return { default: mod.default };
});

function ChartLoading() {
  return (
    <div className="flex h-[260px] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

/* -------------------------------- Constants ------------------------------- */

const INDUSTRY_COLORS = [
  "#10b981",
  "#14b8a6",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
];

const STATUS_COLORS: Record<string, string> = {
  CONNECTED: "#10b981",
  DISCONNECTED: "#64748b",
  ERROR: "#ef4444",
};

const INDUSTRY_FILTER_OPTIONS = [
  { label: "全部行业", value: "" },
  ...INDUSTRY_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
];

/* -------------------------------- Helpers --------------------------------- */

function actionBadgeVariant(action: string): BadgeProps["variant"] {
  if (action.startsWith("LOGIN") || action.startsWith("LOGOUT"))
    return "muted";
  if (action.startsWith("CREATE_")) return "success";
  if (action.startsWith("RESET_PASSWORD") || action.startsWith("UPDATE_"))
    return "warning";
  if (action.startsWith("DELETE_")) return "destructive";
  return "muted";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  return formatDate(iso);
}

/* ----------------------------- StatCard (inline) ----------------------------- */

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "primary",
  loading,
}: {
  label: string;
  value: number | null;
  icon: LucideIcon;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "cool" | "purple";
  loading?: boolean;
}) {
  const map: Record<string, { bg: string; text: string }> = {
    primary: { bg: "bg-primary/12", text: "text-primary" },
    success: { bg: "bg-success/15", text: "text-success" },
    warning: { bg: "bg-warning/15", text: "text-warning" },
    cool: { bg: "bg-blue-500/12", text: "text-blue-600 dark:text-blue-300" },
    purple: { bg: "bg-purple-500/12", text: "text-purple-600 dark:text-purple-300" },
  };
  const s = map[accent] ?? map.primary;

  return (
    <div className="panel-cyber hover-lift group relative overflow-hidden rounded-xl p-4">
      <span className="corner-decor tr" />
      <span className="corner-decor bl" />
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className="mt-1 font-cyber text-2xl font-bold tabular-nums tracking-tight text-primary">
              {value === null ? "—" : formatNumber(value)}
            </p>
          )}
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 shadow-sm",
            s.bg,
            s.text
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- DonutChart (inline) ----------------------------- */

function DonutChart({
  loading,
  data,
  colors,
  centerText,
  centerValue,
}: {
  loading: boolean;
  data: DashboardDistItem[];
  colors: string[];
  centerText?: string;
  centerValue?: number;
}) {
  const option = React.useMemo(() => {
    return {
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { bottom: 0, textStyle: { color: "#64748b", fontSize: 12 } },
      series: [
        {
          type: "pie",
          radius: ["46%", "68%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: data.map((d, i) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: colors[i % colors.length] },
          })),
        },
      ],
    };
  }, [data, colors]);

  if (loading) {
    return (
      <div className="flex h-[260px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        暂无数据
      </div>
    );
  }

  return (
    <div className="relative">
      <React.Suspense fallback={<ChartLoading />}>
        <ReactECharts option={option} theme="cyber" style={{ height: 260 }} />
      </React.Suspense>
      {centerText && (
        <div className="pointer-events-none absolute inset-x-0 top-[35%] flex flex-col items-center">
          <span className="text-2xl font-bold">{centerValue ?? total}</span>
          <span className="text-xs text-muted-foreground">{centerText}</span>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- ActivityItem (inline) ----------------------------- */

function ActivityItem({
  item,
  isLast,
}: {
  item: DashboardActivityItem;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-primary ring-2 ring-primary/20" />
        {!isLast && <div className="w-px flex-1 bg-border/60" />}
      </div>
      <div className={cn("flex-1", isLast ? "pb-0" : "pb-3")}>
        <div className="flex items-center gap-2">
          <Badge variant={actionBadgeVariant(item.action)} className="font-mono text-[10px]">
            {item.action}
          </Badge>
          <span className="text-sm font-medium">{item.username || "系统"}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {formatRelative(item.createdAt)}
          </span>
        </div>
        {item.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- WelcomeBanner ----------------------------- */

function WelcomeBanner({
  userName,
  roleLabel,
  trend,
}: {
  userName: string;
  roleLabel: string;
  trend: { emissions: number; reduction: number } | null;
}) {
  return (
    <div className="panel-cyber hover-lift relative overflow-hidden rounded-xl p-6">
      {/* 四角 L 装饰 */}
      <span className="corner-decor tl" />
      <span className="corner-decor tr" />
      <span className="corner-decor bl" />
      <span className="corner-decor br" />

      {/* 环境光斑 */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-cool/10 blur-3xl"
      />
      {/* 局部网格 */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-cyber-grid-fine bg-grid-20 opacity-30" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="relative">
            <span aria-hidden className="absolute -inset-1 rounded-2xl bg-primary/25 blur-md animate-logo-pulse" />
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-7 w-7" strokeWidth={2.2} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="font-cyber rounded-sm border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">
                {roleLabel}
              </span>
              <span className="text-xs text-muted-foreground">
                实时碳排放监测
              </span>
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-success" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              欢迎回来，<span className="text-primary">{userName}</span>
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {trend
                ? `今日实时碳排放较上期 ${
                    trend.emissions < 0 ? "下降" : "上升"
                  } ${Math.abs(trend.emissions)}% · 碳减排量 ${
                    trend.reduction < 0 ? "下降" : "上升"
                  } ${Math.abs(trend.reduction)}%，平台运行平稳。`
                : "正在加载实时数据，请稍候..."}
            </p>
          </div>
        </div>

        {trend ? (
          <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-8">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">今日排放</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                {trend.emissions < 0 ? (
                  <ArrowDown className="h-4 w-4 text-success" />
                ) : trend.emissions > 0 ? (
                  <ArrowUp className="h-4 w-4 text-destructive" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    trend.emissions < 0
                      ? "text-success"
                      : trend.emissions > 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                  )}
                >
                  {Math.abs(trend.emissions)}%
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">减排变化</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                {trend.reduction < 0 ? (
                  <ArrowDown className="h-4 w-4 text-destructive" />
                ) : trend.reduction > 0 ? (
                  <ArrowUp className="h-4 w-4 text-success" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    trend.reduction > 0
                      ? "text-success"
                      : trend.reduction < 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                  )}
                >
                  {Math.abs(trend.reduction)}%
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ================================ Page ================================ */

export default function DashboardPage() {
  const [overview, setOverview] = React.useState<DashboardOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [industry, setIndustry] = React.useState(
    () => localStorage.getItem("kiln_dashboard_industry") ?? ""
  );
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Recipe state
  const [recipes, setRecipes] = React.useState<FormConfig[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = React.useState<number | null>(null);
  // 运行总览子功能弹窗：低碳运行场景 / 组态展示区 / 统一告警总览
  const [subDialog, setSubDialog] = React.useState<null | "scenes" | "canvas" | "alarms">(null);
  const [recipePageConfig, setRecipePageConfig] = React.useState<Record<string, unknown> | null>(null);
  const [recipeLoading, setRecipeLoading] = React.useState(true);

  // Editor state
  const [editorTarget, setEditorTarget] = React.useState<FormConfig | null>(null);
  const [editorConfig, setEditorConfig] = React.useState<EditorPageConfig | null>(null);

  // Auth user
  const user = useAuthStore((s) => s.user);

  // Load overview data
  const loadOverview = React.useCallback(async (ind: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.dashboard.overview(
        ind ? { industry: ind } : undefined,
      );
      setOverview(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "无法加载驾驶舱数据，请确认后端服务已启动",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Load dashboard recipes (forms with code starting with DASHBOARD)
  const loadRecipes = React.useCallback(async () => {
    setRecipeLoading(true);
    try {
      const result = await api.forms.list({ pageSize: 100 });
      const dashboardForms = result.list.filter(
        (f) => f.code.startsWith("DASHBOARD"),
      );
      setRecipes(dashboardForms);
      // Auto-select first if nothing selected
      if (dashboardForms.length > 0 && !selectedRecipeId) {
        setSelectedRecipeId(dashboardForms[0].id);
      }
    } catch {
      // Silent fail — recipes are optional
    } finally {
      setRecipeLoading(false);
    }
  }, [selectedRecipeId]);

  // Load recipe pageConfig when selection changes
  const loadRecipeDetail = React.useCallback(async (id: number | null) => {
    if (id === null) {
      setRecipePageConfig(null);
      return;
    }
    try {
      const detail = await api.forms.get(id);
      setRecipePageConfig(detail.pageConfig);
    } catch {
      setRecipePageConfig(null);
    }
  }, []);

  React.useEffect(() => {
    loadOverview(industry);
  }, [industry, loadOverview]);

  React.useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  React.useEffect(() => {
    loadRecipeDetail(selectedRecipeId);
  }, [selectedRecipeId, loadRecipeDetail]);

  // Handlers
  const handleIndustryChange = (val: string) => {
    const ind = val === "all" ? "" : val;
    setIndustry(ind);
    localStorage.setItem("kiln_dashboard_industry", ind);
  };

  const handleEditDashboard = async () => {
    const target = recipes.find((r) => r.id === selectedRecipeId) ?? recipes[0];
    if (!target) return;
    try {
      const detail = await api.forms.get(target.id);
      setEditorConfig(migratePageConfig(detail.pageConfig));
      setEditorTarget(target);
    } catch {
      // ignore
    }
  };

  const handleCreateRecipe = async () => {
    try {
      const created = await api.forms.create({
        code: `DASHBOARD_${Date.now()}`,
        name: `驾驶舱配方 ${new Date().toLocaleDateString("zh-CN")}`,
        industry: "通用",
      });
      await loadRecipes();
      setSelectedRecipeId(created.id);
      // Open editor for new recipe
      setEditorConfig(migratePageConfig(null));
      setEditorTarget(created);
    } catch {
      // ignore
    }
  };

  const onlineRate = overview
    ? overview.dataSourceCount > 0
      ? Math.round((overview.onlineSourceCount / overview.dataSourceCount) * 100)
      : 0
    : 0;

  const userName = user?.displayName ?? user?.username ?? "用户";
  const roleLabel = user?.roles?.[0]?.name ?? "成员";

  return (
    <div className="relative flex flex-col gap-6 pb-10">
      {/* Welcome banner */}
      <WelcomeBanner
        userName={userName}
        roleLabel={roleLabel}
        trend={
          overview
            ? {
                emissions: overview.carbonKpi.reductionRate - 35,
                reduction: 5.8,
              }
            : null
        }
      />

      {/* Top action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-sm border border-border bg-muted px-2 py-1 font-cyber text-[11px] text-muted-foreground">
            维度 · {INDUSTRY_FILTER_OPTIONS.find((o) => o.value === industry)?.label ?? "全部行业"}
          </span>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-1 h-3.5 w-3.5" /> 设置
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {recipes.length > 1 && (
            <Select
              value={String(selectedRecipeId ?? "")}
              onValueChange={(v) => setSelectedRecipeId(Number(v))}
            >
              <SelectTrigger className="w-44 shadow-card-sm">
                <SelectValue placeholder="选择配方" />
              </SelectTrigger>
              <SelectContent>
                {recipes.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={handleCreateRecipe} className="shadow-card-sm">
            新建配方
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={handleEditDashboard}
            disabled={recipes.length === 0}
          >
            编辑驾驶舱
          </Button>
        </div>
      </div>

      {/* Carbon KPI Section (Fixed) */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15 text-success shadow-sm">
            <Leaf className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <h2 className="text-base font-semibold tracking-tight">碳排KPI指标</h2>
          <Badge variant="outline-success">Carbon KPI</Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CarbonKpiCard
            title="总碳排放量"
            value={overview?.carbonKpi.totalEmissions ?? null}
            unit="tCO₂e"
            icon={Flame}
            trend={-3.2}
            accent="warning"
            loading={loading}
            highlighted
          />
          <CarbonKpiCard
            title="碳减排量"
            value={overview?.carbonKpi.totalReduction ?? null}
            unit="tCO₂e"
            icon={Leaf}
            trend={5.8}
            accent="success"
            loading={loading}
            hint={`减排率 ${overview?.carbonKpi.reductionRate ?? 0}%`}
          />
          <CarbonKpiCard
            title="能耗总量"
            value={overview?.carbonKpi.totalEnergy ?? null}
            unit="tce"
            icon={Zap}
            trend={-1.5}
            accent="cool"
            loading={loading}
          />
          <CarbonKpiCard
            title="碳排强度"
            value={overview?.carbonKpi.emissionIntensity ?? null}
            unit="tCO₂e/源"
            icon={TrendingDown}
            trend={-2.1}
            accent="destructive"
            loading={loading}
          />
        </div>
      </div>

      {/* Platform Operations Section (Fixed) */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12 text-primary shadow-sm">
            <Activity className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <h2 className="text-base font-semibold tracking-tight">平台运营概况</h2>
          <Badge variant="muted">Platform Ops</Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="数据源数"
            value={overview?.dataSourceCount ?? null}
            icon={Database}
            accent="primary"
            loading={loading}
            hint="已接入"
          />
          <StatCard
            label="采集点位"
            value={overview?.pointCount ?? null}
            icon={Gauge}
            accent="cool"
            loading={loading}
            hint="全部点"
          />
          <StatCard
            label="在线数据源"
            value={overview?.onlineSourceCount ?? null}
            icon={Activity}
            accent="success"
            loading={loading}
            hint={`在线率 ${onlineRate}%`}
          />
          <StatCard
            label="模型在线"
            value={overview?.modelOnlineCount ?? null}
            icon={Boxes}
            accent="warning"
            loading={loading}
            hint={`共 ${overview?.modelTotalCount ?? 0}`}
          />
          <StatCard
            label="场景应用"
            value={overview?.scenarioCount ?? null}
            icon={Factory}
            accent="purple"
            loading={loading}
            hint={`活跃 ${overview?.scenarioActive ?? 0}`}
          />
          <StatCard
            label="模型调用"
            value={overview?.modelCallCount ?? null}
            icon={PlayCircle}
            accent="primary"
            loading={loading}
            hint="累计"
          />
        </div>
      </div>

      {/* Error banner */}
      {error ? (
        <Card variant="elevated" className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Badge variant="outline-destructive">API 不可达</Badge>
            <span className="text-sm text-destructive">{error}</span>
          </CardContent>
        </Card>
      ) : null}

      {/* Industry & Status distributions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel-cyber rounded-xl p-5">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <h3 className="panel-title-bar mb-3 text-sm font-semibold tracking-wider">行业分布</h3>
          <DonutChart
            loading={loading}
            data={overview?.industryDist ?? []}
            colors={INDUSTRY_COLORS}
            centerText="数据源"
            centerValue={overview?.dataSourceCount}
          />
        </div>
        <div className="panel-cyber rounded-xl p-5">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <h3 className="panel-title-bar mb-3 text-sm font-semibold tracking-wider">数据源状态</h3>
          <DonutChart
            loading={loading}
            data={(overview?.statusDist ?? []).map((d) => ({
              name: d.name,
              value: d.value,
            }))}
            colors={(overview?.statusDist ?? []).map(
              (d) => STATUS_COLORS[d.name] ?? "#64748b",
            )}
          />
        </div>
      </div>

      {/* 驾驶舱面板：当前配方的组态结果（定制结果的展示位；编辑驾驶舱可自定义，切换配方可换版） */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              驾驶舱面板
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                当前配方：{recipes.find((r) => r.id === selectedRecipeId)?.name ?? "默认"} ·
                此处即配方定制结果的展示位，右上角「编辑面板配方」可自定义；与自定义大屏同一套组态引擎
              </span>
            </p>
        </div>
        <DashboardCanvas
          pageConfig={recipePageConfig}
          loading={recipeLoading}
          onEdit={handleEditDashboard}
        />
      </div>

      {/* 运行总览子功能入口（弹窗式，与「二级功能子窗口化」信息架构一致） */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              key: "scenes" as const,
              icon: Boxes,
              title: "低碳运行场景",
              tag: "SCENES",
              purpose: "生产与示范场景资产总览——查看各行业场景，打开对应数字孪生或场景工作台",
            },
            {
              key: "alarms" as const,
              icon: BellRing,
              title: "统一告警总览",
              tag: "ALARMS",
              purpose: "跨场景告警聚合与分级统计——掌握活跃告警分布，快速定位与处置",
            },
          ] as { key: "scenes" | "alarms"; icon: LucideIcon; title: string; tag: string; purpose: string }[]
        ).map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              onClick={() => setSubDialog(f.key)}
              className="panel-cyber group relative flex items-start gap-3 rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-md"
            >
              <span className="corner-decor tr" />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight text-foreground">
                    {f.title}
                  </span>
                  <span className="font-cyber rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-primary">
                    {f.tag}
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {f.purpose}
                </span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 pt-4 text-xs text-muted-foreground">
        <Leaf className="h-3.5 w-3.5 text-primary" />
        <span>全流程低碳运行智能监测与调控系统平台 · 支持低代码组态自定义</span>
      </div>

      {/* Full-screen visual editor */}
      {editorTarget && editorConfig ? (
        <StudioEditor
          formId={editorTarget.id}
          formName={editorTarget.name}
          initialPageConfig={editorConfig}
          onClose={() => {
            setEditorTarget(null);
            setEditorConfig(null);
            // Reload recipe detail and overview
            void loadRecipeDetail(selectedRecipeId);
            void loadRecipes();
          }}
        />
      ) : null}
      {/* 子功能弹窗：低碳运行场景 / 统一告警总览 */}
      <Dialog open={subDialog != null} onOpenChange={(o) => !o && setSubDialog(null)}>
        <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
              {subDialog === "scenes" ? "低碳运行场景" : "统一告警总览"}
              <span className="text-xs font-normal text-muted-foreground">
                {subDialog === "scenes"
                  ? "生产与示范场景资产总览，打开对应数字孪生或场景工作台"
                  : "跨场景告警聚合与分级统计，快速定位活跃告警"}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(88vh-110px)] overflow-auto pr-1">
            {subDialog === "scenes" && <IndustrySceneShowcase />}
            {subDialog === "alarms" && (
              <AlarmOverviewSection
                summary={overview?.alarmSummary ?? null}
                loading={loading}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">驾驶舱维度设置</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            选择运行总览展示的行业维度，保存后立即生效并持久保存。
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">行业维度</Label>
            <Select value={industry || "all"} onValueChange={handleIndustryChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || "all"} value={opt.value || "all"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
