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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

      {/* 二级功能子窗口（居中弹窗） */}
      <Dialog open={sub != null} onOpenChange={(o) => !o && setSub(null)}>
        <DialogContent className="flex h-[86vh] max-w-[min(1280px,94vw)] flex-col p-5">
          <DialogHeader className="px-0">
            <DialogTitle className="text-base">
              ② 元模型平台 ·{" "}
              {sub === "library" ? "元模型学术检索中心" : "元模型登记录入"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin pr-1">
            {sub === "library" && <LibraryPage />}
            {sub === "registry" && <RegistryPage />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
