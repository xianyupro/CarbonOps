"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Bell, ChevronDown, Leaf } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlowingDot } from "@/components/ui/GlowingDot";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function initials(name?: string | null): string {
  if (!name) return "U";
  const trimmed = name.trim();
  if (/[\u4e00-\u9fa5]/.test(trimmed)) {
    return trimmed.slice(-2);
  }
  const parts = trimmed.split(/\s+/);
  return (parts[0]?.[0] ?? "U").toUpperCase();
}

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [signingOut, setSigningOut] = React.useState(false);
  const [now, setNow] = React.useState<Date>(new Date());

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await api.auth.logout().catch(() => undefined);
    } finally {
      logout();
      toast.success("已安全退出登录");
      setSigningOut(false);
      router.replace("/login");
    }
  }

  const roleLabel = user?.roles?.[0]?.name ?? "成员";
  const timeStr = now.toLocaleTimeString("zh-CN", { hour12: false });
  const dateStr = now.toLocaleDateString("zh-CN");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-primary/20 bg-background/60 px-5 backdrop-blur-xl">
      {/* 顶部装饰：底部蓝色光条 */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      <Breadcrumb />

      {/* 中间：5 点序列闪烁（demo 风格） */}
      <div className="hidden items-center gap-1.5 lg:flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-primary animate-glow-blink"
            style={{
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        {/* 实时时钟 */}
        <div className="hidden items-center gap-2 rounded-md border border-primary/20 bg-background/40 px-3 py-1 font-cyber text-[11px] tracking-wider md:flex">
          <GlowingDot color="hsl(150 100% 50%)" size="sm" />
          <span className="text-foreground/90">{dateStr}</span>
          <span className="text-primary text-glow-cyan">{timeStr}</span>
        </div>

        <div className="mx-1 h-6 w-px bg-primary/20" />

        {/* 通知 */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="通知"
          className="relative text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <Bell className="h-5 w-5" />
          <span
            aria-hidden
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-success animate-glow-blink"
            style={{ boxShadow: "0 0 8px hsl(150 100% 50%)" }}
          />
        </Button>

        <div className="mx-1 h-6 w-px bg-primary/20" />

        {/* 用户菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]"
              )}
            >
              <div className="relative">
                <Avatar className="h-7 w-7 ring-1 ring-primary/40 shadow-sm">
                  <AvatarFallback className="bg-gradient-primary text-xs font-medium text-white">
                    {initials(user?.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-success animate-glow-blink"
                  style={{ boxShadow: "0 0 6px hsl(150 100% 50%)" }}
                />
              </div>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[13px] font-medium text-foreground">
                  {user?.displayName ?? user?.username ?? "用户"}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {roleLabel}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-card-lg panel-cyber rounded-xl">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {user?.displayName ?? user?.username}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.email || user?.username}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserIcon className="h-4 w-4" />
              个人资料
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                if (!signingOut) void handleLogout();
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "退出中..." : "退出登录"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/* Sidebar 用的 logo（可被 Sidebar 引用） */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* 外圈光晕呼吸 */}
      <span
        aria-hidden
        className="absolute -inset-[3px] rounded-[14px] bg-gradient-to-br from-primary via-cool to-primary opacity-40 blur-[2px] animate-logo-pulse"
      />
      {/* 主 logo */}
      <div
        className="relative flex items-center justify-center rounded-xl bg-gradient-primary text-white shadow-glow-cyan"
        style={{ width: size, height: size }}
      >
        <Leaf className="h-5 w-5" strokeWidth={2.4} />
      </div>
    </div>
  );
}