/**
 * Shared constants for data management UI.
 * Kept in sync with backend enums (see `backend/app/schemas/data.py`).
 */
import type {
  Aggregation,
  DataImportFileType,
  DataImportStatus,
  DataSourceProtocol,
  DataSourceStatus,
  DataPointType,
  DataQuality,
  ModelFunctionType,
  ModelStatus,
  TimeBucket,
} from "@/types/api";

/* ------------------------------ Data Sources ------------------------------ */

export const PROTOCOL_OPTIONS: { value: DataSourceProtocol; label: string }[] =
  [
    { value: "OPC_UA", label: "OPC UA" },
    { value: "MODBUS", label: "Modbus" },
    { value: "MQTT", label: "MQTT" },
    { value: "HTTP", label: "HTTP" },
  ];

export const protocolLabel = (p: DataSourceProtocol | string): string =>
  PROTOCOL_OPTIONS.find((o) => o.value === p)?.label ?? p;

export const SOURCE_STATUS_BADGE: Record<
  DataSourceStatus,
  { label: string; variant: "success" | "muted" | "destructive" }
> = {
  CONNECTED: { label: "已连接", variant: "success" },
  DISCONNECTED: { label: "未连接", variant: "muted" },
  ERROR: { label: "异常", variant: "destructive" },
};

/* -------------------------------- Industries ------------------------------ */

export const INDUSTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "通用", label: "通用" },
  { value: "有色", label: "有色金属" },
  { value: "石化", label: "石油化工" },
  { value: "钢铁", label: "钢铁" },
];

/* -------------------------------- Imports --------------------------------- */

export const IMPORT_STATUS_BADGE: Record<
  DataImportStatus,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  COMPLETED: { label: "已完成", variant: "success" },
  PARSING: { label: "解析中", variant: "warning" },
  FAILED: { label: "失败", variant: "destructive" },
};

export const FILE_TYPE_BADGE: Record<
  DataImportFileType,
  { label: string; variant: "outline" | "secondary" | "muted" }
> = {
  CSV: { label: "CSV", variant: "outline" },
  EXCEL: { label: "Excel", variant: "outline" },
  JSON: { label: "JSON", variant: "secondary" },
  XML: { label: "XML", variant: "secondary" },
  OPCUA_HIST: { label: "OPC UA Hist", variant: "muted" },
};

export const ACCEPTED_IMPORT_EXT = [".csv", ".xlsx", ".xls", ".json", ".xml"];

/* ------------------------------- Time Range ------------------------------- */

export interface TimeRangePreset {
  label: string;
  /** Milliseconds to subtract from Date.now(). */
  ms: number;
}

export const TIME_RANGE_PRESETS: TimeRangePreset[] = [
  { label: "全部数据", ms: 0 },
  { label: "近1小时", ms: 60 * 60 * 1000 },
  { label: "近6小时", ms: 6 * 60 * 60 * 1000 },
  { label: "近24小时", ms: 24 * 60 * 60 * 1000 },
  { label: "近7天", ms: 7 * 24 * 60 * 60 * 1000 },
];

/* ------------------------------ Aggregation ------------------------------- */

export const INTERVAL_OPTIONS: { value: TimeBucket; label: string }[] = [
  { value: "minute", label: "1 分钟" },
  { value: "5 minute", label: "5 分钟" },
  { value: "1 hour", label: "1 小时" },
  { value: "1 day", label: "1 天" },
];

export const AGG_OPTIONS: { value: Aggregation; label: string }[] = [
  { value: "NONE", label: "原始" },
  { value: "AVG", label: "平均" },
  { value: "MAX", label: "最大" },
  { value: "MIN", label: "最小" },
  { value: "SUM", label: "求和" },
];

/* ------------------------------ Data Quality ------------------------------ */

export const QUALITY_BADGE: Record<
  DataQuality,
  { label: string; variant: "success" | "warning" | "muted" }
> = {
  GOOD: { label: "良好", variant: "success" },
  BAD: { label: "异常", variant: "warning" },
  MISSING: { label: "缺失", variant: "muted" },
};

export const POINT_TYPE_OPTIONS: { value: DataPointType; label: string }[] = [
  { value: "NUMBER", label: "数值" },
  { value: "STRING", label: "字符串" },
  { value: "BOOLEAN", label: "布尔" },
];

/** Suggest a Progress color class based on a 0..1 rate. */
export function rateColorClass(rate: number, inverse = false): string {
  const r = inverse ? 1 - rate : rate;
  if (r >= 0.95) return "bg-success";
  if (r >= 0.8) return "bg-warning";
  return "bg-destructive";
}

/** Suggest a Tailwind text color class based on a 0..1 rate. */
export function rateTextClass(rate: number, inverse = false): string {
  const r = inverse ? 1 - rate : rate;
  if (r >= 0.95) return "text-success";
  if (r >= 0.8) return "text-warning";
  return "text-destructive";
}

/* -------------------------------- Models --------------------------------- */

export const MODEL_FUNCTION_OPTIONS: {
  value: ModelFunctionType;
  label: string;
}[] = [
  { value: "OPTIMIZATION", label: "运行优化" },
  { value: "PREDICTION", label: "预测" },
  { value: "CLASSIFICATION", label: "分类" },
  { value: "CARBON_ACCOUNTING", label: "碳核算" },
  { value: "PROCESS_MODELING", label: "过程建模" },
  { value: "PROCESS_CONTROL", label: "过程控制" },
  { value: "CARBON_MONITORING", label: "碳排监测" },
  { value: "DATA_PERCEPTION", label: "数据感知" },
  { value: "AUXILIARY", label: "辅助功能" },
];

export const modelFunctionLabel = (
  t: ModelFunctionType | string
): string =>
  MODEL_FUNCTION_OPTIONS.find((o) => o.value === t)?.label ?? t;

export const MODEL_FUNCTION_BADGE: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive" | "muted";
  }
> = {
  OPTIMIZATION: { label: "运行优化", variant: "default" },
  PREDICTION: { label: "预测", variant: "secondary" },
  CLASSIFICATION: { label: "分类", variant: "outline" },
  CARBON_ACCOUNTING: { label: "碳核算", variant: "destructive" },
  PROCESS_MODELING: { label: "过程建模", variant: "default" },
  PROCESS_CONTROL: { label: "过程控制", variant: "secondary" },
  CARBON_MONITORING: { label: "碳排监测", variant: "destructive" },
  DATA_PERCEPTION: { label: "数据感知", variant: "outline" },
  AUXILIARY: { label: "辅助功能", variant: "muted" },
};

export const MODEL_STAGE_BADGE: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "muted";
  }
> = {
  PRODUCTION: { label: "Production", variant: "success" },
  STAGING: { label: "Staging", variant: "warning" },
  ARCHIVED: { label: "Archived", variant: "muted" },
  NONE: { label: "None", variant: "outline" },
};

export const MODEL_STATUS_BADGE: Record<
  ModelStatus,
  {
    label: string;
    variant: "success" | "warning" | "muted" | "destructive";
  }
> = {
  ONLINE: { label: "已上线", variant: "success" },
  TESTING: { label: "测试中", variant: "warning" },
  DEVELOPING: { label: "开发中", variant: "muted" },
  OFFLINE: { label: "已下线", variant: "destructive" },
};
