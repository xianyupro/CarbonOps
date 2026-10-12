"use client";

/**
 * NumberRoll — 数字滚动动画（client）。
 * 接收 target，使用 requestAnimationFrame 从 0（/prev）动画到 target。
 * 接受 precision (小数位) 与 suffix。
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  target: number;
  /** 动画时长（ms） */
  duration?: number;
  /** 小数位数 */
  precision?: number;
  /** 是否开始动画（默认 true） */
  active?: boolean;
  className?: string;
  /** 自定义渲染（数字部分） */
  format?: (n: number) => React.ReactNode;
}

export function NumberRoll({
  target,
  duration = 600,
  precision = 0,
  active = true,
  className,
  format,
}: Props) {
  const [val, setVal] = React.useState(0);
  const prevTargetRef = React.useRef(0);

  React.useEffect(() => {
    if (!active) {
      setVal(target);
      return;
    }
    const startVal = prevTargetRef.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      // easeOutCubic
      const e = 1 - Math.pow(1 - p, 3);
      setVal(startVal + (target - startVal) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevTargetRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);

  const text = format ? format(val) : val.toFixed(precision);
  return <span className={cn("tabular-nums", className)}>{text}</span>;
}

export default NumberRoll;