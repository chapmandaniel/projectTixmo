# Tixmo Local Market Readiness Gates

Use this before staging smoke, release branches, or production launch review. It proves the local code path is healthy; it does not replace production-like smoke, scanner field testing, backup/restore evidence, legal approval, or uptime monitoring evidence.

## Command

```bash
npm run verify:market
```

## What It Runs

In order:

1. Dependency audits for API and dashboard (including development dependencies).
2. API tooling and development-target safety tests.
3. Root verification-target and CI workflow safety checks.
4. API build, including Prisma client generation.
5. `npm run verify:api` against explicitly disposable services.
6. API lint.
7. Dashboard tests, design guard and production build.
8. Root verification and evidence helper syntax checks.

By default `verify:api` creates uniquely named, loopback-only Postgres and Redis
containers, applies migrations, runs the tests and removes only its own containers.
It does not load application `.env` files. Docker Desktop or the project Colima
profile must be running. An explicitly supplied test target must satisfy both the
local ownership/reset guard and the disposable service guard.

CI provisions disposable job services and uses the explicit guarded verifier path.
Recovery fencing tests run in the ordinary suite because recovery is enabled;
there is no separate opt-in flag for their acceptance coverage.

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

Historical local evidence (2026-06-03; not current acceptance):

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
