"use client";

/**
 * CyberPanel — 替代 Card 的玻璃面板。
 *  - 顶部蓝色描边光（CSS ::before）
 *  - 右下角径向光晕（CSS ::after）
 *  - 4 角 L 装饰（可关）
 *  - hover 边框 + 外发光
 *  - 支持 title 蓝色高亮条
 *
 * 兼容已有 Card API（CardHeader / CardTitle / CardContent 仍可单独使用）。
 */
import * as React from "react";
import { cn } from "@/lib/utils";

type CornerMode = "all" | "tl-tr" | "none" | "bl-br";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  /** 是否显示 4 角 L 装饰 */
  corners?: CornerMode | boolean;
  /** 是否启用 hover 发光（默认 true，统计卡关闭） */
  glowOnHover?: boolean;
  /** 渐变色背景名（控制整体色调），默认主蓝青 */
  tone?: "primary" | "cool" | "success" | "warning" | "danger" | "purple";
}

export function CyberPanel({
  className,
  children,
  corners = "all",
  glowOnHover = true,
  tone,
  ...rest
}: Props) {
  const cornerVal: CornerMode = typeof corners === "boolean" ? (corners ? "all" : "none") : corners;
  return (
    <div
      className={cn(
        "panel-cyber relative rounded-xl",
        glowOnHover && "hover:shadow-glow-cyan",
        tone && toneClass(tone),
        className
      )}
      {...rest}
    >
      {cornerVal !== "none" && (
        <>
          {(cornerVal === "all" || cornerVal === "tl-tr") && (
            <>
              <span className="corner-decor tl" />
              <span className="corner-decor tr" />
            </>
          )}
          {(cornerVal === "all" || cornerVal === "bl-br") && (
            <>
              <span className="corner-decor bl" />
              <span className="corner-decor br" />
            </>
          )}
        </>
      )}
      {children}
    </div>
  );
}

function toneClass(tone: NonNullable<Props["tone"]>) {
  switch (tone) {
    case "primary":
      return "border-primary/30";
    case "cool":
      return "border-cool/30";
    case "success":
      return "border-success/30";
    case "warning":
      return "border-warning/30";
    case "danger":
      return "border-destructive/30";
    case "purple":
      return "border-glow-purple";
  }
}

/** 面板标题（带左侧蓝色高亮条） */
export function CyberPanelTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <h3 className={cn("panel-title-bar text-sm font-semibold tracking-wider text-foreground", className)}>
      {children}
    </h3>
  );
}

export default CyberPanel;