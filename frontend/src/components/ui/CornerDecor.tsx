"use client";

/**
 * CornerDecor — 角部 L 装饰（React 版，相对父元素 absolute）。
 */
import * as React from "react";
import { cn } from "@/lib/utils";

type Corner = "tl" | "tr" | "bl" | "br";

interface Props {
  corners?: Corner[];
  color?: string;
  className?: string;
}

const POS: Record<Corner, string> = {
  tl: "top-2 left-2",
  tr: "top-2 right-2",
  bl: "bottom-2 left-2",
  br: "bottom-2 right-2",
};

export function CornerDecor({ corners = ["tl", "tr"], color = "hsl(195 100% 50%)", className }: Props) {
  return (
    <>
      {corners.map((c) => (
        <span
          key={c}
          aria-hidden
          className={cn("absolute h-5 w-5 animate-corner-flicker", POS[c], className)}
          style={{
            borderTop: c === "tl" || c === "tr" ? `1.5px solid ${color}` : undefined,
            borderBottom: c === "bl" || c === "br" ? `1.5px solid ${color}` : undefined,
            borderLeft: c === "tl" || c === "bl" ? `1.5px solid ${color}` : undefined,
            borderRight: c === "tr" || c === "br" ? `1.5px solid ${color}` : undefined,
            borderRadius: c === "tl" ? "4px 0 0 0" : c === "tr" ? "0 4px 0 0" : c === "bl" ? "0 0 0 4px" : "0 0 4px 0",
          }}
        />
      ))}
    </>
  );
}

export default CornerDecor;