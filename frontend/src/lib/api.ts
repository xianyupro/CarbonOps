/**
 * CarbonOps API client.
 *
 * - Base URL from `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000/api/v1`).
 * - Attaches `Authorization: Bearer <accessToken>` from the auth store.
 * - Unwraps the `{ code, msg, data }` envelope and returns `data`.
 * - On 401, performs a single refresh attempt using the refresh token, then
 *   retries the original request. If refresh fails, tokens are cleared and an
 *   error is thrown so the shell layout can redirect to /login.
 */
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/auth";
import type {
  Aggregation,
  AuditLogListResult,
  AuditLogQuery,
  ConnectionTestResult,
  DashboardOverview,
  DataImport,
  DataImportPreview,
  DataImportQuery,
  DataPoint,
  DataPointPayload,
  DataPointQuery,
  DataSource,
  DataSourceDetail,
  DataSourcePayload,
  DataSourceQuery,
  DataSourceUpdate,
  Dimensions,
  LatestValue,
  PageResult,
  PermissionItem,
  QualityHeatmapCell,
  QualityOverviewItem,
  QualityTrendPoint,
  QueryPayload,
  RefreshResult,
  RoleDetail,
  LoginResult,
  ModelCall,
  ModelInvokePayload,
  ModelInvokeResult,
  ModelQuery,
  ModelRegistry,
  ModelRegistryCreatePayload,
  ModelRegistryDetail,
  ModelRegistryUpdatePayload,
  ModelVersionBrief,
  ModelVersionCreatePayload,
  ModelVersionDetail,
  ModelFacets,
  TestRunPayload,
  TestRunResult,
  Metamodel,
  MetamodelDetail,
  MetamodelFacets,
  MetamodelPayload,
  MetamodelQuery,
  MetamodelVersion,
  KgCategory,
  KgEdge,
  KgGraph,
  KgNode,
  KgNodeCreatePayload,
  KgNodeDetail,
  KgPathResult,
  ComponentDef,
  ComponentRegistry,
  FlowGraph,
  FlowProject,
  FlowRun,
  MetamodelOption,
  Alarm,
  AlarmQuery,
  FormConfig,
  FormConfigCreatePayload,
  FormConfigDetail,
  FormConfigQuery,
  FormConfigUpdatePayload,
  Scenario,
  ScenarioCreatePayload,
  ScenarioQuery,
  ScenarioUpdatePayload,
  TimeSeriesResult,
  User,
  UserCreatePayload,
  UserListResult,
  UserUpdatePayload,
} from "@/types/api";

/**
 * Resolve an API / WebSocket base URL that works equally in:
 *  - local dev (NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1)
 *  - production behind a reverse proxy (NEXT_PUBLIC_API_BASE=/api/v1)
 *  - docker / IP-only deployments
 *
 * Both `BASE_URL` and `WS_BASE` are exported as functions rather than values
 * so they can re-resolve against the current `window.location`. Call them at
 * the actual moment of a request rather than relying on a module-level value.
 */
function resolveApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";
  if (raw.startsWith("/")) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${raw}`;
    }
    // SSR fallback — must be absolute for `new URL()`. Use a host that won't
    // make outbound requests during SSR (buildUrl is only called from React
    // Query hooks that run client-side, but keep this safe).
    return `http://localhost${raw}`;
  }
  return raw;
}

