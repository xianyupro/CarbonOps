"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import {
  INDUSTRY_OPTIONS,
  PROTOCOL_OPTIONS,
} from "@/lib/constants";
import type {
  DataSource,
  DataSourcePayload,
  DataSourceProtocol,
  DataSourceUpdate,
} from "@/types/api";

const formSchema = z.object({
  name: z.string().min(1, "请输入数据源名称").max(64, "名称过长"),
  code: z
    .string()
    .min(2, "编码至少 2 位")
    .max(32, "编码过长")
    .regex(/^[A-Z0-9_]+$/i, "编码只能包含字母、数字、下划线"),
  protocol: z.enum(["OPC_UA", "MODBUS", "MQTT", "HTTP"]),
  host: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional().or(z.literal(0)),
  industry: z.string().min(1, "请选择行业"),
  collectIntervalMs: z.coerce.number().int().min(100).max(3_600_000),
  description: z.string().max(500, "描述过长").optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, edit mode — code is readonly. */
  editing?: DataSource | null;
  onSaved: (created: DataSource) => void;
}

export function SourceFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: SourceFormDialogProps) {
  const isEdit = !!editing;
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      protocol: "OPC_UA",
      host: "",
      port: 0,
      industry: "通用",
      collectIntervalMs: 5000,
      description: "",
    },
  });

  // Re-seed whenever the dialog target changes.
  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        code: editing.code,
        protocol: editing.protocol,
        host: editing.host ?? "",
        port: editing.port ?? 0,
        industry: editing.industry,
        collectIntervalMs: editing.collectIntervalMs,
        description: editing.description ?? "",
      });
    } else {
      form.reset({
        name: "",
        code: "",
        protocol: "OPC_UA",
        host: "",
        port: 0,
        industry: "通用",
        collectIntervalMs: 5000,
        description: "",
      });
    }
  }, [open, editing, form]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload: DataSourcePayload = {
        name: values.name,
        code: values.code,
        protocol: values.protocol as DataSourceProtocol,
        host: values.host || undefined,
        port: values.port || undefined,
        industry: values.industry,
        collectIntervalMs: values.collectIntervalMs,
        description: values.description || undefined,
      };
      let result: DataSource;
      if (isEdit && editing) {
        const update: DataSourceUpdate = {
          name: payload.name,
          host: payload.host,
          port: payload.port,
          industry: payload.industry,
          collectIntervalMs: payload.collectIntervalMs,
          description: payload.description,
        };
        result = await api.dataSources.update(editing.id, update);
      } else {
        result = await api.dataSources.create(payload);
      }
      toast.success(isEdit ? "已更新数据源" : "已创建数据源");
      onSaved(result);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "保存失败，请重试";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑数据源" : "新建数据源"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "修改数据源基本信息。编码不可变更。"
              : "填写数据源接入信息。提交后将创建为未连接状态。"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input placeholder="如：1#回转窑" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>编码</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如：KILN_01"
                        className="font-mono"
                        disabled={isEdit}
                        {...field}
                      />
                    </FormControl>
                    {isEdit ? (
                      <FormDescription>编码创建后不可修改</FormDescription>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="protocol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>协议</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择协议" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROTOCOL_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>行业</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择行业" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INDUSTRY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>主机</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如：127.0.0.1"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>端口</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={65535}
                        placeholder="如：4840"
                        className="font-mono"
                        {...field}
                        value={field.value === 0 ? "" : field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="collectIntervalMs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>采集间隔（毫秒）</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={100}
                      step={500}
                      className="font-mono"
                      {...field}
                      value={field.value === 0 ? "" : field.value}
                    />
                  </FormControl>
                  <FormDescription>
                    默认 5000（5 秒）。可填 100 ~ 3,600,000。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="可选，描述数据源用途、归属产线等"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    保存中…
                  </>
                ) : isEdit ? (
                  "保存修改"
                ) : (
                  "创建"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
