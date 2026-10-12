"use client";

import * as React from "react";
import {
  ArrowRight,
  Bell,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Database,
  FileOutput,
  FileText,
  History,
  Loader2,
  Play,
  RefreshCw,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate, formatNumber, truncate } from "@/lib/utils";
import { MODEL_FUNCTION_BADGE, MODEL_STATUS_BADGE } from "@/lib/constants";
import type {
  BadgeProps,
} from "@/components/ui/badge";
import type {
  ModelCall,
  ModelRegistry,
  Scenario,
} from "@/types/api";

/* --------------------------------- Config --------------------------------- */

const HISTORY_PAGE_SIZE = 15;
const ONLINE_CALL_LIMIT = 5; // 取前 5 个 ONLINE 模型
const PER_MODEL_CALLS = 5;

const OUTPUT_NODES: { icon: typeof FileOutput; label: string }[] = [
  { icon: FileOutput, label: "优化建议" },
  { icon: Bell, label: "预警通知" },
  { icon: FileText, label: "碳排报告" },
];

interface HistoryRow extends ModelCall {
  modelName: string;
  modelCode: string;
}

/* --------------------------------- Helpers -------------------------------- */

/** 安全地从 scenario.config 中读取字符串数组字段。 */
function readStringArray(
  config: Record<string, unknown> | null,
  key: string
): string[] {
  if (!config) return [];
  const v = config[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** 调用状态 → Badge 变体。 */
function callStatusVariant(status: string): BadgeProps["variant"] {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED") return "destructive";
  return "muted";
}

function callStatusLabel(status: string): string {
  if (status === "SUCCESS") return "成功";
  if (status === "FAILED") return "失败";
  return status || "未知";
}

/* ------------------------------- DAG 节点卡片 ------------------------------ */

interface DagNodeProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  accent?: "primary" | "muted";
  children?: React.ReactNode;
}

function DagNode({
  icon: Icon,
  title,
  subtitle,
  accent = "primary",
  children,
}: DagNodeProps) {
  const accentClass =
    accent === "muted"
      ? "bg-muted text-muted-foreground"
      : "bg-primary/10 text-primary";
  return (
    <Card className="w-full min-w-[180px]">
      <CardContent className="flex items-start gap-2.5 p-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${accentClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="truncate text-sm font-medium text-foreground">
            {title}
          </div>
          {subtitle ? (
            <div className="truncate font-mono text-xs text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ DAG 单列容器 ------------------------------- */

interface DagColumnProps {
  title: string;
  children: React.ReactNode;
}

function DagColumn({ title, children }: DagColumnProps) {
  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function OrchestrationPage() {
  const hasOrchRead = useAuthStore((s) => s.hasPermission("orchestration:read"));
  const hasModelRead = useAuthStore((s) => s.hasPermission("model:read"));
  const canRead = hasOrchRead || hasModelRead;

  // 共享数据
  const [scenarios, setScenarios] = React.useState<Scenario[]>([]);
  const [models, setModels] = React.useState<ModelRegistry[]>([]);
  const [scenariosLoading, setScenariosLoading] = React.useState(true);
  const [modelsLoading, setModelsLoading] = React.useState(true);
  const [scenariosError, setScenariosError] = React.useState<string | null>(
    null
  );
  const [modelsError, setModelsError] = React.useState<string | null>(null);

  // Tab 1：编排视图
  const [selectedScenarioId, setSelectedScenarioId] =
    React.useState<string>("");

  // Tab 2：运行历史
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [historyPage, setHistoryPage] = React.useState(1);

  // 执行推理
  const [executing, setExecuting] = React.useState(false);

  const loadHistory = React.useCallback(async (modelList: ModelRegistry[]) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const onlineModels = modelList
        .filter((m) => m.status === "ONLINE")
        .slice(0, ONLINE_CALL_LIMIT);
      const results = await Promise.all(
        onlineModels.map((m) =>
          api.models
            .calls(m.id, { page: 1, pageSize: PER_MODEL_CALLS })
            .then((res) => ({ model: m, calls: res.list ?? [] }))
            .catch(() => ({ model: m, calls: [] as ModelCall[] }))
        )
      );
      const rows: HistoryRow[] = [];
      for (const r of results) {
        for (const c of r.calls) {
          rows.push({
            ...c,
            modelName: r.model.name,
            modelCode: r.model.code,
          });
        }
      }
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setHistory(rows);
    } catch (err) {
      setHistoryError(
        err instanceof ApiError ? err.message : "加载运行历史失败"
      );
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const reload = React.useCallback(async () => {
    setScenariosLoading(true);
    setModelsLoading(true);
    setScenariosError(null);
    setModelsError(null);

    let scnList: Scenario[] = [];
    let mdlList: ModelRegistry[] = [];

    try {
      const res = await api.scenarios.list({ pageSize: 100 });
      scnList = res.list ?? [];
      setScenarios(scnList);
    } catch (err) {
      setScenariosError(
        err instanceof ApiError ? err.message : "加载场景列表失败"
      );
    } finally {
      setScenariosLoading(false);
    }

    try {
      const res = await api.models.list({ pageSize: 100 });
      mdlList = res.list ?? [];
      setModels(mdlList);
    } catch (err) {
      setModelsError(
        err instanceof ApiError ? err.message : "加载模型列表失败"
      );
    } finally {
      setModelsLoading(false);
    }

    await loadHistory(mdlList);
  }, [loadHistory]);

  // 初始加载
  React.useEffect(() => {
    void reload();
  }, [reload]);

  // 选中场景默认取第一个 ACTIVE
  const activeScenarios = React.useMemo(
    () => scenarios.filter((s) => s.status === "ACTIVE"),
    [scenarios]
  );
  React.useEffect(() => {
    if (!selectedScenarioId && activeScenarios.length > 0) {
      setSelectedScenarioId(String(activeScenarios[0].id));
    }
  }, [activeScenarios, selectedScenarioId]);

  const selectedScenario =
    activeScenarios.find((s) => String(s.id) === selectedScenarioId) ?? null;

  const modelsByCode = React.useMemo(() => {
    const map = new Map<string, ModelRegistry>();
    for (const m of models) map.set(m.code, m);
    return map;
  }, [models]);

  // 选中场景的节点
  const sourceCodes = selectedScenario
    ? readStringArray(selectedScenario.config, "sourceCodes")
    : [];
  const modelCodes = selectedScenario
    ? readStringArray(selectedScenario.config, "modelCodes")
    : [];

  async function handleExecute() {
    const onlineModels = models.filter((m) => m.status === "ONLINE");
    if (onlineModels.length === 0) {
      toast.error("当前没有在线模型，无法执行推理");
      return;
    }
    let target = onlineModels[0];
    if (selectedScenario) {
      const codes = readStringArray(selectedScenario.config, "modelCodes");
      const match = onlineModels.find((m) => codes.includes(m.code));
      if (match) target = match;
    }
    setExecuting(true);
    try {
      const result = await api.models.invoke(target.id, {
        input: { source: "orchestration" },
      });
      toast.success(`「${target.name}」推理完成（${result.latencyMs} ms）`);
      await loadHistory(models);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "推理调用失败");
    } finally {
      setExecuting(false);
    }
  }

  // 运行历史分页
  const historyTotalPages = Math.max(
    1,
    Math.ceil(history.length / HISTORY_PAGE_SIZE)
  );
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const pageRows = history.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE
  );

  /* --------------------------------- Render -------------------------------- */

  if (!canRead) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="应用编排 · Orchestration"
          icon={Workflow}
          title="模型编排"
          description="基于场景的 数据源 → 模型 → 输出 流水线可视化"
        />
        <Card>
          <CardContent>
            <EmptyState
              icon={Workflow}
              title="无访问权限"
              description="当前账号缺少 orchestration:read 或 model:read 权限"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="应用编排 · Orchestration"
        icon={Workflow}
        title="模型编排"
        description="基于场景的 数据源 → 模型 → 输出 流水线可视化"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reload()}
              disabled={scenariosLoading || modelsLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  scenariosLoading || modelsLoading ? "animate-spin" : ""
                }`}
              />
              刷新
            </Button>
            {hasModelRead ? (
              <Button
                size="sm"
                onClick={() => void handleExecute()}
                disabled={executing}
              >
                {executing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                执行
              </Button>
            ) : null}
          </>
        }
      />

      <Tabs defaultValue="dag" className="w-full">
        <TabsList>
          <TabsTrigger value="dag">编排视图</TabsTrigger>
          <TabsTrigger value="history">运行历史</TabsTrigger>
          <TabsTrigger value="templates">流水线模板</TabsTrigger>
        </TabsList>

        {/* ----------------------------- Tab 1: 编排视图 ---------------------------- */}
        <TabsContent value="dag">
          <div className="flex flex-col gap-4 lg:flex-row">
            {/* 场景选择器 */}
            <Card className="lg:w-72 lg:shrink-0">
              <CardContent className="space-y-3 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  场景
                </div>
                {scenariosLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : scenariosError ? (
                  <p className="text-sm text-destructive">{scenariosError}</p>
                ) : activeScenarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    暂无启用的场景
                  </p>
                ) : (
                  <Select
                    value={selectedScenarioId || undefined}
                    onValueChange={setSelectedScenarioId}
                  >
                    <SelectTrigger aria-label="选择场景">
                      <SelectValue placeholder="选择场景" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeScenarios.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedScenario ? (
                  <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>编码</span>
                      <span className="font-mono text-foreground">
                        {selectedScenario.code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>行业</span>
                      <Badge variant="outline">
                        {selectedScenario.industry || "通用"}
                      </Badge>
                    </div>
                    {selectedScenario.description ? (
                      <p className="pt-1 text-xs leading-relaxed">
                        {selectedScenario.description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* DAG 主体 */}
            <Card className="flex-1">
              <CardContent className="p-4">
                {scenariosLoading || modelsLoading ? (
                  <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="space-y-3">
                        <Skeleton className="h-4 w-16" />
                        {Array.from({ length: 2 }).map((__, j) => (
                          <Skeleton key={j} className="h-16 w-full" />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : scenariosError || modelsError ? (
                  <div
                    className="flex items-center gap-2 py-10 text-sm text-destructive"
                    role="alert"
                  >
                    <Loader2 className="h-4 w-4" />
                    {scenariosError || modelsError}
                  </div>
                ) : !selectedScenario ? (
                  <EmptyState
                    icon={Workflow}
                    title="暂无可用场景"
                    description="请先在场景管理中创建并启用场景"
                  />
                ) : modelCodes.length === 0 ? (
                  <EmptyState
                    icon={Boxes}
                    title="该场景未配置模型节点"
                    description="请在场景 config.modelCodes 中配置参与编排的模型编码"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex min-w-[720px] items-stretch gap-3">
                      {/* 数据源 */}
                      <DagColumn title="数据源">
                        {sourceCodes.length === 0 ? (
                          <p className="py-6 text-center text-xs text-muted-foreground">
                            未配置数据源
                          </p>
                        ) : (
                          sourceCodes.map((code) => (
                            <DagNode
                              key={code}
                              icon={Database}
                              title={code}
                              subtitle="DATA-SOURCE"
                              accent="muted"
                            />
                          ))
                        )}
                      </DagColumn>

                      <ArrowRight className="h-5 w-5 shrink-0 self-center text-muted-foreground" />

                      {/* 模型 */}
                      <DagColumn title="模型">
                        {modelCodes.map((code) => {
                          const m = modelsByCode.get(code);
                          if (!m) {
                            return (
                              <DagNode
                                key={code}
                                icon={Boxes}
                                title={code}
                                subtitle="模型未登记"
                                accent="muted"
                              >
                                <Badge variant="muted">未登记</Badge>
                              </DagNode>
                            );
                          }
                          const fnMeta = MODEL_FUNCTION_BADGE[
                            m.functionType
                          ] ?? {
                            label: m.functionType,
                            variant: "outline" as const,
                          };
                          const stMeta = MODEL_STATUS_BADGE[m.status] ?? {
                            label: m.status,
                            variant: "muted" as const,
                          };
                          return (
                            <DagNode
                              key={code}
                              icon={Boxes}
                              title={m.name}
                              subtitle={m.code}
                            >
                              <div className="flex flex-wrap gap-1">
                                <Badge variant={fnMeta.variant}>
                                  {fnMeta.label}
                                </Badge>
                                <Badge variant={stMeta.variant}>
                                  {stMeta.label}
                                </Badge>
                              </div>
                            </DagNode>
                          );
                        })}
                      </DagColumn>

                      <ArrowRight className="h-5 w-5 shrink-0 self-center text-muted-foreground" />

                      {/* 输出 */}
                      <DagColumn title="输出">
                        {OUTPUT_NODES.map((node) => (
                          <DagNode
                            key={node.label}
                            icon={node.icon}
                            title={node.label}
                            subtitle="OUTPUT"
                            accent="muted"
                          />
                        ))}
                      </DagColumn>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ----------------------------- Tab 2: 运行历史 ---------------------------- */}
        <TabsContent value="history">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24%]">模型</TableHead>
                  <TableHead className="w-[150px]">调用时间</TableHead>
                  <TableHead className="w-[110px]">耗时</TableHead>
                  <TableHead className="w-[90px]">状态</TableHead>
                  <TableHead>输出摘要</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-14" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-48" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : historyError ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center">
                      <div className="flex flex-col items-center gap-2 text-sm text-destructive">
                        <Loader2 className="h-5 w-5" />
                        {historyError}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-2">
                      <EmptyState
                        icon={History}
                        title="暂无调用记录"
                        description="未检索到在线模型的近期调用记录"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((row) => (
                    <TableRow key={`${row.modelId}-${row.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Boxes className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {row.modelName}
                            </div>
                            <div className="truncate font-mono text-xs text-muted-foreground">
                              {row.modelCode}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums text-muted-foreground">
                        {row.latencyMs} ms
                      </TableCell>
                      <TableCell>
                        <Badge variant={callStatusVariant(row.status)}>
                          {callStatusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[420px] truncate font-mono text-xs text-muted-foreground">
                          {row.output
                            ? truncate(JSON.stringify(row.output), 50)
                            : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* 分页 */}
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                共{" "}
                <span className="font-medium text-foreground">
                  {formatNumber(history.length)}
                </span>{" "}
                条{historyLoading ? "（加载中）" : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={safeHistoryPage <= 1 || historyLoading}
                  onClick={() =>
                    setHistoryPage((p) => Math.max(1, p - 1))
                  }
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  上一页
                </Button>
                <span className="px-2 font-mono">
                  {safeHistoryPage} / {historyTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={
                    safeHistoryPage >= historyTotalPages || historyLoading
                  }
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  下一页
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ---------------------------- Tab 3: 流水线模板 --------------------------- */}
        <TabsContent value="templates">
          {scenariosLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="space-y-3 p-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-28" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : scenariosError ? (
            <Card>
              <CardContent>
                <div
                  className="flex items-center gap-2 py-10 text-sm text-destructive"
                  role="alert"
                >
                  <Loader2 className="h-4 w-4" />
                  {scenariosError}
                </div>
              </CardContent>
            </Card>
          ) : scenarios.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Workflow}
                  title="暂无流水线模板"
                  description="请先在场景管理中创建场景以作为流水线模板"
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {scenarios.map((s) => {
                const srcCount = readStringArray(s.config, "sourceCodes")
                  .length;
                const mdlCount = readStringArray(s.config, "modelCodes")
                  .length;
                const statusMeta =
                  s.status === "ACTIVE"
                    ? { label: "启用", variant: "success" as const }
                    : s.status === "TEMPLATE"
                      ? {
                          label: "模板",
                          variant: "outline" as const,
                        }
                      : { label: "停用", variant: "muted" as const };
                return (
                  <Card key={s.id} className="flex flex-col">
                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Workflow className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {s.name}
                            </div>
                            <div className="truncate font-mono text-xs text-muted-foreground">
                              {s.code}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">
                          {s.industry || "通用"}
                        </Badge>
                        <Badge variant={statusMeta.variant}>
                          {statusMeta.label}
                        </Badge>
                      </div>

                      <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
                        {s.description || "暂无描述"}
                      </p>

                      <div className="mt-auto flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                        <Database className="h-3.5 w-3.5" />
                        <span>{srcCount} 个数据源</span>
                        <span className="text-border">·</span>
                        <Boxes className="h-3.5 w-3.5" />
                        <span>{mdlCount} 个模型</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Workflow className="h-3.5 w-3.5" />
        CarbonOps · 模型编排（只读可视化）
      </div>
    </div>
  );
}
