# T120 merge-train v3 QA (independent verification)

Independent check of scratch branch `cursor/t119-merge-train-v3` head
`33528da409be4600807dc444bb08311bb1bc7a33` (base `main`
`aee54592d25fc1134ea22f01bab0da59074479a0`). Queue order: #198, #210, #204,
#190, #191, #192, #202, #200, #203, #205, #208, #209, #207, #206, #211, #212,
#213, #214.

Lead notes in `evidence/t119/merge-checklist.md` on that head were treated as
unverified. No app code was changed. `cursor/t119-merge-train-v3` and `main`
were not pushed, merged, or retargeted. No PR was opened. No staging,
production, Stripe, or other external product traffic. `--allow-remote` was not
used. Fake data only. This branch is evidence-only and must not be merged to
`main`.

## Overall verdict

**PASS** for product verification of merge-train v3.

Full dashboard suites, design guard, and production build are green on the
train and on `main`. API Jest on this machine reported the same two
`showpass-seed` failures on **both** the train and `main`; those cases are not
train regressions. GitHub `local-gates`, `configured-image-restore`, and
`guard-and-build` on `33528da` all finished **success**. Local HTTP + Chrome
CDP smoke against a disposable loopback API/Postgres/Redis (fake users, org,
event, tickets) passed the required flows.

## Per-flow smoke

Exercised against `http://127.0.0.1:3000` (Express `dist/index.js`) and
`http://127.0.0.1:5173` (Vite), disposable Postgres `tixmo_disposable_t120_smoke`
and Redis `/3`. Seeded fake OWNER/MANAGER/CUSTOMER, org, two ON_SALE events,
paid/unpaid/wrong-event tickets, and notifications. No checkout, payment, or
refund calls beyond what the suites already do.

| Flow | Result | How it was exercised |
| --- | --- | --- |
| (a) login and session | **PASS** | HTTP `POST /api/v1/auth/login`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` (all 200). Re-login for later flows. |
| (b) org/team admin | **PASS** | HTTP `POST /organizations` 201; `POST /users` invite TEAM_MEMBER 201 (`invitationPending=true`); manager cannot create OWNER (403); customer cannot invite (403); add member `POST /organizations/:id/members` 200; change role `PUT /users/:id` → PROMOTER 200; remove `DELETE .../members/:userId` 200; last OWNER `DELETE` 400 (guard is on this train and on current `main`). |
| (c) event dashboard | **PASS** | HTTP `GET /events/:id/stats`, `/occupancy`, `/timeline`, `/scanner-stats` all 200. Vite `GET /events/:eventId` and `/orders|/attendees|/tickets|/settings` all 200 SPA shells. Chrome CDP loaded `/events/<uuid>` while signed in (command-center route). |
| (d) tasks/todo | **PASS** | HTTP create 201, list 200, get 200, PATCH 200, comment 201, DELETE 204. Chrome CDP `/todo` rendered `h1=Task Manager`. |
| (e) notifications bell | **PASS** | HTTP list 200 (3 rows), `unreadOnly=true` 200 (2 unread), `PUT /:id/read` 200, `PUT /read-all` 200. Chrome CDP: bell `[aria-label=Notifications]` present; after seeding one unread row, `unreadDot=true`. |
| (f) door scanning | **PASS** | HTTP `POST /scanners/register` 201; live `POST /scanners/scan` valid ticket `data.valid=true`; duplicate `data.valid=false reason=ALREADY_USED`; unpaid `data.valid=false reason=UNPAID`; WRONG_EVENT HTTP 403 `reasonCode=WRONG_EVENT`; `GET /scanners/sync` 200; `POST /scanners/validate` batch 4 rows, foreign ticket `reasonCode=WRONG_EVENT`. |
| T83 extra (stub) | **PASS** | Attached `smoke.py` vs loopback stub: 6 PASS / 0 FAIL / 1 SKIP. Host guard refused `http://example.invalid` (exit 2, `requests_sent: false`). |
| T83 extra (live localhost) | **FAIL** (fixture, not product) | Same script vs local API+Vite without `--allow-remote`: 5 PASS / 1 FAIL / 1 SKIP. `event-slug` 404 because T83's QA slug is not seeded. Checkout/scan SPA 200; CORS preflight 204. Same limitation T109 recorded. |

Scanner duplicate/unpaid denials use a 200 envelope with `data.valid=false`
(not a top-level `success: false`). That is the live-scan contract, not a
failure.

## Suite counts (train vs main)

