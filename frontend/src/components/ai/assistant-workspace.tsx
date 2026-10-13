"use client";

/**
 * AI 智能助手工作台 —— 独立的 AI 交互界面。
 *
 * 左侧：会话列表（新建 / 搜索 / 重命名 / 删除）；
 * 右侧：流式对话区（Markdown 渲染、停止生成、快捷提问）。
 * 后端 SSE：POST /ai-chat/sessions/{id}/chat → data: {content|error} / [DONE]。
 */
import * as React from "react";
import dayjs from "dayjs";
import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError, apiBaseUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownContent } from "@/components/ai/markdown-content";
import type { AiChatMessage, AiChatSession, AiChatStatus } from "@/types/ai-chat";

/** 首屏快捷提问 */
const SUGGESTIONS = [
  {
    title: "元模型盘点",
    prompt: "平台目前登记了哪些元模型？请按类别盘点，并说明各自用途。",
  },
  {
    title: "能耗优化分析",
    prompt: "我们厂区近期综合能耗偏高，请从全流程低碳运行的角度给出能耗分析与优化建议。",
  },
  {
    title: "碳排放核算",
    prompt: "请介绍工业企业碳排放核算的主要方法（排放因子法、物料平衡法、实测法）及适用场景。",
  },
  {
    title: "平台使用指导",
    prompt: "我想登记一个新的机理模型并接入实时数据，应该在平台中如何操作？",
  },
];