function resolveWsBase(): string {
  const raw = process.env.NEXT_PUBLIC_WS_BASE;
  if (raw && raw.trim() !== "") {
    if (raw.startsWith("/")) {
      if (typeof window !== "undefined") {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${proto}//${window.location.host}${raw}`;
      }
      return `ws://localhost${raw}`;
    }
    return raw;
  }
  // No WS base configured — derive from API base. "/api/v1" → "/ws",
  // "http://host:port/api/v1" → "ws://host:port/ws".
  const api = resolveApiBase();
  if (api.startsWith("/")) {
    if (typeof window !== "undefined") {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${window.location.host}/ws`;
    }
    return "ws://localhost/ws";
  }
  try {
    const u = new URL(api);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/ws";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "ws://localhost:8000/ws";
  }
}

/* These call into resolveApiBase / resolveWsBase at call time so the returned
 * string always reflects the current window.location.origin (avoids hydration
 * mismatch when the user deploys behind a reverse proxy / changing host). */
export function apiBaseUrl(): string {
  return resolveApiBase();
}
export function wsBaseUrl(): string {
  return resolveWsBase();
}

/* --------------------------------- Errors --------------------------------- */

export class ApiError extends Error {
  code: number;
  status: number;
  constructor(message: string, code = -1, status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/* --------------------------------- Helpers -------------------------------- */

type Query = object;

function buildUrl(path: string, query?: Query): string {
  // Resolve at call time so the absolute URL tracks window.location.origin
  // even after deployments change. `new URL(...)` requires an absolute base.
  const url = new URL(`${resolveApiBase().replace(/\/$/, "")}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** Send body as FormData (multipart). */
  isForm?: boolean;
  /** Internal flag — skip the refresh-on-401 retry loop. */
  _retried?: boolean;
}

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const url = buildUrl(path, opts.query);
  const headers: Record<string, string> = {};
  if (!opts.isForm && opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body:
        opts.body === undefined
          ? undefined
          : opts.isForm
            ? (opts.body as BodyInit)
            : JSON.stringify(opts.body),
      credentials: "include",
    });
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? err.message : "网络请求失败",
      -1,
      0
    );
  }

  // 401 → attempt a single refresh + retry.
  if (res.status === 401 && !opts._retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(method, path, { ...opts, _retried: true });
    }
    clearTokens();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login?from=" + encodeURIComponent(window.location.pathname);
    }
    throw new ApiError("登录已过期，请重新登录", 401, 401);
  }

  // Parse envelope. 5xx → throw.
  if (res.status >= 500) {
    throw new ApiError(`服务暂不可用 (${res.status})`, -1, res.status);
  }

  let payload: { code?: number; msg?: string; data?: T } | null = null;
  try {
    payload = (await res.json()) as { code?: number; msg?: string; data?: T };
  } catch {
    throw new ApiError("响应解析失败", -1, res.status);
  }

  if (!payload || typeof payload.code !== "number") {
    throw new ApiError("响应格式异常", -1, res.status);
  }
  if (payload.code !== 0) {
    throw new ApiError(payload.msg || "请求失败", payload.code, res.status);
  }
  return payload.data as T;
}

