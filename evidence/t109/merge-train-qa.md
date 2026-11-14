# T109 merge-train QA (verification only)

Independent check of scratch branch `cursor/t108-merge-train` head
`7b8137a4811854bf1bbf267ab914d16bd9517d82` (base `main` `aee54592d25fc1134ea22f01bab0da59074479a0`).
Queue order: #198, #204, #190, #191, #192, #202, #200, #203, #205, #208, #209, #207, #206.

No app code was changed. No merge, deploy, staging, production, or Stripe traffic.
`--allow-remote` was not used. This branch is evidence-only and must not be merged to
`main`. `cursor/t108-merge-train` was not pushed.

Lead (T108) claimed API Jest 1761/0/0, tdash 507/0/0, passing build, and
in-progress local-gates run `43601485268`. Those product counts independently
reproduced. That CI run finished **success** while this QA ran.

## Summary

| Area | Result | Counts | Notes |
| --- | --- | --- | --- |
| API Jest | **PASS** | 1761 passed / 0 failed / 0 skipped (186/186 suites) | 609.761 s. Matches Lead CI-equivalent total. |
| tdash Vitest | **PASS** | 507 passed / 0 failed / 0 skipped (66 files) | 34.49 s. Matches Lead. |
| tdash build | **PASS** | Vite production build + buyer-policy + robots html | 9.17 s. |
| T83 QA smoke | **PASS** | 6 passed / 0 failed / 1 skipped | Loopback stub (documented dry-run). Host guard refused `example.invalid` (exit 2, no requests). |
| T90 map check | **PASS** | 155/155 mapped files present; 0 mapped tests removed/renamed/failing | Queue closed several T90 gaps; some others already closed on current `main` (#195). |
| Skipped-test audit | **PASS** | 0 active `it.skip` / `test.skip` / `describe.skip` / `xit` in API or tdash tests | T101, T106, T98/T99 WRONG_EVENT cases are live `it()` and included in the green totals. |
| CI local-gates | **PASS** | run `43601485268`, job `132466977767`, conclusion **success** | `workflow_dispatch` on this head. |
| CI configured-image-restore | **PASS** | run `43601485268`, job `132466977522`, conclusion **success** | Same workflow. |
| CI guard-and-build | **FAIL** | no run ID | `tdash-design-system.yml` has no `workflow_dispatch` and does not trigger on this non-default branch. Local substitute passed (design guard 739 baseline / no regressions; Vitest 507; build). |

Overall product verification: **PASS**. The only FAIL row is missing GitHub
`guard-and-build` on this scratch head (workflow trigger, not a product failure).

## Environment (this machine)

| Item | Value |
| --- | --- |
| Node | v24.21.0 (`nvm`) |
| Chrome | 157.0.8103.50 at `/usr/bin/google-chrome` (`TIXMO_BROWSER_PATH`) |
| PostgreSQL | 16.15 loopback, database `tixmo_disposable_t109` |
| Redis | 7.0.15 loopback, database `/1` |
| Opt-in | `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1` |
| Secrets | synthetic JWT/session/Stripe values matching `.github/workflows/market-readiness-local.yml`. No inherited app `.env`. Stripe was never fetched. |

## 1. API Jest

Command: `npm --prefix tixmoapi2 test -- --runInBand` (includes pretest build).
`NODE_OPTIONS=--max-old-space-size=8192`. Did **not** use `--json --outputFile`
(T108: that reporter OOM'd; not a test failure).

```
Test Suites: 186 passed, 186 total
Tests:       1761 passed, 1761 total
Snapshots:   0 total
Time:        609.761 s
```

Exit 0. 0 skipped. Scanner-browser ran because `TIXMO_BROWSER_PATH` was set
(T108's first pass skipped that one file without Chrome).

## 2. tdash tests and build

```
Test Files  66 passed (66)
      Tests  507 passed (507)
   Duration  34.49s
```

`npm --prefix tdash run build`: **passed** (Vite 6.4.5, 9.17 s). Buyer policy
pages and robots html check passed.

Local `guard-and-build` substitute (not a GitHub run):
`npm --prefix tdash run design:guard` — passed, 739 tracked baseline
violations, no regressions.

## 3. T83 QA smoke

Attested scripts copied to `/tmp/t83` only (not committed). Stub bound to
`127.0.0.1:43193`. No `--allow-remote`. Stripe not fetched.

Happy path (`--check-stripe-script`, expected SKIP on the stub's open-checkout
shell):

| Check | Result |
| --- | --- |
| public-event-list | PASS |
| event-slug | PASS |
| closed-checkout | PASS |
| draft-checkout | PASS |
| scanner-landing | PASS |
| allowed-origin-preflight | PASS |
| open-checkout-stripe-script | SKIP (static HTML has no `js.stripe.com`; documented) |
| **totals** | **6 PASS / 0 FAIL / 1 SKIP**, exit 0 |

Negative host-guard: `--api-base http://example.invalid` refused before any
request (`requests_sent: false`, process exit 2).

Smoke was **not** pointed at a live merge-train API/dashboard: the disposable
DB was in use by Jest, the T83 QA slugs are not seeded, and a live checkout
page is an SPA. Stub mode is the documented T83 dry-run.

## 4. T90 feature-to-test map

Map source: T90 analysis of `main` at `7f9eaa9` (42 features). Train base is
newer `main` `aee5459` (includes #195 coverage work).

- Every mapped test **file** still exists (155/155 key paths resolved; 0 missing).
- `git diff --diff-filter=DR aee54592...7b8137a -- tixmoapi2/tests tdash/src/test`:
  **empty**. No mapped test file removed or renamed on the train vs current main.
- Quoted T90 titles that name real tests still appear (ellipsis-truncated map
  strings resolve to the full `it()` / `it.each` titles). The string
  `Payment could not be completed.` is a T90 **gap**, not a mapped test; it is
  still absent (checkout `result.error` still untested).
- Full API + tdash suites passed, so mapped tests that still exist also passed.

### Coverage gaps the queue closed

| T90 gap | Closed by | Evidence on this head |
| --- | --- | --- |
| #4 Buyer wallet self-service (transfer/cancel/`GET /orders/mine`, WalletPage dialog) | #203 T101, #205 T103 | `buyer-wallet-self-service.test.ts`; WalletPage transfer/cancel/pagination tests; `WalletPage.jsx:129` `recipient.trim().toLowerCase()`; `transfer-recipient-email.test.ts` |
| #3 Offline door field contract (sync / disconnect / upload outcomes) | #200 T98 | `scanner-offline-field-contract.test.ts` (auth, snapshot, reconnect, unpaid/refunded/stolen/dup/unknown/garbage, WRONG_EVENT) |
| WRONG_EVENT offline validate-row | #202 T99 (+ scratch combine with #200) | live `it('keeps a wrong-event denial on the validate row as WRONG_EVENT rather than a throw-only 403')`; field-sequence row uses presented message + `reasonCode: WRONG_EVENT` |
| Event Command Center `occupancy` / `timeline` / `scanner-stats` | #208 T106 | `event-command-center-stats.test.ts`; expanded `stats.service.test.ts` |
| VALIDATION-only timeline hour buckets | #209 T107 | `it('omits hours that only contain successful VALIDATION scans')` un-skipped and passing |
| Untested dead dashboard modules (promo UI, EventWizard, ECC_Marketing, …) | #207 T104 | those files **deleted** (not mapped tests). Promo **API** remains; buyer still cannot apply a code |

### Gaps already closed on current `main` (not by the 13-PR queue)

T90 was taken at `7f9eaa9`. Train base `aee5459` already contains #195:

- Feature 35 notification preferences: `notification-preferences.test.ts` (was **None** on T90).
- Feature 3 org create HTTP: `organizations-admin-http.test.ts`.
- Feature 4 `TeamMemberWizard`: `tdash/src/test/TeamMemberWizard.test.jsx`.

### Gaps still open (not regressions)

Unchanged from T90 and **not** in this queue: dashboard refund success/role gating;
checkout `confirmPayment` `result.error` / thrown Stripe; no offline scanner
**client**; festival prototype; several staff surfaces. Offline server coverage
is now strong; `/scan` is still online-only.

## 5. Skipped-test audit

`rg` over `tixmoapi2/tests` and `tdash/src/test`:

| Pattern | Hits |
| --- | --- |
| `xit(` / `xdescribe(` / `xtest(` | none |
| `describe.skip` | none |
| `it.skip` | comment only: `scanner-offline-field-contract.test.ts:477` “drop T98's it.skip” |
| `test.skip` | helper only: `tixmoapi2/tests/helpers/missing-env.ts:75,78` (`testOrSkipMissingEnv`) |
| `.skip` (same two files) | as above |

`testOrSkipMissingEnv` still gates `scanner-browser.test.ts` (needs
`TIXMO_BROWSER_PATH`) and Stripe-webhook race files (needs synthetic
`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`). This run and CI set those, so
Jest reported **0 skipped**.

### Named cases

| Case | Status | Location |
| --- | --- | --- |
| T101 WalletPage transfer email not trimmed/lowercased | **PASS** (un-skipped, passing) | `tdash/src/test/WalletPage.test.jsx:188` `it('normalises the transfer recipient email (trim/lowercase) before POST')`. Implementation `WalletPage.jsx:129` `recipient.trim().toLowerCase()`. T101 evidence recorded this as skipped; #205 un-skipped it. |
| T106 `getEntryTimeline` VALIDATION-only hour buckets | **PASS** (un-skipped, passing) | `tixmoapi2/tests/unit/stats.service.test.ts:244` `it('omits hours that only contain successful VALIDATION scans')`. Mixed-hour neighbor at `:253`. #209 un-skipped the T106 skip. |
| T98/T99 WRONG_EVENT offline validate-row | **PASS** (un-skipped, passing) | `tixmoapi2/tests/integration/scanner-offline-field-contract.test.ts:478` live `it(...)`, not `it.skip`. Also the in-suite field-sequence WRONG_EVENT asserts at `:427–444` and live-scan 403 at `:503`. Scratch combine of #200/#202 dropped T98's skip (T108). |

## 6. CI on head `7b8137a`

Waited until nothing was queued or in progress. Only workflow run on this SHA:

| Workflow | Run ID | Event | Jobs | Conclusion |
| --- | --- | --- | --- | --- |
| Tixmo Market Readiness Local Gates (`market-readiness-local.yml`) | [43601485268](https://github.com/chapmandaniel/projectTixmo/actions/runs/43601485268) | `workflow_dispatch` | local-gates `132466977767` **success** (completed 2026-11-14T14:00:26Z); configured-image-restore `132466977522` **success** (completed 2026-11-14T13:50:25Z) | **success** (completed 2026-11-14T14:00:27Z) |
| Tdash Design System (`tdash-design-system.yml`, job `guard-and-build`) | **none** | — | — | **did not run** |

`guard-and-build` triggers on `pull_request` and `push` to `main`/`master` only
(no `workflow_dispatch`). T108 already could not start it without editing
workflows or opening a PR; T109 did neither. Local substitute: design guard +
Vitest 507 + production build, all passed.

Check-runs on `7b8137a`: `local-gates` success, `configured-image-restore`
success. Combined status API: no legacy statuses. No other workflow runs on
this SHA (including soak).

## 7. Regressions

**None found.** No failing product test, no mapped-test removal, no skip of the
named T101/T106/T98/T99 cases.

Process / evidence limitations (not product defects):

1. **CI `guard-and-build` missing on this head** — workflow trigger. Local
   substitute green. Severity: process/evidence, not product.
2. **T83 smoke used the loopback stub**, not a seeded local app. Severity: low;
   allowed by T83 README. Does not prove CORS/checkout HTML of the combined
   Vite/Express processes.
3. **T108 scratch combine of #200/#202** remains: a real #200 PR still needs
   refresh after #202 (drop `it.skip`, presented WRONG_EVENT message). That is
   a merge-order note, not a failure on this combined tree.
4. Remaining T90 product gaps listed in §4 were not in this queue and were not
   treated as merge-train regressions.

No secrets in this file. No app fix applied.
