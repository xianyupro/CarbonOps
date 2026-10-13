"use client";

/** 系统基本设置面板：平台参数 KV 编辑。 */
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const LABELS: Record<string, { label: string; hint?: string }> = {
  "platform.name": { label: "平台名称" },
  "platform.dimension": { label: "默认展示维度", hint: "留空为全部行业（有色/石化/钢铁/通用）" },
  "data.retention_days": { label: "数据保留天数", hint: "超期历史数据的保留策略基线" },
  "collect.ws_push_seconds": { label: "实时推送周期", hint: "WebSocket 推送间隔（秒）" },
  "collect.backfill_days": { label: "启动回填天数", hint: "启动时时序回填检查的天数" },
  "backup.auto": { label: "自动备份", hint: "on / off" },
  "backup.keep_count": { label: "备份保留数量", hint: "超出数量的旧备份将被清理策略引用" },
};

export function SettingsPanel() {
  const [values, setValues] = React.useState<Record<string, string> | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api.systemAdmin.settings().then(setValues).catch(() => toast.error("设置加载失败"));
  }, []);

  async function handleSave() {
    if (!values) return;
    setSaving(true);
    try {
      await api.systemAdmin.updateSettings(values);
      toast.success("设置已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (!values) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      {Object.entries(LABELS).map(([key, meta]) => (
        <div key={key} className="grid grid-cols-[180px_1fr] items-center gap-3">
          <div>
            <p className="text-xs font-medium">{meta.label}</p>
            <p className="font-cyber text-[10px] text-muted-foreground">{key}</p>
          </div>
          <Input
            value={values[key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
          {meta.hint ? (
            <p className="col-span-2 -mt-2 text-[10px] text-muted-foreground">{meta.hint}</p>
          ) : null}
        </div>
      ))}
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
        保存设置
      </Button>
    </div>
  );
}

export default SettingsPanel;
