"use client";

/** 路径查询弹窗：选起终点 → 后端 BFS 最短路 → 高亮回显。 */
import * as React from "react";
import { Loader2, Search } from "lucide-react";

import { api } from "@/lib/api";
import type { KgNode, KgPathResult } from "@/types/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: KgNode[];
  /** 查询成功，把结果交给页面高亮 */
  onResult: (result: KgPathResult | null) => void;
}

function NodePicker({
  label,
  nodes,
  value,
  onChange,
}: {
  label: string;
  nodes: KgNode[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [kw, setKw] = React.useState("");
  const selected = nodes.find((n) => n.id === value);
  const candidates = kw.trim()
    ? nodes
        .filter((n) => n.name.toLowerCase().includes(kw.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {selected ? (
        <div className="flex items-center justify-between rounded-md border border-primary bg-accent px-3 py-2 text-sm">
          <span className="truncate">{selected.name}</span>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            重选
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="搜索节点名称…"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
          {candidates.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
              {candidates.map((n) => (
                <button
                  key={n.id}
                  className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onChange(n.id);
                    setKw("");
                  }}
                >
                  {n.name}
                  <span className="ml-2 text-xs text-muted-foreground">{n.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PathQueryDialog({ open, onOpenChange, nodes, onResult }: Props) {
  const [source, setSource] = React.useState<number | null>(null);
  const [target, setTarget] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<KgPathResult | null>(null);

  async function handleQuery() {
    if (source == null || target == null) return;
    setLoading(true);
    try {
      const r = await api.kg.path(source, target);
      setResult(r);
      onResult(r.found ? r : null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setResult(null);
          onResult(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>路径查询</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <NodePicker label="起点节点" nodes={nodes} value={source} onChange={setSource} />
          <NodePicker label="终点节点" nodes={nodes} value={target} onChange={setTarget} />

          {result && !result.found && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              两节点之间不存在可达路径
            </p>
          )}
          {result?.found && (
            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                最短路径（{result.nodes.length} 个节点 / {result.edges.length} 步）
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {result.nodes.map((n, i) => (
                  <span key={n.id} className="flex items-center gap-1.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{n.name}</span>
                    {i < result.edges.length && (
                      <span className="text-muted-foreground">
                        —{result.edges[i].relationType}→
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={handleQuery}
            disabled={source == null || target == null || loading || source === target}
          >
            {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            查询路径
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PathQueryDialog;
