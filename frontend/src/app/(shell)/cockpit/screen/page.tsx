"use client";

/**
 * 自定义大屏（监控投屏）—— 与「面板配方」同一套组态引擎。
 * 与面板配方的区别：全屏投屏布局、独立保存到 screen_configs；组件数据来自实时接口。
 * - 查看：DashboardCanvas bare 变体渲染 PageConfig（深色大屏）；
 * - 编辑：StudioEditor 全屏编辑器（onSave 写入 screen_configs，隐藏发布/版本）；
 * - 迁移：旧版 {items:[...]} 布局首次加载自动转换为 PageConfig 并回写。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Loader2, Maximize, Pencil, RefreshCw } from "lucide-react";

import { api } from "@/lib/api";
import {
  createEmptyPageConfig,
  migratePageConfig,
  type ComponentInstance,
  type PageConfig,
} from "@/lib/canvas/schema";
import { Button } from "@/components/ui/button";

const ScreenCanvas = dynamic(() => import("@/components/dashboard/dashboard-canvas"), {
  ssr: false,
  loading: () => <Loading text="正在加载大屏渲染器…" />,
});
const StudioEditor = dynamic(() => import("@/components/canvas/studio-editor"), {
  ssr: false,
  loading: () => <Loading text="正在加载组态编辑器…" />,
});

function Loading({ text }: { text: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

/** 旧版 {items:[{i,widget,pointId,x,y,w,h}]} → PageConfig（pointId 反查点位名后映射组件） */
async function migrateLegacyLayout(
  items: { i?: string; widget?: string; pointId?: number; x?: number; y?: number; w?: number; h?: number }[],
): Promise<PageConfig> {
  const byId = new Map<number, string>();
  try {
    const pts = await api.dataPoints.list({ pageSize: 1000 });
    for (const p of pts.list) byId.set(p.id, p.name);
  } catch {
    /* 点位反查失败时组件不带绑定 */
  }

  const components: ComponentInstance[] = [];
  items.forEach((it, idx) => {
    const pointName = it.pointId != null ? byId.get(it.pointId) : undefined;
    const base = {
      id: it.i ?? `m${idx}`,
      position: { x: it.x ?? 0, y: it.y ?? 0, w: it.w ?? 4, h: Math.max(2, it.h ?? 2) },
    };
    if (it.widget === "kpi") {
      components.push({
        ...base,
        type: "kpi",
        title: "碳排 KPI 总览",
        props: { overview: true },
        bindings: {},
      });
    } else if (it.widget === "alarms") {
      components.push({
        ...base,
        type: "alarm",
        title: "最新报警",
        props: { maxItems: 10, filterLevel: "all" },
        bindings: {},
      });
    } else if (it.widget === "chart") {
      components.push({
        ...base,
        type: "chart",
        title: pointName ?? "历史曲线",
        props: { chartType: "line", timeWindow: "24h", showLegend: true, color: "#0d9488" },
        bindings: pointName
          ? { series: { kind: "point" as const, point: pointName } }
          : {},
      });
    } else if (it.widget === "point") {
      components.push({
        ...base,
        type: "point",
        title: pointName ?? "点位实时值",
        props: { unit: "", decimals: 2 },
        bindings: pointName
          ? { value: { kind: "point" as const, point: pointName } }
          : {},
      });
    }
  });

  return {
    version: "2.0",
    layout: "grid",
    canvas: { background: "#0f172a", theme: "dark", gridSize: 8 },
    components,
  };
}

