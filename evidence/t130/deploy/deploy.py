#!/usr/bin/env python3
"""T130: deploy Labs dash only to PR #218 demo/labs-presentation head 8646ae92 (previous T129: a6bb6b59 deploy fcb2408e; rollback point fcb2408e @ a6bb6b59). VITE_APP_LABS_BRANCH re-asserted with skipDeploys.

Do not touch labs-api, staging, or prod.
On FAIL/CRASH/3-min stall: stop, no retry, no auto-restore.
"""
import json, os, subprocess, datetime, time, sys
from pathlib import Path

os.environ["RAILWAY_CALLER"] = "skill:use-railway@1.3.7"
os.environ["RAILWAY_AGENT_SESSION"] = "railway-skill-t130-demo-labs"

P = "8c5a1df6-dc6b-46ca-a516-dc1c25750921"
E = "810da028-c2b7-4874-a0d4-e95242dc2cb1"
A = "c2ae5f88-7b52-4199-928a-c5d9ee8cc15d"
D = "7be6efd7-f821-49a3-a102-d8d19b03e23d"
NEW = "8646ae92015bac1b0f4eda812295eaa8a2ce1e9b"
NEW_BRANCH = "demo/labs-presentation"
PROD = "36121c6d"
STAGING = "d21ebf73"
API_DEPLOY = "d3a657fe-4abf-4a56-9429-766f32ccda25"
API_SHA_PREFIX = "9f2c523"
CURRENT_DASH = "fcb2408e-3cac-4e23-a2fa-9418c4113697"
OUT = Path("/workspace/projectTixmo/evidence/t130/deploy")

SAFE_KEYS = {
    "VITE_APP_LABS_BRANCH",
    "VITE_SOCIAL_COMMAND_CENTER_ENABLED",
    "VITE_SOCIAL_DASHBOARD_ANALYST_VIEWS",
    "VITE_APP_ENV",
    "VITE_API_URL",
}

KNOWN = {
    CURRENT_DASH,
    API_DEPLOY,
    "94c93b99-a81a-43c0-a50e-568b9ba1c18d",
    "8e57f31c-bd04-4e6c-abb9-fc83ef6a4396",
}


def stamp():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S NST")


def log(msg):
    line = f"{stamp()} {msg}"
    print(line, flush=True)
    with (OUT / "deploy.log").open("a") as f:
        f.write(line + "\n")


def g(q, timeout=60):
    r = subprocess.run(["/home/box/.local/bin/railway", "api", q], cwd="/tmp",
                       capture_output=True, text=True, timeout=timeout)
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout)[:4000])
    j = json.loads(r.stdout)
    if j.get("errors"):
        raise RuntimeError(j["errors"])
    return j["data"]


def assert_labs_only():
    env = g('query { environment(id:"%s"){ id name projectId } }' % E)["environment"]
    assert env["id"] == E and env["name"] == "labs" and env["projectId"] == P, env
    assert not env["id"].startswith(PROD) and not env["id"].startswith(STAGING), env
    dash = g('query { service(id:"%s"){ id name } }' % D)["service"]
    api = g('query { service(id:"%s"){ id name } }' % A)["service"]
    assert dash["id"] == D and dash["name"] == "labs-dash", dash
    assert api["id"] == A and api["name"] == "labs-api", api
    log(f"scope ok project={P} env=labs/{E} dash={D} api={A}")


def instance(sid):
    return g('query { serviceInstance(serviceId:"%s",environmentId:"%s"){ latestDeployment { id status createdAt meta } activeDeployments { id status createdAt } } }' % (sid, E))["serviceInstance"]


def var_names(sid):
    data = g('query { variables(projectId:"%s", environmentId:"%s", serviceId:"%s") }' % (P, E, sid))
    variables = data.get("variables") or {}
    if not isinstance(variables, dict):
        raise RuntimeError(f"unexpected variables type {type(variables)}")
    return set(variables.keys()), variables


def safe_value(variables, name):
    if name not in SAFE_KEYS:
        raise RuntimeError(f"refusing to print non-allowlisted var {name}")
    if name not in variables:
        return "ABSENT"
    return str(variables[name])


