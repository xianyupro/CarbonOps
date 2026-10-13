"use client";

import React from "react";
import { WidthProvider, Responsive, type Layout } from "react-grid-layout";
import { LayoutPanelLeft, Pencil } from "lucide-react";
import { WidgetRenderer } from "@/components/canvas/widgets";
import { migratePageConfig, type PageConfig, type ComponentInstance } from "@/lib/canvas/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ResponsiveGridLayout = WidthProvider(Responsive);

/** 画布主体（组态组件网格），面板与全屏大屏共用 */
function CanvasBody({
  config,
  components,
  minHeight,
}: {
  config: PageConfig;
  components: ComponentInstance[];
  minHeight: string;
}) {
  const layouts = React.useMemo(() => {
    const items: Layout[] = components.map((c) => ({
      i: c.id,
      x: c.position.x,
      y: c.position.y,
      w: c.position.w,
      h: c.position.h,
      minW: 1,
      minH: 1,
      static: true,
    }));
    return { lg: items, md: items, sm: items, xs: items, xxs: items };
  }, [components]);

  return (
    <div
      className="overflow-hidden rounded-xl shadow-card-sm ring-1 ring-white/10"
      style={{
        background: config.canvas.background,
        backgroundImage: "radial-gradient(rgba(148,163,184,0.07) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        minHeight,
      }}
    >
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
        rowHeight={60}
        margin={[8, 8]}
        isDraggable={false}
        isResizable={false}
        draggableHandle=".no-drag"
      >
        {components.map((comp: ComponentInstance) => (
          <div key={comp.id} className="overflow-hidden rounded-lg p-0.5">
            <WidgetRenderer component={comp} />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}

export function DashboardCanvas({
  pageConfig,
  loading,
  onEdit,
  bare = false,
}: {
  pageConfig: unknown;
  loading: boolean;
  onEdit?: () => void;
  /** 全屏大屏模式：不带卡片外壳与标题，铺满父容器 */
  bare?: boolean;
}) {
  const config: PageConfig = React.useMemo(
    () => migratePageConfig(pageConfig),
    [pageConfig],
  );

  const components = config.components ?? [];
  const hasComponents = components.length > 0;

  // 大屏模式：只渲染画布主体（外层由调用方提供工具栏/边框/高度）
  if (bare) {
    return (
      <div className="h-full min-h-[420px] overflow-auto rounded-lg border border-border p-2">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            加载大屏配置中...
          </div>
        ) : hasComponents ? (
          <CanvasBody config={config} components={components} minHeight="420px" />
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            大屏暂无组件，点击「编辑」开始搭建
          </div>
        )}
      </div>
    );
  }

  return (
    <Card variant="elevated">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-cool text-white shadow-glow-cyan">
            <LayoutPanelLeft className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span>组态展示区</span>
          {hasComponents && (
            <Badge variant="gradient" className="ml-1">
              {components.length} 组件
            </Badge>
          )}
        </CardTitle>
        {onEdit ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-card px-3 py-1.5 text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-card-sm"
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            编辑面板配方
          </button>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            加载组态配置中...
          </div>
        ) : hasComponents ? (
          <CanvasBody config={config} components={components} minHeight="300px" />
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="relative">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary/15 blur-xl"
              />
              <LayoutPanelLeft className="relative h-10 w-10 text-primary opacity-80" />
            </div>
            <p className="text-sm">暂无组态配置</p>
            {onEdit ? (
              <button
                onClick={onEdit}
                className="mt-1 flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-1.5 text-sm text-white shadow-glow-emerald transition-all hover:-translate-y-0.5 hover:shadow-card-lg"
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                配置驾驶舱内容
              </button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DashboardCanvas;