function formatRelativeTime(dateStr: string): string {
  const d = dayjs(dateStr);
  const diffMin = dayjs().diff(d, "minute");
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)} 小时前`;
  if (diffMin < 60 * 48) return "昨天";
  return d.format("M/D");
}

function formatTime(dateStr: string): string {
  return dayjs(dateStr).format("HH:mm");
}

/** 解析 SSE 流：buffer 安全，逐事件回调 */
async function readSseStream(
  res: Response,
  handlers: { onDelta: (text: string) => void; onError: (msg: string) => void }
) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        if (obj.error) streamError = obj.error;
        else if (obj.content) handlers.onDelta(obj.content);
      } catch {
        /* 忽略无法解析的行 */
      }
    }
  }
  if (streamError) handlers.onError(streamError);
}

export function AssistantWorkspace() {
  const user = useAuthStore((s) => s.user);

  const [sessions, setSessions] = React.useState<AiChatSession[]>([]);
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [messages, setMessages] = React.useState<AiChatMessage[]>([]);
  const [status, setStatus] = React.useState<AiChatStatus | null>(null);

  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState("");
  const [chatError, setChatError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [renamingId, setRenamingId] = React.useState<number | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stickToBottomRef = React.useRef(true);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const filteredSessions = React.useMemo(
    () =>
      search.trim()
        ? sessions.filter((s) => s.title.toLowerCase().includes(search.trim().toLowerCase()))
        : sessions,
    [sessions, search]
  );

  /* ------------------------------ 数据加载 ------------------------------ */

  const loadSessions = React.useCallback(async () => {
    try {
      setSessions(await api.aiChat.sessions());
    } catch {
      /* 侧栏加载失败静默，对话区仍可用 */
    }
  }, []);

  React.useEffect(() => {
    loadSessions();
    api.aiChat
      .status()
      .then(setStatus)
      .catch(() => setStatus({ available: false, model: "-" }));
  }, [loadSessions]);

  React.useEffect(() => {
    if (stickToBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages, streamingText]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadSession = async (id: number) => {
    if (sending) abortRef.current?.abort();
    try {
      const detail = await api.aiChat.getSession(id);
      setActiveId(id);
      setMessages(detail.messages);
      setChatError(null);
      stickToBottomRef.current = true;
    } catch {
      /* ignore */
    }
  };

  const startDraft = () => {
    if (sending) abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setChatError(null);
    inputRef.current?.focus();
  };

  /* ------------------------------ 会话管理 ------------------------------ */

  const renameSession = async (id: number) => {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!title) return;
    try {
      const updated = await api.aiChat.renameSession(id, title);
      setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch {
      /* ignore */
    }
  };

  const deleteSession = async (id: number) => {
    setDeleteConfirmId(null);
    try {
      await api.aiChat.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) startDraft();
    } catch {
      /* ignore */
    }
  };

  /* ------------------------------ 对话 ------------------------------ */

  const send = async (raw?: string) => {
    const content = (raw ?? input).trim();
    if (!content || sending) return;

    setChatError(null);
    stickToBottomRef.current = true;

    // 无活动会话时先创建（首条消息作标题）
    let sessionId = activeId;
    if (!sessionId) {
      try {
        const s = await api.aiChat.createSession(content.slice(0, 50));
        sessionId = s.id;
        setSessions((prev) => [s, ...prev]);
        setActiveId(s.id);
      } catch (err) {
        setChatError(err instanceof ApiError ? err.message : "创建会话失败");
        return;
      }
    }

    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: -Date.now(), role: "user", content, createdAt: now },
    ]);
    setInput("");
    setSending(true);
    setStreamingText("");

    const controller = new AbortController();
    abortRef.current = controller;
    let full = "";

    try {
      const res = await fetch(api.aiChat.chatStreamUrl(sessionId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let msg = `请求失败 (${res.status})`;
        try {
          const env = (await res.json()) as { msg?: string };
          if (env?.msg) msg = env.msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      await readSseStream(res, {
        onDelta: (delta) => {
          full += delta;
          setStreamingText(full);
        },
        onError: (msg) => {
          throw new Error(msg);
        },
      });

      setMessages((prev) => [
        ...prev,
        { id: -Date.now(), role: "assistant", content: full, createdAt: new Date().toISOString() },
      ]);
      setStreamingText("");
      loadSessions();
    } catch (err) {
      setStreamingText("");
      if (err instanceof DOMException && err.name === "AbortError") {
        // 用户主动停止：保留已生成的部分内容（仅本地展示）
        if (full) {
          setMessages((prev) => [
            ...prev,
            { id: -Date.now(), role: "assistant", content: full, createdAt: new Date().toISOString() },
          ]);
        }
        loadSessions();
      } else {
        setChatError(err instanceof Error ? err.message : "AI 服务暂时不可用");
      }
    } finally {
      setSending(false);
      setStreamingText("");
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const stop = () => abortRef.current?.abort();

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const userInitial = user?.displayName?.[0] || user?.username?.[0] || "我";
  const empty = messages.length === 0 && !streamingText && !sending;

  /* ------------------------------ 渲染 ------------------------------ */

  return (
    <div className="flex h-[calc(100vh-104px)] min-h-[540px] gap-4">
      {/* ========== 会话侧栏 ========== */}
      <aside
        className={cn(
          "flex shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-200",
          sidebarCollapsed ? "w-0 border-0" : "w-64"
        )}
      >
        <div className="space-y-2 border-b border-border/70 p-3">
          <Button onClick={startDraft} className="w-full gap-1.5" size="sm">
            <Plus className="h-4 w-4" />
            新建对话
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索对话…"
              className="h-8 border-none bg-muted/60 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-2">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <MessageSquare className="h-6 w-6 opacity-40" />
              <p className="text-xs">{sessions.length === 0 ? "暂无历史对话" : "无匹配结果"}</p>
            </div>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={cn(
                  "group cursor-pointer rounded-md border px-2.5 py-2 transition-colors",
                  activeId === s.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-transparent hover:bg-muted/60"
                )}
              >
                {renamingId === s.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameSession(s.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-xs"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        renameSession(s.id);
                      }}
                      className="shrink-0 rounded p-1 text-success hover:bg-success/10"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-1">
                      <p
                        className={cn(
                          "truncate text-[13px]",
                          activeId === s.id ? "font-medium text-primary" : "text-foreground/85"
                        )}
                      >
                        {s.title}
                      </p>
                      <div
                        className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          title="重命名"
                          onClick={() => {
                            setRenamingId(s.id);
                            setRenameDraft(s.title);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-primary"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {deleteConfirmId === s.id ? (
                          <button
                            type="button"
                            title="确认删除"
                            onClick={() => deleteSession(s.id)}
                            className="rounded p-1 text-destructive hover:bg-destructive/10"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="删除对话"
                            onClick={() => setDeleteConfirmId(s.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{formatRelativeTime(s.updatedAt)}</span>
                      <span>·</span>
                      <span>{s.messageCount} 条消息</span>
                      {deleteConfirmId === s.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(null);
                          }}
                          className="ml-auto flex items-center gap-0.5 text-destructive"
                        >
                          <X className="h-3 w-3" /> 取消删除
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ========== 对话主区 ========== */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        {/* 顶栏 */}
        <header className="flex items-center gap-3 border-b border-border/70 bg-background/40 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? "展开会话列表" : "收起会话列表"}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">
              {activeSession ? activeSession.title : "AI 智能助手"}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {status
                ? `基于 ${status.model} · 全流程低碳运行领域顾问`
                : "正在连接 AI 服务…"}
            </p>
          </div>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px]",
              status?.available
                ? "border-success/40 bg-success/10 text-success"
                : "border-warning/40 bg-warning/10 text-warning"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status?.available ? "bg-success animate-pulse" : "bg-warning"
              )}
            />
            {status?.available ? "在线" : "未配置"}
          </span>
        </header>

        {/* 消息区 */}
        <div ref={scrollRef} onScroll={onScroll} className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-5 py-5">
            {empty ? (
              /* 首屏欢迎页 */
              <div className="flex flex-col items-center pb-6 pt-10 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(199_89%_40%)] text-white shadow-glow-cyan">
                  <Bot className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold">CarbonOps AI 智能助手</h3>
                <p className="mb-8 mt-2 max-w-md text-[13px] text-muted-foreground">
                  面向全流程低碳运行的智能顾问 — 支持碳排核算、能耗优化、平台操作指引等领域的连续对话
                </p>
                {status && !status.available && (
                  <div className="mb-6 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    AI 服务未配置（缺少 DEEPSEEK_API_KEY），请先在后端 .env 中配置
                  </div>
                )}
                <div className="grid w-full max-w-xl grid-cols-2 gap-3">
                  {SUGGESTIONS.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => {
                        setInput(item.prompt);
                        inputRef.current?.focus();
                      }}
                      className="group rounded-lg border border-border bg-background/60 p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
                    >
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground/90">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        {item.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {item.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="mb-5 flex justify-end gap-3">
                      <div className="max-w-[80%]">
                        <div className="rounded-lg rounded-tr-sm bg-primary px-3.5 py-2 text-[13px] leading-relaxed text-primary-foreground shadow-sm">
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        </div>
                        <p className="mt-1 text-right text-[10px] text-muted-foreground">
                          {formatTime(m.createdAt)}
                        </p>
                      </div>
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-foreground">
                        {userInitial}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="mb-5 flex gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-[hsl(199_89%_40%)] text-white shadow-sm">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="group min-w-0 max-w-[92%] flex-1">
                        <div className="rounded-lg rounded-tl-sm border border-border/70 bg-muted/40 px-3.5 py-2.5 text-[13px] leading-relaxed">
                          <MarkdownContent content={m.content} />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{formatTime(m.createdAt)}</span>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(m.content)}
                            className="flex items-center gap-0.5 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                          >
                            <Copy className="h-3 w-3" /> 复制
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* 流式输出中 */}
                {streamingText && (
                  <div className="mb-5 flex gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-[hsl(199_89%_40%)] text-white shadow-sm animate-pulse">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 max-w-[92%] flex-1">
                      <div className="rounded-lg rounded-tl-sm border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-[13px] leading-relaxed">
                        <MarkdownContent content={streamingText} />
                        <span className="ml-0.5 inline-block h-3.5 w-[3px] animate-pulse rounded bg-primary align-middle" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 等待首字节 */}
                {sending && !streamingText && (
                  <div className="mb-5 flex gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-[hsl(199_89%_40%)] text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg rounded-tl-sm border border-border/70 bg-muted/40 px-4 py-3">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/80 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/80 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/80 [animation-delay:300ms]" />
                    </div>
                  </div>
                )}

                {/* 错误提示 */}
                {chatError && (
                  <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="flex-1">
                      <p>{chatError}</p>
                      <button
                        type="button"
                        onClick={() => setChatError(null)}
                        className="mt-1 underline underline-offset-2 hover:opacity-80"
                      >
                        知道了
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 输入区 */}
        <footer className="border-t border-border/70 bg-background/40 p-3">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-end gap-2 rounded-lg border border-input bg-card p-2 shadow-sm transition-all focus-within:border-primary focus-within:shadow-glow-cyan">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResize(e.target);
                }}
                onKeyDown={onKeyDown}
                placeholder="输入您的问题…（Enter 发送，Shift+Enter 换行）"
                rows={1}
                disabled={sending}
                className="scrollbar-thin max-h-[140px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground disabled:opacity-60"
              />
              {sending ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={stop}
                  title="停止生成"
                  className="h-9 w-9 shrink-0"
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  onClick={() => send()}
                  disabled={!input.trim()}
                  title="发送"
                  className="h-9 w-9 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              AI 生成内容仅供参考，请以实际监测数据与专业判断为准
            </p>
          </div>
        </footer>
      </section>
    </div>
  );
}