/* ------------------------------- Refresh flow ------------------------------ */

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(buildUrl("/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const json = (await res.json()) as { code: number; data: RefreshResult };
        if (json.code !== 0 || !json.data?.accessToken) return false;
        setTokens({
          accessToken: json.data.accessToken,
          refreshToken,
          expiresIn: json.data.expiresIn,
        });
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

/* --------------------------------- Clients -------------------------------- */

export const api = {
  auth: {
    login: (body: { username: string; password: string }) =>
      request<LoginResult>("POST", "/auth/login", { body }),
    logout: () => request<void>("POST", "/auth/logout"),
    me: () => request<User>("GET", "/auth/me"),
    refresh: (refreshToken: string) =>
      request<RefreshResult>("POST", "/auth/refresh", { body: { refreshToken } }),
  },

  users: {
    list: (params?: { page?: number; pageSize?: number; keyword?: string }) =>
      request<UserListResult>("GET", "/users", { query: params }),
    get: (id: number) =>
      request<User>("GET", `/users/${id}`),
    create: (body: UserCreatePayload) =>
      request<User>("POST", "/users", { body }),
    update: (id: number, body: UserUpdatePayload) =>
      request<User>("PUT", `/users/${id}`, { body }),
    delete: (id: number) =>
      request<void>("DELETE", `/users/${id}`),
    resetPassword: (id: number, newPassword: string) =>
      request<void>("POST", `/users/${id}/reset-password`, {
        body: { newPassword },
      }),
    roles: () =>
      request<RoleDetail[]>("GET", "/users/roles"),
    permissions: () =>
      request<PermissionItem[]>("GET", "/users/permissions"),
    auditLogs: (params?: AuditLogQuery) =>
      request<AuditLogListResult>("GET", "/users/audit-logs", { query: params }),
  },

  dataSources: {
    list: (params?: DataSourceQuery) =>
      request<PageResult<DataSource>>("GET", "/data-sources", { query: params }),
    get: (id: number) =>
      request<DataSourceDetail>("GET", `/data-sources/${id}`),
    create: (body: DataSourcePayload) =>
      request<DataSource>("POST", "/data-sources", { body }),
    update: (id: number, body: DataSourceUpdate) =>
      request<DataSource>("PUT", `/data-sources/${id}`, { body }),
    delete: (id: number) =>
      request<void>("DELETE", `/data-sources/${id}`),
    test: (id: number) =>
      request<ConnectionTestResult>("POST", `/data-sources/${id}/test`),
    start: (id: number) =>
      request<DataSource>("POST", `/data-sources/${id}/start`),
    stop: (id: number) =>
      request<DataSource>("POST", `/data-sources/${id}/stop`),
  },

  dataImports: {
    list: (params?: DataImportQuery) =>
      request<PageResult<DataImport>>("GET", "/data-imports", { query: params }),
    upload: (file: File, extra?: Record<string, string>) => {
      const form = new FormData();
      form.append("file", file);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) form.append(k, v);
      }
      return request<DataImport>("POST", "/data-imports/upload", {
        body: form,
        isForm: true,
      });
    },
    get: (id: number) =>
      request<DataImport>("GET", `/data-imports/${id}`),
    preview: (id: number) =>
      request<DataImportPreview>("GET", `/data-imports/${id}/preview`),
    delete: (id: number) =>
      request<void>("DELETE", `/data-imports/${id}`),
  },

  dataPoints: {
    list: (params?: DataPointQuery) =>
      request<PageResult<DataPoint>>("GET", "/data-points", { query: params }),
    create: (body: DataPointPayload) =>
      request<DataPoint>("POST", "/data-points", { body }),
    delete: (id: number) =>
      request<void>("DELETE", `/data-points/${id}`),
  },

  data: {
    query: (body: QueryPayload) =>
      request<TimeSeriesResult[]>("POST", "/data/query", { body }),
    latest: (pointIds: number[]) =>
      request<LatestValue[]>("GET", "/data/latest", {
        query: { point_ids: pointIds.join(",") },
      }),
    dimensions: () =>
      request<Dimensions>("GET", "/data/dimensions"),
  },

  quality: {
    overview: () =>
      request<QualityOverviewItem[]>("GET", "/data-quality/overview"),
    trend: (sourceId: number, hours = 24) =>
      request<QualityTrendPoint[]>("GET", `/data-quality/${sourceId}/trend`, {
        query: { hours },
      }),
    heatmap: (sourceId: number) =>
      request<QualityHeatmapCell[]>("GET", `/data-quality/${sourceId}/heatmap`),
  },

  dashboard: {
    overview: (params?: { industry?: string }) =>
      request<DashboardOverview>("GET", "/dashboard/overview", { query: params }),
  },

  models: {
    list: (params?: ModelQuery) =>
      request<PageResult<ModelRegistry>>("GET", "/models", { query: params }),
    facets: (keyword?: string) =>
      request<ModelFacets>("GET", "/models/facets", {
        query: keyword ? { keyword } : undefined,
      }),
    get: (id: number) =>
      request<ModelRegistryDetail>("GET", `/models/${id}`),
    create: (body: ModelRegistryCreatePayload) =>
      request<ModelRegistry>("POST", "/models", { body }),
    update: (id: number, body: ModelRegistryUpdatePayload) =>
      request<ModelRegistry>("PUT", `/models/${id}`, { body }),
    delete: (id: number) =>
      request<void>("DELETE", `/models/${id}`),
    updateCard: (id: number, modelCard: Record<string, unknown>) =>
      request<{ id: number; modelCard: Record<string, unknown> }>(
        "PUT", `/models/${id}/card`, { body: { modelCard } }
      ),
    versions: (id: number) =>
      request<ModelVersionBrief[]>("GET", `/models/${id}/versions`),
    versionDetail: (modelId: number, versionId: number) =>
      request<ModelVersionDetail>("GET", `/models/${modelId}/versions/${versionId}`),
    createVersion: (id: number, body: ModelVersionCreatePayload) =>
      request<ModelVersionBrief>("POST", `/models/${id}/versions`, { body }),
    activateVersion: (modelId: number, versionId: number) =>
      request<ModelVersionBrief>("POST", `/models/${modelId}/versions/${versionId}/activate`),
    transitionStage: (modelId: number, versionId: number, stage: string) =>
      request<ModelVersionBrief>("POST", `/models/${modelId}/versions/${versionId}/transition`, {
        body: { stage },
      }),
    getSourceCode: (modelId: number, versionId: number) =>
      request<{ sourceCode: string; pythonVersion: string | null; entryFunction: string }>(
        "GET", `/models/${modelId}/versions/${versionId}/source`
      ),
    updateSourceCode: (modelId: number, versionId: number, sourceCode: string, pythonVersion?: string) =>
      request<{ id: number; sourceCode: string; pythonVersion: string | null }>(
        "PUT", `/models/${modelId}/versions/${versionId}/source`,
        { body: { sourceCode, pythonVersion } }
      ),
    testRun: (modelId: number, versionId: number, body: TestRunPayload) =>
      request<TestRunResult>("POST", `/models/${modelId}/versions/${versionId}/test-run`, { body }),
    invoke: (id: number, body: ModelInvokePayload) =>
      request<ModelInvokeResult>("POST", `/models/${id}/invoke`, { body }),
    calls: (id: number, params?: { page?: number; pageSize?: number }) =>
      request<PageResult<ModelCall>>("GET", `/models/${id}/calls`, {
        query: params,
      }),
  },

  metamodels: {
    list: (params?: MetamodelQuery) =>
      request<PageResult<Metamodel>>("GET", "/metamodels", { query: params }),
    facets: () => request<MetamodelFacets>("GET", "/metamodels/facets"),
    get: (id: number) => request<MetamodelDetail>("GET", `/metamodels/${id}`),
    create: (body: MetamodelPayload) =>
      request<Metamodel>("POST", "/metamodels", { body }),
    update: (id: number, body: MetamodelPayload) =>
      request<Metamodel>("PUT", `/metamodels/${id}`, { body }),
    delete: (id: number) => request<void>("DELETE", `/metamodels/${id}`),
    versions: (id: number) =>
      request<MetamodelVersion[]>("GET", `/metamodels/${id}/versions`),
    createVersion: (id: number, body: { versionNo: string; changelog?: string }) =>
      request<MetamodelVersion>("POST", `/metamodels/${id}/versions`, { body }),
    importJson: (metamodels: Record<string, unknown>[]) =>
      request<{ created: number; updated: number }>("POST", "/metamodels/import", {
        body: { metamodels },
      }),
    /** 导出（返回 Blob，由调用方触发下载） */
    exportUrl: (format: "json" | "excel", modelType?: string) => {
      const qs = new URLSearchParams({ format });
      if (modelType) qs.set("modelType", modelType);
      return `${buildUrl("/metamodels/export")}?${qs.toString()}`;
    },
  },

  kg: {
    graph: () => request<KgGraph>("GET", "/kg/graph"),
    categories: () => request<KgCategory[]>("GET", "/kg/categories"),
    search: (q: string) => request<KgNode[]>("GET", "/kg/search", { query: { q } }),
    nodeDetail: (id: number) => request<KgNodeDetail>("GET", `/kg/node/${id}/detail`),
    createNode: (body: KgNodeCreatePayload) => request<KgNode>("POST", "/kg/nodes", { body }),
    updateNode: (id: number, body: Partial<KgNodeCreatePayload>) =>
      request<KgNode>("PUT", `/kg/nodes/${id}`, { body }),
    deleteNode: (id: number) => request<void>("DELETE", `/kg/nodes/${id}`),
    createEdge: (body: { sourceNodeId: number; targetNodeId: number; relationType: string; weight?: number }) =>
      request<KgEdge>("POST", "/kg/edges", { body }),
    deleteEdge: (id: number) => request<void>("DELETE", `/kg/edges/${id}`),
    path: (source: number, target: number) =>
      request<KgPathResult>("GET", "/kg/path", { query: { source, target } }),
    aiStatus: () =>
      request<{ available: boolean; model: string }>("GET", "/kg/ai/status"),
    extract: (text: string) =>
      request<{ nodesCreated: number; edgesCreated: number }>("POST", "/kg/extract", {
        body: { text },
      }),
  },

  flows: {
    components: () => request<ComponentRegistry>("GET", "/flows/components"),
    metamodelOptions: () => request<MetamodelOption[]>("GET", "/flows/components/metamodel-options"),
    list: () => request<FlowProject[]>("GET", "/flows"),
    get: (id: number) => request<FlowProject>("GET", `/flows/${id}`),
    create: (body: { name: string; description?: string; graph?: FlowGraph }) =>
      request<FlowProject>("POST", "/flows", { body }),
    update: (
      id: number,
      body: { name?: string; description?: string; graph?: FlowGraph; status?: string }
    ) => request<FlowProject>("PUT", `/flows/${id}`, { body }),
    delete: (id: number) => request<void>("DELETE", `/flows/${id}`),
    run: (id: number) =>
      request<FlowRun>("POST", `/flows/${id}/run`, { body: { mode: "once" } }),
    runs: (id: number) => request<FlowRun[]>("GET", `/flows/${id}/runs`),
  },

  scenarios: {
    list: (params?: ScenarioQuery) =>
      request<PageResult<Scenario>>("GET", "/scenarios", { query: params }),
    get: (id: number) =>
      request<Scenario>("GET", `/scenarios/${id}`),
    create: (body: ScenarioCreatePayload) =>
      request<Scenario>("POST", "/scenarios", { body }),
    update: (id: number, body: ScenarioUpdatePayload) =>
      request<Scenario>("PUT", `/scenarios/${id}`, { body }),
    delete: (id: number) =>
      request<void>("DELETE", `/scenarios/${id}`),
  },

  alarms: {
    list: (params?: AlarmQuery) =>
      request<PageResult<Alarm>>("GET", "/alarms", { query: params }),
    get: (id: number) =>
      request<Alarm>("GET", `/alarms/${id}`),
    ack: (id: number) =>
      request<Alarm>("POST", `/alarms/${id}/ack`),
    resolve: (id: number) =>
      request<Alarm>("POST", `/alarms/${id}/resolve`),
  },

  forms: {
    list: (params?: FormConfigQuery) =>
      request<PageResult<FormConfig>>("GET", "/forms", { query: params }),
    get: (id: number) =>
      request<FormConfigDetail>("GET", `/forms/${id}`),
    create: (body: FormConfigCreatePayload) =>
      request<FormConfig>("POST", "/forms", { body }),
    update: (id: number, body: FormConfigUpdatePayload) =>
      request<FormConfig>("PUT", `/forms/${id}`, { body }),
    delete: (id: number) =>
      request<void>("DELETE", `/forms/${id}`),
    publish: (id: number) =>
      request<FormConfig>("POST", `/forms/${id}/publish`),
  },
};

/* ------------------------------- Realtime WS ------------------------------- */

/**
 * Build a WebSocket URL for streaming realtime point values.
 * The token is forwarded as a query param so the backend can authenticate the
 * upgrade handshake.
 */
export function realtimeWsUrl(pointIds: number[]): string {
  const url = new URL(resolveWsBase());
  url.pathname = `${url.pathname.replace(/\/$/, "")}/realtime`;
  const token = getAccessToken();
  if (token) url.searchParams.set("token", token);
  url.searchParams.set("point_ids", pointIds.join(","));
  return url.toString();
}

export type { Aggregation };
