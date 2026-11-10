# T79 main health audit

Audited commit: `061b578f8d55c0b7ce9ea053f5d38facba231bbb` (main).
Node used for every command below: `v24.21.0` (npm `11.19.0`), matching `actions/setup-node` in `.github/workflows/market-readiness-local.yml` and `.github/workflows/tdash-design-system.yml`.
Installs were `npm ci --prefix tixmoapi2` and `npm ci --prefix tdash`.

## Executive summary

- API tests, typecheck, lint, and build all passed. Dashboard tests, design guard, and build all passed. No failing, skipped, todo, only, or flaky tests on the clean run.
- API: 179 suites, 1676 tests, 0 skipped, exit 0 in 607.05s. Lint exit 0 with 383 warnings and 0 errors. Typecheck exit 0. Build exit 0.
- Dashboard: 65 files, 493 tests, 0 skipped, exit 0 in 25.31s. Design guard exit 0 (920 existing baseline violations, no new ones). Build exit 0. There is no lint or typecheck script, and no `tsconfig` or ESLint config.
- Docs that tell someone `verify:api` creates Docker containers, or that Node 18 is enough, were wrong. Those operational lines are corrected on this branch. December 2025 status counts in `tixmoapi2/README.md` and `tixmoapi2/PROGRESS.md` are still historical and were not rewritten.
- Dead config removed here: unused `@models/*` path, `ENABLE_SMS_NOTIFICATIONS` and `ENABLE_PUSH_NOTIFICATIONS` (nothing reads them), and gitignore for generated `runtime/` receipts. Unused npm packages were not removed.
- The cart-hold mismatch, the nested workflow, the unused packages, and the missing labs reset script were applied in [Decisions applied (T81)](#decisions-applied-t81). Twilio, Elasticsearch, and the AI config fields stay because the code still reads them. Do not merge this draft.

## Commands

| Area | Command | Exit | Duration | Counts |
| --- | --- | --- | --- | --- |
| API install | `npm ci --prefix tixmoapi2` | 0 | 7.6s | 822 packages added |
| API typecheck | `npm --prefix tixmoapi2 run typecheck` (`tsc --noEmit`) | 0 | 7.41s | rerun after the `@models` path removal; first run on the audited tree was also exit 0 in 8.15s |
| API lint | `npm --prefix tixmoapi2 run lint` | 0 | 22.3s | 0 errors, 383 warnings |
| API build | `npm --prefix tixmoapi2 run build` | 0 | 8.63s | Prisma client generate plus `scripts/build.cjs` |
| API tests | `npm --prefix tixmoapi2 test` (`jest --runInBand`) | 0 | 607.05s (Jest 606.306s) | 179 passed / 179 suites, 1676 passed / 1676 tests, 0 skipped, 0 snapshots |
| Dashboard install | `npm ci --prefix tdash` | 0 | 3.6s | 299 packages added |
| Dashboard design guard | `npm --prefix tdash run design:guard` | 0 | 0.21s | passed, 920 tracked baseline violations, no regressions |
| Dashboard tests | `npm --prefix tdash test -- --run` | 0 | 25.31s (Vitest 24.94s) | 65 passed / 65 files, 493 passed / 493 tests, 0 skipped |
| Dashboard build | `npm --prefix tdash run build` | 0 | 23.66s | Vite 6.4.5 production build plus buyer-policy and robots checks |
| Dashboard lint | none | n/a | n/a | `tdash/package.json` has no `lint` script and no ESLint config |
| Dashboard typecheck | none | n/a | n/a | no `tsconfig` and no `typecheck` script. The app is JavaScript |

API test environment, aligned with the market-readiness job rather than an inherited `DATABASE_URL`:

- `CI=true`, `NODE_ENV=test`, `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`
- `DATABASE_URL=postgresql://tixmo_ci@127.0.0.1:5432/tixmo_disposable_ci?schema=public` (local PostgreSQL 16.15; the workflow image is Postgres 14)
- `REDIS_URL=redis://127.0.0.1:6379/1` (Redis 7.0.15)
- `TIXMO_BROWSER_PATH=/usr/bin/google-chrome` (Chrome 156.0.8078.47)
- synthetic `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_CURRENCY=cad`, `ADMIN_EMAIL` matching `.github/workflows/market-readiness-local.yml`
- `npm run build` completed first. Receipt files were cleared with `node scripts/http-pressure-receipt.cjs clear`, `http-ramp-receipt.cjs clear`, `native-recovery-receipt.cjs clear`, `payment-http-receipt.cjs clear`, and `scanner-browser-guard.cjs clear`

`npm run verify:market` was not executed. This environment has no Docker, and that command also runs image restore, rollback, and auth-IP jobs. Coverage (`npm run test:coverage`) was not run. The root gate calls `npm test`, not the coverage script. The nested workflow that would run coverage is not a GitHub workflow (see dead config).

## Failing, skipped, and flaky tests

| Kind | Count | Detail |
| --- | --- | --- |
| Failing | 0 | Clean API and dashboard runs above |
| Skipped / todo / only | 0 | Jest and Vitest summaries show every test passed. Search of `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs` found no `it.skip`, `test.skip`, `describe.skip`, `xit`, `xdescribe`, `it.todo`, `test.todo`, `it.only`, `test.only`, or `describe.only` |
| Flaky | 0 | No suite failed on the clean run, so none was repeated. Passing suites were not rerun |

Two earlier API attempts were discarded before the clean run. They are harness mistakes, not product failures, and the same suites passed afterward:

- `scanner-browser` failed while `TIXMO_BROWSER_PATH` was unset. The market-readiness job sets it. With `/usr/bin/google-chrome`, `runtime/task615-scanner-browser.json` recorded `passed: true`.
- Ramp, pressure, payment-HTTP, and scanner suites failed their fresh-receipt check because the first attempt had left `runtime/task608`, `task609`, `task615`, and `task616` in place. CI clears those files before the suite. After `clear`, pressure recorded `testAssertionsPassed: true` and `http201: 900`, and payment-HTTP and scanner receipts recorded `passed: true`.
- `payment-recovery-backlog` and `showpass-seed` require `dist/` newer than `src/`. CI builds before `verify:market`. After `npm run build`, the full suite passed, including those files.

## Outdated docs

| Finding | Location | Severity | Recommended fix | In this PR |
| --- | --- | --- | --- | --- |
| `verify:api` was documented as creating loopback containers, running migrations, and needing Colima. `scripts/verify-api.mjs` only checks an already running disposable Postgres and Redis, then `prisma db push` and Jest | `docs/LOCAL_MARKET_READINESS_GATES.md:24` | high | Describe the guard and `db push` | fixed |
| Launch checklist said `verify:api` starts Postgres and Redis | `docs/PRODUCTION_LAUNCH_CHECKLIST.md:133` | high | Point at the gate doc | fixed |
| README and master doc required Node 18, TypeScript 5.2, Express 4.18, Prisma 5.5, `npm install`, and `docker-compose` | `tixmoapi2/README.md:11`, `tixmoapi2/README.md:104`, `tixmoapi2/README.md:300`, `tixmoapi2/MASTER_DOCUMENTATION.md:78`, `tixmoapi2/MASTER_DOCUMENTATION.md:317` | high | Match `package.json` `engines` and current dependency pins. CI uses Node 24.21.0 and `npm ci` | fixed |
| Contributing told people to clone a `tixmoapi2` repository and `npm install` | `tixmoapi2/CONTRIBUTING.md:9` | med | Clone `chapmandaniel/projectTixmo` and `npm ci` inside `tixmoapi2/` | fixed |
| Master doc sample `DATABASE_URL` used database `tixmo`. Compose and `.env.example` use `tixmoapi` | `tixmoapi2/MASTER_DOCUMENTATION.md:350` | med | Use the example URL | fixed |
| Master doc said lint had 0 warnings | `tixmoapi2/MASTER_DOCUMENTATION.md:284` | med | Say warnings do not fail `npm run lint` | fixed |
| Showpass local doc opened with a feature-branch name | `docs/vendor-import-local.md:3` | low | Say the steps match main | fixed |
| Dashboard example omitted Vite vars the entrypoint and `runtimeConfig.js` already read | `tdash/.env.example:7` | med | Comment the existing `VITE_*` keys. Commented so a copied file does not change runtime | fixed |
| December 2025 phase table, 143/143 badge, and 86% coverage badge | `tixmoapi2/README.md:23` | med | Leave the snapshot, label it historical. This audit's suite is 1676 API tests and 493 dashboard tests | note added; badges not rewritten |
| `PROGRESS.md` still says TypeScript 5.2.2 and is a sprint log | `tixmoapi2/PROGRESS.md:1331` | low | Do not treat it as live status (`AGENTS.md` already says this) | not fixed |
| Demo plan lists `db:seed:minimal`, `db:drop`, `db:migrate`, `db:backup`, and other scripts that are not in `package.json` | `tixmoapi2/docs/DEMO_DATA_PLAN.md:654` | med | Keep it as a plan. Current commands are `npm run demo:market` in `docs/MARKET_DEMO_DATA.md` | not fixed |
| Reconciliation record still names Vite 6.4.4 and `follow-redirects` 1.16.1. `tdash/package.json` now pins Vite `6.4.5` and `follow-redirects` `1.16.2` | `docs/LOCAL_DEVELOPMENT_RECONCILIATION.md:26` | low | Leave the point-in-time record | not fixed |
| Health example omits `railwayEnvironment`, `branch`, and `release`, which `src/app.ts` returns | `tixmoapi2/README.md:153`, `tixmoapi2/src/app.ts:102` | low | Extend the example or point at `/health` | not fixed |
| `docs/labs.md` documents `ops/labs-reset.sh`, and says the script is "once added". No `labs-reset.sh` exists | `docs/labs.md:38` | low | Add the script in a separate change, or say it is still absent | applied in T81: marked not available |
| `CART_EXPIRY_MINUTES=10` in the example, code default `15` when unset | `tixmoapi2/.env.example:177`, `tixmoapi2/src/config/environment.ts:316` | med | Human picks one hold duration. Copying the example changes checkout expiry from the code default | applied in T81: example is 15 |
| `LOG_LEVEL=debug` in the example, code default `info` | `tixmoapi2/.env.example:173`, `tixmoapi2/src/config/environment.ts:312` | low | Example is an explicit override, not a stale command | not fixed |

## Dead config

| Finding | Location | Severity | Recommended fix | In this PR |
| --- | --- | --- | --- | --- |
| `ENABLE_SMS_NOTIFICATIONS` and `ENABLE_PUSH_NOTIFICATIONS` are set in the example and never read | `tixmoapi2/.env.example` (removed) | med | Delete them | fixed |
| `@models/*` mapped to `src/models/`, which does not exist, and nothing imports `@models` | `tixmoapi2/tsconfig.json`, `tixmoapi2/jest.config.js` | low | Remove the alias | fixed |
| Jest and verifier receipts land in `/runtime` and were untracked, so they can be committed by accident | `.gitignore` | med | Ignore `/runtime/` | fixed |
| `tixmoapi2/.github/workflows/ci.yml` is not a GitHub Actions workflow. Only `.github/workflows/` at the repo root runs. The nested file would typecheck, run `test:coverage` with a 70% threshold, and lint | `tixmoapi2/.github/workflows/ci.yml:1` | high | Decide whether to move coverage into a root workflow or delete the nested file. Not deleted here | applied in T81: file deleted |
| Twilio, Elasticsearch, Gemini, OpenAI, and `ENABLE_AI_GENERATION` are copied onto `config` and have no other readers. `@google/generative-ai` has no import | `tixmoapi2/src/config/environment.ts:248`, `:253`, `:264`, `:308`; `tixmoapi2/package.json:57` | med | Remove the unused wiring in a product change. Env examples for Twilio and Elasticsearch stay because `environment.ts` still reads them | package removed in T81; config fields left |
| `@sentry/tracing` and devDependency `chalk` have no imports under `tixmoapi2` outside the lockfile | `tixmoapi2/package.json:60`, `tixmoapi2/package.json:102` | low | Confirm Sentry v7 tracing is intentionally unused, then drop the packages | applied in T81: both removed |
| `recharts` has no import. `@nivo/core` and `@nivo/tooltip` have no direct import; `@nivo/line` already depends on them. Analytics uses `@nivo/line`, `pie`, `bar`, and `heatmap` | `tdash/package.json:16`, `:20`, `:30` | low | Drop `recharts` after a lockfile review. Leave `@nivo/*` that charts import | `recharts` removed in T81; `@nivo/*` left |
| `npm run typecheck` excludes tests | `tixmoapi2/tsconfig.json:41` | low | ESLint type-aware lint still includes tests via `tsconfig.eslint.json`. Extending `tsc` to tests may surface new errors | not fixed |
| API lint is green with a warning backlog: 96 `require-await`, 82 `no-unsafe-assignment`, 68 `no-console`, 65 `no-unsafe-member-access`, 31 `no-unsafe-argument`, 17 `no-explicit-any`, plus smaller unsafe-call, template, return, and floating-promise counts | `npm run lint` on this commit | low | Do not `--fix` these. `require-await` and the unsafe-* rules change signatures or types. Prettier reported 0 errors, so there was no formatting-only fix | not fixed |
| Design-system guard carries 920 baseline violations | `tdash` `design:guard` output | low | Burn down in a design change. Do not refresh the baseline to make the guard pass | not fixed |
| Root workflows that were checked (`market-readiness-local`, `tdash-design-system`, checkout, dependency audit, smoke, soak, public routes, uptime) point at scripts and `npm` scripts that exist | `.github/workflows/` | n/a | No missing path found | n/a |
| Package script targets exist, except `start` and `db:seed:showpass`, which run `dist/` after `npm run build` | `tixmoapi2/package.json` | n/a | Not dead | n/a |

Depcheck and knip were not installed. Unused packages above are from an import search of source, tests, and scripts, excluding `node_modules` and lockfiles.

## What this branch changes

- Doc corrections listed as fixed above.
- Removal of the two unread SMS/push example flags and the unused `@models` alias.
- `/runtime/` added to `.gitignore`.
- `evidence/t79/main-health.md`.

No test expectations, Stripe, auth, migrations, or CORS behavior were changed. No failing test was skipped or deleted.

## Decisions applied (T81)

Applied on this same branch after the audit above. Local checks used Node `v24.21.0`.

### Cart expiry

`tixmoapi2/.env.example` now sets `CART_EXPIRY_MINUTES=15`, matching `tixmoapi2/src/config/environment.ts` (`parseInt(process.env.CART_EXPIRY_MINUTES || '15', 10)`). A repo search for `CART_EXPIRY_MINUTES` found no other assignment of `10`. Other "10 minutes" lines are rate-limit and onsale notes, not the hold window, so they were left alone. Tests already stub `cartExpiryMinutes: 15`.

### Nested API workflow

Deleted `tixmoapi2/.github/workflows/ci.yml`. A search of workflows, scripts, `package.json`, and docs found no runner that invokes it. Live instructions that named it were updated: `tixmoapi2/README.md` and `tixmoapi2/MASTER_DOCUMENTATION.md` now point at the root `.github/workflows/` market-readiness gate. Dated audit inventories still name the old path as a file that existed when they were written (`docs/audits/2026-10-04-security-manifest.json`, `docs/audits/2026-10-04-security-coverage.json`, `docs/audits/2026-10-04-security-report.md`, `docs/audits/2026-10-04-full-project-audit.md`, `docs/audits/2026-10-20-local-development-reconciliation.json`). Those records were not rewritten.

### Unused packages

Nothing under `src`, `tests`, `scripts`, or config imports or requires `@google/generative-ai`, `@sentry/tracing`, `chalk`, or `recharts`. `npm uninstall` removed them and updated the lockfiles. The lock diffs only drop those packages and `recharts` dependents (`recharts-scale` and its chart helpers). `@sentry/node` stays: `tixmoapi2/src/config/sentry.ts` imports it, and tracing comes from `@sentry/node`'s dependency `@sentry-internal/tracing`, not from `@sentry/tracing`. Jest still depends on its own nested `chalk` 4. `@nivo/line`, `pie`, `bar`, and `heatmap` stay because Analytics imports them. Twilio, Elasticsearch, `GEMINI_API_KEY`, `OPENAI_API_KEY`, and `ENABLE_AI_GENERATION` stay on `config` because `environment.ts` still reads them; this change did not delete that wiring.

Local results after the removal:

| Check | Exit | Duration | Result |
| --- | --- | --- | --- |
| `npm --prefix tixmoapi2 run typecheck` | 0 | 8.22s | `tsc --noEmit` |
| `npm --prefix tixmoapi2 run lint` | 0 | 24.55s | 0 errors, 383 warnings |
| `npm --prefix tixmoapi2 run build` | 0 | 8.07s | Prisma generate and `scripts/build.cjs` |
| `npm --prefix tixmoapi2 test` | 0 | 520.59s | 179 suites passed, 1676 tests passed |
| `npm --prefix tdash run design:guard` | 0 | 0.19s | passed, no new baseline violations |
| `npm --prefix tdash test -- --run` | 0 | 29.2s | 65 files passed, 493 tests passed |
| `npm --prefix tdash run build` | 0 | 12.82s | Vite production build |

### Labs reset

`docs/labs.md` no longer tells anyone to run `ops/labs-reset.sh`. A search found no `labs-reset.sh` and no other labs database reset script. The reset section now says a scripted reset is not available, and that deleting the labs volume is not a substitute. The Showpass seed command is named as a seed, not a reset. No new script was added.
