"use client";

/**
 * AI 生成元模型草稿弹窗。
 * 自然语言描述 → DeepSeek 生成八节结构草稿（不落库）→ 预览确认 → 填充到登记表单。
 */
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, WandSparkles } from "lucide-react";

import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MetamodelPayload, MetamodelType } from "@/types/api";

const TYPE_LABEL: Record<MetamodelType, string> = {
  MECHANISM: "机理模型",
  DATA_MODEL: "数据模型",
  ALGORITHM: "算法模型",
  KNOWLEDGE_RULE: "知识规则模型",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前登记页选择的模型类型（作为生成默认类型）。 */
  modelType: MetamodelType;
  /** 确认后回调：把草稿填充进表单。 */
  onApply: (draft: MetamodelPayload) => void;
}

export function AiGenerateDialog({ open, onOpenChange, modelType, onApply }: Props) {
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<MetamodelType>(modelType);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState<MetamodelPayload | null>(null);

  // 打开时同步当前页签类型、清空上次结果
  React.useEffect(() => {
    if (open) {
      setType(modelType);
      setDraft(null);
    }
  }, [open, modelType]);

  const SAMPLE =
    "我要登记一个回转挥发窑的炉衬传热机理模型：已知窑内烟气温度和衬砖物性参数，" +
    "通过一维稳态圆筒壁导热计算窑体外表面温度和散热损失，用于能耗监测与保温优化。";

  async function handleGenerate() {
    if (!description.trim() || loading) return;
    setLoading(true);
    setDraft(null);
    try {
      const r = await api.metamodelAi.draft(description.trim(), type);
      setDraft(r.draft);
      toast.success("草稿已生成，请确认后填充到表单");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!draft) return;
    onApply(draft);
    onOpenChange(false);
    setDescription("");
    setDraft(null);
  }

  const ioCount = draft?.ioParams?.length ?? 0;
  const relCount = draft?.coreRelations?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" /> AI 生成元模型草稿
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              AI 正在按《元模型交付模板》八节结构生成草稿，约需 10-30 秒…
            </p>
          </div>
        ) : draft ? (
          /* ---------- 草稿预览 ---------- */
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{draft.name}</p>
                <Badge variant="secondary">{TYPE_LABEL[(draft.modelType as MetamodelType) ?? type] ?? draft.modelType}</Badge>
                <Badge variant="outline">{draft.industry}</Badge>
                <Badge variant="outline">v{draft.versionNo}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{draft.purpose}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded border border-border bg-background px-2 py-1.5">
                  <p className="font-cyber text-base font-bold tabular-nums">{ioCount}</p>
                  <p className="text-[10px] text-muted-foreground">变量参数</p>
                </div>
                <div className="rounded border border-border bg-background px-2 py-1.5">
                  <p className="font-cyber text-base font-bold tabular-nums">{relCount}</p>
                  <p className="text-[10px] text-muted-foreground">核心关系式</p>
                </div>
                <div className="rounded border border-border bg-background px-2 py-1.5">
                  <p className="font-cyber text-base font-bold tabular-nums">{draft.structureFlow?.length ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">流程环节</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              点击「填充到表单」后进入登记表单，可逐节核对修改后再入库。
            </p>
          </div>
        ) : (
          /* ---------- 描述输入 ---------- */
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-sm text-muted-foreground">模型类别</span>
              <Select value={type} onValueChange={(v) => setType(v as MetamodelType)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_LABEL) as [MetamodelType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              rows={7}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="用自然语言描述要登记的元模型：对象是什么、解决什么问题、已知哪些输入/参数、算什么输出…"
            />
            <div className="flex items-center justify-between">
              <button className="text-xs text-primary hover:underline" onClick={() => setDescription(SAMPLE)}>
                填入示例描述
              </button>
              <span className="text-xs text-muted-foreground">{description.length} 字</span>
            </div>
          </div>
        )}

        <DialogFooter>
          {draft ? (
            <>
              <Button variant="outline" onClick={() => setDraft(null)}>重新描述</Button>
              <Button onClick={handleApply}>
                <WandSparkles className="mr-1 h-4 w-4" /> 填充到表单
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={handleGenerate} disabled={!description.trim()}>
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                生成草稿
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
