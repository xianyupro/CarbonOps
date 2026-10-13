/**
 * 右侧参数面板的空状态 —— 简明操作指南（替代原来的纯文字空态）。
 */
import { GitBranch, MousePointerClick, Play, Settings2 } from "lucide-react";

const STEPS = [
  {
    icon: MousePointerClick,
    title: "添加节点",
    desc: "点击左侧组件库条目，或拖拽到画布指定位置",
  },
  {
    icon: GitBranch,
    title: "连接端口",
    desc: "从端口拖出连线：实线 = 控制流，虚线 = 数据流",
  },
  {
    icon: Settings2,
    title: "配置参数",
    desc: "单击节点在右侧配置，双击打开设置弹窗",
  },
  {
    icon: Play,
    title: "运行仿真",
    desc: "保存后点击「运行」，查看节点级执行日志与画布回放",
  },
];

export function ParamsEmptyGuide() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-1.5 py-4">
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
        操作指南
      </p>
      {STEPS.map((s, i) => (
        <div
          key={s.title}
          className="flex items-start gap-2.5 rounded-md border border-border/70 bg-muted/30 p-2.5"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-teal-600">
            <s.icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold">
              {i + 1}. {s.title}
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{s.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
