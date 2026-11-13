# Railway deployment pipeline review (#225)

> **HISTORICAL snapshot, observed 2026-10-20.** This is not the current deploy model. Production autodeploy is OFF; production deploys are manual full-SHA GraphQL. Live production is `82905ae` (deployed Nov 5). A GitHub source attached to `main` does not auto-deploy.

Observed 2026-10-20 through the authenticated Railway connector, read-only.
Repository review baseline: `0d193a6e8f8180d509f5cfdbb793203904047237`
(the product candidate recorded on #61, not a deployed-release claim).

## Review entry points

- [Railway project](https://railway.com/project/8c5a1df6-dc6b-46ca-a516-dc1c25750921)
- [Sanitized service/config snapshot](railway-pipeline-225.snapshot.json)
- [Launch checklist](../PRODUCTION_LAUNCH_CHECKLIST.md)
- [Backup and rollback runbook](../DB_BACKUP_AND_MIGRATION_ROLLBACK.md)
- GitHub repository: `chapmandaniel/projectTixmo`.

The snapshot contains source/build/deploy configuration and domain metadata,
not environment variable values. Railway reports no staged changes in either
environment, so the captured effective configurations are not pending patches.
Railway SUCCESS is provider deployment status, not a fresh application smoke pass.

## Existing environments and routes

Project: **tixmo API and Dashboard**, `8c5a1df6-dc6b-46ca-a516-dc1c25750921`.

| Environment | ID | Dashboard | API |
| --- | --- | --- | --- |
| staging-audit-20261005 | d21ebf73-4198-4483-9a16-1fc2fb3685e6 | https://tixmo-dashboard-candidate-staging-audit-20261005.up.railway.app | https://tixmo-api-candidate-staging-audit-20261005.up.railway.app |
| production | 36121c6d-d63f-4d58-8be2-e3684dfda52a | https://demo.tixmo.co | https://api-production-fbaf.up.railway.app |

Production dashboard also exposes `dash-production-7487.up.railway.app` and
`frontend-dash-production.up.railway.app`. These are configured routes; no HTTP
requests were made to establish present runtime health or redirect behavior.

Staging has its own Postgres-S5Gj, Redis-83Ua, two 5000 MB database volumes and
`tixmo-staging-audit-20261005` object bucket. Production has Postgres, Redis,
their mounted volumes, `mediabucket`, and an additional unattached Postgres
volume. Actual connection destinations, isolation and backup validity were not
verified; separate named resources alone do not prove database isolation.

## Source -> build -> deployment

| Service | Source/config | Build | Startup / health |
| --- | --- | --- | --- |
| Production frontend dash | GitHub source may still be attached to `main`, but that does not auto-deploy; deploys are manual full-SHA GraphQL. checkSuites=false was the Oct 20 observation. | DOCKERFILE, configured path /tdash/Dockerfile | Docker image CMD; no explicit healthcheckPath returned |
| Production backend api | GitHub source may still be attached to `main`, but that does not auto-deploy; deploys are manual full-SHA GraphQL. checkSuites=false was the Oct 20 observation. Start command and region/replica figures in this table are stale vs today's production API (us-west2 ×3, start script path). | RAILPACK | `npx prisma migrate deploy && npm run db:seed && npm start` (Oct 20 observation; stale vs current start script); no explicit healthcheckPath returned |
| Staging Tixmo Dashboard Candidate | root /tdash; no repo/branch returned | DOCKERFILE, path Dockerfile | healthcheck /, timeout 300 seconds |
| Staging Tixmo API Candidate | root /tixmoapi2; no repo/branch returned | DOCKERFILE, path Dockerfile | `/bin/sh -c 'npm run migrate && exec node dist/index.js'`; healthcheck /ready, timeout 300 seconds |

Production apps have one replica in us-east4-eqdc4a. Staging apps have one
replica in us-west2. Staging restartPolicyMaxRetries is 5. Tracing and automatic
instrumentation are off for all four app services at observation time.

Autodeploy is OFF and there are no deployment triggers. Branch protection and
required checks exist on `main`. The Oct 20 uncertainty about auto-deploy
triggers, watch paths, and branch protection is no longer current. checkSuites=false means the returned Railway source config is not
set to wait for check suites; it does not prove GitHub has no checks or protections.
Staging has a deployed build, but its original upload/source procedure is not
established by these connector responses. Do not invent a GitHub staging branch.

At the reviewed candidate, tdash/Dockerfile builds the Vite dashboard and serves
it with Nginx and the runtime-config entrypoint. API package scripts map build to
Prisma generation/TypeScript build, start to node dist/index.js, migrate to
prisma migrate deploy, and db:seed to prisma/seed-minimal.js.

## Observed deployment mapping

The table below is the latest mapping **as of 2026-10-20**. Live production since Nov 5 is `82905ae` (dashboard deploy `eef1b05e`, API deploy `7dd43be5`).

| Service | Latest deployment | Created (UTC) | Returned Git mapping |
| --- | --- | --- | --- |
| Production dashboard (latest as of 2026-10-20) | 0910a6b7-ce64-40e3-98c6-b8665d2c375a | 2026-07-26T16:29:26.508Z | main, 2f3a05540b6db6f6bd8c026156e74afcc7b1bf9e. Live production since Nov 5 is `82905ae` (dashboard deploy `eef1b05e`). |
| Production API (latest as of 2026-10-20) | 86b22bcd-2ca8-4754-8c23-8b4054af3c2d | 2026-06-16T23:57:52.309Z | main, 2f3a05540b6db6f6bd8c026156e74afcc7b1bf9e. Live production since Nov 5 is `82905ae` (API deploy `7dd43be5`). |
| Staging dashboard | 068df481-3cba-47f9-a735-eb7f3fb7d78d | 2026-10-07T04:00:57.412Z | no commitHash/branch returned |
| Staging API | c8436e3e-07c3-4551-adfb-88a5344aa4fd | 2026-10-07T04:00:56.378Z | no commitHash/branch returned |

All four are SUCCESS in Railway. Production metadata identifies an older commit,
not the reviewed 0d193a6 candidate. Staging deployment metadata does not establish
its source SHA. A successful older deployment is not current-candidate acceptance.

## Existing GitHub verification workflows

These files exist in the candidate; no new CI/deployment framework is needed.
They produce evidence, not a Railway promotion pipeline:

- `.github/workflows/market-readiness-local.yml`: PR/path-filtered main/master
  pushes and manual execution; runs local market gates with disposable local
  test configuration. No Railway deployment step.
- `.github/workflows/tdash-design-system.yml`: dashboard design-system checks.
- `.github/workflows/dependency-audit-evidence.yml`: manual dependency evidence.
- `.github/workflows/external-smoke-evidence.yml`: manual staging/production/both
  evidence; consumes configured origins and test account/token references.
- `.github/workflows/checkout-runtime-config-evidence.yml`: manual checkout
  runtime configuration/policy URL evidence.
- `.github/workflows/public-route-screenshot-evidence.yml`: screenshot evidence.
- `.github/workflows/uptime-status.yml`: manual and declared 15-minute schedule;
  declaring a schedule is not proof of successful current runs or alert delivery.

The workflow definitions were inspected, not dispatched. Workflow secret names
are references, not proof values are present/correct. Full smoke authentication
and scanner/review paths must not be mislabeled non-mutating just because they
are called smoke tests. Inspect exact commands against #61's permitted scope.

## Findings and concrete continuation

1. **Access blocker correction (#61):** Railway control-plane read access works;
   existing staging environment and both origins are now known. Do not ask Daniel
   to identify the hosting platform or resend these facts. This does not prove
   native-CI access, runtime test-account access or permission for mutations.
2. **Candidate mapping remains open:** release must establish the deployed staging
   source/artifact SHA before treating target evidence as evidence for 0d193a6.
   Record a trustworthy build manifest/source archive mapping or approved exact-SHA
   deployment; absent metadata is not permission to redeploy.
3. **Concrete reproducibility gap:** staging API config expects a Dockerfile under
   /tixmoapi2, but `tixmoapi2/Dockerfile` is absent from the reviewed Git tree.
   The successful historical build may have used another upload/artifact. Recover
   that build provenance and reconcile the build contract before a future deploy.
4. **Production startup mutates data:** the configured API command runs migrations
   and seeding on startup. Any deployment/restart review must assess this exact
   seed/migration path and rollback/backup implications; no startup was invoked.
5. **CI coupling not established:** source checkSuites=false and independent evidence
   workflows do not establish a required green-gate-before-deploy contract. Lead
   reviews intended gating and branch/source trigger settings before changes.
6. **Remaining release gates:** runtime credentials/dataset references, exact scope
   and window, CI capacity/access, scanner operator, recovery/second operator,
   policy/legal and on-call acceptance still require verified inputs. Existing
   conditional Blockerbuster decision on #61 is not launch or mutation approval.

Owners: tixmo-release maintains deployment/source mapping and build provenance;
tixmo-lead reviews build/startup/CI contracts; tixmo-qa independently reviews this
artifact and future execution evidence; tixmo-pm updates #61 without duplicate
human escalations. Local preparation/review can proceed immediately.

## Verification and limits

Actual reads: Railway list_projects, list_services, describe_environment for both
environments, describe_service for four app services, list_deployments (16 latest),
and candidate Git tree/workflow/Dockerfile/package-script inspection. Snapshot
captures returned config/domain/deployment fields; the deployment SHA table also
uses list_deployments metadata. No variable values, logs or credentials fetched.
No deploy, source attachment, restart, migration, seed, app HTTP request, CI dispatch,
config/scheduler change, merge or new financial commitment. Independent documentation
review is required before closing #225. Release readiness is unchanged by discovery.
