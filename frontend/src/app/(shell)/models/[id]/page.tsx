"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Code2,
  FileText,
  History,
  Loader2,
  Play,
  Rocket,
  Save,
  Terminal,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/empty-state";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  MODEL_FUNCTION_BADGE,
  MODEL_STATUS_BADGE,
  MODEL_STAGE_BADGE,
} from "@/lib/constants";
import type {
  ModelCall,
  ModelInvokeResult,
  ModelRegistryDetail,
  ModelStage,
  ModelVersionBrief,
  ModelVersionDetail,
  TestRunResult,
} from "@/types/api";

const CALLS_PAGE_SIZE = 15;
const STAGES: ModelStage[] = ["NONE", "STAGING", "PRODUCTION", "ARCHIVED"];

export default function ModelDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const modelId = parseInt(params.id, 10);
  const router = useRouter();
  const hasWrite = useAuthStore((s) => s.hasPermission("model:write"));

  const [detail, setDetail] = React.useState<ModelRegistryDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Selected version for source code / test run
  const [selectedVersionId, setSelectedVersionId] = React.useState<number | null>(null);
  const [versionDetail, setVersionDetail] = React.useState<ModelVersionDetail | null>(null);
  const [versionLoading, setVersionLoading] = React.useState(false);

  // Source code state
  const [sourceCode, setSourceCode] = React.useState("");
  const [sourceDirty, setSourceDirty] = React.useState(false);
  const [savingSource, setSavingSource] = React.useState(false);

  // Test run state
  const [testInput, setTestInput] = React.useState('{\n  "sample": "input"\n}');
  const [testResult, setTestResult] = React.useState<TestRunResult | null>(null);
  const [testing, setTesting] = React.useState(false);

  // Invoke dialog
  const [invokeInput, setInvokeInput] = React.useState('{\n  "sample": "input"\n}');
  const [invokeResult, setInvokeResult] = React.useState<ModelInvokeResult | null>(null);
  const [invoking, setInvoking] = React.useState(false);

  // Calls state
  const [calls, setCalls] = React.useState<ModelCall[]>([]);
  const [callsTotal, setCallsTotal] = React.useState(0);
  const [callsPage, setCallsPage] = React.useState(1);
  const [callsLoading, setCallsLoading] = React.useState(false);

  // Active tab
  const [activeTab, setActiveTab] = React.useState("overview");

  // Load model detail
  React.useEffect(() => {
    if (!modelId) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await api.models.get(modelId);
        if (!active) return;
        setDetail(data);
        // Auto-select first version
        const currentVersion = data.versions.find((v) => v.isCurrent) ?? data.versions[0];
        if (currentVersion) {
          setSelectedVersionId(currentVersion.id);
        }
      } catch (err) {
        if (active) {
          toast.error(
            err instanceof ApiError ? err.message : "加载模型详情失败"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [modelId]);

  // Load version detail when selected version changes
  const loadVersionDetail = React.useCallback(async (vid: number) => {
    setVersionLoading(true);
    try {
      const vd = await api.models.versionDetail(modelId, vid);
      setVersionDetail(vd);
      setSourceCode(vd.sourceCode ?? "");
      setSourceDirty(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "加载版本详情失败"
      );
    } finally {
      setVersionLoading(false);
    }
  }, [modelId]);

  React.useEffect(() => {
    if (selectedVersionId && (activeTab === "source" || activeTab === "test")) {
      void loadVersionDetail(selectedVersionId);
    }
  }, [selectedVersionId, activeTab, loadVersionDetail]);

  // Load calls
  const loadCalls = React.useCallback(
    async (page: number) => {
      if (!modelId) return;
      setCallsLoading(true);
      try {
        const res = await api.models.calls(modelId, {
          page,
          pageSize: CALLS_PAGE_SIZE,
        });
        setCalls(res.list ?? []);
        setCallsTotal(res.meta?.total ?? 0);
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "加载调用记录失败"
        );
      } finally {
        setCallsLoading(false);
      }
    },
    [modelId]
  );

  React.useEffect(() => {
    if (activeTab === "calls" && modelId) {
      void loadCalls(callsPage);
    }
  }, [activeTab, modelId, callsPage, loadCalls]);

  // Save source code
  async function handleSaveSource() {
    if (!selectedVersionId) return;
    setSavingSource(true);
    try {
      await api.models.updateSourceCode(modelId, selectedVersionId, sourceCode, versionDetail?.pythonVersion ?? undefined);
      setSourceDirty(false);
      toast.success("源代码已保存");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setSavingSource(false);
    }
  }

  // Test run
  async function handleTestRun() {
    if (!selectedVersionId) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(testInput);
    } catch {
      toast.error("输入不是有效的 JSON");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.models.testRun(modelId, selectedVersionId, {
        sourceCode: sourceDirty ? sourceCode : undefined,
        input: parsed,
      });
      setTestResult(result);
      if (result.success) {
        toast.success(`执行成功（${result.latencyMs} ms）`);
      } else {
        toast.error(`执行失败: ${result.error}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "试运行失败");
    } finally {
      setTesting(false);
    }
  }

  // Invoke
  async function handleInvoke() {
    if (!modelId) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(invokeInput);
    } catch {
      toast.error("输入不是有效的 JSON");
      return;
    }
    setInvoking(true);
    setInvokeResult(null);
    try {
      const result = await api.models.invoke(modelId, { input: parsed });
      setInvokeResult(result);
      toast.success(`推理完成（${result.latencyMs} ms）`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "推理调用失败");
    } finally {
      setInvoking(false);
    }
  }

  // Stage transition
  async function handleTransition(vid: number, stage: ModelStage) {
    try {
      await api.models.transitionStage(modelId, vid, stage);
      toast.success(`已切换至 ${MODEL_STAGE_BADGE[stage]?.label ?? stage}`);
      // Reload detail
      const data = await api.models.get(modelId);
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "操作失败");
    }
  }

  // Activate version
  async function handleActivate(vid: number) {
    try {
      await api.models.activateVersion(modelId, vid);
      toast.success("已设为当前版本");
      const data = await api.models.get(modelId);
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "操作失败");
    }
  }

  const callsTotalPages = Math.max(1, Math.ceil(callsTotal / CALLS_PAGE_SIZE));
  const versions = detail?.versions ?? [];
  const currentVersion = versions.find((v) => v.isCurrent);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <EmptyState
        className="mt-20"
        icon={Boxes}
        title="模型不存在"
        description="该模型可能已被删除"
      />
    );
  }

  const fnMeta = MODEL_FUNCTION_BADGE[detail.functionType] ?? {
    label: detail.functionType,
    variant: "outline" as const,
  };
  const stMeta = MODEL_STATUS_BADGE[detail.status] ?? {
    label: detail.status,
    variant: "muted" as const,
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="mt-1"
          onClick={() => router.push("/models")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{detail.name}</h1>
            <Badge variant={stMeta.variant}>{stMeta.label}</Badge>
            <Badge variant={fnMeta.variant}>{fnMeta.label}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="font-mono">{detail.code}</span>
            {detail.provider ? <span>{detail.provider}</span> : null}
            {detail.processStage ? <span>{detail.processStage}</span> : null}
            <span>调用 {formatNumber(detail.callCount)} 次</span>
          </div>
          {detail.description ? (
            <p className="text-sm leading-relaxed text-foreground/80">
              {detail.description}
            </p>
          ) : null}
          {detail.tags && detail.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {detail.tags.map((t) => (
                <Badge key={t} variant="muted" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <FileText className="mr-1.5 h-4 w-4" />
            概览
          </TabsTrigger>
          <TabsTrigger value="versions">
            <History className="mr-1.5 h-4 w-4" />
            版本管理
          </TabsTrigger>
          <TabsTrigger value="source">
            <Code2 className="mr-1.5 h-4 w-4" />
            源码编辑
          </TabsTrigger>
          <TabsTrigger value="test">
            <Terminal className="mr-1.5 h-4 w-4" />
            试运行
          </TabsTrigger>
          <TabsTrigger value="calls">
            <TrendingUp className="mr-1.5 h-4 w-4" />
            调用记录
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <InfoRow label="模型编码" value={detail.code} mono />
                <InfoRow label="行业" value={detail.industry} />
                <InfoRow label="工序阶段" value={detail.processStage ?? "—"} />
                <InfoRow label="功能类型" value={fnMeta.label} />
                <InfoRow label="提供单位" value={detail.provider ?? "—"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  运行指标
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <InfoRow
                  label="准确率"
                  value={
                    detail.accuracy > 0
                      ? `${(detail.accuracy * 100).toFixed(1)}%`
                      : "—"
                  }
                  mono
                />
                <InfoRow label="调用次数" value={formatNumber(detail.callCount)} mono />
                <InfoRow label="版本数量" value={String(detail.versionCount)} mono />
                <InfoRow label="最新版本" value={detail.latestVersion ?? "—"} mono />
                <InfoRow
                  label="创建时间"
                  value={formatDate(detail.createdAt) ?? "—"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  快捷操作
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => setActiveTab("source")}
                >
                  <Code2 className="mr-2 h-4 w-4" />
                  查看源码
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => setActiveTab("test")}
                >
                  <Terminal className="mr-2 h-4 w-4" />
                  试运行
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => setActiveTab("versions")}
                >
                  <History className="mr-2 h-4 w-4" />
                  版本管理
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Inline Invoke */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  推理调用
                </CardTitle>
                <Button size="sm" onClick={() => void handleInvoke()} disabled={invoking}>
                  {invoking ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-1.5 h-4 w-4" />
                  )}
                  {invoking ? "推理中…" : "执行推理"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={invokeInput}
                onChange={(e) => setInvokeInput(e.target.value)}
                rows={4}
                className="font-mono text-xs"
                spellCheck={false}
                placeholder="输入 JSON 格式的推理参数"
              />
              {invokeResult ? (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">结果</span>
                    <Badge variant={invokeResult.status === "SUCCESS" ? "success" : "destructive"}>
                      {invokeResult.status}
                    </Badge>
                    <span className="font-mono text-muted-foreground">
                      {invokeResult.latencyMs} ms
                    </span>
                  </div>
                  <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                    <code>{JSON.stringify(invokeResult.output, null, 2)}</code>
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versions">
          <Card>
            <CardContent className="p-0">
              {versions.length === 0 ? (
                <EmptyState
                  className="py-12"
                  icon={History}
                  title="暂无版本"
                  description="该模型尚未发布任何版本"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>版本号</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>阶段</TableHead>
                      <TableHead>更新说明</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="w-[120px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => {
                      const stageBadge = MODEL_STAGE_BADGE[v.stage] ?? {
                        label: v.stage,
                        variant: "outline" as const,
                      };
                      return (
                        <TableRow key={v.id}>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="font-mono">
                                {v.versionNo}
                              </Badge>
                              {v.isCurrent ? (
                                <Badge variant="success">当前</Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={MODEL_STATUS_BADGE[v.status]?.variant ?? "muted"}>
                              {MODEL_STATUS_BADGE[v.status]?.label ?? v.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={stageBadge.variant}>
                              {stageBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {v.changelog ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(v.createdAt) ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {hasWrite ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 px-2">
                                    操作
                                    <ChevronRight className="ml-1 h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  {!v.isCurrent && (
                                    <DropdownMenuItem onSelect={() => void handleActivate(v.id)}>
                                      <Rocket className="mr-2 h-4 w-4" />
                                      设为当前版本
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onSelect={() => void handleTransition(v.id, "STAGING")}>
                                    <Badge variant="warning" className="mr-2 text-[10px]">S</Badge>
                                    转为 Staging
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => void handleTransition(v.id, "PRODUCTION")}>
                                    <Badge variant="success" className="mr-2 text-[10px]">P</Badge>
                                    转为 Production
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => void handleTransition(v.id, "ARCHIVED")}>
                                    <Badge variant="muted" className="mr-2 text-[10px]">A</Badge>
                                    归档
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Source Code Tab */}
        <TabsContent value="source">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-sm font-medium">
                    Python 源代码
                  </CardTitle>
                  {versions.length > 0 ? (
                    <Select
                      value={String(selectedVersionId ?? "")}
                      onValueChange={(v) => setSelectedVersionId(parseInt(v, 10))}
                    >
                      <SelectTrigger className="h-7 w-[140px]">
                        <SelectValue placeholder="选择版本" />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.versionNo}
                            {v.isCurrent ? " (当前)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
                {hasWrite ? (
                  <Button
                    size="sm"
                    onClick={() => void handleSaveSource()}
                    disabled={!sourceDirty || savingSource || !selectedVersionId}
                  >
                    {savingSource ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-4 w-4" />
                    )}
                    保存
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {versionLoading ? (
                <Skeleton className="h-[480px] w-full" />
              ) : !selectedVersionId ? (
                <EmptyState
                  className="py-12"
                  icon={Code2}
                  title="暂无版本"
                  description="请先创建版本后再编辑源代码"
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      Python {versionDetail?.pythonVersion ?? "3.11"}
                    </Badge>
                    <span>入口函数:</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                      {versionDetail?.entryFunction ?? "predict"}()
                    </code>
                    {sourceDirty ? (
                      <Badge variant="warning" className="text-[10px]">未保存</Badge>
                    ) : null}
                  </div>
                  <Textarea
                    value={sourceCode}
                    onChange={(e) => {
                      setSourceCode(e.target.value);
                      setSourceDirty(true);
                    }}
                    rows={22}
                    className="font-mono text-xs leading-relaxed"
                    spellCheck={false}
                    placeholder="# 在此编写 Python 模型代码&#10;# 必须定义入口函数: def predict(input: dict) -> dict:"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Run Tab */}
        <TabsContent value="test">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Left: Code + Input */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    源代码 & 测试输入
                  </CardTitle>
                  {versions.length > 0 ? (
                    <Select
                      value={String(selectedVersionId ?? "")}
                      onValueChange={(v) => setSelectedVersionId(parseInt(v, 10))}
                    >
                      <SelectTrigger className="h-7 w-[140px]">
                        <SelectValue placeholder="选择版本" />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.versionNo}
                            {v.isCurrent ? " (当前)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Python 源代码 {sourceDirty ? "(未保存的修改)" : ""}
                  </div>
                  <Textarea
                    value={sourceCode}
                    onChange={(e) => {
                      setSourceCode(e.target.value);
                      setSourceDirty(true);
                    }}
                    rows={14}
                    className="font-mono text-xs leading-relaxed"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    测试输入 (JSON)
                  </div>
                  <Textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    rows={4}
                    className="font-mono text-xs"
                    spellCheck={false}
                  />
                </div>
                <Button
                  onClick={() => void handleTestRun()}
                  disabled={testing || !selectedVersionId}
                  className="w-full"
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {testing ? "执行中…" : "运行测试"}
                </Button>
              </CardContent>
            </Card>

            {/* Right: Results */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  执行结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!testResult ? (
                  <EmptyState
                    className="py-16"
                    icon={Terminal}
                    title="等待执行"
                    description="点击「运行测试」后在此查看结果"
                  />
                ) : (
                  <div className="space-y-4">
                    {/* Status header */}
                    <div className="flex items-center gap-3">
                      {testResult.success ? (
                        <CircleCheck className="h-6 w-6 text-success" />
                      ) : (
                        <CircleX className="h-6 w-6 text-destructive" />
                      )}
                      <div>
                        <div className="font-medium">
                          {testResult.success ? "执行成功" : "执行失败"}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {testResult.latencyMs} ms
                        </div>
                      </div>
                    </div>

                    {/* Error message */}
                    {testResult.error ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                        <div className="mb-1 text-xs font-medium text-destructive">
                          错误信息
                        </div>
                        <pre className="overflow-auto text-xs text-destructive">
                          <code>{testResult.error}</code>
                        </pre>
                      </div>
                    ) : null}

                    {/* Output */}
                    {testResult.output ? (
                      <div>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">
                          输出结果
                        </div>
                        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                          <code>{JSON.stringify(testResult.output, null, 2)}</code>
                        </pre>
                      </div>
                    ) : null}

                    {/* Stdout */}
                    {testResult.stdout ? (
                      <div>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">
                          标准输出 (stdout)
                        </div>
                        <pre className="overflow-auto rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                          <code>{testResult.stdout}</code>
                        </pre>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls">
          <Card>
            <CardContent className="p-0">
              {callsLoading && calls.length === 0 ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={`csk-${i}`} className="h-10 w-full" />
                  ))}
                </div>
              ) : calls.length === 0 ? (
                <EmptyState
                  className="py-12"
                  icon={TrendingUp}
                  title="暂无调用记录"
                  description="该模型尚未被调用"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">ID</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">延迟</TableHead>
                      <TableHead>输入摘要</TableHead>
                      <TableHead>输出摘要</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calls.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          #{c.id}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.status === "SUCCESS" ? "success" : "destructive"}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {c.latencyMs} ms
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {c.input ? JSON.stringify(c.input) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {c.output ? JSON.stringify(c.output) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(c.createdAt) ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {callsTotal > CALLS_PAGE_SIZE ? (
              <div className="flex items-center justify-end gap-1 border-t px-4 py-3 text-xs text-muted-foreground">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={callsPage <= 1 || callsLoading}
                  onClick={() => setCallsPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 font-mono">
                  {callsPage} / {callsTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={callsPage >= callsTotalPages || callsLoading}
                  onClick={() => setCallsPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
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
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={mono ? "font-mono text-sm" : "text-sm"}>
        {value}
      </span>
    </div>
  );
}
