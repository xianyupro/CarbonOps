"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Leaf, Loader2, LockKeyhole, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth-store";
import { api, ApiError } from "@/lib/api";

const loginSchema = z.object({
  username: z
    .string()
    .min(1, "请输入用户名")
    .max(64, "用户名长度不能超过 64 个字符"),
  password: z
    .string()
    .min(1, "请输入密码")
    .min(6, "密码至少 6 位")
    .max(128, "密码长度不能超过 128 个字符"),
});

type LoginForm = z.infer<typeof loginSchema>;

const demoAccounts = [
  { role: "管理员", account: "admin / admin123" },
  { role: "工程师", account: "engineer / engineer123" },
  { role: "访客", account: "viewer / viewer123" },
];

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            正在加载…
          </div>
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginForm) {
    try {
      const result = await api.auth.login(values);
      login(result);
      toast.success(`欢迎回来，${result.user.displayName}`);
      const from = search.get("from");
      router.replace(from && from.startsWith("/") ? from : "/");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "登录失败，请重试";
      toast.error(msg);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[hsl(165_72%_22%)] via-[hsl(170_68%_30%)] to-[hsl(178_60%_28%)] p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-dot-grid opacity-70" />
        {/* Abstract SVG accent */}
        <svg
          className="absolute -right-20 top-1/4 h-[34rem] w-[34rem] opacity-25"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="0.6" />
          <circle cx="100" cy="100" r="60" stroke="white" strokeWidth="0.6" />
          <circle cx="100" cy="100" r="40" stroke="white" strokeWidth="0.6" />
          <circle cx="100" cy="100" r="20" stroke="white" strokeWidth="0.6" />
          <path
            d="M20 100 H180 M100 20 V180"
            stroke="white"
            strokeWidth="0.4"
            strokeDasharray="2 4"
          />
          <path
            d="M40 140 Q100 40 160 140"
            stroke="white"
            strokeWidth="1"
            fill="none"
          />
        </svg>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Leaf className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">
              全流程低碳运行智能监测
            </div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/70">
              工业智能调控系统平台
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            让每一吨碳排放
            <br />
            可见 · 可控 · 可优化
          </h1>
          <p className="text-sm leading-relaxed text-white/80">
            面向工业企业的低碳运行数字化底座，覆盖数据采集、质量治理、模型编排与场景化应用，助力企业迈向碳中和目标。
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4 text-xs">
          {[
            { v: "9+", l: "工业协议" },
            { v: "实时", l: "数据采集" },
            { v: "多角色", l: "权限协同" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 backdrop-blur"
            >
              <div className="text-base font-semibold text-white">{s.v}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/60">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Login form panel */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
                <Leaf className="h-5 w-5 text-primary" strokeWidth={2.2} />
              </div>
              <span className="text-base font-semibold tracking-tight">
                全流程低碳运行智能监测与调控系统平台
              </span>
            </div>
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="space-y-1.5 pb-5">
              <CardTitle className="text-xl">欢迎登录</CardTitle>
              <CardDescription>
                使用您的账号登录系统平台
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-4"
                noValidate
              >
                <div className="space-y-1.5">
                  <Label htmlFor="username">用户名</Label>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="username"
                      autoComplete="username"
                      placeholder="请输入用户名"
                      className="pl-9"
                      {...register("username")}
                    />
                  </div>
                  {errors.username ? (
                    <p className="text-xs text-destructive">
                      {errors.username.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">密码</Label>
                    <Link
                      href="#"
                      className="text-xs text-muted-foreground transition-colors hover:text-primary"
                    >
                      忘记密码？
                    </Link>
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="请输入密码"
                      className="pl-9"
                      {...register("password")}
                    />
                  </div>
                  {errors.password ? (
                    <p className="text-xs text-destructive">
                      {errors.password.message}
                    </p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 w-full"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      登录中…
                    </>
                  ) : (
                    "登录"
                  )}
                </Button>
              </form>
            </CardContent>

            <Separator />

            <CardFooter className="flex-col items-stretch gap-2 pt-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                演示账号
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                {demoAccounts.map((d) => (
                  <div
                    key={d.role}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 font-mono"
                  >
                    <span className="font-sans font-medium text-foreground/80">
                      {d.role}
                    </span>
                    <span>{d.account}</span>
                  </div>
                ))}
              </div>
            </CardFooter>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} 全流程低碳运行智能监测与调控系统平台
          </p>
        </div>
      </div>
    </div>
  );
}