export default function ScreenBuilderPage() {
  const [screenId, setScreenId] = React.useState<number | null>(null);
  const [name, setName] = React.useState("低碳运行大屏");
  const [pageConfig, setPageConfig] = React.useState<PageConfig | null>(null);
  const [editMode, setEditMode] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [screens, pts] = await Promise.all([
          api.screens.list(),
          api.dataPoints.list({ pageSize: 1000 }).catch(() => ({ list: [] })),
        ]);
        const byId = new Map<number, string>(
          pts.list.map((p) => [p.id, p.name] as [number, string]),
        );
        if (screens.length > 0) {
          const s = screens[0];
          setScreenId(s.id);
          setName(s.name);
          const raw = (s.layout ?? {}) as Record<string, unknown>;
          if (raw.version === "2.0") {
            setPageConfig(migratePageConfig(raw));
          } else if (Array.isArray(raw.items) && raw.items.length > 0) {
            // 旧版布局迁移
            const legacy = raw.items as {
              i?: string; widget?: string; pointId?: number; x?: number; y?: number; w?: number; h?: number;
            }[];
            const components: ComponentInstance[] = [];
            legacy.forEach((it, idx) => {
              const pointName = it.pointId != null ? byId.get(it.pointId) : undefined;
              const base = {
                id: it.i ?? `m${idx}`,
                position: { x: it.x ?? 0, y: it.y ?? 0, w: it.w ?? 4, h: Math.max(2, it.h ?? 2) },
              };
              if (it.widget === "kpi") {
                components.push({ ...base, type: "kpi", title: "碳排 KPI 总览", props: { overview: true }, bindings: {} });
              } else if (it.widget === "alarms") {
                components.push({ ...base, type: "alarm", title: "最新报警", props: { maxItems: 10 }, bindings: {} });
              } else if (it.widget === "chart") {
                components.push({
                  ...base,
                  type: "chart",
                  title: pointName ?? "历史曲线",
                  props: { chartType: "line", timeWindow: "24h", showLegend: true, color: "#0d9488" },
                  bindings: pointName ? { series: { kind: "point" as const, point: pointName } } : {},
                });
              } else if (it.widget === "point") {
                components.push({
                  ...base,
                  type: "point",
                  title: pointName ?? "点位实时值",
                  props: { unit: "", decimals: 2 },
                  bindings: pointName ? { value: { kind: "point" as const, point: pointName } } : {},
                });
              }
            });
            const migrated: PageConfig = {
              version: "2.0",
              layout: "grid",
              canvas: { background: "#0f172a", theme: "dark", gridSize: 8 },
              components,
            };
            setPageConfig(migrated);
            // 回写迁移结果
            try {
              await api.screens.update(s.id, { name: s.name, layout: migrated as unknown as Record<string, unknown> });
              toast.success("旧版大屏布局已自动迁移");
            } catch {
              /* 回写失败不影响查看 */
            }
          }
        }
      } catch {
        toast.error("大屏配置加载失败");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  /** StudioEditor 保存回调：写入 screen_configs */
  const handleEditorSave = React.useCallback(
    async (pc: PageConfig) => {
      setPageConfig(pc);
      if (screenId == null) {
        const s = await api.screens.create({
          name,
          layout: pc as unknown as Record<string, unknown>,
        });
        setScreenId(s.id);
      } else {
        await api.screens.update(screenId, {
          name,
          layout: pc as unknown as Record<string, unknown>,
        });
      }
    },
    [screenId, name],
  );

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }

  const editorInitial = pageConfig ?? createEmptyPageConfig();

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">自定义大屏（监控投屏）</h1>
            <span className="rounded bg-teal-600/10 px-2 py-0.5 text-[10px] font-medium text-teal-700">
              实时数据
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            与「面板配方」同一套组态引擎与组件——区别是全屏投屏布局、独立保存到监控大屏；
            组件数据来自实时接口（点位 5s / 图表 30s / KPI 与告警 15s 轮询）
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            刷新
          </Button>
          {!editMode && (
            <>
              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                <Maximize className="mr-1 h-3.5 w-3.5" />
                放映
              </Button>
              <Button size="sm" onClick={() => setEditMode(true)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                编辑
              </Button>
            </>
          )}
          {editMode && (
            <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
              完成编辑
            </Button>
          )}
        </div>
      </div>

      {/* 大屏画布 / 编辑器 */}
      <div ref={containerRef} className="h-[calc(100vh-230px)] min-h-[460px]">
        {!ready ? (
          <Loading text="正在加载大屏配置…" />
        ) : editMode ? (
          <StudioEditor
            formId={screenId ?? 0}
            formName={name}
            initialPageConfig={editorInitial}
            onSave={handleEditorSave}
            onClose={() => setEditMode(false)}
          />
        ) : (
          <ScreenCanvas pageConfig={pageConfig} bare loading={!ready} onEdit={() => setEditMode(true)} />
        )}
      </div>
    </div>
  );
}
