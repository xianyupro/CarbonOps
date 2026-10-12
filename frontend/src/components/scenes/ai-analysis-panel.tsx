"use client";

/**
 * 场景详情 — AI 大模型智能分析面板。
 * 点击「AI 一键分析」模拟流式打字机输出诊断报告。
 */
import * as React from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Scene } from "@/types/cloud-edge";

interface Props {
  scene: Scene;
}

/** 根据场景生成结构化诊断报告 */
function buildReport(scene: Scene) {
  const reduction = scene.reduction ?? 0;
  const efficiency = scene.efficiency ?? 0;
  const alerts = scene.alerts;

  const summary =
    reduction > 20
      ? `当前 ${scene.name} 处于较优运行状态，综合碳减排率 ${reduction}%，能效 ${efficiency || "--"}% 优于行业基准。`
      : `当前 ${scene.name} 综合碳减排率 ${reduction}% 仍有提升空间，建议关注关键工序的能效优化。`;

  const anomalies: string[] = [];
  if (alerts > 0) anomalies.push(`检测到 ${alerts} 个待处理告警，建议优先排查关联设备。`);
  if (efficiency && efficiency < 90) anomalies.push(`能效 ${efficiency}% 低于预警阈值 90%，存在能耗上升趋势。`);
  if (scene.location && scene.location.includes("西北")) anomalies.push("西北区域站点近期气象波动较大，已自动调用感知模型补偿。");

  const suggestions = [
    "调用「" + (scene.industry === "钢铁" ? "燃烧优化控制" : scene.industry === "有色" ? "MPC 模型预测控制" : "窄区间多变量协同优化控制") + "」模型动态调整关键参数",
    "下发" + (scene.industry === "石化" ? "工况在线识别" : "多物理场碳排特性智能表征") + "策略到边缘节点 A 进行本地推理",
    "对" + (scene.params ? "窑中温度" : "关键运行参数") + "进行 24h 趋势预测，提前发现潜在漂移",
  ];

  const forecast =
    scene.reduction != null
      ? `未来 4 小时预测：碳减排率将稳定在 ${(scene.reduction - 1).toFixed(1)}% ~ ${(scene.reduction + 1.5).toFixed(1)}%，波动可控。`
      : "当前数据不足以生成预测，建议先补齐采集点位。";

  return { summary, anomalies, suggestions, forecast };
}

export function AIAnalysisPanel({ scene }: Props) {
  const [running, setRunning] = React.useState(false);
  const [streamed, setStreamed] = React.useState("");
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const fullText = React.useMemo(() => {
    const r = buildReport(scene);
    return [
      `▌ 综合诊断`,
      r.summary,
      "",
      `▌ 异常与告警`,
      r.anomalies.length > 0 ? r.anomalies.join("\n") : "（无）",
      "",
      `▌ 优化建议`,
      r.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      "",
      `▌ 趋势预测`,
      r.forecast,
    ].join("\n");
  }, [scene]);

  const startAnalyze = React.useCallback(() => {
    if (running) return;
    setRunning(true);
    setStreamed("");

    let i = 0;
    timerRef.current = setInterval(() => {
      i += 2;
      setStreamed(fullText.slice(0, i));
      if (i >= fullText.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setRunning(false);
      }
    }, 18);
  }, [running, fullText]);

  React.useEffect(() => {
    // 组件卸载或场景切换时清理
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="panel-cyber relative flex h-full flex-col overflow-hidden rounded-xl">
      <span className="corner-decor tl" />
      <span className="corner-decor tr" />
      <span className="corner-decor bl" />
      <span className="corner-decor br" />
      <div className="flex items-center justify-between border-b border-primary/15 bg-background/40 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="relative">
            <span aria-hidden className="absolute -inset-1 rounded-md bg-purple-500/30 blur-md animate-logo-pulse" />
            <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="panel-title-bar text-sm font-semibold tracking-wider">大模型智能分析</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">基于工业碳减排知识图谱</div>
          </div>
        </div>
        <span
          className={cn(
            "font-cyber rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider",
            running
              ? "border-warning/40 bg-warning/10 text-warning animate-glow-blink"
              : streamed
                ? "border-success/40 bg-success/10 text-success"
                : "border-primary/30 bg-primary/5 text-primary"
          )}
        >
          {running ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              分析中…
            </span>
          ) : streamed ? (
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              已完成
            </span>
          ) : (
            "就绪"
          )}
        </span>
      </div>
      <CardContent className="flex-1 overflow-auto p-4">
        {streamed ? (
          <pre className="whitespace-pre-wrap break-words font-cyber text-[12.5px] leading-relaxed text-foreground/90">
            {streamed}
            {running ? (
              <span className="inline-block h-3.5 w-2 bg-success align-middle animate-text-blink" />
            ) : null}
          </pre>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Bot className="mb-3 h-10 w-10 text-purple-500/60" />
            <p className="text-sm">
              点击上方驾驶舱顶栏的
              <span className="mx-1 font-semibold text-primary">「AI 一键分析」</span>
              按钮
              <br />
              获取当前场景智能诊断报告
            </p>
          </div>
        )}
      </CardContent>
      <div className="border-t border-border/40 bg-card/40 px-4 py-2 text-right">
        <button
          type="button"
          className="rounded-md bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:from-purple-600 hover:to-blue-600 disabled:opacity-50"
          disabled={running}
          onClick={startAnalyze}
        >
          {running ? "分析中…" : streamed ? "重新分析" : "开始 AI 分析"}
        </button>
      </div>
    </div>
  );
}

export default AIAnalysisPanel;
