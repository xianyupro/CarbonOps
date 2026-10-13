"use client";

/**
 * ② 元模型平台工作台。
 * 主界面：知识图谱；元模型库 / 元模型登记 以子窗口弹窗呈现。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { FilePlus2, Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ModuleToolbar } from "@/components/layout/ModuleToolbar";

const GraphPage = dynamic(() => import("@/app/(shell)/metamodel/graph/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const LibraryPage = dynamic(() => import("@/app/(shell)/metamodel/library/page"), {
  ssr: false,
  loading: () => <Loading />,
});
const RegistryPage = dynamic(() => import("@/app/(shell)/metamodel/registry/page"), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  return (
    <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
      正在加载…
    </div>
  );
}

type SubWindow = "library" | "registry" | null;

export default function MetamodelHubPage() {
  const [sub, setSub] = React.useState<SubWindow>(null);

  return (
    <div className="flex flex-col gap-3">
      <ModuleToolbar
        badge="②"
        module="元模型平台"
        view="知识图谱"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setSub("library")}>
              <Network className="mr-1 h-3.5 w-3.5" /> 元模型库
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSub("registry")}>
              <FilePlus2 className="mr-1 h-3.5 w-3.5" /> 元模型登记
            </Button>
          </>
        }
      />

      {/* 主工作区：知识图谱 */}
      <GraphPage />

      {/* 二级功能子窗口：登记为全屏，库为宽侧窗 */}
      {sub === "registry" ? (
        <Sheet open onOpenChange={(o) => !o && setSub(null)}>
          <SheetContent
            side="top"
            className="h-full w-full max-w-none border-0 p-6 sm:max-w-none"
          >
            <SheetHeader className="px-0">
              <SheetTitle className="text-base">
                ② 元模型平台 · 元模型登记录入
              </SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100vh-5rem)] overflow-y-auto scrollbar-thin pb-6">
              <RegistryPage />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Sheet open={sub != null} onOpenChange={(o) => !o && setSub(null)}>
          <SheetContent className="w-[88%] max-w-[1100px] overflow-y-auto scrollbar-thin p-5 sm:max-w-[1100px]">
            <SheetHeader className="px-0">
              <SheetTitle className="text-base">
                ② 元模型平台 · 元模型库
              </SheetTitle>
            </SheetHeader>
            <div className="px-0 pb-6">{sub === "library" && <LibraryPage />}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