def cancel_if_new(sid, known, reason):
    try:
        si = instance(sid)
    except Exception as ex:
        log(f"WARN cannot list deployments for cancel: {ex}")
        return []
    cancelled = []
    latest = si.get("latestDeployment") or {}
    candidates = list(si.get("activeDeployments") or [])
    if latest.get("id"):
        candidates.append(latest)
    seen = set()
    for dep in candidates:
        lid = dep.get("id")
        if not lid or lid in seen or lid in known:
            continue
        seen.add(lid)
        st = dep.get("status")
        if st in ("SUCCESS", "REMOVED", "CRASHED", "FAILED", "SLEEPING"):
            continue
        log(f"cancelling unexpected deploy {lid} status={st} ({reason})")
        try:
            try:
                g('mutation { deploymentCancel(id:"%s") }' % lid)
                log(f"deploymentCancel {lid} ok")
            except Exception as ex:
                log(f"deploymentCancel failed ({ex}); trying deploymentStop")
                g('mutation { deploymentStop(id:"%s") }' % lid)
                log(f"deploymentStop {lid} ok")
            cancelled.append(lid)
        except Exception as ex:
            log(f"ERROR could not cancel {lid}: {ex}")
    return cancelled


def slim_events(j):
    edges = ((j.get("deploymentEvents") or {}).get("edges")) or []
    rows = []
    for e in edges:
        n = e.get("node") or {}
        payload = n.get("payload") or {}
        err = payload.get("error") if isinstance(payload, dict) else None
        rows.append({
            "step": n.get("step"),
            "createdAt": n.get("createdAt"),
            "completedAt": n.get("completedAt"),
            "error": err,
        })
    return rows