| Check | Train `33528da` | Main `aee5459` |
| --- | --- | --- |
| API Jest suites | 187 passed / 1 failed / 188 total | 181 passed / 1 failed / 182 total |
| API Jest tests | 1776 passed / 2 failed / 0 skipped / 1778 total | 1709 passed / 2 failed / 0 skipped / 1711 total |
| API Jest time | 667.461 s | 580.481 s |
| tdash Vitest files | 71 passed (71) | 66 passed (66) |
| tdash Vitest tests | 553 passed / 0 failed / 0 skipped | 500 passed / 0 failed / 0 skipped |
| tdash design:guard | passed, **739** baseline, no regressions | passed, **920** baseline, no regressions |
| tdash build | passed (Vite 6.4.5 + buyer-policy + robots html) | passed |

Commands: `npm --prefix tixmoapi2 test -- --runInBand` (includes pretest
build); `npm --prefix tdash test -- --run`; `npm --prefix tdash run design:guard`;
`npm --prefix tdash run build`. `NODE_OPTIONS=--max-old-space-size=8192`. Did
not use Jest `--json --outputFile` (T108/T109: that reporter OOM'd).

API +6 suites / +67 tests vs `main` are the new files from the queue
(`buyer-wallet-self-service`, `event-command-center-stats`,
`notifications.http`, `scanner-offline-field-contract`, `tasks.http`,
`transfer-recipient-email`) plus dashboard files
`EventManagementDashboard`, `TodoView`, `CreateTaskModal`,
`TaskDetailsModal`, `NotificationBell`. Guard baseline drop 920 → 739 is
#207 (dead-module deletion), not a weakened gate.

## Regressions vs main

**None.** Every Jest failure on the train also failed on `main` with the same
file, titles, and assertion (`result.code` expected 0, received 1):

| File | Test name | On main? | Likely PR | Classification |
| --- | --- | --- | --- | --- |
| `tixmoapi2/tests/integration/showpass-seed.test.ts` | `accepts the vendor-sandbox Railway name with NODE_ENV=development` | yes (same fail) | none (file unchanged vs `aee5459`) | local env: parent `CORS_ORIGIN` with loopback origins inherited into a seed child that sets `RAILWAY_ENVIRONMENT_NAME=vendor-sandbox`; CORS config refuses localhost on a named Railway env |
| `tixmoapi2/tests/integration/showpass-seed.test.ts` | `accepts the labs Railway name with NODE_ENV=development` | yes (same fail) | none | same |

Isolated re-run of that file on a fresh `tixmo_disposable_t120_seed` **without**
inherited `CORS_ORIGIN`: **4 passed / 0 failed**. CI `local-gates` on this
head succeeded, so GitHub did not reproduce the failure. Not a merge-train
product defect.

`git diff --diff-filter=DR aee54592...33528da -- tixmoapi2/tests tdash/src/test`
is empty: no mapped test file removed or renamed.

## Skipped tests

Jest and Vitest both reported **0 skipped** on train and on `main` in these
runs (`TIXMO_BROWSER_PATH=/usr/bin/google-chrome` and synthetic Stripe keys
set, so `testOrSkipMissingEnv` did not skip).

`rg` over `tixmoapi2/tests` and `tdash/src/test` on the train:

| Pattern | Hits |
| --- | --- |
| `xit(` / `xdescribe(` / `xtest(` | none |
| `describe.skip` / `it.skip` / `test.skip` as a test | none (only `tests/helpers/missing-env.ts` helper and a T98 comment) |

### Named T-job skip cases (all live `it()` on this train)

| Case | Status | Location | Notes |
| --- | --- | --- | --- |
| T113 fetch-error stays on event dashboard | **live, passing in Vitest** | `tdash/src/test/EventManagementDashboard.test.jsx` `shows a fetch error instead of silently leaving the event dashboard` | Un-skipped by #212 (T114). Not an active skip. |
| T113 title-only friendly slug | **live, passing in Vitest** | same file `keeps the friendly slug when the event only has a title` | Un-skipped by #212. |
| T117 non-UUID mark-read | **live, passing in Jest** | `tixmoapi2/tests/integration/notifications.http.test.ts` `rejects a non-UUID notification id on mark-read (notifications/routes.ts:60)` | Un-skipped by #214 (T118). |
| T117 mention suggestions null lastName | **live, passing in Vitest** | `tdash/src/test/CreateTaskModal.test.jsx` | Un-skipped by #214. |
| T117 TaskDetailsModal priority enum | **live, passing in Vitest** | `tdash/src/test/TaskDetailsModal.test.jsx` | Un-skipped by #214. |
| T117 bell mark-all-read | **live, passing in Vitest** | `tdash/src/test/NotificationBell.test.jsx` | Un-skipped by #214. |
| T101 WalletPage transfer email | **live** | `tdash/src/test/WalletPage.test.jsx` `normalises the transfer recipient email (trim/lowercase) before POST` | Un-skipped by #205; still present. |
| T106 VALIDATION-only timeline hours | **live** | `tixmoapi2/tests/unit/stats.service.test.ts` `omits hours that only contain successful VALIDATION scans` | Un-skipped by #209; still present. |
| T98/T99 WRONG_EVENT offline validate-row | **live** | `tixmoapi2/tests/integration/scanner-offline-field-contract.test.ts` | Comment still says “drop T98's it.skip”; case is a live `it()`. Confirmed over HTTP in smoke. |

No new `it.skip` was added by this train (Lead's claim matches).

## T90 map and T109 hold

T90 map source: attached analysis of `main` at `7f9eaa9` (42 features).

- Unique quoted test filenames in that map: **158**. All resolved on this
  head (0 missing). Glob entries (`payment-distinct-*.test.ts`,
  `payment-expired-*.test.ts`) expand to existing files.
- T109's 155/155 mapped-file check still holds: nothing T90 named has been
  deleted or renamed on the train vs current `main`.
- T90 string `Payment could not be completed.` remains a **gap**, not a
  mapped test (checkout `result.error` still untested).

T109 product conclusions still hold, with expected extras from PRs that were
not in the T108/T109 13-PR queue:

| T109 claim | T120 |
| --- | --- |
| No mapped-test removal vs `aee5459` | still true |
| Named T101 / T106 / T98/T99 cases live and green | still true |
| T90 gaps closed by #203/#205, #200/#202, #208/#209, #207 still closed | files and titles still present |
| CI `guard-and-build` missing on scratch head | **no longer true**: #210 added `workflow_dispatch`; run below succeeded |
| T83 live app not seeded with QA slugs | still true; stub extra-check used |

Remaining T90 gaps T109 listed as out of queue (dashboard refund success/role
gating, checkout `confirmPayment` `result.error`, no offline scanner client,
festival prototype) are still out of this 18-PR queue and are not treated as
train regressions.

## CI on head `33528da`

Waited until both named runs completed (`gh run watch` + API poll). Nothing
queued or in progress at the end. Combined commit-status API: no legacy
statuses (`total_count: 0`). No other workflow runs on this SHA (including
soak; soak is PR-triggered).

| Workflow | Run | Event | Jobs | Conclusion |
| --- | --- | --- | --- | --- |
| Tixmo Market Readiness Local Gates (`market-readiness-local.yml`) | [43747017803](https://github.com/chapmandaniel/projectTixmo/actions/runs/43747017803) | `workflow_dispatch` | [local-gates 132912467479](https://github.com/chapmandaniel/projectTixmo/actions/runs/43747017803/job/132912467479) **success** (completed 2026-11-15T18:44:05Z); [configured-image-restore 132912467219](https://github.com/chapmandaniel/projectTixmo/actions/runs/43747017803/job/132912467219) **success** (completed 2026-11-15T18:32:11Z) | **success** (completed 2026-11-15T18:44:06Z, 14m54s) |
| Tdash Design System (`tdash-design-system.yml`) | [43747020455](https://github.com/chapmandaniel/projectTixmo/actions/runs/43747020455) | `workflow_dispatch` | [guard-and-build 132912475034](https://github.com/chapmandaniel/projectTixmo/actions/runs/43747020455/job/132912475034) **success** (completed 2026-11-15T18:31:00Z) | **success** (1m48s) |

`configured-image-restore` log annotations about Docker log exit 1 on the
runner image notice are not a job failure; job conclusion is success.

## Environment (this machine)

| Item | Value |
| --- | --- |
| Node | v24.21.0 (`nvm`) |
| Chrome | 157.0.8103.50 at `/usr/bin/google-chrome` (`TIXMO_BROWSER_PATH`) |
| PostgreSQL | 16.15 loopback; train Jest `tixmo_disposable_t120`; main Jest `tixmo_disposable_t120_main`; smoke `tixmo_disposable_t120_smoke` |
| Redis | 7.0.15 loopback; Jest `/1` (train) `/2` (main); smoke `/3` |
| Opt-in | `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1` |
| Secrets | synthetic JWT/session/Stripe values matching `.github/workflows/market-readiness-local.yml`. No inherited app `.env`. Stripe was never fetched. |

Kanban CLI was not available in this Cloud Agent session.

## Limitations

1. **Local API Jest `showpass-seed` (2 tests)** — same on `main`; caused by
   inherited loopback `CORS_ORIGIN` in the QA shell. Isolated re-run without
   that env passed. CI green. Severity: environment/evidence, not product.
2. **T83 live localhost** failed `event-slug` because the documented QA slugs
   were not seeded. Stub extra-check passed; host guard stayed on. Severity:
   low; allowed by T83 README / T109.
3. **Dashboard UI** was Chrome CDP against Vite with a session injected into
   `localStorage` after HTTP login, plus SPA `GET` 200s. Not a visual /
   mobile / camera pass.
4. **Scanner unpaid/duplicate** assertions are the API's `data.valid=false`
   reasons, not HTTP 4xx.
5. Remaining T90 product gaps listed above were not in this queue.

No secrets in this file. No app fix applied.
