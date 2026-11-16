# T126 merge-train v4 checklist

Throwaway scratch branch `cursor/t126-merge-train-v4`. Base `main`
`aee54592d25fc1134ea22f01bab0da59074479a0`. Queue (merge commits, no squash):
#198, #210, #204, #190, #191, #192, #202, #200, #203, #205, #208, #209, #207,
#206, #211, #212, #213, #214, #216, #217.

This branch must not be merged to `main`. No deploy, no staging / production /
Stripe traffic, no branch-protection or settings changes. Fake data only.
`--allow-remote` was not used. Secrets are not printed (values redacted to last
4 where an identifier is needed).

Train HEAD after the 20 merges (before this evidence file):
`70ec07ca85bae9e329a76fd9e26cf476e5804733`.

## PR queue (current heads at merge time)

All 20 PRs were **open**. None skipped. Heads below are the exact SHAs merged
(re-checked still current at merge time).

| Order | PR | Title | Head SHA merged | Merge result |
| --- | --- | --- | --- | --- |
| 1 | #198 | T96: always report required PR checks without path-filter skips | `9256622171e10795f0c9a9ad92d09e5eda19c00a` | clean `f04ec167` |
| 2 | #210 | ci: add workflow_dispatch to Tdash Design System (T111) | `45c0f697041e6eab526a657032080142fec8024c` | clean `8b2223d8` |
| 3 | #204 | T100: make API + tdash test suites deterministic (draft) | `1718c506a9b4a341e4e2bff17ff0e6e116d2a6eb` | clean `3c361cd0` |
| 4 | #190 | Bump the tdash-patches group in /tdash with 6 updates | `392e22267e9f1372125d2b7c1d56106a5e009fc3` | clean `91a0dfd4` |
| 5 | #191 | Bump @stripe/react-stripe-js from 6.6.0 to 7.0.1 in /tdash | `75247c18e2c5ce0ff516b38c8a9759514b0fe673` | clean `ebe9c47e` |
| 6 | #192 | Bump the tixmoapi2-patches group in /tixmoapi2 with 4 updates | `2fd9739a9422bc057a5d9d9838eee501a21d319a` | clean `7598cc35` |
| 7 | #202 | T99: return WRONG_EVENT reasonCode on offline validate | `985d05c6cd428a1806aac614c00a89aa92ff5aef` | clean `6ad02d31` |
| 8 | #200 | test: cover offline door scanning field contract (T98) | `4fd5fc98128620f8be434eaf74121f20c01c0a1b` | clean `e76606b8` |
| 9 | #203 | test: cover buyer wallet self-service (T101) | `e7fbe8a0d4cdac1e3ecf87584102bc91c1456747` | clean `cf9acf0f` |
| 10 | #205 | T103: normalise wallet transfer recipient email (draft) | `841746d1776fa5f49c0d7ae77e270c01dc7f5dc7` | clean `9e7ff5ec` |
| 11 | #208 | test: Event Command Center occupancy, timeline, and scanner-stats (T106) | `edf4b048c990cd5cfb501d5420917006497dc979` | clean `e9e4aff5` |
| 12 | #209 | fix: omit VALIDATION-only hours from entry timeline (T107) | `0e4e94a2c0f6f388962086d961c5f948a708786d` | clean `22a14468` |
| 13 | #207 | T104: delete dead tdash code (draft) | `492a130ed4617a5f1f3433a56e566b2c7ec19a6d` | clean `5ca78539` |
| 14 | #206 | T105b: docs-only, mark stale onsale/deploy docs historical (draft) | `8f60f3e3626b4fb3499d2fdc8bd707a9d150778b` | clean `ec38d487` |
| 15 | #211 | test: cover EventManagementDashboard and TeamMemberWizard flows | `dd187696c72a0e51dacf3151c6bc85b848e7645d` | clean `3055d614` |
| 16 | #212 | fix: keep event dashboard on fetch errors and title-only slugs | `9e07efcf4ac2e03fb2ab153c52bfe83a4071e530` | clean `4cf8ec6e` |
| 17 | #213 | test: cover tasks HTTP/Todo and notification list/read/bell (T117) | `9174a4c723e9b1398908e1da8d177726936ca2e4` | clean `be495f65` |
| 18 | #214 | fix: T118 QA bugs — UUID 400, bell read-all, mention nulls, priority enum | `ec47ac28558b7a3263e03775ec4cbdd18432a57b` | clean `3f836c82` |
| 19 | #216 | fix(hooks): raise pre-push V8 heap ceiling so verify:api does not OOM (T121) | `42c823c855dbb44f216288aaed486c71bd2d06ef` | clean `7a3605d4` |
| 20 | #217 | fix(hooks): clear leftover task6NN receipt files before pre-push (T122) | `487027e78214dd1b5dc8872dad3cf0c30ab0ae30` | **conflict** → `70ec07ca` |

