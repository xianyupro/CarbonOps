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
  PlusCircle,
  Cloud,
  Network,
  FilePlus2,
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
  /**
   * Alternate accepted permission codes — item is shown if the user has the
   * primary permission OR any of these.
   */
  anyPermission?: string[];
}

export interface NavGroup {
  /** Optional group title. Empty string = top-level ungrouped item. */
  title?: string;
  items: NavItem[];
}

/**
 * CarbonOps sidebar navigation. 顶部主导航对齐客户 demo 心智模型：
 * 驾驶舱 / 行业场景 / 新增场景 / 云边端资源协同；
 * 现有数据/模型/组态/系统模块作为「资源底座」下移保留，避免破坏现有功能。
 *
 * Routes correspond to file paths under `src/app/(shell)/`.
 */
export const navConfig: NavGroup[] = [
  // ====== 顶部主导航（对齐客户 demo）======
  {
    items: [
      {
        label: "驾驶舱",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "驾驶舱中心",
    items: [
      {
        label: "数字孪生",
        href: "/cockpit/twin",
        icon: Boxes,
        permission: "model:read",
      },
      {
        label: "自定义大屏",
        href: "/cockpit/screen",
        icon: PenTool,
        permission: "studio:read",
        anyPermission: ["model:read"],
      },
    ],
  },
  {
    title: "运行与场景",
    items: [
      {
        label: "行业场景",
        href: "/scenarios",
        icon: Factory,
        permission: "scenario:read",
      },
      {
        label: "新增场景",
        href: "/scenarios/new",
        icon: PlusCircle,
        permission: "scenario:read",
      },
      {
        label: "云边端资源协同",
        href: "/cloud-edge",
        icon: Cloud,
      },
    ],
  },
  // ====== 资源底座（保留现有能力）======
  {
    title: "数据底座",
    items: [
      {
        label: "数据源",
        href: "/data/sources",
        icon: Database,
        permission: "data:source:read",
      },
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
    ],
  },
  {
    title: "元模型中心",
    items: [
      {
        label: "登记录入",
        href: "/metamodel/registry",
        icon: FilePlus2,
        permission: "model:write",
        anyPermission: ["model:read"],
      },
      {
        label: "元模型库",
        href: "/metamodel/library",
        icon: Network,
        permission: "model:read",
      },
      {
        label: "知识图谱",
        href: "/metamodel/graph",
        icon: Workflow,
        permission: "model:read",
      },
    ],
  },
  {
    title: "组件平台",
    items: [
      {
        label: "控制流编排",
        href: "/platform/flow",
        icon: Workflow,
        permission: "orchestration:read",
        anyPermission: ["model:read"],
      },
      {
        label: "组态开发",
        href: "/studio",
        icon: PenTool,
        permission: "studio:read",
      },
    ],
  },
  {
    title: "系统管理",
    items: [
      {
        label: "用户",
        href: "/system/users",
        icon: Users,
        permission: "system:user:read",
      },
      {
        label: "操作日志",
        href: "/system/logs",
        icon: ScrollText,
        permission: "system:audit:read",
      },
    ],
  },
];

/** Flat list of every shell route for breadcrumb/guard lookups. */
export const allRoutes: NavItem[] = navConfig.flatMap((g) => g.items);

/** Map path → NavItem for quick lookup. */
export const routeMap: Record<string, NavItem> = Object.fromEntries(
  allRoutes.map((r) => [r.href, r])
);