def watch_until(k, dep):
    last_sig = None
    progress = time.monotonic()
    while True:
        j = g('query { deployment(id:"%s"){ id status createdAt staticUrl meta } deploymentEvents(id:"%s", first:80){ edges { node { step createdAt completedAt payload { error } } } } }' % (dep, dep))
        st = j["deployment"]["status"]
        events = slim_events(j)
        sig = json.dumps({"status": st, "events": events}, sort_keys=True)
        meta = j["deployment"].get("meta") or {}
        (OUT / f"last-{k}.json").write_text(json.dumps({
            "deployment": {
                "id": j["deployment"]["id"],
                "status": st,
                "createdAt": j["deployment"].get("createdAt"),
                "staticUrl": j["deployment"].get("staticUrl"),
                "commitHash": meta.get("commitHash"),
            },
            "events": events,
        }, indent=2) + "\n")
        if sig != last_sig:
            progress = time.monotonic()
            last_sig = sig
            last_step = events[-1]["step"] if events else None
            log(f"{k} {st} events={len(events)} last_step={last_step}")
        if st in ("FAILED", "CRASHED", "REMOVED"):
            log(f"STOP {k} {st}; no retry")
            (OUT / "deploy-failed.txt").write_text(json.dumps({
                "time": stamp(), "status": st, "deploy": dep, "sha": NEW
            }, indent=2) + "\n")
            sys.exit(5)
        if time.monotonic() - progress >= 180:
            log(f"STOP {k} 3 minutes no progress (status {st}); no retry")
            (OUT / "deploy-stalled.txt").write_text(json.dumps({
                "time": stamp(), "status": st, "deploy": dep, "sha": NEW
            }, indent=2) + "\n")
            sys.exit(4)
        if st == "SUCCESS":
            (OUT / f"live-{k}.txt").write_text(stamp() + "\n")
            log(f"{k} LIVE SUCCESS")
            return dep
        time.sleep(10)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    assert_labs_only()

    si_d = instance(D)
    si_a = instance(A)
    dmeta = (si_d.get("latestDeployment") or {}).get("meta") or {}
    ameta = (si_a.get("latestDeployment") or {}).get("meta") or {}
    log(f"pre dash latest={(si_d.get('latestDeployment') or {}).get('id')} status={(si_d.get('latestDeployment') or {}).get('status')} sha={dmeta.get('commitHash')}")
    log(f"pre api latest={(si_a.get('latestDeployment') or {}).get('id')} status={(si_a.get('latestDeployment') or {}).get('status')} sha={ameta.get('commitHash')}")
    api_id = (si_a.get("latestDeployment") or {}).get("id")
    if api_id != API_DEPLOY:
        log(f"STOP: labs-api latest deploy is {api_id}, expected {API_DEPLOY}; no writes made")
        sys.exit(3)
    api_sha = (ameta.get("commitHash") or "")
    if not api_sha.startswith(API_SHA_PREFIX):
        log(f"STOP: labs-api sha {api_sha} is not {API_SHA_PREFIX}; no writes made")
        sys.exit(3)

    names, vals = var_names(D)
    analyst_unset = "VITE_SOCIAL_DASHBOARD_ANALYST_VIEWS" not in names
    log(f"pre dash var count={len(names)} has_flag={('VITE_SOCIAL_COMMAND_CENTER_ENABLED' in names)} flag={safe_value(vals, 'VITE_SOCIAL_COMMAND_CENTER_ENABLED')} VITE_APP_LABS_BRANCH={safe_value(vals, 'VITE_APP_LABS_BRANCH')} ANALYST_VIEWS_UNSET={analyst_unset}")
    if not analyst_unset:
        log("STOP: VITE_SOCIAL_DASHBOARD_ANALYST_VIEWS is unexpectedly set; no deploy started")
        sys.exit(3)
    if safe_value(vals, "VITE_SOCIAL_COMMAND_CENTER_ENABLED") != "true":
        log("STOP: VITE_SOCIAL_COMMAND_CENTER_ENABLED is not true; no deploy started")
        sys.exit(3)

    g('mutation { variableCollectionUpsert(input:{projectId:"%s",environmentId:"%s",serviceId:"%s",skipDeploys:true,variables:{VITE_APP_LABS_BRANCH:"%s"}}) }' % (P, E, D, NEW_BRANCH))
    log(f"vars upserted skipDeploys: VITE_APP_LABS_BRANCH={NEW_BRANCH} (flag left true, ANALYST_VIEWS left unset)")
    time.sleep(2)
    stray_d = cancel_if_new(D, KNOWN, "after var upsert skipDeploys")
    stray_a = cancel_if_new(A, KNOWN, "after var upsert skipDeploys")
    names2, vals2 = var_names(D)
    log(f"post-upsert dash flag={safe_value(vals2, 'VITE_SOCIAL_COMMAND_CENTER_ENABLED')} VITE_APP_LABS_BRANCH={safe_value(vals2, 'VITE_APP_LABS_BRANCH')} ANALYST_VIEWS_UNSET={('VITE_SOCIAL_DASHBOARD_ANALYST_VIEWS' not in names2)}")
    if safe_value(vals2, "VITE_APP_LABS_BRANCH") != NEW_BRANCH:
        log("STOP: VITE_APP_LABS_BRANCH read-back mismatch; no deploy started")
        sys.exit(3)
    if safe_value(vals2, "VITE_SOCIAL_COMMAND_CENTER_ENABLED") != "true":
        log("STOP: flag changed unexpectedly; no deploy started")
        sys.exit(3)
    if "VITE_SOCIAL_DASHBOARD_ANALYST_VIEWS" in names2:
        log("STOP: ANALYST_VIEWS became set; no deploy started")
        sys.exit(3)
    (OUT / "setvars.json").write_text(json.dumps({
        "time": stamp(),
        "namesSet": ["VITE_APP_LABS_BRANCH"],
        "VITE_APP_LABS_BRANCH": NEW_BRANCH,
        "flagKept": "true",
        "analystViewsUnset": True,
        "strayCancelledDash": stray_d,
        "strayCancelledApi": stray_a,
    }, indent=2) + "\n")

    dep = g('mutation { serviceInstanceDeployV2(serviceId:"%s",environmentId:"%s",commitSha:"%s") }' % (D, E, NEW))["serviceInstanceDeployV2"]
    (OUT / "dep-dash.id").write_text(dep + "\n")
    KNOWN.add(dep)
    log(f"deploy dash {dep} sha={NEW}")
    watch_until("dash", dep)

    si_a2 = instance(A)
    ameta2 = (si_a2.get("latestDeployment") or {}).get("meta") or {}
    api_id2 = (si_a2.get("latestDeployment") or {}).get("id")
    log(f"post api latest={api_id2} status={(si_a2.get('latestDeployment') or {}).get('status')} sha={ameta2.get('commitHash')} (expected unchanged 9f2c523 / {API_DEPLOY})")
    names3, vals3 = var_names(D)
    log(f"post dash flag={safe_value(vals3, 'VITE_SOCIAL_COMMAND_CENTER_ENABLED')} VITE_APP_LABS_BRANCH={safe_value(vals3, 'VITE_APP_LABS_BRANCH')} ANALYST_VIEWS_UNSET={('VITE_SOCIAL_DASHBOARD_ANALYST_VIEWS' not in names3)}")
    (OUT / "deploy-success.txt").write_text(json.dumps({
        "time": stamp(),
        "sha": NEW,
        "dash": dep,
        "api": api_id2,
        "apiSha": ameta2.get("commitHash"),
        "apiMoved": api_id2 != API_DEPLOY,
    }, indent=2) + "\n")
    log(f"DEPLOY SUCCESS dash={dep}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as ex:
        log(f"UNCAUGHT {type(ex).__name__}: {ex}")
        sys.exit(8)
