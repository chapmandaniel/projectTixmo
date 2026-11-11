# T84 API dependency audit

Audited failing commit: `7f9eaa9f6977ec8e0767e083578101881833a6a3` (main, merge of PR #184).
Last green main before that push: `061b578f8d55c0b7ce9ea053f5d38facba231bbb`.
Node used for the lockfile and the checks below: `v24.21.0` (npm `11.19.0`), matching `actions/setup-node` in `.github/workflows/market-readiness-local.yml`.

## Root cause

`GHSA-474x-hrwr-fgx4` (CVE-2026-126066, low) covers `fast-xml-parser <= 5.11.2`. The GitHub advisory summary is "fast-xml-parser: Quadratic CPU consumption scanning unterminated stop-node tags". The first patched version is `5.12.0`. GitHub published it at `2026-11-10T21:09:44Z` (`gh api /advisories/GHSA-474x-hrwr-fgx4`).

That is after PR #184's last green market-readiness run. Run [42880294445](https://github.com/chapmandaniel/projectTixmo/actions/runs/42880294445) (`Tixmo Market Readiness Local Gates`, head `2336e80c2a0932ab674477b104c3cac8cae9d28c`) was created at `2026-11-10T18:56:49Z` and succeeded. The advisory did not exist for that run.

Main push run [42936962775](https://github.com/chapmandaniel/projectTixmo/actions/runs/42936962775) on `7f9eaa9f` failed `local-gates` in about a minute. The log line is:

```text
[verify:market] API dependency audit failed: advisory GHSA-474x-hrwr-fgx4 is not exempt
```

`configured-image-restore` on that same main run succeeded. PR #184 did not introduce the vulnerable package.

`git diff 061b578f 7f9eaa9f -- tixmoapi2/package-lock.json` does not touch `fast-xml-parser`. The only lockfile edits in #184 delete unused `@google/generative-ai`, `@sentry/tracing`, and dev `chalk`. Both commits resolve `fast-xml-parser` `5.7.3` (`fast-xml-parser-5.7.3.tgz`, integrity `sha512-C0AaNuC+mscy6vrAQKAc/rMq+zAPHodfHGZu4sGVehvAQt/JLG1O5zEcYcXSY5zSqr4YVgxsB+pHXTq0i7eDlg==`) at the same four nested paths:

- `node_modules/@aws-sdk/client-s3/node_modules/fast-xml-parser`
- `node_modules/@aws-sdk/credential-provider-login/node_modules/fast-xml-parser`
- `node_modules/@aws-sdk/middleware-flexible-checksums/node_modules/fast-xml-parser`
- `node_modules/@aws-sdk/s3-request-presigner/node_modules/fast-xml-parser`

Each copy is required by a nested `@aws-sdk/xml-builder@3.972.29`, whose published dependency is the exact pin `fast-xml-parser: 5.7.3`. The direct API dependencies stay `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` at `^3.980.0`, resolved as `3.980.0`.

## Why an override

No published `@aws-sdk/xml-builder` depends on `fast-xml-parser >= 5.12.0`. The registry history (147 versions) pins the parser like this:

| Declared `fast-xml-parser` | Version count |
| --- | --- |
| none | 103 |
| `5.2.5` | 16 |
| `5.3.4` | 2 |
| `5.3.6` | 4 |
| `5.4.1` | 3 |
| `5.5.6` | 3 |
| `5.5.8` | 4 |
| `5.7.1` | 1 |
| `5.7.2` | 4 |
| `5.7.3` | 7 |

The exact `5.7.3` pin is `3.972.25` through `3.972.30` (`3.972.30` published `2026-06-15`). `3.972.31` (published `2026-06-22`) and every later release omit the dependency. Latest `3.972.43` (published `2026-11-09T20:13:35Z`) depends only on `tslib` `^2.6.2` and `@smithy/types` `^4.20.0`. `fast-xml-parser@5.12.0` itself was published `2026-11-03T12:15:08Z`, after xml-builder had already dropped the package, so no xml-builder release moved onto the patched parser.

Latest `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` are both `3.1166.0` (published `2026-11-10`). `client-s3@3.1166.0` depends on `@aws-sdk/core` `^3.981.0`, and `core@3.981.0` depends on `@aws-sdk/xml-builder` `^3.972.43`. That tree removes `fast-xml-parser` rather than depending on `>= 5.12.0`, and it would move the rest of the AWS SDK packages. The override is the smaller change that puts `fast-xml-parser` at `>= 5.12.0` and leaves the AWS SDK pins alone. The exemption list in `scripts/dependency-audit-gate.mjs` was not changed.

## Fix

`tixmoapi2/package.json` overrides:

```json
"fast-xml-parser": "^5.12.0"
```

The lockfile was regenerated with npm `11.19.0` (`npm install --package-lock-only --ignore-scripts` in `tixmoapi2`). The four nested `5.7.3` installations are gone. One hoisted copy resolves to `5.12.0` (`fast-xml-parser-5.12.0.tgz`). `npm ls fast-xml-parser --all` shows all four xml-builder paths deduped onto that copy:

- `@aws-sdk/client-s3@3.980.0` → `@aws-sdk/core@3.973.5` → `@aws-sdk/xml-builder@3.972.29` → `fast-xml-parser@5.12.0`
- `@aws-sdk/credential-provider-login@3.972.3` → the same `5.12.0`, deduped
- `@aws-sdk/middleware-flexible-checksums@3.972.3` → the same `5.12.0`, deduped
- `@aws-sdk/s3-request-presigner@3.980.0` → the same `5.12.0`, deduped

The lockfile still records xml-builder's own declaration `"fast-xml-parser": "5.7.3"`. That string is the upstream requirement. The override replaces the installed copy.

Packages that exist only because `fast-xml-parser` depends on them moved with the `5.12.0` ranges. Nothing else in the lockfile changed version:

| Package | Before | After |
| --- | --- | --- |
| `fast-xml-parser` | `5.7.3` (four nested copies) | `5.12.0` (hoisted) |
| `@nodable/entities` | `2.1.1` | `3.1.0` |
| `fast-xml-builder` | `1.2.0` | `1.3.1` |
| `path-expression-matcher` | `1.5.0` | `1.6.2` |
| `strnum` | `2.4.0` | `2.5.1` |
| `anynum` | `1.0.0` | `1.0.1` |
| `xml-naming` | `0.1.0` | `0.3.0` |
| `is-unsafe` | absent | `2.0.3` |

## Local verification

Install: `npm ci --prefix tixmoapi2` with Node `v24.21.0` / npm `11.19.0`. Exit 0, 817 packages added. `node -p "require('./tixmoapi2/node_modules/fast-xml-parser/package.json').version"` printed `5.12.0`.

API dependency audit, the same `npm --prefix tixmoapi2 audit --json` plus `evaluateDependencyAudit` call that `scripts/verify-market-local.mjs` makes:

```text
npm audit exit 1
vulnerability counts {"info":0,"low":6,"moderate":0,"high":0,"critical":0,"total":6}
advisories:
 - deepmerge 1243505 https://github.com/advisories/GHSA-gcqx-w48m-w2h4 low range=>=4.2.0 <=4.3.1
gate {"ok":true,"ignored":"ignored GHSA-gcqx-w48m-w2h4 on dev-only deepmerge under jest; remove when a patched deepmerge exists (https://github.com/advisories/GHSA-gcqx-w48m-w2h4)"}
```

`npm audit` still exits 1 because of the existing dev-only deepmerge exemption. `GHSA-474x-hrwr-fgx4` is not in the report. The market gate accepts the report.

| Command | Exit | Duration | Result |
| --- | --- | --- | --- |
| `npm --prefix tixmoapi2 run build` | 0 | 7s | Prisma client 5.22.0 generate, then `scripts/build.cjs` |
| `npm --prefix tixmoapi2 run lint` | 0 | 19s | 0 errors, 383 warnings |
| `npm --prefix tixmoapi2 test` | 1, then the two browser suites rerun at 0 | 546.511s, then 37.258s | See below |

Test environment, aligned with the market-readiness job: `CI=true`, `NODE_ENV=test`, `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`, loopback `tixmo_disposable_ci` on local PostgreSQL 16.15 (the workflow image is Postgres 14), Redis 7.0.15 database `/1`, `TIXMO_BROWSER_PATH=/usr/bin/google-chrome` (Chrome 156.0.8078.47), and the workflow's synthetic JWT, session, Stripe, and admin values. Receipt files were cleared first. `npm run build` completed before the suite.

The first `npm --prefix tixmoapi2 test` (`jest --runInBand`) reported 2 failed, 177 passed, 179 suites; 2 failed, 1674 passed, 1676 tests; 0 snapshots; 546.511s. Both failures were `tests/integration/scanner-browser.test.ts` and `tests/integration/wallet-browser-recovery.test.ts` at browser stage 1, category `other`. Those workers import Vite from `tdash` immediately after `mark(1)`. `tdash/node_modules` was not installed, so the import threw before Chrome started. That is a local setup gap, not the parser override.

After `npm ci --prefix tdash` (282 packages, 0 vulnerabilities), the same two files were rerun: 2 passed, 2 suites, 37.258s, exit 0. Together with the first run, all 179 suites and 1676 tests passed. No product assertion failed.

`npm run verify:market` was not executed as a whole. This environment has no Docker, and that command also runs the dashboard gates. The API audit step, API build, API lint, and API tests above are the checks this change can affect locally.

## CI

Draft PR #185, first head `be768d17b364fc133a7d07a8de41d016a373bff8`, run [42959194634](https://github.com/chapmandaniel/projectTixmo/actions/runs/42959194634):

- `configured-image-restore` succeeded.
- `local-gates` got past the API audit (`ignored GHSA-gcqx-w48m-w2h4` only) and then failed dashboard tests: `CheckoutPage` "renders the ended state instead of checkout when the public event has ended" expected `document.title` `Neon Nights · Tixmo` and received `Tixmo Dashboard`. 1 failed, 492 passed, 493 tests.

The title is set in a `useEffect` after the closed-sale heading commits. `findByRole` can return on that commit before the effect runs. `tdash/src/test/EventOnSalePage.test.jsx` already waits for the same title. The three closed-checkout title checks in `CheckoutPage.test.jsx` now use `waitFor` the same way. Local `npm --prefix tdash test -- --run` then passed: 65 files, 493 tests, exit 0, 23.56s. The checkout file also passed on three separate runs (49 tests each).
