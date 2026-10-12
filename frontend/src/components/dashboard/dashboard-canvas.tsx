"use client";

import React from "react";
import { WidthProvider, Responsive, type Layout } from "react-grid-layout";
import { LayoutPanelLeft, Pencil } from "lucide-react";
import { WidgetRenderer } from "@/components/canvas/widgets";
import { migratePageConfig, type PageConfig, type ComponentInstance } from "@/lib/canvas/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ResponsiveGridLayout = WidthProvider(Responsive);

export function DashboardCanvas({
  pageConfig,
  loading,
  onEdit,
}: {
  pageConfig: Record<string, unknown> | null;
  loading: boolean;
  onEdit?: () => void;
}) {
  const config: PageConfig = React.useMemo(
    () => migratePageConfig(pageConfig),
    [pageConfig],
  );

  const components = config.components ?? [];
  const hasComponents = components.length > 0;

  // Build layout array for react-grid-layout
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
            <Pencil className="h-3.5 w-3.5" />
            编辑驾驶舱
          </button>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            加载组态配置中...
          </div>
        ) : hasComponents ? (
          <div
            className="overflow-hidden rounded-xl shadow-card-sm"
            style={{
              background: config.canvas.background,
              minHeight: "300px",
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
                <div
                  key={comp.id}
                  className="overflow-hidden rounded-lg border border-white/10 bg-slate-800/40 p-2 shadow-card-sm"
                >
                  <WidgetRenderer component={comp} />
                </div>
              ))}
            </ResponsiveGridLayout>
          </div>
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
                <Pencil className="h-3.5 w-3.5" />
                配置驾驶舱内容
              </button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
