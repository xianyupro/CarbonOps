"use client";

/** 节点详情侧栏：基本信息、来源溯源、出入关系、平台资产挂接。 */
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";

import { api } from "@/lib/api";
import type { KgNodeDetail } from "@/types/api";
import { categoryColor } from "./category-colors";

interface Props {
  nodeId: number;
  onClose: () => void;
  /** 点击邻居节点跳转 */
  onNavigate: (nodeId: number) => void;
  /** 节点被删除后通知刷新 */
  onDeleted: () => void;
}

export function NodeDetailPanel({ nodeId, onClose, onNavigate, onDeleted }: Props) {
  const [detail, setDetail] = React.useState<KgNodeDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDetail(null);
    setError(null);
    api.kg
      .nodeDetail(nodeId)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [nodeId]);

  async function handleDelete() {
    if (!detail) return;
    if (!window.confirm(`确认删除节点「${detail.node.name}」及其全部关系？`)) return;
    try {
      await api.kg.deleteNode(nodeId);
      onDeleted();
      onClose();
    } catch {
      /* toast 由调用页统一处理亦可，这里静默 */
    }
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <p>{error}</p>
        <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }

  const { node } = detail;
  const color = categoryColor(node.category);

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-2 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
            <h3 className="truncate text-base font-semibold">{node.name}</h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{node.category}</Badge>
            {node.sourceType === "ai" && <Badge variant="outline" className="text-violet-600">AI 提取</Badge>}
            {node.sourceType === "migration" && <Badge variant="outline">知识库迁移</Badge>}
            {node.refType === "METAMODEL" && <Badge className="bg-teal-600">平台元模型</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto scrollbar-thin p-4">
        {/* 描述 */}
        {node.description && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">描述</h4>
            <p className="text-sm leading-relaxed">{node.description}</p>
          </section>
        )}

        {/* 溯源 */}
        {node.sourceText && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">来源溯源</h4>
            <blockquote className="rounded-md border-l-2 border-primary bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
              {node.sourceText}
              {node.sourceLocation && <span className="mt-1 block opacity-70">— {node.sourceLocation}</span>}
            </blockquote>
          </section>
        )}

        {/* 出关系 */}
        {detail.outgoing.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">
              出关系（{detail.outgoing.length}）
            </h4>
            <div className="space-y-1">
              {detail.outgoing.map((e) => {
                const target = detail.neighbors.find((n) => n.id === e.targetNodeId);
                return (
                  <button
                    key={e.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => target && onNavigate(target.id)}
                  >
                    <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{e.relationType}</span>
                    <span className="font-medium">→</span>
                    <span className="truncate">{target?.name ?? `#${e.targetNodeId}`}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 入关系 */}
        {detail.incoming.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">
              入关系（{detail.incoming.length}）
            </h4>
            <div className="space-y-1">
              {detail.incoming.map((e) => {
                const src = detail.neighbors.find((n) => n.id === e.sourceNodeId);
                return (
                  <button
                    key={e.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => src && onNavigate(src.id)}
                  >
                    <span className="truncate">{src?.name ?? `#${e.sourceNodeId}`}</span>
                    <span className="font-medium">→</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{e.relationType}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 平台资产挂接 */}
        {detail.links.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">关联平台资产</h4>
            <div className="space-y-1.5">
              {detail.links.map((l) => (
                <div key={l.id} className="rounded-md border border-border p-2 text-xs">
                  <Badge variant="outline" className="mr-1.5">{l.linkType}</Badge>
                  <span className="font-mono text-muted-foreground">#{l.linkId}</span>
                  {l.description && <p className="mt-1 text-muted-foreground">{l.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 底部操作 */}
      <div className="border-t border-border p-3">
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
          <Trash2 className="mr-1 h-3.5 w-3.5" /> 删除节点
        </Button>
      </div>
    </div>
  );
}

export default NodeDetailPanel;
