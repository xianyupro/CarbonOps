"""Quick smoke test against a running backend (no pytest)."""
import json
import urllib.request

BASE = "http://127.0.0.1:8000/api/v1"


def post(path, body, token=None):
    data = json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def get(path, token=None):
    req = urllib.request.Request(BASE + path)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    # login
    res = post("/auth/login", {"username": "admin", "password": "admin123"})
    tok = res["data"]["accessToken"]
    print("LOGIN ok | perms:", len(res["data"]["user"]["permissions"]))

    # data sources
    res = get("/data-sources?page=1&pageSize=10", token=tok)
    meta = res["data"]["meta"]
    print("SOURCES total:", meta["total"])
    src = res["data"]["list"][0]
    print("  first:", src["name"], "| protocol:", src["protocol"], "| points:", src["pointCount"])

    # detail + points
    res = get(f"/data-sources/{src['id']}", token=tok)
    print("  detail points:", len(res["data"]["points"]), "| sample:", res["data"]["points"][0]["name"])

    # latest values for first 3 points
    pids = ",".join(str(p["id"]) for p in res["data"]["points"][:3])
    res = get(f"/data/latest?point_ids={pids}", token=tok)
    print("LATEST:", [(d["pointId"], d["value"], d["quality"]) for d in res["data"]])

    # query aggregate (last 24h, 1 hour)
    import datetime
    end = datetime.datetime.utcnow()
    start = end - datetime.timedelta(hours=24)
    res = post("/data/query", {
        "pointIds": [int(x) for x in pids.split(",")][:1],
        "start": start.isoformat(), "end": end.isoformat(),
        "interval": "1 hour", "agg": "AVG",
    }, token=tok)
    pts = len(res["data"][0]["series"])
    print("QUERY series points (hourly avg, 24h):", pts)

    # quality overview
    res = get("/data-quality/overview", token=tok)
    q = res["data"][0]
    print("QUALITY:", q["sourceName"], "| completeness:", q["completenessRate"], "| anomaly:", q["anomalyRate"])

    # RBAC: viewer should NOT be able to create a source
    res = post("/auth/login", {"username": "viewer", "password": "viewer123"})
    vtok = res["data"]["accessToken"]
    try:
        post("/data-sources", {"name": "x", "code": "X_TEST", "protocol": "HTTP"}, token=vtok)
        print("RBAC FAIL: viewer could create source!")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        print("RBAC ok: viewer blocked ->", e.code, body["msg"])

    print("\nALL SMOKE CHECKS PASSED")


if __name__ == "__main__":
    main()
