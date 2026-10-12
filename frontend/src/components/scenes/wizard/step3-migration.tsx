"use client";

/**
 * 新增场景向导 Step3 — 模型自适应迁移。
 *  - 源环境（GPU 训练集群） → 目标环境（边缘部署） 双卡对比
 *  - 导出格式 / 适配优化 选择
 *  - 迁移过程监控（4 步进度：格式转换 → 精度校验 → 量化压缩 → 边端部署）
 *  - 执行按钮 → 完成确认页（含精度/加速/功耗提升）
 */
import * as React from "react";
import { CheckCircle2, Loader2, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  onBack: () => void;
  onComplete: () => void;
}

export function Step3Migration({ onBack, onComplete }: Props) {
  const [exportFormat, setExportFormat] = React.useState("onnx");
  const [adaptOpt, setAdaptOpt] = React.useState("quantize");
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0); // 0..100
  const [stepDone, setStepDone] = React.useState([true, true, false, false]);
  const [done, setDone] = React.useState(false);

  const execute = () => {
    setRunning(true);
    setProgress(76); // demo 起始展示
    setStepDone([true, true, false, false]);
    let p = 76;
    const tick = setInterval(() => {
      p = Math.min(100, p + 4);
      setProgress(p);
      if (p >= 100) {
        clearInterval(tick);
        setStepDone([true, true, true, true]);
        setRunning(false);
        setDone(true);
      } else if (p >= 88) {
        setStepDone([true, true, true, false]);
      } else if (p >= 84) {
        setStepDone([true, true, false, false]);
      }
    }, 180);
  };

  return (
    <div className="space-y-4">
      {/* 源 / 目标对比 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel-cyber rounded-xl">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <div className="border-b border-primary/15 px-4 py-2.5">
            <h3 className="panel-title-bar flex items-center gap-2 text-sm font-semibold tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">☁</span>
              源环境 (云端训练)
            </h3>
          </div>
          <div className="p-4">
            <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4 shadow-glow-cyan">
              <div className="mb-2 text-2xl">☁</div>
              <div className="font-semibold text-foreground">GPU 训练集群</div>
              <div className="mt-1 text-xs text-muted-foreground">
                PyTorch 2.x · CUDA 12 · 数据集: 全量历史数据
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="font-cyber rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">精度 98.7%</span>
                <span className="font-cyber rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">模型 v3.2</span>
                <span className="font-cyber rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">参数量 127M</span>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Label className="text-xs">导出格式</Label>
              <Select value={exportFormat} onValueChange={setExportFormat} disabled={running || done}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onnx">ONNX (通用格式)</SelectItem>
                  <SelectItem value="torchscript">TorchScript</SelectItem>
                  <SelectItem value="tensorrt">TensorRT (GPU优化)</SelectItem>
                  <SelectItem value="openvino">OpenVINO (Intel优化)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="panel-cyber rounded-xl">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <div className="border-b border-primary/15 px-4 py-2.5">
            <h3 className="panel-title-bar flex items-center gap-2 text-sm font-semibold tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">🔷</span>
              目标环境 (边缘部署)
            </h3>
          </div>
          <div className="p-4">
            <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent p-4 shadow-[0_0_12px_hsl(195_100%_50%_/_0.18)]">
              <div className="mb-2 text-2xl">🔷</div>
              <div className="font-semibold text-foreground">边缘推理节点</div>
              <div className="mt-1 text-xs text-muted-foreground">
                寒武纪 MLU370 · 内存 16GB · 功耗限制 75W
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="font-cyber rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">INT8 量化</span>
                <span className="font-cyber rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">精度目标 ≥95%</span>
                <span className="font-cyber rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">延迟 &lt;5ms</span>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Label className="text-xs">适配优化</Label>
              <Select value={adaptOpt} onValueChange={setAdaptOpt} disabled={running || done}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quantize">量化压缩 (INT8)</SelectItem>
                  <SelectItem value="prune">模型剪枝 (结构化)</SelectItem>
                  <SelectItem value="distill">知识蒸馏</SelectItem>
                  <SelectItem value="nas">架构搜索 (NAS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* 迁移监控 */}
      <div className="panel-cyber rounded-xl">
        <span className="corner-decor tl" />
        <span className="corner-decor tr" />
        <span className="corner-decor bl" />
        <span className="corner-decor br" />
        <div className="border-b border-primary/15 px-4 py-2.5">
          <h3 className="panel-title-bar text-sm font-semibold tracking-wider">📊 迁移过程监控</h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {done ? "迁移完成 ✓" : running ? "正在迁移..." : "待执行"}
                </span>
                <span className="font-mono text-primary">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "格式转换", sub: "PyTorch→" + exportFormat.toUpperCase() },
                { label: "精度校验", sub: "偏差 <1.2%" },
                { label: "量化压缩", sub: "FP32→INT8" },
                { label: "边端部署", sub: "已下发到边缘节点" },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className={cn(
                    "rounded-lg border p-3 text-center text-xs",
                    stepDone[i]
                      ? "border-success/30 bg-success/5"
                      : i === 2 && running
                        ? "border-warning/40 bg-warning/5"
                        : "border-border/40 bg-card/50"
                  )}
                >
                  <div className="mb-1 flex justify-center text-base">
                    {stepDone[i] ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : i === 2 && running ? (
                      <Loader2 className="h-5 w-5 animate-spin text-warning" />
                    ) : (
                      <span className="text-muted-foreground">○</span>
                    )}
                  </div>
                  <div className={cn("font-medium", stepDone[i] ? "text-success" : "text-foreground")}>
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
              <strong className="text-primary">迁移摘要：</strong>{" "}
              源模型 CO₂ 排放预测 v3.2 (PyTorch, 127M 参数) → 目标设备 边缘节点 A (寒武纪 MLU370) · 策略:{" "}
              {adaptOpt === "quantize" ? "INT8 量化" : adaptOpt === "prune" ? "结构化剪枝" : adaptOpt === "distill" ? "知识蒸馏" : "架构搜索"} ·{" "}
              预估精度损失 &lt;1.5% · 推理速度提升 4.2×
            </div>
          </div>
        </div>
      </div>

      {!done ? (
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>← 上一步</Button>
          <Button variant="gradient" onClick={execute} disabled={running}>
            {running ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                迁移中…
              </>
            ) : (
              <>
                <Rocket className="mr-1 h-4 w-4" />
                执行模型自适应迁移
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="panel-cyber rounded-xl shadow-glow-success">
          <span className="corner-decor tl" />
          <span className="corner-decor tr" />
          <span className="corner-decor bl" />
          <span className="corner-decor br" />
          <div className="py-8 text-center">
            <div className="mb-3 text-5xl">✅</div>
            <div className="mb-1 text-base font-semibold text-success text-glow-success">
              模型自适应迁移成功！
            </div>
            <div className="mb-5 text-xs text-muted-foreground">
              源模型 v3.2 → 边缘节点 A (寒武纪 MLU370)
            </div>
            <div className="mx-auto mb-6 grid max-w-md grid-cols-3 gap-3">
              <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                <div className="font-cyber text-xl font-bold text-success text-glow-success">97.3%</div>
                <div className="text-[10px] text-muted-foreground">迁移后精度</div>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="font-cyber text-xl font-bold text-primary text-glow-cyan">4.2×</div>
                <div className="text-[10px] text-muted-foreground">推理加速</div>
              </div>
              <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                <div className="font-cyber text-xl font-bold text-success text-glow-success">↓68%</div>
                <div className="text-[10px] text-muted-foreground">功耗降低</div>
              </div>
            </div>
            <Button size="lg" onClick={onComplete} className="min-w-[180px]">
              🎯 完成部署
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