Stacked PRs merged as given: #210 on #198, #200 contains #202, #205 on #203,
#209 on #208, #212 on #211, #214 on #213. Git recorded them as empty-or-clean
fast-forwards of already-included commits plus the remaining unique commits.

## Conflict notes

Only **#217** conflicted, in `tixmoapi2/.husky/pre-push` against #216.

Minimal resolution kept both intents:

1. #217 receipt cleanup first: `rm -f runtime/task6[0-9][0-9]-*.json`
2. #216 `NODE_OPTIONS` heap ceiling (`--max-old-space-size=4096` unless already set)
3. Existing `typecheck` + `verify:api`

No other files were touched for conflict resolution. No test assertions,
baselines, or product code were edited to make checks pass.

## Suite counts (train vs main)

Commands: `npm --prefix tixmoapi2 test -- --runInBand` (includes pretest
build); `npm --prefix tdash test -- --run`; `npm --prefix tdash run design:guard`;
`npm --prefix tdash run build`. `NODE_OPTIONS=--max-old-space-size=8192`.
`TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`. Did not use Jest `--json --outputFile`
(T108/T109: that reporter OOM'd). CORS_ORIGIN and RAILWAY_ENVIRONMENT_NAME
were **unset** for the full suites.

| Check | Train `70ec07ca` | Main `aee5459` |
| --- | --- | --- |
| API Jest suites | 188 passed / 188 total | 182 passed / 182 total |
| API Jest tests | 1778 passed / 0 failed / 0 skipped / 1778 total | 1711 passed / 0 failed / 0 skipped / 1711 total |
| API Jest time | 604.168 s (EXIT 0) | 590.361 s (EXIT 0) |
| tdash Vitest files | 71 passed (71) | 66 passed (66) |
| tdash Vitest tests | 553 passed / 0 failed / 0 skipped | 500 passed / 0 failed / 0 skipped |
| tdash design:guard | passed, **739** baseline, no regressions | passed, **920** baseline, no regressions |
| tdash build | passed (Vite 6.4.5 + buyer-policy + robots html) | passed |

API +6 suites / +67 tests vs `main` are the new files from the queue (same
delta T120 recorded on the 18-PR train). Guard baseline drop 920 → 739 is #207
(dead-module deletion), not a weakened gate.

### showpass-seed (known CORS_ORIGIN env)

Full suites on this machine did **not** reproduce the 2 showpass-seed failures
because `CORS_ORIGIN` was unset (test-env helper). Isolated re-runs of
`tixmoapi2/tests/integration/showpass-seed.test.ts` on disposable
`tixmo_disposable_t126_seed` / Redis `/4`:

| Env | Result |
| --- | --- |
| CORS_ORIGIN unset, RAILWAY_ENVIRONMENT_NAME unset | **4 passed / 0 failed** (4.168 s) |
| CORS_ORIGIN=`http://localhost:5173,http://127.0.0.1:3000` (loopback, inherited into seed child that sets `RAILWAY_ENVIRONMENT_NAME=vendor-sandbox` / `labs`) | **2 failed / 2 passed**: `accepts the vendor-sandbox Railway name with NODE_ENV=development` and `accepts the labs Railway name with NODE_ENV=development` (`result.code` expected 0, received 1) |

That matches T120's diagnosis: not a train regression. File is unchanged vs
`aee5459`. GitHub `local-gates` on this head succeeded, so CI did not
reproduce the failure.

## Per-flow smoke (fake data, localhost)

Exercised against `http://127.0.0.1:3000` (Express `dist/index.js`,
`NODE_ENV=development`) and `http://127.0.0.1:5173` (Vite), disposable
Postgres `tixmo_disposable_t126_smoke` and Redis `/3`. Seeded fake
OWNER/MANAGER/CUSTOMER, org, two ON_SALE events, paid/unpaid/wrong-event
tickets, and notifications via HTTP + Prisma. No checkout, payment, or refund
calls. Chrome 157.0.8103.50 CDP for dashboard UI.

| Flow | Result | How it was exercised |
| --- | --- | --- |
| (a) login and session | **PASS** | HTTP `POST /api/v1/auth/register` 201, `POST /auth/login` 200, `GET /auth/me` 200, `POST /auth/refresh` 200, `POST /auth/logout` 200, re-login 200. |
| (b) org/team admin | **PASS** | HTTP `POST /organizations` 201; `POST /users` invite TEAM_MEMBER 201 (`invitationPending=true`); manager cannot create OWNER (403); customer cannot invite (403); add member `POST /organizations/:id/members` 200; change role `PUT /users/:id` → PROMOTER 200; remove `DELETE .../members/:userId` 200; last OWNER `DELETE` 400. |
| (c) event dashboard | **PASS** | HTTP `GET /events/:id/stats`, `/occupancy`, `/timeline`, `/scanner-stats` all 200. Vite `GET /events/:eventId` and `/orders` `/attendees` `/tickets` `/settings` all 200 SPA shells. Chrome CDP loaded `/events/<uuid>` signed in; command center rendered the event name. |
| (d) tasks/todo | **PASS** | HTTP create 201, list 200, get 200, PATCH 200, comment 201, DELETE 204. Chrome CDP `/todo` rendered `h1=Task Manager`. |
| (e) notifications bell | **PASS** | HTTP list 200 (3 rows), `unreadOnly=true` 200 (2 unread), `PUT /:id/read` 200, `PUT /read-all` 200. Chrome CDP: bell `[aria-label=Notifications]` present; after seeding one unread row, `unreadDot=true`. |
| (f) door scanning | **PASS** | HTTP `POST /scanners/register` 201; live `POST /scanners/scan` valid ticket `data.valid=true`; duplicate `data.valid=false reason=ALREADY_USED`; unpaid `data.valid=false reason=UNPAID`; WRONG_EVENT HTTP 403 `reasonCode=WRONG_EVENT`; `GET /scanners/sync` 200; `POST /scanners/validate` batch 4 rows, foreign ticket `reasonCode=WRONG_EVENT`. |

Scanner duplicate/unpaid denials use a 200 envelope with `data.valid=false`
(not a top-level HTTP 4xx). That is the live-scan contract, not a failure.

## CI on head `70ec07ca`

`gh workflow run` / `POST .../dispatches` with this agent's GitHub App token
returned **HTTP 403** `Resource not accessible by integration` (no `actions:
write`). To still run the named jobs on this head without targeting `main`, a
draft PR **#219** was opened from `cursor/t126-merge-train-v4` onto throwaway
base `cursor/t126-ci-base-823b` (`aee5459`). That is **not** a merge-to-main
PR. Event on the runs below is `pull_request` (path filter still reported
relevant=true vs that base). Waited until both named runs completed (`gh run
watch` + poll). `configured-image-restore` log annotations about Docker log
exit 1 on the runner image notice are not a job failure; job conclusion is
success.

| Workflow | Run | Event | Jobs | Conclusion |
| --- | --- | --- | --- | --- |
| Tixmo Market Readiness Local Gates (`market-readiness-local.yml`) | [43874833728](https://github.com/chapmandaniel/projectTixmo/actions/runs/43874833728) | `pull_request` | [local-gates 133325030001](https://github.com/chapmandaniel/projectTixmo/actions/runs/43874833728/job/133325030001) **success** (completed 2026-11-16T13:35:53Z); [configured-image-restore 133325030442](https://github.com/chapmandaniel/projectTixmo/actions/runs/43874833728/job/133325030442) **success** (completed 2026-11-16T13:23:06Z) | **success** (13:20:30Z–13:35:53Z, ~15m23s) |
| Tdash Design System (`tdash-design-system.yml`) | [43874833865](https://github.com/chapmandaniel/projectTixmo/actions/runs/43874833865) | `pull_request` | [guard-and-build 133325030929](https://github.com/chapmandaniel/projectTixmo/actions/runs/43874833865/job/133325030929) **success** (completed 2026-11-16T13:22:10Z) | **success** (~1m39s) |

Soak on the same PR was skipped (opt-in). Combined commit-status API was not
used as a gate.

This evidence file is committed after those runs. The evidence commit changes
HEAD; follow-up CI on the new HEAD must also be green before T126 is complete.

## Regressions vs main

**None.** Full API/tdash suites on the train and on `main` were EXIT 0 with 0
failed tests. The only showpass-seed failures seen were the inherited
`CORS_ORIGIN` environment case, reproduced in isolation on both this train
checkout and historically on `main` (T120). Not a merge-train product defect.

`#216` / `#217` add no product tests; suite counts vs T120's 18-PR train are
unchanged (188/1778 API, 71/553 tdash).

## Environment (this machine)

| Item | Value |
| --- | --- |
| Node | v24.21.0 (`nvm`; PATH prefers nvm over `/exec-daemon/node` v22) |
| Chrome | 157.0.8103.50 at `/usr/bin/google-chrome` (`TIXMO_BROWSER_PATH`) |
| PostgreSQL | 16.15 loopback; train Jest `tixmo_disposable_t126`; main Jest `tixmo_disposable_t126_main`; smoke `tixmo_disposable_t126_smoke`; seed isolate `tixmo_disposable_t126_seed` |
| Redis | 7.0.15 loopback; Jest `/1` (train) `/2` (main); smoke `/3`; seed `/4` |
| Opt-in | `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1` |
| Secrets | synthetic JWT/session/Stripe values matching `.github/workflows/market-readiness-local.yml`. No inherited app `.env`. Stripe was never fetched. JWT secret last4 `alue`. |

Kanban CLI was not available in this Cloud Agent session.

## Limitations

1. **workflow_dispatch 403** — GitHub App token cannot create dispatch events.
   Named jobs still ran on `70ec07ca` via draft PR #219 targeting throwaway
   base `cursor/t126-ci-base-823b`, **not** `main`. Event name is
   `pull_request` rather than `workflow_dispatch`. #210's dispatch YAML is
   present on the train; this agent could not exercise the dispatch API.
2. **Local showpass-seed** fails if `CORS_ORIGIN` has loopback origins and the
   seed child sets a named Railway env. Isolated re-run without that env
   passed. CI green. Severity: environment/evidence, not product.
3. **Dashboard UI** was Chrome CDP against Vite with a session injected into
   `localStorage` after HTTP login, plus SPA `GET` 200s. Not a visual /
   mobile / camera pass.
4. **Scanner unpaid/duplicate** assertions are the API's `data.valid=false`
   reasons, not HTTP 4xx.
5. T83 extra-check / live QA slugs were not in the T126 required smoke list
   and were not re-run.
6. Draft PR #219 exists only to start Actions; it must not be retargeted or
   merged to `main`.

No secrets in this file. No app fix applied beyond the #217 husky conflict
resolution recorded above.
