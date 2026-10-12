import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Database,
  Upload,
  BarChart3,
  ShieldCheck,
  Boxes,
  Workflow,
  PenTool,
  Factory,
  Users,
  ScrollText,
  Cloud,
  Network,
  FilePlus2,
  Waypoints,
  PanelsTopLeft,
} from "lucide-react";

export interface NavItem {
  /** Visible label. */
  label: string;
  /** Route path. */
  href: string;
  /** Lucide icon. */
  icon: LucideIcon;
  /** Permission code required to view this item. Empty = visible to everyone. */
  permission?: string;
  /** Alternate accepted permission codes — shown if primary OR any of these. */
  anyPermission?: string[];
}

export interface NavGroup {
  /** Group title. */
  title?: string;
  /** 层级徽标（①②③④），对应四层递进架构。 */
  badge?: string;
  items: NavItem[];
}

/**
 * CarbonOps 侧边栏 —— 对齐四层递进架构（层层递进，逐层支撑）：
 * ① 数据基座 → ② 元模型平台 → ③ 组件平台 → ④ 驾驶舱中心；系统管理单列。
 * Routes correspond to file paths under `src/app/(shell)/`.
 */
export const navConfig: NavGroup[] = [
  {
    title: "数据基座",
    badge: "①",
    items: [
      { label: "数据源", href: "/data/sources", icon: Database, permission: "data:source:read" },
      {
        label: "离线导入",
        href: "/data/imports",
        icon: Upload,
        permission: "data:import:read",
        anyPermission: ["data:source:read"],
      },
      {
        label: "数据可视化",
        href: "/data/visualize",
        icon: BarChart3,
        permission: "data:point:read",
        anyPermission: ["data:source:read"],
      },
      {
        label: "数据质量",
        href: "/data/quality",
        icon: ShieldCheck,
        permission: "data:quality:read",
        anyPermission: ["data:source:read"],
      },
      {
        label: "云边端协同",
        href: "/cloud-edge",
        icon: Cloud,
      },
    ],
  },
  {
    title: "元模型平台",
    badge: "②",
    items: [
      {
        label: "元模型登记",
        href: "/metamodel/registry",
        icon: FilePlus2,
        permission: "model:write",
        anyPermission: ["model:read"],
      },
      { label: "元模型库", href: "/metamodel/library", icon: Network, permission: "model:read" },
      { label: "知识图谱", href: "/metamodel/graph", icon: Waypoints, permission: "model:read" },
    ],
  },
  {
    title: "组件平台",
    badge: "③",
    items: [
      {
        label: "控制流编排",
        href: "/platform/flow",
        icon: Workflow,
        permission: "orchestration:read",
        anyPermission: ["model:read"],
      },
      { label: "组态开发", href: "/studio", icon: PenTool, permission: "studio:read" },
    ],
  },
  {
    title: "驾驶舱中心",
    badge: "④",
    items: [
      { label: "运行总览", href: "/dashboard", icon: LayoutDashboard },
      { label: "行业场景", href: "/scenarios", icon: Factory, permission: "scenario:read" },
      { label: "数字孪生", href: "/cockpit/twin", icon: Boxes, permission: "model:read" },
      {
        label: "自定义大屏",
        href: "/cockpit/screen",
        icon: PanelsTopLeft,
        permission: "studio:read",
        anyPermission: ["model:read"],
      },
    ],
  },
  {
    title: "系统管理",
    items: [
      { label: "用户与权限", href: "/system/users", icon: Users, permission: "system:user:read" },
      { label: "操作日志", href: "/system/logs", icon: ScrollText, permission: "system:audit:read" },
    ],
  },
];

/** Flat list of every shell route for breadcrumb/guard lookups. */
export const allRoutes: NavItem[] = navConfig.flatMap((g) => g.items);

/** Map path → NavItem for quick lookup. */
export const routeMap: Record<string, NavItem> = Object.fromEntries(
  allRoutes.map((r) => [r.href, r])
);
