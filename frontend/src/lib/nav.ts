import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Database,
  Network,
  Workflow,
  LayoutDashboard,
  Users,
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
 * CarbonOps 侧边栏 —— 一个模块一个主菜单；驾驶舱中心为平台主入口置顶，
 * 其余按四层递进架构排列：① 数据基座 → ② 元模型平台 → ③ 组件平台；系统管理单列。
 * 徽标编号保留四层架构语义（数据基座①→驾驶舱④），与菜单展示顺序无关。
 * 各模块的二级功能（数据源管理、离线导入、组态开发等）在模块工作台内
 * 以子窗口/视图切换呈现，不再占用侧边栏。
 */
export const navConfig: NavGroup[] = [
  {
    title: "驾驶舱中心",
    badge: "④",
    items: [
      {
        label: "驾驶舱工作台",
        href: "/cockpit",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "数据基座",
    badge: "①",
    items: [
      {
        label: "数据基座工作台",
        href: "/data",
        icon: Database,
        permission: "data:source:read",
      },
    ],
  },
  {
    title: "元模型平台",
    badge: "②",
    items: [
      {
        label: "元模型平台",
        href: "/metamodel",
        icon: Network,
        permission: "model:read",
      },
    ],
  },
  {
    title: "组件平台",
    badge: "③",
    items: [
      {
        label: "组件平台",
        href: "/platform",
        icon: Workflow,
        permission: "orchestration:read",
        anyPermission: ["model:read"],
      },
    ],
  },
  {
    title: "智能助手",
    items: [
      {
        label: "AI 智能助手",
        href: "/assistant",
        icon: Bot,
      },
    ],
  },
  {
    title: "系统管理",
    items: [
      {
        label: "系统管理",
        href: "/system",
        icon: Users,
        permission: "system:user:read",
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
