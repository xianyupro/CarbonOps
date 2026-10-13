/**
 * 底部状态栏（28px）—— 工业编辑器完成度细节：
 * READY/RUNNING 状态点 · 当前流程 · 节点/连线统计 · 缩放比例 · 视图信息。
 */
interface Props {
  running: boolean;
  flowName: string;
  nodeCount: number;
  edgeCount: number;
  zoomPct: number;
}

export function FlowStatusBar({ running, flowName, nodeCount, edgeCount, zoomPct }: Props) {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-muted/40 px-3 text-[11px] text-muted-foreground">
      {/* 运行状态 */}
      <span className={`flex items-center gap-1.5 font-medium ${running ? "text-emerald-600" : ""}`}>
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-emerald-500" : "bg-emerald-500/80"}`}
        />
        {running ? "RUNNING · 仿真执行中" : "READY"}
      </span>

      <i aria-hidden className="h-3 w-px bg-border" />

      {/* 当前流程 */}
      <span className="max-w-[200px] truncate" title={flowName}>
        {flowName}
      </span>

      <i aria-hidden className="h-3 w-px bg-border" />

      {/* 统计 */}
      <span>
        节点 <span className="font-mono tabular-nums text-foreground/75">{nodeCount}</span>
      </span>
      <span>
        连线 <span className="font-mono tabular-nums text-foreground/75">{edgeCount}</span>
      </span>
      <span>
        缩放 <span className="font-mono tabular-nums text-foreground/75">{zoomPct}%</span>
      </span>

      {/* 视图信息 */}
      <span className="ml-auto hidden items-center gap-3 md:flex">
        <span>网格 20px</span>
        <span>对齐辅助 开</span>
      </span>
    </footer>
  );
}
