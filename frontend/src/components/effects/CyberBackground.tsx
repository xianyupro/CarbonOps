"use client";

/**
 * 全局赛博科技风背景层。
 *  - 固定网格（移动）
 *  - 顶部径向 aurora 渐变（在 body 已应用，此处补充局部）
 *  - 粒子层（Canvas，参考 demo 80 粒子）
 *  - 顶部扫描线
 *  - 左下 Logo 角光圈
 *
 * 性能：
 *  - Canvas 仅在 SSR 跳过（浏览器端初始化）
 *  - 粒子数量受 density 控制
 *  - prefers-reduced-motion 时仅渲染网格
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** 是否显示粒子层 */
  showParticles?: boolean;
  /** 是否显示顶部扫描线 */
  showScanLine?: boolean;
  /** 是否显示网格 */
  showGrid?: boolean;
  /** 粒子数量 */
  density?: number;
  className?: string;
}

export function CyberBackground({
  showParticles = true,
  showScanLine = true,
  showGrid = true,
  density = 50,
  className,
}: Props) {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const cb = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", cb);
    return () => mq.removeEventListener?.("change", cb);
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-0 overflow-hidden",
        className
      )}
    >
      {/* 网格层（移动） */}
      {showGrid && !reduced && (
        <div
          className="absolute inset-0 bg-cyber-grid bg-grid-60 animate-cyber-grid-shift opacity-90"
          style={{ backgroundPosition: "0 0" }}
        />
      )}
      {showGrid && reduced && (
        <div className="absolute inset-0 bg-cyber-grid bg-grid-60 opacity-50" />
      )}

      {/* 粒子层 */}
      {showParticles && !reduced && <ParticleField density={density} />}

      {/* 顶部扫描线 */}
      {showScanLine && !reduced && (
        <div className="absolute inset-x-0 top-0 h-[2px] animate-scan-line-down bg-scanline-gradient" />
      )}

      {/* 顶部装饰：彩虹光弧 */}
      <div className="absolute -top-40 left-1/2 h-80 w-[80%] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -bottom-40 right-0 h-80 w-[60%] rounded-full bg-primary/[0.04] blur-3xl" />
    </div>
  );
}

/* ===================== 粒子层 ===================== */

function ParticleField({ density = 50 }: { density?: number }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    const particles: P[] = [];
    const count = density;
    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w(),
        y: Math.random() * h(),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random() * 0.5 + 0.2,
      });
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      // 粒子
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w();
        if (p.x > w()) p.x = 0;
        if (p.y < 0) p.y = h();
        if (p.y > h()) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x * dpr, p.y * dpr, p.r * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${p.a})`;
        ctx.fill();
      }

      // 连线
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x * dpr, particles[i].y * dpr);
            ctx.lineTo(particles[j].x * dpr, particles[j].y * dpr);
            ctx.strokeStyle = `rgba(0, 168, 255, ${0.12 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.6 * dpr;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}

export default CyberBackground;