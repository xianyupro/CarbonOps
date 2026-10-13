"use client";

/**
 * 图谱统计弹窗：总节点/总关系/分类数三卡概览 + 分类分布占比条 + 度数 Top5。
 * 数据口径与当前过滤后的 nodes/edges 一致。
 */
import * as React from "react";
import { Boxes, GitCommitHorizontal, Network } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { KgEdge, KgNode } from "@/types/api";
import { categoryColor } from "./category-colors";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: KgNode[];
  edges: KgEdge[];
}

export function GraphStatsDialog({ open, onOpenChange, nodes, edges }: Props) {
  const categories = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [nodes]);

  const topDegree = React.useMemo(() => {
    const deg = new Map<number, number>();
    for (const e of edges) {
      deg.set(e.sourceNodeId, (deg.get(e.sourceNodeId) ?? 0) + 1);
      deg.set(e.targetNodeId, (deg.get(e.targetNodeId) ?? 0) + 1);
    }
    return [...deg.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, degree]) => ({ node: nodes.find((n) => n.id === id), degree }));
  }, [edges, nodes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>图谱统计分析</DialogTitle>
          <DialogDescription>节点规模、分类分布与枢纽节点概览</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 总览三卡 */}
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { label: "总节点数", value: nodes.length, icon: Network, cls: "text-cyan-700 bg-cyan-500/10" },
                { label: "总关系数", value: edges.length, icon: GitCommitHorizontal, cls: "text-teal-700 bg-teal-500/10" },
                { label: "分类数", value: categories.length, icon: Boxes, cls: "text-violet-700 bg-violet-500/10" },
              ] as const
            ).map(({ label, value, icon: Icon, cls }) => (
              <div key={label} className="rounded-lg border border-border bg-card p-4 text-center">
                <Icon className={`mx-auto h-4 w-4 ${cls.split(" ")[0]}`} />
                <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* 分类分布 */}
          <section>
            <h3 className="mb-2.5 text-sm font-semibold">分类分布</h3>
            <div className="space-y-2">
              {categories.map(([cat, count]) => {
                const pct = nodes.length > 0 ? (count / nodes.length) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: categoryColor(cat) }}
                    />
                    <span className="w-24 truncate text-sm">{cat}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: categoryColor(cat) }}
                      />
                    </div>
                    <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                      {count}（{pct.toFixed(1)}%）
                    </span>
                  </div>
                );
              })}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              )}
            </div>
          </section>

          {/* 度数 Top5 */}
          <section>
            <h3 className="mb-2.5 text-sm font-semibold">度分布 Top 5</h3>
            <div className="space-y-1.5">
              {topDegree.map(({ node, degree }, i) => (
                <div
                  key={node?.id ?? i}
                  className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
                  <span className="w-5 text-center text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: categoryColor(node?.category ?? "") }}
                  />
                  <span className="flex-1 truncate text-sm">{node?.name ?? `#${node?.id ?? "-"}`}</span>
                  <span className="text-sm font-bold tabular-nums text-teal-700">{degree}</span>
                  <span className="text-xs text-muted-foreground">条关系</span>
                </div>
              ))}
              {topDegree.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无关系数据</p>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GraphStatsDialog;
