# Tixmo Local Market Readiness Gates

Use this before staging smoke, release branches, or production launch review. It proves the local code path is healthy; it does not replace production-like smoke, scanner field testing, backup/restore evidence, legal approval, or uptime monitoring evidence.

## Command

```bash
npm run verify:market
```

## What It Runs

In order:

1. `npm --prefix tixmoapi2 run build`
2. `npm run verify:api`
3. `npm --prefix tdash test -- --run`
4. `npm --prefix tdash run design:guard`
5. `npm --prefix tdash run build`
6. `node --check scripts/verify-api.mjs`
7. `node --check scripts/check-status.mjs`
8. `node --check scripts/external-smoke-evidence.mjs`

## CI Workflow

Workflow: `.github/workflows/market-readiness-local.yml`

Triggers:

- Pull requests touching API, dashboard, scripts, package config, or the workflow.
- Pushes to `main` or `master` touching those paths.
- Manual `workflow_dispatch`.

The workflow installs API and dashboard dependencies, then runs the same root command:

```bash
npm run verify:market
```

## Evidence To Capture

- Local terminal output when run manually.
- GitHub Actions run URL when run in CI.
- Commit SHA.
- Any failure logs and the first fixed passing run.

Latest local evidence:

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
