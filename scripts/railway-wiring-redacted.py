#!/usr/bin/env python3
"""Read-only Railway wiring receipt; never emit variable values or raw errors."""
import json
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

PROJECT = "c1c17660-3110-4fa8-a0bd-aca06d13a3ed"
ENVIRONMENT = "dd8e0541-0e1d-478d-bec1-1f6bb7be1e2d"
SERVICES = {
    "api": "13efc131-9ae3-4305-9628-55c783286990",
    "dashboard": "275c6d17-fb2a-4768-aa6a-489fa95bacc1",
    "postgres": "e9448ee8-7c8e-4311-8f0c-d935930dd99b",
    "redis": "22ca3ef4-ffb2-4b91-bb18-51b5ea9c5c29",
}


def query_data(query):
    proc = subprocess.run(["npx", "--yes", "@railway/cli", "api", "--compact"], input=query, capture_output=True, text=True, timeout=45)
    if proc.returncode:
        raise ValueError("query failed")
    response = json.loads(proc.stdout)
    if response.get("errors"):
        raise ValueError("API error")
    return response.get("data", response)


def catalog():
    # Secret-bearing responses are captured ONLY in this process; never printed.
    query = 'query { '
    for role in ("api", "postgres"):
        query += role + ': variables(projectId: "' + PROJECT + '", environmentId: "' + ENVIRONMENT + '", serviceId: "' + SERVICES[role] + '", unrendered: false) '
    data = query_data(query + '}')
    internal_api = urlsplit(data["api"]["DATABASE_URL"])
    internal_pg = urlsplit(data["postgres"]["DATABASE_URL"])
    public_pg = urlsplit(data["postgres"]["DATABASE_PUBLIC_URL"])
    identity = lambda url: (url.hostname, url.port or 5432, unquote(url.path), unquote(url.username or ""))
    if identity(internal_api) != identity(internal_pg):
        raise ValueError("database wiring mismatch")
    if (public_pg.scheme not in ("postgres", "postgresql") or not public_pg.hostname
            or not public_pg.hostname.endswith(".proxy.rlwy.net") or not public_pg.port
            or unquote(public_pg.path) != unquote(internal_pg.path)
            or public_pg.username != internal_pg.username):
        raise ValueError("unverified public database target")
    root = "/home/daniel/projects/projectTixmo/worktrees/task-57/.local-runtime-57/root"
    env = {"PATH": "/usr/bin:/bin", "LD_LIBRARY_PATH": root + "/usr/lib/x86_64-linux-gnu",
           "PGHOST": public_pg.hostname, "PGPORT": str(public_pg.port),
           "PGDATABASE": unquote(public_pg.path.lstrip("/")), "PGUSER": unquote(public_pg.username or ""),
           "PGPASSWORD": unquote(public_pg.password or ""), "PGSSLMODE": "require", "PGCONNECT_TIMEOUT": "5"}
    # Explicitly reviewed metadata-only read: no logs column or application rows.
    sql = """BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SELECT json_build_object('serverVersion', current_setting('server_version'),
 'databaseSizeBytes', pg_database_size(current_database()),
 'migrations', (SELECT coalesce(json_agg(m ORDER BY migration_name), '[]'::json)
 FROM (SELECT migration_name, checksum, started_at, finished_at, rolled_back_at,
 applied_steps_count FROM _prisma_migrations ORDER BY migration_name LIMIT 500) m));
ROLLBACK;
"""
    proc = subprocess.run([root + "/usr/lib/postgresql/18/bin/psql", "-X", "-w", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
                          input=sql, capture_output=True, text=True, env=env, timeout=25)
    if proc.returncode:
        print(json.dumps({"status": "catalog_connection_or_query_failed", "exitCode": proc.returncode,
                          "raw_errors_suppressed": True, "retried": False}))
        return
    result = json.loads(proc.stdout)
    if set(result) != {"serverVersion", "databaseSizeBytes", "migrations"}:
        raise ValueError("unexpected catalog result")
    fields = {"migration_name", "checksum", "started_at", "finished_at", "rolled_back_at", "applied_steps_count"}
    for row in result["migrations"]:
        if set(row) != fields or not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", row["migration_name"]) or not re.fullmatch(r"[a-f0-9]{64}", row["checksum"]):
            raise ValueError("catalog output rejected")
    result.update({"apiPostgresWiringMatch": True, "targetServiceId": SERVICES["postgres"]})
    print(json.dumps(result, indent=2))


def receipt(data):
    names = {e["node"]["name"]: e["node"]["id"] for e in data["project"]["services"]["edges"]}
    if not set(SERVICES.values()).issubset(set(names.values())):
        raise ValueError("target mismatch")
    result = {"projectId": PROJECT, "environmentId": ENVIRONMENT, "variables": []}
    keys = {
        "api": ("DATABASE_URL", "REDIS_URL"),
        "dashboard": ("VITE_API_URL", "VITE_API_BASE_URL", "REACT_APP_API_URL"),
    }
    for role, selected in keys.items():
        variables = data[role]
        if not isinstance(variables, dict):
            raise ValueError("invalid response")
        for key in selected:
            value = variables.get(key)
            refs = re.findall(r"\$\{\{([^{}]+)\}\}", value) if isinstance(value, str) else []
            ids = sorted({names[ref.rsplit(".", 1)[0]] for ref in refs if ref.rsplit(".", 1)[0] in names})
            expected = SERVICES["postgres"] if key == "DATABASE_URL" else SERVICES["redis"] if key == "REDIS_URL" else SERVICES["api"]
            result["variables"].append({"serviceId": SERVICES[role], "key": key, "present": value is not None,
                "referencedServiceIds": ids, "expectedServiceReference": expected in ids,
                "allReferencesResolved": bool(refs) and len(refs) == sum(ref.rsplit(".", 1)[0] in names for ref in refs)})
    return result


def main():
    if sys.argv[1:] == ["--self-test"]:
        names = [{"node": {"name": role, "id": sid}} for role, sid in SERVICES.items()]
        data = {"project": {"services": {"edges": names}}, "api": {"DATABASE_URL": "${{postgres.DATABASE_URL}}", "REDIS_URL": "DO_NOT_EMIT_SECRET"}, "dashboard": {}}
        out = json.dumps(receipt(data))
        assert "DO_NOT_EMIT_SECRET" not in out
        assert receipt(data)["variables"][0]["expectedServiceReference"] is True
        assert receipt(data)["variables"][1]["expectedServiceReference"] is False
        data["project"]["services"]["edges"] = []
        try:
            receipt(data)
        except ValueError:
            pass
        else:
            raise AssertionError("target mismatch accepted")
        print("PASS: redaction, reference mapping, literal rejection, target mismatch")
        return
    if sys.argv[1:] == ["--catalog"]:
        catalog()
        return
    if sys.argv[1:] != ["--read-only"]:
        raise ValueError("explicit read-only mode required")
    query = 'query { project(id: "' + PROJECT + '") { services { edges { node { id name } } } } '
    for role in ("api", "dashboard"):
        query += role + ': variables(projectId: "' + PROJECT + '", environmentId: "' + ENVIRONMENT + '", serviceId: "' + SERVICES[role] + '", unrendered: true) '
    query += '}'
    print(json.dumps(receipt(query_data(query)), indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print('{"status":"failed_closed","raw_errors_suppressed":true}')
        sys.exit(1)
