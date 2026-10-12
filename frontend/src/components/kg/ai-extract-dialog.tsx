"use client";

/** AI 三元组提取弹窗：粘贴工艺文本 → DeepSeek 提取实体关系 → 入库。 */
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiAvailable: boolean;
  /** 提取成功后通知刷新图谱 */
  onExtracted: () => void;
}

export function AiExtractDialog({ open, onOpenChange, aiAvailable, onExtracted }: Props) {
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const SAMPLE = `1号挥发窑焙烧挥发工序中，锌浸出渣球团经圆盘给料机送入回转挥发窑，在窑内完成焙烧挥发，铅、铟等有价金属挥发进入烟气，砷等杂质部分脱除。烟气经余热锅炉冷却回收余热后进入电收尘器收尘，窑尾温度与给料机频率是关键控制参数，CO浓度用于监测燃烧状况。`;

  async function handleExtract() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const r = await api.kg.extract(text);
      toast.success(`提取完成：新增 ${r.nodesCreated} 个实体、${r.edgesCreated} 条关系`);
      onExtracted();
      onOpenChange(false);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "提取失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" /> AI 知识提取
          </DialogTitle>
        </DialogHeader>
        {aiAvailable ? (
          <>
            <p className="text-sm text-muted-foreground">
              粘贴工艺文档/说明文本，AI 自动提取实体与关系到知识图谱（保留原文溯源）。
            </p>
            <Textarea
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="在此粘贴工艺文本…"
            />
            <div className="flex items-center justify-between">
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setText(SAMPLE)}
              >
                填入示例文本
              </button>
              <span className="text-xs text-muted-foreground">{text.length} 字</span>
            </div>
            <DialogFooter>
              <Button onClick={handleExtract} disabled={loading || !text.trim()}>
                {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                开始提取
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">AI 通道未启用</p>
            <p className="mt-1 leading-relaxed">
              在后端 <code className="font-mono">.env</code> 中配置{" "}
              <code className="font-mono">DEEPSEEK_API_KEY</code> 并重启后端即可开启
              （DeepSeek/OpenAI 兼容接口）。
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AiExtractDialog;
