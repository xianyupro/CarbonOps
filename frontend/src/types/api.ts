/**
 * TypeScript interfaces matching the CarbonOps FastAPI backend response schema.
 * Field names are camelCase as returned by the API envelope `data` field.
 *
 * This file is the SINGLE SOURCE OF TRUTH for the frontend<->backend contract.
 */

/* ----------------------------------- Auth ---------------------------------- */

export interface Role {
  id: number;
  code: string;
  name: string;
}

export interface User {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: Role[];
  permissions: string[];
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface RefreshResult {
  accessToken: string;
  expiresIn: number;
}

export interface AuditLog {
  id: number;
  username: string | null;
  action: string;
  resource: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

export interface UserListResult {
  list: User[];
  meta: PageMeta;
}

export interface AuditLogListResult {
  list: AuditLog[];
  meta: PageMeta;
}

export interface RoleDetail extends Role {
  description: string | null;
  isBuiltin: boolean;
  permissions: PermissionItem[];
}

export interface PermissionItem {
  id: number;
  code: string;
  name: string;
  module: string;
}

export interface UserCreatePayload {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
  roleIds: number[];
}

export interface UserUpdatePayload {
  email?: string;
  displayName?: string;
  isActive?: boolean;
  roleIds?: number[];
}

export interface AuditLogQuery extends PageQuery {
  username?: string;
  action?: string;
  start?: string;
  end?: string;
}

/* --------------------------------- Common ---------------------------------- */

export interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageResult<T> {
  list: T[];
  meta: PageMeta;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

/* ------------------------------- Data Sources ------------------------------ */

export type DataSourceProtocol = "OPC_UA" | "MODBUS" | "MQTT" | "HTTP";

export type DataSourceStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

export interface DataSource {
  id: number;
  name: string;
  code: string;
  protocol: DataSourceProtocol;
  host: string | null;
  port: number | null;
  config: Record<string, unknown> | null;
  status: DataSourceStatus;
  industry: string;
  collectIntervalMs: number;
  lastCollectedAt: string | null;
  description: string | null;
  pointCount: number;
  createdAt: string;
}

export interface DataPointBrief {
  id: number;
  code: string;
  name: string;
  unit: string | null;
  dataType: string;
  processStage: string | null;
  device: string | null;
}

export interface DataSourceDetail extends DataSource {
  points: DataPointBrief[];
}

export interface DataSourceQuery extends PageQuery {
  industry?: string;
  protocol?: DataSourceProtocol | "";
  status?: DataSourceStatus | "";
}

export interface DataSourcePayload {
  name: string;
  code: string;
  protocol: DataSourceProtocol;
  host?: string;
  port?: number;
  config?: Record<string, unknown> | null;
  industry?: string;
  collectIntervalMs?: number;
  description?: string;
}

export type DataSourceUpdate = Partial<DataSourcePayload> & { status?: DataSourceStatus };

export interface ConnectionTestResult {
  connected: boolean;
  latencyMs: number;
  message: string;
}

/* ------------------------------- Data Imports ------------------------------ */

export type DataImportStatus = "PARSING" | "COMPLETED" | "FAILED";

export type DataImportFileType =
  | "CSV"
  | "EXCEL"
  | "JSON"
  | "XML"
  | "OPCUA_HIST";

export interface DataImport {
  id: number;
  filename: string;
  fileType: DataImportFileType;
  fileSize: number;
  status: DataImportStatus;
  totalRows: number;
  importedRows: number;
  errorMsg: string | null;
  uploadedBy: number | null;
  createdAt: string;
}

export interface DataImportQuery extends PageQuery {
  status?: DataImportStatus | "";
}

export interface DataImportPreview {
  columns: string[];
  rows: unknown[][];
  total: number;
}

/* -------------------------------- Data Points ------------------------------ */

export type DataPointType = "NUMBER" | "STRING" | "BOOLEAN";

export interface DataPoint {
  id: number;
  sourceId: number;
  code: string;
  name: string;
  unit: string | null;
  dataType: string;
  tags: string[] | null;
  industry: string;
  processStage: string | null;
  device: string | null;
  genBase: number;
  genAmplitude: number;
  genPeriodS: number;
  genNoise: number;
  description: string | null;
}

export interface DataPointQuery extends PageQuery {
  sourceId?: number;
}

export interface DataPointPayload {
  sourceId: number;
  code: string;
  name: string;
  unit?: string;
  dataType?: DataPointType;
  tags?: string[];
  industry?: string;
  processStage?: string;
  device?: string;
  description?: string;
}

/* ------------------------------- Time Series ------------------------------- */

export type Aggregation = "NONE" | "AVG" | "MAX" | "MIN" | "SUM";

/** Time bucket for aggregation, e.g. "1 minute","5 minute","1 hour","1 day". */
export type TimeBucket =
  | "minute"
  | "5 minute"
  | "hour"
  | "1 hour"
  | "day"
  | "1 day";

export interface QueryPayload {
  pointIds: number[];
  start: string;
  end: string;
  interval?: TimeBucket;
  agg?: Aggregation;
}

export interface TimeSeriesPoint {
  t: string;
  v: number | null;
}

export interface TimeSeriesResult {
  pointId: number;
  series: TimeSeriesPoint[];
}

export type DataQuality = "GOOD" | "BAD" | "MISSING";

export interface LatestValue {
  pointId: number;
  value: number | null;
  timestamp: string | null;
  quality: DataQuality;
}

/* ------------------------------- Dimensions -------------------------------- */

export interface Dimensions {
  industry: string[];
  processStage: string[];
  device: string[];
  dataType: string[];
}

/* ------------------------------ Data Quality ------------------------------- */

export interface QualityOverviewItem {
  sourceId: number;
  sourceName: string;
  industry: string;
  accessRate: number;
  completenessRate: number;
  anomalyRate: number;
  pointCount: number;
}

export interface QualityTrendPoint {
  recordedAt: string;
  accessRate: number;
  completenessRate: number;
  anomalyRate: number;
}

export interface QualityHeatmapCell {
  pointId: number;
  pointName: string;
  hour: number;
  rate: number;
}

/* -------------------------------- Dashboard -------------------------------- */

export interface DashboardDistItem {
  name: string;
  value: number;
}

export interface DashboardActivityItem {
  id: number;
  username: string | null;
  action: string;
  detail: string | null;
  createdAt: string | null;
}

export interface CarbonKpi {
  totalEmissions: number;
  totalReduction: number;
  totalEnergy: number;
  emissionIntensity: number;
  reductionRate: number;
  emissionsTrend: { date: string; value: number }[];
}

export interface AlarmSummary {
  total: number;
  active: number;
  acked: number;
  resolved: number;
  byLevel: { CRITICAL: number; WARN: number; INFO: number };
  byCategory: { DATA: number; MODEL: number; CONTROL: number; SYSTEM: number };
}

export interface DashboardOverview {
  dataSourceCount: number;
  pointCount: number;
  onlineSourceCount: number;
  modelOnlineCount: number;
  modelTotalCount: number;
  modelCallCount: number;
  scenarioCount: number;
  scenarioActive: number;
  industryDist: DashboardDistItem[];
  statusDist: DashboardDistItem[];
  avgAccessRate: number;
  avgCompletenessRate: number;
  avgAnomalyRate: number;
  carbonKpi: CarbonKpi;
  alarmSummary: AlarmSummary;
  recentActivity: DashboardActivityItem[];
}

/* ------------------------------ Model Library ------------------------------ */

export type ModelFunctionType =
  | "OPTIMIZATION"
  | "PREDICTION"
  | "CLASSIFICATION"
  | "CARBON_ACCOUNTING"
  | "PROCESS_MODELING"
  | "PROCESS_CONTROL"
  | "CARBON_MONITORING"
  | "DATA_PERCEPTION"
  | "AUXILIARY";

export type ModelStatus = "DEVELOPING" | "TESTING" | "ONLINE" | "OFFLINE";

export type ModelStage = "NONE" | "STAGING" | "PRODUCTION" | "ARCHIVED";

export type VersionStatus = "DEVELOPING" | "TESTING" | "ONLINE" | "OFFLINE";

export interface ModelVersionBrief {
  id: number;
  modelId: number;
  versionNo: string;
  entryFunction: string;
  isCurrent: boolean;
  status: VersionStatus;
  stage: ModelStage;
  changelog: string | null;
  createdAt: string;
}

export interface ModelVersionDetail {
  id: number;
  modelId: number;
  versionNo: string;
  entryFunction: string;
  isCurrent: boolean;
  status: VersionStatus;
  stage: ModelStage;
  changelog: string | null;
  sourceCode: string | null;
  pythonVersion: string | null;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  dependencies: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  createdAt: string;
}

export interface ModelRegistry {
  id: number;
  name: string;
  code: string;
  industry: string;
  functionType: ModelFunctionType;
  processStage: string | null;
  description: string | null;
  tags: string[] | null;
  status: ModelStatus;
  callCount: number;
  accuracy: number;
  ownerId: number | null;
  provider: string | null;
  modelCard: Record<string, unknown> | null;
  versionCount: number;
  latestVersion: string | null;
  createdAt: string;
}

export interface ModelRegistryDetail extends ModelRegistry {
  versions: ModelVersionBrief[];
}

export interface ModelRegistryCreatePayload {
  name: string;
  code: string;
  industry?: string;
  functionType: ModelFunctionType;
  processStage?: string;
  description?: string;
  tags?: string[];
  provider?: string;
}

export interface ModelRegistryUpdatePayload {
  name?: string;
  industry?: string;
  functionType?: ModelFunctionType;
  processStage?: string;
  description?: string;
  tags?: string[];
  status?: ModelStatus;
  accuracy?: number;
  provider?: string;
}

export interface ModelVersionCreatePayload {
  versionNo: string;
  entryFunction?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  changelog?: string;
  isCurrent?: boolean;
  sourceCode?: string;
  pythonVersion?: string;
}

export interface ModelInvokePayload {
  input: Record<string, unknown>;
  versionId?: number;
}

export interface ModelInvokeResult {
  modelId: number;
  versionId: number | null;
  output: Record<string, unknown>;
  latencyMs: number;
  status: string;
}

export interface ModelCall {
  id: number;
  modelId: number;
  versionId: number | null;
  callerId: number | null;
  latencyMs: number;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  createdAt: string;
}

export interface TestRunPayload {
  sourceCode?: string;
  input: Record<string, unknown>;
}

export interface TestRunResult {
  success: boolean;
  output: Record<string, unknown> | null;
  error: string | null;
  latencyMs: number;
  stdout: string | null;
}

export interface FacetBucket {
  value: string;
  label: string;
  count: number;
}

export interface ModelFacets {
  industry: FacetBucket[];
  functionType: FacetBucket[];
  status: FacetBucket[];
  provider: FacetBucket[];
  processStage: FacetBucket[];
}

export interface ModelQuery extends PageQuery {
  industry?: string;
  functionType?: string;
  status?: string;
  provider?: string;
  processStage?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/* -------------------------------- Scenarios -------------------------------- */

export type ScenarioStatus = "ACTIVE" | "INACTIVE" | "TEMPLATE";

export interface Scenario {
  id: number;
  code: string;
  name: string;
  industry: string;
  description: string | null;
  config: Record<string, unknown> | null;
  status: ScenarioStatus;
  icon: string | null;
  ownerId: number | null;
  createdAt: string;
}

export interface ScenarioCreatePayload {
  code: string;
  name: string;
  industry?: string;
  description?: string;
  config?: Record<string, unknown>;
  icon?: string;
}

export type ScenarioUpdatePayload = Partial<Omit<ScenarioCreatePayload, "code">> & {
  status?: ScenarioStatus;
};

export interface ScenarioQuery extends PageQuery {
  industry?: string;
  status?: ScenarioStatus | "";
}

/* --------------------------------- Alarms ---------------------------------- */

export type AlarmLevel = "INFO" | "WARN" | "CRITICAL";
export type AlarmCategory = "DATA" | "MODEL" | "CONTROL" | "SYSTEM";
export type AlarmStatus = "ACTIVE" | "ACK" | "RESOLVED";

export interface Alarm {
  id: number;
  level: AlarmLevel;
  category: AlarmCategory;
  sourceType: string | null;
  sourceId: number | null;
  title: string;
  content: string | null;
  status: AlarmStatus;
  ackedBy: number | null;
  ackedAt: string | null;
  createdAt: string;
}

export interface AlarmQuery extends PageQuery {
  level?: AlarmLevel | "";
  category?: AlarmCategory | "";
  status?: AlarmStatus | "";
  sourceType?: string;
}

/* ------------------------------ Form Configs ------------------------------- */

export type FormConfigStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface FormConfig {
  id: number;
  code: string;
  name: string;
  industry: string;
  scenario: string | null;
  description: string | null;
  pageConfig: Record<string, unknown> | null;
  status: FormConfigStatus;
  versionNo: string;
  createdBy: number | null;
  createdAt: string;
}

export interface FormConfigDetail extends FormConfig {}

export interface FormConfigCreatePayload {
  code: string;
  name: string;
  industry?: string;
  scenario?: string;
  description?: string;
  pageConfig?: Record<string, unknown>;
}

export type FormConfigUpdatePayload = Partial<Omit<FormConfigCreatePayload, "code">> & {
  status?: FormConfigStatus;
};

export interface FormConfigQuery extends PageQuery {
  industry?: string;
  status?: FormConfigStatus | "";
}

/* -------------------------------- WebSocket -------------------------------- */

export interface RealtimeFrame {
  type: "point";
  pointId: number;
  timestamp: string;
  value: number | null;
  quality: DataQuality;
}

// ===================== 数据基座 · 元模型 =====================

/** 四类元模型 */
export type MetamodelType = "MECHANISM" | "DATA_MODEL" | "ALGORITHM" | "KNOWLEDGE_RULE";

/** 核心关系式（结构与核心关系节） */
export interface MetamodelRelation {
  id: string;
  expression: string;
  note?: string | null;
}

/** 变量与参数定义（第四节的行） */
export interface MetamodelIoParam {
  category: string; // 输入 / 参数 / 输出传参 / 输出
  symbol: string;
  dtype: string;
  dim?: string;
  unit?: string;
  rangeRequired?: string;
  exampleDefault?: string;
  sourceMeaning?: string;
}

/** 元模型（按《元模型交付模板》8 节结构） */
export interface Metamodel {
  id: number;
  metaCode: string;
  modelType: MetamodelType;
  name: string;
  domain?: string | null;
  hierarchy?: string | null;
  purpose?: string | null;
  methodStructure?: string | null;
  versionNo: string;
  maturity?: string | null;
  keywords?: string[] | null;
  scopeObject?: string | null;
  sourceOwnership?: string | null;
  authorMaintainer?: string | null;
  namingRule?: string | null;
  sceneDomain?: string | null;
  assumptions?: string | null;
  limitsPrecision?: string | null;
  structureFlow?: string[] | null;
  coreRelations?: MetamodelRelation[] | null;
  ioParams?: MetamodelIoParam[] | null;
  methodFlow?: string | null;
  entryInterface?: string | null;
  exceptionBehavior?: string | null;
  envMaterials?: string | null;
  sourceManifest?: string | null;
  deliveryRepro?: string | null;
  deployCombination?: string | null;
  validationBaseline?: string | null;
  validationLimits?: string | null;
  status: ModelStatus;
  industry: string;
  processStage?: string | null;
  tags?: string[] | null;
  provider?: string | null;
  callCount: number;
  accuracy?: number | null;
  legacyModelId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetamodelDetail extends Metamodel {
  versions?: MetamodelVersion[];
}

export interface MetamodelVersion {
  id: number;
  metamodelId: number;
  versionNo: string;
  changelog?: string | null;
  snapshot?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface MetamodelQuery extends PageQuery {
  modelType?: string;
  industry?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface MetamodelFacets {
  modelType: FacetBucket[];
  industry: FacetBucket[];
  status: FacetBucket[];
}

/** 元模型录入/编辑载荷（camelCase 直传后端） */
export interface MetamodelPayload extends Partial<Metamodel> {
  initialChangelog?: string;
}

// ===================== 元模型平台 · 知识图谱 =====================

export interface KgNode {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  properties?: Record<string, unknown> | null;
  sourceType: "manual" | "ai" | "migration" | "derived";
  sourceText?: string | null;
  sourceLocation?: string | null;
  refType?: string | null;
  refId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface KgEdge {
  id: number;
  sourceNodeId: number;
  targetNodeId: number;
  relationType: string;
  weight: number;
}

export interface KgGraph {
  nodes: KgNode[];
  edges: KgEdge[];
}

export interface KgLink {
  id: number;
  nodeId: number;
  linkType: string;
  linkId: number;
  description?: string | null;
}

export interface KgNodeDetail {
  node: KgNode;
  outgoing: KgEdge[];
  incoming: KgEdge[];
  neighbors: KgNode[];
  links: KgLink[];
}

export interface KgCategory {
  value: string;
  count: number;
}

export interface KgPathResult {
  found: boolean;
  nodes: KgNode[];
  edges: KgEdge[];
}

export interface KgExtractResult {
  nodesCreated: number;
  edgesCreated: number;
  nodes: KgNode[];
  edges: KgEdge[];
}

export interface KgNodeCreatePayload {
  name: string;
  category: string;
  description?: string;
  sourceText?: string;
}
