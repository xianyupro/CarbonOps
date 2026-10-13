"use client";

/**
 * AI 助手 Markdown 渲染器 —— 亮色主题。
 * 支持代码块（带语言标签与复制按钮）、表格、引用、列表等 GFM 语法。
 */
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-md border border-border bg-muted/60">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{language || "text"}</span>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-background hover:text-primary"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="font-mono text-[12.5px] leading-relaxed text-foreground/90">{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
        h1: ({ children }) => (
          <h1 className="mb-2 mt-4 text-lg font-bold first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-4 border-b border-border/70 pb-1 text-base font-bold first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1.5 mt-3 text-sm font-bold first:mt-0">{children}</h3>
        ),
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic text-primary">{children}</em>,
        ul: ({ children }) => <ul className="my-2 ml-1 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1">{children}</ol>,
        li: ({ children }) => (
          <li className="flex items-start gap-1.5">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/70" />
            <span className="flex-1">{children}</span>
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 rounded-r-md border-l-2 border-primary/50 bg-primary/5 py-1.5 pl-3 pr-2 text-muted-foreground">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const match = /language-(\w+)/.exec(className || "");
          if (match) {
            return <CodeBlock language={match[1]} code={String(children).replace(/\n$/, "")} />;
          }
          return (
            <code className="rounded bg-primary/10 px-1 py-0.5 font-mono text-[12px] text-primary">
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full text-[12.5px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
        th: ({ children }) => (
          <th className="border-b border-border px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border/50 px-3 py-1.5 align-top">{children}</td>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-4 border-border/70" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
