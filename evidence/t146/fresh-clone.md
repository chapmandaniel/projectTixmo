# T146 fresh-clone health check of main

Date: 2026-11-17, America/St_Johns (NST, UTC-3:30).
Clone: `/tmp/t146-fresh-clone` from `chapmandaniel/projectTixmo`, branch `main` at `a702a4a025244d4cfcc087298a720a943f177eab`.
Node: v24.22.1 (engines `>=24.21.0 <25`; `.nvmrc` is 24.21.0). npm 11.21.1.

Followed only the README and docs setup. There was no root README on main. Setup was taken from `tixmoapi2/README.md`, `tixmoapi2/CONTRIBUTING.md`, `AGENTS.md`, `docs/LOCAL_MARKET_READINESS_GATES.md`, and `docs/vendor-import-local.md`.

## Environment deviations

- `npm run dev:services` / `docker compose` failed: Docker is not installed on this box (`docker: not found`, exit 127). Recorded in the first pass, then used an isolated local PostgreSQL 18.3 and Redis 7.4.2 bound to `127.0.0.1:55446` and `127.0.0.1:16379`.
- Disposable target only: database `tixmo_disposable_t146`, Redis `/1`, `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`. Safety check accepted the target. The shared Compose database `tixmoapi` was not used.
- Host and Postgres session TimeZone were `America/St_Johns`. CI Postgres 14 runs in UTC. This difference is what surfaced the expiry bug below.
- Synthetic JWT/session and Stripe values matched the public workflow placeholders in `.github/workflows/market-readiness-local.yml`. No application `.env` was loaded. Chrome was at `/usr/bin/google-chrome`.

## Gate results on main `a702a4a` (before the fix)

| Gate | Command | Result |
| --- | --- | --- |
| Install API | `npm ci --prefix tixmoapi2` | PASS, exit 0, 5.8s, 820 packages, 0 vulnerabilities. npm 11 `allowScripts` warnings for Prisma and related packages, as already documented in `docs/vendor-import-local.md`. Husky hooks installed. |
| Install dash | `npm ci --prefix tdash` | PASS, exit 0, 2.7s, 282 packages added (289 audited), 0 vulnerabilities. esbuild `allowScripts` warning, already documented. |
| Typecheck | `npm --prefix tixmoapi2 run typecheck` | PASS, exit 0, 10.6s, `tsc --noEmit`. |
| Lint | `npm --prefix tixmoapi2 run lint` | PASS, exit 0, 30.1s, 0 errors, 384 warnings. Matches the documented behaviour that warnings do not fail the command. |
| API tests | `npm --prefix tixmoapi2 test -- --runInBand` after a disposable `prisma` schema push (same sequence as `npm run verify:api`, with Jest output kept for counts) | FAIL, exit 1, 612s. 187 passed / 1 failed suites, 1776 passed / 2 failed / 1778 total. |
| Dash tests | `npm --prefix tdash test -- --run` | PASS, exit 0, 21.2s. 71 files, 553 tests. |
| design:guard | `npm --prefix tdash run design:guard` | PASS, exit 0, 0.4s. 739 tracked baseline violations, no regressions. |
| API build | `npm --prefix tixmoapi2 run build` | PASS, exit 0, 9s. |
| Dash build | `npm --prefix tdash run build` | PASS, exit 0, 34.3s. Vite build, buyer policy pages, and robots HTML check passed. |

`npm run verify:market` was not run as a second full copy of the same API and dashboard gates. Each documented gate above was run individually.

### API test failure on main

Both failures were in `tests/integration/order-confirm-expiry.race.test.ts`:

- `expired reservations never fulfill when confirmation/expiry overlap (expiry starts first=false)`
- `expired reservations never fulfill when confirmation/expiry overlap (expiry starts first=true)`

Confirm correctly returned 409 (`Order can no longer be fulfilled`). The order row stayed `PENDING` instead of `CANCELLED`, because `claimNextExpiredOrder` uses `expires_at < NOW()`. Prisma stores `DateTime` without `@db.Timestamptz` as `timestamp without time zone` in UTC clock time. With `TimeZone=America/St_Johns`, `NOW()` is session-local and those holds looked about 3.5 hours in the future in SQL.

This failed 5/5 times in isolation on the same database, so it is not a flake. Setting the database TimeZone to `UTC` made the same file pass 3/3, which matches why CI on `a702a4a` is green (run 43997067038). The third test in the file (confirm first, expiry later on an already-paid order) passed throughout.

Known flaky tests named in the T146 brief both passed on this first run and were not rerun to get a green result:

- `scanner-browser.test.ts#1` passed
- `orders-http-ramp.test.ts#3` passed (`#1` and `#2` also passed)

A later full-suite rerun failed 7 tests only because leftover `runtime/task6*.json` receipts from the first run were still on disk. Those files were removed and were not treated as product failures.

## Fixes

All in one branch, `fix/t146-fresh-clone-health`:

1. **Expiry SQL** in `tixmoapi2/src/api/orders/service.ts`: compare `expires_at < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`, and write `updated_at` the same way when cancelling a hold. This keeps the sweep correct on a non-UTC Postgres session.
2. **Regression** `tixmoapi2/tests/integration/order-expiry-timezone.test.ts`: under `TimeZone=America/St_Johns`, `expires_at < NOW()` is false for a hold that expired 60 seconds ago in UTC, the UTC comparison is true, and `claimNextExpiredOrder` cancels that hold.
3. **Root `README.md`**: was missing. Documents install, the shared Compose dev stack versus disposable test targets, and every documented gate.
4. **`tixmoapi2/README.md` and `CONTRIBUTING.md`**: clone is the monorepo; `docker compose` starts `tixmoapi` and is not a test target; tests go through `verify:api` / a `tixmo_disposable_*` database.

## Gate results after the fix (same disposable Postgres/Redis, still `America/St_Johns`)

- Typecheck: PASS
- Lint: PASS, still 0 errors / 384 warnings
- Targeted: `order-confirm-expiry.race.test.ts`, `order-expiry-timezone.test.ts`, and `order-expiry-sweep.lock.test.ts` — 6/6 PASS
- Full API suite: PASS, exit 0, 583s. **189 suites, 1779 tests** (the new timezone test plus the previous 1778). Known flakes passed. Expiry race passed 3/3.

Dashboard gates were already green and were not changed.

## PR

- Draft PR: (filled after open)
- Head SHA: (filled after commit)
- Required checks: `local-gates` and `configured-image-restore` (filled after CI)

No merge, no deploy, no staging/prod/Labs changes. Labs re-seed was not run.
