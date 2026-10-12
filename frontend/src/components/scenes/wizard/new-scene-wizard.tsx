"use client";

/**
 * 新增场景向导 — 3 步状态机 + 完成页。
 * 步骤：
 *  1. 组态化系统开发（拖拽画布 + 迁移配置 + 云边端口）
 *  2. 云边端资源协同（拓扑 + 节点/终端管理 + 同步策略）
 *  3. 模型自适应迁移（源/目标 + 监控 + 执行 + 完成）
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Cpu,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Step1ConfigDev } from "@/components/scenes/wizard/step1-config-dev";
import { Step2CloudEdge } from "@/components/scenes/wizard/step2-cloud-edge";
import { Step3Migration } from "@/components/scenes/wizard/step3-migration";
import type { ComposerNode } from "@/types/cloud-edge";

const STEPS = [
  { num: 1, label: "组态化系统开发", icon: Wand2 },
  { num: 2, label: "云边端资源协同", icon: Cloud },
  { num: 3, label: "模型自适应迁移", icon: Cpu },
] as const;

export function NewSceneWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [completed, setCompleted] = React.useState<boolean[]>([false, false, false]);

  /* Step1 状态 */
  const [sceneName, setSceneName] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [nodes, setNodes] = React.useState<ComposerNode[]>([]);

  const goStep2 = () => {
    if (nodes.length < 1) {
      toast.error("请先在画布上拖拽至少一个模型/组件");
      return;
    }
    if (!sceneName) {
      toast.error("请输入场景名称");
      return;
    }
    if (!industry) {
      toast.error("请选择行业");
      return;
    }
    setCompleted([true, false, false]);
    setStep(2);
  };

  const goStep3 = () => {
    setCompleted([true, true, false]);
    setStep(3);
  };

  const completeDeployment = () => {
    toast.success(`场景「${sceneName || "未命名"}」已部署到边缘节点！`);
    router.push("/scenarios");
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* 顶部 */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.push("/scenarios")} className="shadow-card-sm">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          返回行业场景
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-md bg-gradient-primary text-white shadow-glow-cyan">
              <Sparkles className="h-4 w-4" />
              <span aria-hidden className="absolute -inset-1 rounded-md bg-primary/30 blur-md animate-logo-pulse" />
            </span>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">新增低碳场景</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            通过向导式配置快速搭建一个完整的低碳运行场景 — 组态开发 → 云边协同 → 模型自适应迁移
          </p>
        </div>
      </div>

      {/* 步骤指示器（机甲风） */}
      <div className="panel-cyber rounded-xl p-4">
        <span className="corner-decor tl" />
        <span className="corner-decor tr" />
        <span className="corner-decor bl" />
        <span className="corner-decor br" />
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isDone = completed[i];
            return (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    {isActive ? (
                      <span
                        aria-hidden
                        className="absolute -inset-1 rounded-full bg-primary/40 blur-md animate-logo-pulse"
                      />
                    ) : null}
                    <div
                      className={cn(
                        "relative flex h-8 w-8 items-center justify-center rounded-full font-cyber text-xs font-semibold transition-all",
                        isDone
                          ? "border border-success/40 bg-success/20 text-success text-glow-success"
                          : isActive
                            ? "border border-primary/50 bg-primary/20 text-primary text-glow-cyan"
                            : "border border-border bg-muted text-muted-foreground"
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : isActive ? <Icon className="h-4 w-4" /> : s.num}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors",
                      isActive ? "text-primary text-glow-cyan" : isDone ? "text-success" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="relative mx-4 h-0.5 flex-1 overflow-hidden rounded-full bg-primary/15">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 transition-all duration-500",
                        completed[i]
                          ? "w-full bg-gradient-to-r from-success to-primary"
                          : "w-0 bg-primary"
                      )}
                    />
                    {/* 流动粒子 */}
                    {completed[i] ? (
                      <div className="absolute inset-y-0 w-1/3 animate-data-flow rounded-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />
                    ) : null}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step 内容 */}
      {step === 1 && (
        <Step1ConfigDev
          sceneName={sceneName}
          industry={industry}
          onSceneNameChange={setSceneName}
          onIndustryChange={setIndustry}
          nodes={nodes}
          setNodes={setNodes}
          onGoStep2={goStep2}
        />
      )}
      {step === 2 && <Step2CloudEdge onGoStep3={goStep3} onBack={() => setStep(1)} />}
      {step === 3 && <Step3Migration onBack={() => setStep(2)} onComplete={completeDeployment} />}
    </div>
  );
}

export default NewSceneWizard;
