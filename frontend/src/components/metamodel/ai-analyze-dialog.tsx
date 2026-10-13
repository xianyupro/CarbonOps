"use client";

/**
 * AI 解读元模型弹窗：对已登记元模型生成结构化解读报告（只读）。
 */
import * as React from "react";
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
import { MarkdownContent } from "@/components/ai/markdown-content";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 要解读的元模型 id 与名称。 */
  target: { id: number; name: string } | null;
}

export function AiAnalyzeDialog({ open, onOpenChange, target }: Props) {
  const [analysis, setAnalysis] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open && target) {
      setLoading(true);
      setAnalysis("");
      api.metamodelAi
        .analyze(target.id)
        .then((r) => setAnalysis(r.analysis))
        .catch((e) => setAnalysis(`⚠️ **解读失败**: ${e instanceof Error ? e.message : "请稍后重试"}`))
        .finally(() => setLoading(false));
    }
  }, [open, target]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            AI 解读{target ? `：${target.name}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto rounded-md border border-border bg-muted/30 px-4 py-3">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                AI 正在通读该元模型的八节结构并生成解读报告…
              </p>
            </div>
          ) : (
            <div className="text-[13px] leading-relaxed">
              <MarkdownContent content={analysis} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          {analysis && !loading && (
            <Button
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(analysis).then(() => {})}
            >
              复制报告
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
