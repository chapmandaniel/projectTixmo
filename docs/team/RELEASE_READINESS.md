# Release readiness and isolated environment recovery

## Scope and evidence boundary

Task #23, `tixmo-release`, 2026-10-19. Reviewed bootstrap base `151a1ab`;
branch `tixmo/task-23-release-readiness`; isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-23`. Only this document is
owned. This is environment/release inventory, not launch approval.

Prior evidence: #22 commit `2050fac34629772d7756a95f12029c8ae3b6f50d`,
`docs/team/VERIFICATION_BASELINE.md` (read via `git show`, not merged here),
already establishes missing dependencies and unsafe DB bootstrap. Its detailed
check table is not repeated or promoted to current success. Existing npm,
GitHub Actions, Docker Compose and repository runbooks are sufficient; no
custom environment manager or paid platform is needed.

## Observed recovery: dashboard dependencies

Node `v24.21.0`, npm `11.19.0`, Docker CLI `/usr/bin/docker`, Compose `v5.6.0`
are installed. `command -v psql` and `command -v redis-cli` found neither on
PATH; this says nothing about container clients or daemon availability.
Only `docker compose version` was executed; no service enumeration or mutation.

In this task checkout, with no personal/application env forwarded:

```bash
cd /home/daniel/projects/projectTixmo/worktrees/task-23
sha256sum tdash/package-lock.json
env -i PATH="$PATH" HOME=/home/daniel LANG=C.UTF-8 CI=true \
  npm_config_update_notifier=false \
  npm_config_cache=/tmp/tixmo-task23-npm-cache \
  npm ci --prefix tdash --ignore-scripts --no-audit --no-fund \
    --fetch-retries=0 --fetch-timeout=20000
