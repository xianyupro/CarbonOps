"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * LaTeX 特征检测：含控制序列或上下标记号、且不含 CJK 文本才走 KaTeX 渲染；
 * 长尾登记的纯中文描述句（如「输入→机理方程→输出」）自动回退等宽文本。
 */
export function looksLikeLatex(expression: string): boolean {
  if (/[\u4e00-\u9fff]/.test(expression)) return false;
  return /\\[a-zA-Z]+/.test(expression) || /[_^]\{?[a-zA-Z0-9]/.test(expression);
}

export function renderLatexHtml(expression: string): string {
  return katex.renderToString(expression, {
    throwOnError: false,
    displayMode: false,
    strict: false,
    output: "html",
  });
}

interface FormulaBlockProps {
  id?: string;
  expression: string;
  note?: string | null;
}

/** 论文式关系式卡：公式居中、式号右对齐、注释跟随 */
export function FormulaBlock({ id, expression, note }: FormulaBlockProps) {
  const useKatex = looksLikeLatex(expression);
  const html = useMemo(
    () => (useKatex ? renderLatexHtml(expression) : ""),
    [useKatex, expression]
  );
  return (
    <div className="border border-border/60 bg-muted/30">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1 overflow-x-auto text-center">
          {useKatex ? (
            <span
              className="inline-block text-[15px] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <span className="font-cyber text-xs leading-relaxed break-all text-foreground/90">
              {expression}
            </span>
          )}
        </div>
        {id ? (
          <span className="shrink-0 font-cyber text-[11px] text-muted-foreground/80">({id})</span>
        ) : null}
      </div>
      {note ? (
        <div className="border-t border-border/40 px-3 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {note}
        </div>
      ) : null}
    </div>
  );
}

export default FormulaBlock;
