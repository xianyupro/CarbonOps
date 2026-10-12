"use client";

/**
 * RadarSweep — 装饰性雷达扫描组件。
 * 半径可配，颜色可配。中心可放文字/图标。
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  color?: string;
  className?: string;
  /** 中心内容 */
  children?: React.ReactNode;
  /** 环数量 */
  rings?: number;
  /** 透明度（0~1） */
  opacity?: number;
}

export function RadarSweep({
  size = 180,
  color = "hsl(195 100% 50%)",
  className,
  children,
  rings = 3,
  opacity = 1,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 2;
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size, opacity }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="radar-sweep-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
          <radialGradient id="radar-bg-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 背景径向 */}
        <circle cx={cx} cy={cy} r={maxR} fill="url(#radar-bg-gradient)" />

        {/* 同心环 */}
        {Array.from({ length: rings }).map((_, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={(maxR / rings) * (i + 1)}
            fill="none"
            stroke={color}
            strokeOpacity={0.25}
            strokeWidth={0.5}
          />
        ))}

        {/* 十字线 */}
        <line x1={cx} y1={2} x2={cx} y2={size - 2} stroke={color} strokeOpacity={0.2} strokeWidth={0.5} />
        <line x1={2} y1={cy} x2={size - 2} y2={cy} stroke={color} strokeOpacity={0.2} strokeWidth={0.5} />

        {/* 旋转扫描扇形 */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "radar-sweep 3s linear infinite",
          }}
        >
          <path
            d={`M ${cx} ${cy} L ${cx} ${cy - maxR} A ${maxR} ${maxR} 0 0 1 ${cx + maxR * Math.cos(Math.PI / 6)} ${cy - maxR * Math.sin(Math.PI / 6)} Z`}
            fill="url(#radar-sweep-gradient)"
            opacity={0.7}
          />
        </g>

        {/* 中心点 */}
        <circle cx={cx} cy={cy} r={3} fill={color}>
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}

export default RadarSweep;