sha256sum tdash/package-lock.json
```

Actual command ran through Python `subprocess.run`, equivalent environment,
95-second timeout, captured combined output. Exit **0**, **350 packages**,
**8.32 seconds**; no install failure and no repair was needed. Before/after
SHA256: `00fdb5af7b2c52d5f8f2676c4e222d7ec66ccb61583f0a722240b82e7064b048`.
Tracked lockfile unchanged. `--ignore-scripts` suppresses lifecycle hooks;
this is a validated dashboard recovery path, not a claim that API Prisma
client generation or CI's ordinary lifecycle-enabled install was exercised.
Audit was deliberately not run, so install success is not security approval.

Use the same sanitized environment for these follow-ups:

| Command | Observed outcome |
| --- | --- |
| `npm --prefix tdash exec -- vitest --version` | Exit 0, `vitest/4.0.18 linux-x64 node-v24.21.0`, 0.47 s; runner availability only |
| `npm --prefix tdash run design:guard` | Exit 0; 1055 tracked baseline violations, no regressions; baseline not modified |
| `npm --prefix tdash run build` | Exit 0; Vite 4.5.14, 2514 modules; final bounded capture 7.49 s (Vite 7.07 s) |

The build was repeated once to recover its final exit/timing from truncated terminal
output; the final capture above establishes exit 0. Build warnings include stale
browserslist/baseline-browser data; no dependency
or baseline updates were attempted. Full frontend tests were not run: #35
owns implementation and behavioral validation. No API dependency install,
build, Prisma, Jest, aggregate gate, DB, service or external smoke was run.
All bounded install/check subprocesses completed; none is left running.
Ignored `tdash/node_modules`, `tdash/dist` and task-specific npm cache remain
local task artifacts, not shared dependencies or committed release assets.

### Handoff to #35

Frontend must run the procedure in **its own checkout**, substituting its own
cache such as `/tmp/tixmo-task35-npm-cache`; never symlink another worktree's
`node_modules`, copy `.env`, run `npm install`, or regenerate lockfiles. Confirm
baseline lock hash first and unchanged hash after. Run focused regression
and then relevant full frontend checks at the exact implementation SHA.
A failed install gets one bounded diagnosis/repair preserving the lockfile;
do not weaken flags/tests or retry indefinitely. Bound each command; if a
timeout occurs, terminate/reap only its own process tree before handoff.

API recovery is **unvalidated**: backend #34 owns its checkout/dependencies.
After inspecting hooks, use isolated `npm ci --prefix tixmoapi2` with sanitized
CI environment and task-specific cache; explicitly account for Prisma client
generation and native package scripts. Do not reuse the dashboard result as
API build/test evidence. No API dependency directory was touched by #23.

## Collision-safe disposable services: proposed, NOT executed

Current `tixmoapi2/docker-compose.yml` has fixed `tixmo_postgres`, `tixmo_redis`,
ports 5432/6379, persistent volumes and explicit `tixmo_network`. A different
Compose project name alone cannot isolate these resources. Do not run root
`dev:services`/`dev:services:down` or existing verifier at this baseline.

PM/release must first allocate one test owner and disposable targets. Use a
**standalone** throwaway Compose file, not a merge with the existing file:

- Unique project token `tixmo-test-<task>-<run>` recorded on the board; no
  `container_name`, externally named volumes, shared network or bind mounts.
- Postgres 14 Alpine and Redis 7 Alpine match repository service families.
  Pin actual image digests in final evidence. Use tmpfs/ephemeral data; disable
  Redis persistence. Random host ports bound only to `127.0.0.1` for 5432/6379
  avoid check-then-bind races. Derive allocated ports from this project's
  mappings, not an assumed default or a free-port probe.
- Use newly created throwaway DB/user and test-only values, never inherited
  application config. Before any schema push, record project/container labels,
  allocated loopback ports, unique database name, health and target ownership
  without logging URL credentials. Localhost alone does not prove disposable.
- Independently reviewed #34 safety controls must reject unknown targets,
  avoid automatic shared Compose startup and require explicit disposable
  configuration in both verifier and Jest setup. Inspect final #34 contract
  before supplying exact flags; do not guess a bypass in this report.
- Only the recorded owner runs DB-mutating tests. PM allocates API/listener
  ports too. Cleanup later targets only the standalone file and exact project
  token, verifying labels first; never stop/remove shared services or volumes.

Unblock conditions: PM records allocation/sole owner, reviewed #34 is integrated
on the chosen test branch, isolated dependencies installed, target identity and
health verified, sanitized test-only env explicitly supplied. Then QA/release
may run exact-SHA API and aggregate checks under the separately authorized
local test scope. None of these service prerequisites is claimed satisfied.

## CI and runtime inventory

| Observed configuration | Gap / owner / precise unblock condition |
| --- | --- |
| `market-readiness-local.yml`: PR/path-filtered main/master pushes/manual; Ubuntu, Node 20, 25 min, both npm ci then verify:market | Release + backend: reconcile #34 explicit preprovisioned disposable target contract with CI; provision isolated job services and run the exact reviewed candidate. Current file relies on old verifier Compose startup. No current run URL/status obtained. |
| `tdash-design-system.yml`: Node 20, npm ci, guard, two named tests, build | Frontend/QA: current exact-SHA run and full relevant tests; two targeted suites are not complete behavior coverage. |
| Manual dependency-audit, external-smoke, public-route-screenshot, checkout-runtime-config workflows | Release/QA: launch-ticket artifacts and run URLs for exact SHA/target; workflow presence is not execution evidence. No workflows dispatched here. |
| Uptime workflow: configured every 15 minutes, staging/production checks can skip successfully when both URLs missing | Release: demonstrate configured targets and non-skipped scheduled run plus alert routing; a green skipped job is insufficient. No secrets/config read. |
| API package declares Node >=18/npm >=9; CI Node 20; dashboard lock dependencies require modern Node (some >=20.19 or >=22.12) | Lead/release: choose and verify consistent supported runtime. Local Node24 result does not prove Node20 CI parity. |
| `tdash/Dockerfile` uses node:18-alpine and npm install | Release/frontend: Node18 conflicts with locked modern dependency requirements; review supported pinned runtime and lock-preserving install in a later task, then build image. No Dockerfile edit/image build here. |

API runtime configuration names are declared in
`tixmoapi2/src/config/environment.ts`; production boot requires DATABASE_URL,
JWT_SECRET, JWT_REFRESH_SECRET and SESSION_SECRET. Launch prerequisites also
include Redis, object storage, Stripe/webhooks, email, CORS/domain/TLS,
release-tagged Sentry and dashboard runtime API/payment/policy configuration.
These are **declared requirements only**, not verified provisioned services or
valid configuration. No personal env, credentials or secret values were read.
Server's Storybook AWS role is not Tixmo infrastructure authorization.

## Deployment, rollback and release evidence

`docs/PRODUCTION_LAUNCH_CHECKLIST.md` and launch evidence ticket templates are
existing sources of truth. `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md` describes
Railway backup/manual restore/PITR and code-only versus schema rollback paths;
provider documentation in a runbook is not evidence of a current deployment.

| Unverified evidence | Accountable owner / exact unblock condition |
| --- | --- |
| Candidate, environment/service IDs, dashboard/API alignment, deploy IDs and last-known-good SHA | PM + release: identify approved candidate and environment in launch ticket, attach successful exact-SHA local/CI evidence and release/deploy mapping. Daniel authorizes deployment; none performed here. |
| Backups, retention, manual pre-migration snapshot, restore rehearsal, rollback time | Release + backend: attach backup IDs/times, outside-production restore result and smoke evidence, schema compatibility decision, named rollback operator and second approver. No backup/DB operation performed. |
| Production observability and incident response | Release: attach release-tagged Sentry test/alert receipt, non-skipped uptime run and named support escalation owner; no outbound action here. |
| Stripe test checkout/webhook lifecycle, scanner real-device/offline, reviewer routes, policies/legal | Backend/frontend + QA: approved staging evidence at candidate SHA; PM/Daniel: policy/signoff and release authority. Never substitute build success or historical June artifacts. |

The backup runbook's local `verify:api` preflight must remain confined to the
verified disposable target, never inherit production DATABASE_URL while
following migration instructions. Do not execute migration/restore commands
as part of this inventory. Default-branch integration, provisioning, spend,
production mutation, live payment, deploy and external messaging remain out
of scope. Independent exact-SHA review is required; submit #23 to review, not done.
