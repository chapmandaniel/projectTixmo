# Tixmo Local Market Readiness Gates

Use this before staging smoke, release branches, or production launch review. It proves the local code path is healthy; it does not replace production-like smoke, scanner field testing, backup/restore evidence, legal approval, or uptime monitoring evidence.

## Command

```bash
npm run verify:market
```

## What It Runs

At source `8aae387bcd4290edd259fd75aa11baaa1f62ca63`,
`scripts/verify-market-local.mjs` runs these 12 stages, stopping at the first
nonzero exit. API build is nested inside `verify:api`, not a separate stage.

1. `npm --prefix tixmoapi2 audit`
2. `npm --prefix tdash audit`
3. `npm --prefix tixmoapi2 run test:tooling`
4. `npm --prefix tixmoapi2 run test:development`
5. `npm run verify:api`
6. `npm --prefix tixmoapi2 run lint`
7. `npm --prefix tdash test -- --run`
8. `npm --prefix tdash run design:guard`
9. `npm --prefix tdash run build` (child `NODE_ENV=production`)
10. `node --check scripts/verify-api.mjs`
11. `node --check scripts/check-status.mjs`
12. `node --check scripts/external-smoke-evidence.mjs`

`verify:api` validates disposable targets before running API build, migration
rehearsal, Prisma schema bootstrap (`--accept-data-loss`), and unfiltered Jest.
Read its safety contract and coordinate sole disposable DB ownership first.

## Advisory audit versus guarded local qualification

The two unfiltered `npm audit` stages require advisory-registry access; they
are not equivalent to the production-only `evidence:dependency-audit` helper.
The task362/424 loopback Node guard intentionally blocks nonloopback requests.
Task424 evidence commit `21e2c8fec6f6fd7913c1c14e274b79fda964fc46`
records market exit 1 at API audit: 0 stages passed, 1 failed, 11 not reached.
This is not an advisory verdict or a market pass. Supplementary checks are
not passes of the unexecuted market stages.

The current market script inherits one environment for all stages and offers
no supported split/skip mode. Do not disable its guard, use an offline/cache
result as a fresh audit, or skip audits to claim full-market acceptance.
A proposed two-environment composition and required authority are documented
in [task428 assessment](team/evidence/task-428/README.md). It is a proposal,
not an implemented or authorized execution path. Full market remains open.

## CI Workflow

Workflow: `.github/workflows/market-readiness-local.yml`

Triggers:

- Pull requests touching API, dashboard, scripts, package config, or the workflow.
- Pushes to `main` or `master` touching those paths.
- Manual `workflow_dispatch`.

The workflow provisions job-scoped PostgreSQL 14 and Redis 7 services with
health checks and dynamically assigned host ports bound to `127.0.0.1`.
There are no shared container names or persistent volumes. Step-scoped
`job.services.<service>.ports[...]` expressions supply the mapped ports to
`DATABASE_URL` (`tixmo_disposable_ci`) and `REDIS_URL` (explicit `/1`), together
with `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`. The database password and application
keys in this workflow are synthetic throwaway CI values, not deployed secrets.
The job installs dependencies with `npm ci` and runs the same root command:

```bash
npm run verify:market
```

Dependency-free synthetic CI contract checks (no services or schema actions):

```bash
node --test scripts/market-readiness-workflow.test.mjs scripts/verification-safety.test.mjs
```

These inspect the workflow source and substitute synthetic mapped ports into
the real verifier with subprocesses stubbed. They do not emulate GitHub Actions,
prove Docker port publication, or establish a successful full integration run.
YAML syntax can be checked separately with an available YAML parser; an actual
CI run remains required for runner/service integration evidence.

## Evidence To Capture

- Local terminal output when run manually.
- GitHub Actions run URL when run in CI.
- Commit SHA.
- Any failure logs and the first fixed passing run.

Historical local evidence (not a current-candidate pass):

- `npm run verify:market` passed on 2026-06-03.
- API verification included 50 passing Jest suites and 320 passing tests.
- Dashboard verification included 22 passing Vitest files and 104 passing tests.
- Dashboard design guard passed with the tracked baseline and no regressions.
- Dashboard production build passed.

## What This Does Not Prove

- Production environment variables are configured.
- Stripe webhooks reach the deployed API.
- Real-device scanner/offline behavior is acceptable.
- External reviewer flow works on the production-like domain.
- Production backups, restores, and rollback owners are confirmed.
- Legal/payment/support/security policy approval is complete.
- Uptime/status monitoring has a passing scheduled run.
