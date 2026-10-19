# Current local verification baseline

## Scope and provenance

- Task: #22, QA owner `tixmo-qa`; captured 2026-10-19.
- Exact code baseline tested: `2f3a05540b6db6f6bd8c026156e74afcc7b1bf9e`.
- Branch: `tixmo/task-22-verification`.
- Worktree: `/home/daniel/projects/projectTixmo/worktrees/task-22`.
- Only owned change: this report. Code and guard baseline were not modified.
- Worktree was clean before checks. Main had unrelated untracked `AGENTS.md`
  and `docs/team/`, which were read for onboarding and preserved untouched.
- These are fresh executions, not the June 3 historical passes in the gate
  documentation. This is a **partial, environment-blocked baseline**, not a
  full readiness pass or launch approval. Independent lead review is required.

## Inspected gates and prerequisites

Read root/API/dashboard package scripts, `scripts/verify-market-local.mjs`,
`scripts/verify-api.mjs`, `docs/LOCAL_MARKET_READINESS_GATES.md`,
`.github/workflows/market-readiness-local.yml`, API Jest config/setup,
dashboard Vitest/Vite setup, design guard, Prisma generator declaration and
API Compose configuration.

The documented aggregate runs API build, API verification, dashboard tests,
design guard, dashboard build, then three root-helper syntax checks, stopping
at the first failed step. Safe independent steps were executed separately to
avoid hiding their results behind the failed API build.

Current runtime: Node `v24.21.0`, npm `11.19.0`; CI config uses Node 20. Root,
API and dashboard `node_modules` are absent, including local Prisma, TypeScript,
Vite and Vitest binaries. Both component lockfiles exist. No dependency install,
symlink to shared dependencies, package download or lockfile change was made.
The API build script is `prisma generate && tsc && tsc-alias`; it failed before
client generation. Dashboard guard uses only Node built-ins.

### Database safety boundary

No local disposable database has been verified. No database connection, port
probe, Docker start or service change was attempted, and no inherited
`DATABASE_URL` was printed or used. A hostname of localhost alone is not proof
of disposability.

`verify-api.mjs` reads API `.env`, preserves inherited environment values,
starts Compose services and runs `prisma db push --accept-data-loss
--skip-generate` before Jest. It does not enforce a disposable/local target.
It also logs the Redis URL unredacted. Crucially, `tixmoapi2/tests/setup.ts`
also executes that schema push for Jest suites, catching bootstrap errors;
direct API unit-test invocation is therefore not a safe workaround.

Compose names fixed containers `tixmo_postgres` / `tixmo_redis`, publishes
5432 / 6379 and persists named volumes; it must not be assumed disposable.
API `.env` and dashboard `.env` are absent in this isolated worktree; no
personal or shared environment files were loaded.

## Fresh execution results

All commands below ran from the worktree root, sequentially, with a 30-second
per-command timeout and a minimal subprocess environment containing only
existing `PATH`, `HOME=/home/daniel`, `LANG=C.UTF-8`, `CI=true`, and
`npm_config_update_notifier=false`. Inherited database, payment and other
application variables were not forwarded. Timing uses Python
`time.monotonic()` around `subprocess.run(..., capture_output=True, text=True,
timeout=30, env=...)`. Each check completed without timeout.

| Command | Start (UTC) | Duration (s) | Exit | Outcome |
| --- | --- | ---: | ---: | --- |
| `npm --prefix tixmoapi2 run build` | 2026-10-19T20:23:56.311208+00:00 | 0.144 | 127 | BLOCKED: prisma executable missing; no generation/compile occurred. |
| `npm --prefix tdash test -- --run` | 2026-10-19T20:23:56.455539+00:00 | 0.123 | 127 | BLOCKED: vitest executable missing; no test suite ran. |
| `npm --prefix tdash run design:guard` | 2026-10-19T20:23:56.578191+00:00 | 0.219 | 0 | PASS: 1055 tracked baseline violations, no regressions; baseline unchanged. |
| `npm --prefix tdash run build` | 2026-10-19T20:23:56.797122+00:00 | 0.117 | 127 | BLOCKED: vite executable missing; no bundle built. |
| `node --check scripts/verify-api.mjs` | 2026-10-19T20:23:56.914578+00:00 | 0.030 | 0 | PASS: syntax only. |
| `node --check scripts/check-status.mjs` | 2026-10-19T20:23:56.944421+00:00 | 0.029 | 0 | PASS: syntax only; status checker not executed. |
| `node --check scripts/external-smoke-evidence.mjs` | 2026-10-19T20:23:56.972997+00:00 | 0.029 | 0 | PASS: syntax only; no external request executed. |
| `node --check scripts/verify-market-local.mjs` | 2026-10-19T20:23:57.002281+00:00 | 0.026 | 0 | PASS: syntax only; gate not executed. |

Exact failure diagnostics were `sh: 1: prisma: not found`,
`sh: 1: vitest: not found`, and `sh: 1: vite: not found`, respectively.
The successful guard printed: `Design-system guard passed with 1055 tracked
baseline violation(s) and no regressions.` All four syntax checks returned
no output. Guard success means no deviation from its tracked baseline, not
that the application is free of design violations or functionally correct.

## Explicitly withheld / unverified

- `npm run verify:api`, direct API Jest tests, and Prisma schema/migration/seed
  commands: withheld because disposable DB safety has not been established.
- `npm run verify:market`: not run as an aggregate; includes the withheld API
  verifier and the independently observed missing build dependencies.
- API compilation, dashboard tests/build: attempted but not verified due to
  missing prerequisites. There is no assertion about application test health.
- No browser checks, running API smoke, external checks, current CI run,
  staging/production evidence, live payment actions, scanner field evidence,
  backup restore, release authorization or deployment was obtained.

## Recovery / handoff

PM/release must coordinate an isolated dependency installation (preserve
lockfiles with `npm ci --prefix tixmoapi2` and `npm ci --prefix tdash`) and an
explicitly disposable local Postgres/Redis allocation before database checks.
Confirm DB target ownership/disposability without exposing credentials,
fixed-name/port collision safety, and the single database-mutating test owner.
Account for automatic Compose startup and schema pushes in both verifier and
Jest setup. Re-run against the exact reviewed SHA with those prerequisites;
record new outcomes rather than promoting this partial report to green.

No dependencies or services were installed/altered in this task. The missing
prerequisites need PM coordination, not a test weakening or guard-baseline
refresh. Submit this documentation-only commit to review; do not mark done.
