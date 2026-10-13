"use client";

/**
 * /scenarios —— 旧「应用编排 · 场景库」列表页已从信息架构移除：
 * 场景资产入口 = 运行总览「低碳运行场景」子功能；场景工作台 = /scenarios/[id]。
 * 本路由仅保留重定向，避免旧链接/返回按钮 404。
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ScenariosRedirectPage() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      场景库已并入「低碳运行场景」，正在前往…
    </div>
  );
}
