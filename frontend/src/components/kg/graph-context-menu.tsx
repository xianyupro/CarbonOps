"use client";

/**
 * 图谱右键菜单（亮色工业风）。
 * 节点：查看详情 / 以此展开（一跳聚焦）/ 删除节点；
 * 空白：重置视图（解除拖拽固定 + 清空过滤 + 适配缩放）。
 */
import * as React from "react";
import { Crosshair, Eye, RotateCcw, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface GraphContextMenuState {
  /** 视口坐标 */
  x: number;
  y: number;
  /** null 表示空白处右键 */
  nodeId: number | null;
  nodeName: string;
}

interface Props {
  state: GraphContextMenuState | null;
  /** 该节点当前是否处于展开聚焦态 */
  expanding: boolean;
  onView: (nodeId: number) => void;
  onToggleExpand: (nodeId: number) => void;
  onDelete: (nodeId: number) => void;
  onResetView: () => void;
  onClose: () => void;
}

function MenuItem({
  icon,
  label,
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-accent"
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </button>
  );
}

export function GraphContextMenu({
  state,
  expanding,
  onView,
  onToggleExpand,
  onDelete,
  onResetView,
  onClose,
}: Props) {
  // 点击任意处 / 窗口尺寸变化时关闭
  React.useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
    };
  }, [state, onClose]);

  if (!state) return null;

  const isNode = state.nodeId != null;
  const left = Math.max(4, Math.min(state.x, window.innerWidth - 190));
  const top = Math.max(4, Math.min(state.y, window.innerHeight - 150));

  return (
    <div
      className="fixed z-50 min-w-[168px] overflow-hidden rounded-md border border-border bg-popover py-1 shadow-md"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isNode ? (
        <>
          <div className="truncate border-b border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
            {state.nodeName}
          </div>
          <MenuItem
            icon={<Eye className="h-3.5 w-3.5" />}
            label="查看详情"
            onClick={() => {
              onClose();
              onView(state.nodeId!);
            }}
          />
          <MenuItem
            icon={<Crosshair className="h-3.5 w-3.5" />}
            label={expanding ? "取消展开" : "以此展开"}
            onClick={() => {
              onClose();
              onToggleExpand(state.nodeId!);
            }}
          />
          <div className="my-1 h-px bg-border/60" />
          <MenuItem
            destructive
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label="删除节点"
            onClick={() => {
              onClose();
              onDelete(state.nodeId!);
            }}
          />
        </>
      ) : (
        <MenuItem
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          label="重置视图"
          onClick={() => {
            onClose();
            onResetView();
          }}
        />
      )}
    </div>
  );
}

export default GraphContextMenu;
