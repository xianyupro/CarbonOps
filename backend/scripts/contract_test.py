"""End-to-end smoke test for M2 frontend-backend contract.

Verifies that the response shapes from the FastAPI backend match what the
TypeScript types in `frontend/src/types/api.ts` expect. Run after both
backend (port 8000) and the dev server (port 3000) are up.
"""
from __future__ import annotations

import json
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8000/api/v1"
ADMIN = ("admin", "admin123")
ENGINEER = ("engineer", "engineer123")
VIEWER = ("viewer", "viewer123")


def post(path: str, body: dict | None = None, token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, headers=headers, method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def get(path: str, token: str | None = None) -> dict:
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def expect(label: str, ok: bool, detail: str = "") -> bool:
    mark = "OK  " if ok else "FAIL"
    print(f"[{mark}] {label}{(' — ' + detail) if detail else ''}")
    return ok


def main() -> int:
    failures = 0

    # --- 1. Login admin ---
    try:
        r = post("/auth/login", {"username": ADMIN[0], "password": ADMIN[1]})
        if not expect("auth/login admin returns code 0", r.get("code") == 0):
            failures += 1
            return failures
        token = r["data"]["accessToken"]
        user = r["data"]["user"]
        failures += not expect(
            "user has permissions[]",
            isinstance(user.get("permissions"), list) and len(user["permissions"]) > 0,
            f"{len(user.get('permissions', []))} perms",
        )
        failures += not expect(
            "user.displayName exists", "displayName" in user and user["displayName"],
            str(user.get("displayName")),
        )
    except Exception as e:
        failures += 1
        print(f"[FAIL] auth/login raised: {e}")
        return failures

    # --- 2. Dashboard overview (enhanced) ---
    try:
        r = get("/dashboard/overview", token)
        d = r["data"]
        failures += not expect(
            "dashboard/overview has base 5 fields",
            all(
                k in d
                for k in (
                    "dataSourceCount",
                    "pointCount",
                    "onlineSourceCount",
                    "modelOnlineCount",
                    "scenarioCount",
                )
            ),
            f"keys={list(d.keys())}",
        )
        failures += not expect(
            "dashboard/overview has enhanced fields",
            all(
                k in d
                for k in (
                    "modelTotalCount",
                    "industryDist",
                    "statusDist",
                    "avgAccessRate",
                    "avgCompletenessRate",
                    "avgAnomalyRate",
                    "recentActivity",
                )
            ),
            f"missing={[k for k in ('modelTotalCount','industryDist','statusDist','avgAccessRate','avgCompletenessRate','avgAnomalyRate','recentActivity') if k not in d]}",
        )
        failures += not expect(
            "dashboard/overview NO carbonReductionKg",
            "carbonReductionKg" not in d,
        )
        failures += not expect(
            "dashboard industryDist is list",
            isinstance(d.get("industryDist"), list),
        )
        failures += not expect(
            "dashboard recentActivity is list",
            isinstance(d.get("recentActivity"), list),
        )
    except Exception as e:
        failures += 1
        print(f"[FAIL] dashboard/overview raised: {e}")

    # --- 3. Data sources list ---
    try:
        r = get("/data-sources?page=1&pageSize=20", token)
        d = r["data"]
        failures += not expect(
            "data-sources uses {list, meta} shape",
            isinstance(d.get("list"), list) and isinstance(d.get("meta"), dict),
        )
        if d["list"]:
            src = d["list"][0]
            failures += not expect(
                "DataSource has lastCollectedAt (NOT lastConnectedAt)",
                "lastCollectedAt" in src and "lastConnectedAt" not in src,
            )
            failures += not expect(
                "DataSource has collectIntervalMs (camelCase)",
                "collectIntervalMs" in src,
                f"protocol={src.get('protocol')}",
            )
            failures += not expect(
                "DataSource protocol is one of OPC_UA/MODBUS/MQTT/HTTP",
                src.get("protocol") in {"OPC_UA", "MODBUS", "MQTT", "HTTP"},
                f"got {src.get('protocol')!r}",
            )
            failures += not expect(
                "DataSource status is CONNECTED/DISCONNECTED/ERROR",
                src.get("status") in {"CONNECTED", "DISCONNECTED", "ERROR"},
                f"got {src.get('status')!r}",
            )
            failures += not expect(
                "meta has total but NOT totalPages (backend truth)",
                "total" in d["meta"] and "totalPages" not in d["meta"],
            )
            source_id = src["id"]
        else:
            source_id = None
    except Exception as e:
        failures += 1
        print(f"[FAIL] data-sources raised: {e}")
        source_id = None

    # --- 4. Data source detail ---
    if source_id:
        try:
            r = get(f"/data-sources/{source_id}", token)
            d = r["data"]
            failures += not expect(
                "data-source detail has points[]",
                isinstance(d.get("points"), list),
                f"{len(d.get('points', []))} points",
            )
            if d["points"]:
                p = d["points"][0]
                failures += not expect(
                    "DataPointBrief has processStage (camelCase)",
                    "processStage" in p and "process_stage" not in p,
                )
        except Exception as e:
            failures += 1
            print(f"[FAIL] data-source detail raised: {e}")

    # --- 5. Data points ---
    try:
        r = get("/data-points?sourceId=1&page=1&pageSize=10", token)
        d = r["data"]
        failures += not expect(
            "data-points uses sourceId param (camelCase)",
            isinstance(d.get("list"), list),
        )
        if d["list"]:
            p = d["list"][0]
            failures += not expect(
                "DataPoint has genBase/genAmplitude/genPeriodS/genNoise",
                all(
                    k in p
                    for k in ("genBase", "genAmplitude", "genPeriodS", "genNoise")
                ),
            )
            point_id = p["id"]
        else:
            point_id = None
    except Exception as e:
        failures += 1
        print(f"[FAIL] data-points raised: {e}")
        point_id = None

    # --- 6. Data query ---
    if point_id:
        try:
            body = {
                "pointIds": [point_id],
                "start": "2025-01-01T00:00:00",
                "end": "2025-01-02T00:00:00",
                "interval": "1 hour",
                "agg": "AVG",
            }
            r = post("/data/query", body, token)
            d = r["data"]
            failures += not expect(
                "data/query returns SeriesOut[]",
                isinstance(d, list) and (len(d) == 0 or "series" in d[0]),
                f"{len(d)} series",
            )
        except Exception as e:
            failures += 1
            print(f"[FAIL] data/query raised: {e}")

    # --- 7. Data quality overview ---
    try:
        r = get("/data-quality/overview", token)
        d = r["data"]
        failures += not expect(
            "quality/overview returns array (not {list,meta})",
            isinstance(d, list),
        )
        if d:
            item = d[0]
            failures += not expect(
                "QualityOverviewItem has correct camelCase fields",
                all(
                    k in item
                    for k in (
                        "sourceId",
                        "sourceName",
                        "industry",
                        "accessRate",
                        "completenessRate",
                        "anomalyRate",
                        "pointCount",
                    )
                ),
            )
            q_source_id = item["sourceId"]
        else:
            q_source_id = source_id
    except Exception as e:
        failures += 1
        print(f"[FAIL] quality/overview raised: {e}")
        q_source_id = source_id

    if q_source_id:
        try:
            r = get(f"/data-quality/{q_source_id}/trend?hours=24", token)
            d = r["data"]
            failures += not expect(
                "quality/trend returns array",
                isinstance(d, list),
            )
            if d:
                failures += not expect(
                    "QualityTrendPoint has recordedAt camelCase",
                    "recordedAt" in d[0],
                )
        except Exception as e:
            failures += 1
            print(f"[FAIL] quality/trend raised: {e}")

        try:
            r = get(f"/data-quality/{q_source_id}/heatmap", token)
            d = r["data"]
            failures += not expect(
                "quality/heatmap returns array",
                isinstance(d, list),
            )
            if d:
                cell = d[0]
                failures += not expect(
                    "HeatmapCell has pointName/hour/rate",
                    all(k in cell for k in ("pointName", "hour", "rate")),
                )
        except Exception as e:
            failures += 1
            print(f"[FAIL] quality/heatmap raised: {e}")

    # --- 8. Data imports ---
    try:
        r = get("/data-imports?page=1&pageSize=10", token)
        d = r["data"]
        failures += not expect(
            "data-imports uses {list, meta}",
            isinstance(d.get("list"), list),
        )
    except Exception as e:
        failures += 1
        print(f"[FAIL] data-imports raised: {e}")

    # --- 9. RBAC: viewer can't create source ---
    try:
        v_login = post("/auth/login", {"username": VIEWER[0], "password": VIEWER[1]})
        v_token = v_login["data"]["accessToken"]
        v_perms = v_login["data"]["user"]["permissions"]
        failures += not expect(
            "viewer has no data:source:write perm",
            "data:source:write" not in v_perms,
            f"perms={v_perms[:3]}...",
        )
        try:
            post(
                "/data-sources",
                {"name": "T", "code": "TEST_ONLY", "protocol": "HTTP"},
                v_token,
            )
            failures += not expect(
                "viewer create source rejected", False, "did not raise"
            )
        except urllib.error.HTTPError as e:
            failures += not expect(
                "viewer create source rejected with 403",
                e.code == 403,
                f"got {e.code}",
            )
    except Exception as e:
        failures += 1
        print(f"[FAIL] RBAC check raised: {e}")

    # --- 10. Users management (M2 system enhancement) ---
    try:
        r = get("/users?page=1&pageSize=10", token)
        d = r["data"]
        failures += not expect(
            "users list uses {list, meta}",
            isinstance(d.get("list"), list) and isinstance(d.get("meta"), dict),
        )
        if d["list"]:
            u = d["list"][0]
            failures += not expect(
                "User has roles[] (camelCase)",
                isinstance(u.get("roles"), list),
            )
        # roles endpoint
        r = get("/users/roles", token)
        d = r["data"]
        failures += not expect(
            "users/roles returns list",
            isinstance(d, list) and len(d) > 0,
            f"{len(d)} roles",
        )
        if d:
            role = d[0]
            failures += not expect(
                "RoleDetail has permissions[]",
                isinstance(role.get("permissions"), list),
            )
        # permissions endpoint
        r = get("/users/permissions", token)
        d = r["data"]
        failures += not expect(
            "users/permissions returns list",
            isinstance(d, list) and len(d) > 0,
            f"{len(d)} perms",
        )
    except Exception as e:
        failures += 1
        print(f"[FAIL] users management raised: {e}")

    # --- 11. Audit logs ---
    try:
        r = get("/users/audit-logs?page=1&pageSize=5", token)
        d = r["data"]
        failures += not expect(
            "audit-logs uses {list, meta}",
            isinstance(d.get("list"), list) and isinstance(d.get("meta"), dict),
        )
        if d["list"]:
            log = d["list"][0]
            failures += not expect(
                "AuditLog has createdAt camelCase",
                "createdAt" in log,
            )
    except Exception as e:
        failures += 1
        print(f"[FAIL] audit-logs raised: {e}")

    # --- 12. Models library (M3) ---
    model_id = None
    try:
        r = get("/models?page=1&pageSize=20", token)
        d = r["data"]
        failures += not expect(
            "models list uses {list, meta}",
            isinstance(d.get("list"), list) and isinstance(d.get("meta"), dict),
        )
        if d["list"]:
            m = d["list"][0]
            failures += not expect(
                "ModelRegistry has camelCase fields",
                all(
                    k in m
                    for k in (
                        "functionType",
                        "callCount",
                        "ownerId",
                        "versionCount",
                        "latestVersion",
                    )
                ),
                f"keys={list(m.keys())[:8]}",
            )
            failures += not expect(
                "ModelRegistry functionType is valid enum",
                m.get("functionType")
                in {"OPTIMIZATION", "PREDICTION", "CLASSIFICATION", "CARBON_ACCOUNTING"},
                f"got {m.get('functionType')!r}",
            )
            model_id = m["id"]
            # detail
            r = get(f"/models/{model_id}", token)
            md = r["data"]
            failures += not expect(
                "ModelRegistryDetail has versions[]",
                isinstance(md.get("versions"), list),
                f"{len(md.get('versions', []))} versions",
            )
            # versions list endpoint
            r = get(f"/models/{model_id}/versions", token)
            failures += not expect(
                "models/{id}/versions returns list",
                isinstance(r["data"], list),
            )
            # calls endpoint
            r = get(f"/models/{model_id}/calls?page=1&pageSize=5", token)
            cd = r["data"]
            failures += not expect(
                "models/{id}/calls uses {list, meta}",
                isinstance(cd.get("list"), list),
            )
    except Exception as e:
        failures += 1
        print(f"[FAIL] models raised: {e}")

    # --- 13. Model invoke (mock inference) ---
    if model_id:
        try:
            r = post(f"/models/{model_id}/invoke", {"input": {"sample": "test"}}, token)
            d = r["data"]
            failures += not expect(
                "model invoke returns latencyMs/output/status",
                all(k in d for k in ("latencyMs", "output", "status")),
                f"keys={list(d.keys())}",
            )
            failures += not expect(
                "invoke status is SUCCESS",
                d.get("status") == "SUCCESS",
                f"got {d.get('status')!r}",
            )
            failures += not expect(
                "invoke output is dict",
                isinstance(d.get("output"), dict),
            )
        except Exception as e:
            failures += 1
            print(f"[FAIL] model invoke raised: {e}")

    # --- 14. Scenarios (M5) ---
    try:
        r = get("/scenarios?page=1&pageSize=20", token)
        d = r["data"]
        failures += not expect(
            "scenarios list uses {list, meta}",
            isinstance(d.get("list"), list) and isinstance(d.get("meta"), dict),
        )
        if d["list"]:
            s = d["list"][0]
            failures += not expect(
                "Scenario has ownerId camelCase",
                "ownerId" in s and "owner_id" not in s,
            )
            failures += not expect(
                "Scenario status is valid enum",
                s.get("status") in {"ACTIVE", "INACTIVE", "TEMPLATE"},
                f"got {s.get('status')!r}",
            )
            failures += not expect(
                "Scenario has config dict",
                isinstance(s.get("config"), dict) or s.get("config") is None,
            )
    except Exception as e:
        failures += 1
        print(f"[FAIL] scenarios raised: {e}")

    # --- 15. Alarms (M5) ---
    try:
        r = get("/alarms?page=1&pageSize=20", token)
        d = r["data"]
        failures += not expect(
            "alarms list uses {list, meta}",
            isinstance(d.get("list"), list) and isinstance(d.get("meta"), dict),
        )
        if d["list"]:
            a = d["list"][0]
            failures += not expect(
                "Alarm has sourceType/ackedBy camelCase",
                "sourceType" in a and "ackedBy" in a,
            )
            failures += not expect(
                "Alarm level is valid enum",
                a.get("level") in {"INFO", "WARN", "CRITICAL"},
                f"got {a.get('level')!r}",
            )
            failures += not expect(
                "Alarm status is valid enum",
                a.get("status") in {"ACTIVE", "ACK", "RESOLVED"},
                f"got {a.get('status')!r}",
            )
            failures += not expect(
                "Alarm category is valid enum",
                a.get("category") in {"DATA", "MODEL", "CONTROL", "SYSTEM"},
                f"got {a.get('category')!r}",
            )
    except Exception as e:
        failures += 1
        print(f"[FAIL] alarms raised: {e}")

    # --- 16. Forms / Studio (M4) ---
    try:
        r = get("/forms?page=1&pageSize=20", token)
        d = r["data"]
        failures += not expect(
            "forms list uses {list, meta}",
            isinstance(d.get("list"), list) and isinstance(d.get("meta"), dict),
        )
        if d["list"]:
            f = d["list"][0]
            failures += not expect(
                "FormConfig has versionNo/createdBy camelCase",
                "versionNo" in f and "createdBy" in f,
            )
            failures += not expect(
                "FormConfig status is valid enum",
                f.get("status") in {"DRAFT", "PUBLISHED", "ARCHIVED"},
                f"got {f.get('status')!r}",
            )
            # list should NOT include pageConfig (heavy)
            failures += not expect(
                "FormConfig list item omits pageConfig",
                "pageConfig" not in f,
            )
            # detail should include pageConfig
            r = get(f"/forms/{f['id']}", token)
            fd = r["data"]
            failures += not expect(
                "FormConfigDetail includes pageConfig",
                "pageConfig" in fd,
            )
    except Exception as e:
        failures += 1
        print(f"[FAIL] forms raised: {e}")

    # --- 17. orchestration:read permission in viewer (regression) ---
    try:
        v_login = post("/auth/login", {"username": VIEWER[0], "password": VIEWER[1]})
        v_perms = v_login["data"]["user"]["permissions"]
        failures += not expect(
            "viewer has orchestration:read perm",
            "orchestration:read" in v_perms,
            f"perms={v_perms}",
        )
        e_login = post("/auth/login", {"username": ENGINEER[0], "password": ENGINEER[1]})
        e_perms = e_login["data"]["user"]["permissions"]
        failures += not expect(
            "engineer has orchestration:read+write",
            "orchestration:read" in e_perms and "orchestration:write" in e_perms,
        )
        failures += not expect(
            "engineer has scenario:read",
            "scenario:read" in e_perms,
        )
    except Exception as e:
        failures += 1
        print(f"[FAIL] orchestration permission check raised: {e}")

    print()
    print("=" * 60)
    if failures == 0:
        print("ALL CHECKS PASSED")
        return 0
    else:
        print(f"{failures} failure(s)")
        return failures


if __name__ == "__main__":
    sys.exit(main())
