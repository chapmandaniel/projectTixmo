# T107 entry timeline VALIDATION-only hour fix

Task: fix `getEntryTimeline` so hours whose only successful scans are `VALIDATION` are omitted entirely. Draft PR only; not merged. Stacked on #208 (`65f27543`); this branch contains #208's commits and should merge with or after #208.

Local Node `v24.21.0`, npm `11.19.0`. Disposable Postgres `tixmo_disposable_ci` on `127.0.0.1:5432` and Redis DB `/1`. Synthetic JWT/Stripe env matching `.github/workflows/market-readiness-local.yml`. No staging, production, or Stripe network traffic. Fake data only. No `workflow_dispatch`.

## Root cause

`tixmoapi2/src/api/events/stats.service.ts` `getEntryTimeline` grouped every successful scan by hour. For each scan it did:

1. Round `scannedAt` to the hour and `timelineMap.get(key) || { entries: 0, exits: 0 }`.
2. Increment `entries` only for `ENTRY` and `exits` only for `EXIT`.
3. **Always** `timelineMap.set(key, current)`.

A successful `VALIDATION` scan (or any `scanType` other than `ENTRY`/`EXIT`) therefore opened an hourly map entry with both counts still 0. The serializer then emitted `{ timestamp, entryCount: 0, exitCount: 0, occupancy: <prior> }`. The route is an entry/exit hourly breakdown; a validation-only hour should not appear.

Repro before the fix: only a successful `VALIDATION` scan in the window returned one zero-count bucket instead of `[]`. QA skipped that case in #208 as `EventStatsService getEntryTimeline omits hours that only contain successful VALIDATION scans`.

Mixed hours that also had `ENTRY`/`EXIT` already counted correctly; `VALIDATION` did not increment those counts. The bug was bucket *creation*, not the increment.

## Diff summary

Fix commit `ad0cf029e419837cff6ea2b244f0bee058249e03` (2 files, +33/−5):

- `tixmoapi2/src/api/events/stats.service.ts`: return before creating a map key unless `scanType` is `ENTRY` or `EXIT`. After that filter the remaining branch is `EXIT`, so `else if (scan.scanType === 'EXIT')` became `else`. Query, lookback window, occupancy clamp, and mixed-hour counting are unchanged.
- `tixmoapi2/tests/unit/stats.service.test.ts`: un-skipped the T106 case; added `counts ENTRY in a mixed hour and omits a neighboring VALIDATION-only hour` (hour 18 has VALIDATION + ENTRY → one bucket with `entryCount: 1`; hour 19 is VALIDATION-only and is omitted; occupancy 1 then 2).

## Local tests

Receipts cleared first (`http-pressure-receipt`, `http-ramp-receipt`, `native-recovery-receipt`, `payment-http-receipt`, `scanner-browser-guard`). `TIXMO_BROWSER_PATH=/usr/bin/google-chrome`. `npm --prefix tixmoapi2 test -- --runInBand` (pretest build).

| Suite | Command | Result |
| --- | --- | --- |
| Stats unit + HTTP | `tests/unit/stats.service.test.ts` `tests/integration/event-command-center-stats.test.ts` | **2** suites, **33** passed / **33** total, **0** skipped, 9.343s |
| Full API Jest | `npm --prefix tixmoapi2 test -- --runInBand` | **183** suites, **1743** passed / **1743** total, **0** skipped, 590.526s |

#208 was 1741 passed / 1742 total, 1 skipped. Un-skip + one new case → 1743 / 1743, 0 skipped. No retries, skips, or loosened assertions.

## CI run ids

`guard-and-build` (tdash-design-system) is path-filtered and does not run unless `tdash/**` changes. Soak is not required.

### Fix commit `ad0cf029e419837cff6ea2b244f0bee058249e03`

Workflow: [Tixmo Market Readiness Local Gates run 43513772218](https://github.com/chapmandaniel/projectTixmo/actions/runs/43513772218).

| Check | Run | Job | Conclusion |
| --- | --- | --- | --- |
| local-gates | [43513772218](https://github.com/chapmandaniel/projectTixmo/actions/runs/43513772218) | [132190341776](https://github.com/chapmandaniel/projectTixmo/actions/runs/43513772218/job/132190341776) | **success** (completed 2026-11-13T22:04:38Z) |
| configured-image-restore | [43513772218](https://github.com/chapmandaniel/projectTixmo/actions/runs/43513772218) | [132190342513](https://github.com/chapmandaniel/projectTixmo/actions/runs/43513772218/job/132190342513) | **success** (completed 2026-11-13T21:50:41Z) |
| guard-and-build | not triggered (no `tdash/**` change) | — | n/a |

Soak run [43513772208](https://github.com/chapmandaniel/projectTixmo/actions/runs/43513772208) skipped (not required). No job re-runs.

### Evidence commit `71b8feb300c01217fa73f6066ff84a3c31ef0af1`

Workflow: [Tixmo Market Readiness Local Gates run 43518823747](https://github.com/chapmandaniel/projectTixmo/actions/runs/43518823747).

| Check | Run | Job | Conclusion |
| --- | --- | --- | --- |
| local-gates | [43518823747](https://github.com/chapmandaniel/projectTixmo/actions/runs/43518823747) | [132207587309](https://github.com/chapmandaniel/projectTixmo/actions/runs/43518823747/job/132207587309) | **success** (completed 2026-11-13T22:39:54Z) |
| configured-image-restore | [43518823747](https://github.com/chapmandaniel/projectTixmo/actions/runs/43518823747) | [132207587084](https://github.com/chapmandaniel/projectTixmo/actions/runs/43518823747/job/132207587084) | **success** (completed 2026-11-13T22:25:51Z) |
| guard-and-build | not triggered (no `tdash/**` change) | — | n/a |

### Later T122 commits on this branch

T122 stacked timezone-independent hour-bucket test fixtures onto this PR (`edf4b048`, `8ddc008f`, `b4ebe54b`, evidence `8c251046`). Those commits do not change `stats.service.ts`. T107's product fix remains `ad0cf029`.

### T122 evidence commit `8c251046012f03a29ddbf7e28d690ae82d720a53`

Workflow: [Tixmo Market Readiness Local Gates run 43760653559](https://github.com/chapmandaniel/projectTixmo/actions/runs/43760653559).

| Check | Run | Job | Conclusion |
| --- | --- | --- | --- |
| local-gates | [43760653559](https://github.com/chapmandaniel/projectTixmo/actions/runs/43760653559) | [132954479337](https://github.com/chapmandaniel/projectTixmo/actions/runs/43760653559/job/132954479337) | **failure** — `users_create.test.ts` all 19 cases at `beforeAll` `cleanupTestData()` (`tests/integration/users_create.test.ts:18`). Not T107 timeline tests. Not `scanner-browser` / `wallet-browser-recovery`. T107 and T122 did not edit this file. |
| configured-image-restore | [43760653559](https://github.com/chapmandaniel/projectTixmo/actions/runs/43760653559) | [132954479588](https://github.com/chapmandaniel/projectTixmo/actions/runs/43760653559/job/132954479588) | **success** (completed 2026-11-15T20:57:28Z) |
| guard-and-build | not triggered | — | n/a |

Soak run [43760653470](https://github.com/chapmandaniel/projectTixmo/actions/runs/43760653470) skipped (not required).

GitHub Actions job re-run via API returned **403** (`Resource not accessible by integration`). No `workflow_dispatch`. T122 retriggered the same flake with evidence commit `5131a677` (not a T107 job re-run). `scanner-browser` / `wallet-browser-recovery` were **not** re-run; they did not fail.

### T122 retrigger `5131a6779d66580ee990392f094abe963434ccba`

Workflow: [Tixmo Market Readiness Local Gates run 43762151641](https://github.com/chapmandaniel/projectTixmo/actions/runs/43762151641).

| Check | Run | Job | Conclusion |
| --- | --- | --- | --- |
| local-gates | [43762151641](https://github.com/chapmandaniel/projectTixmo/actions/runs/43762151641) | [132959124097](https://github.com/chapmandaniel/projectTixmo/actions/runs/43762151641/job/132959124097) | **success** (completed 2026-11-15T21:23:44Z) |
| configured-image-restore | [43762151641](https://github.com/chapmandaniel/projectTixmo/actions/runs/43762151641) | [132959124373](https://github.com/chapmandaniel/projectTixmo/actions/runs/43762151641/job/132959124373) | **success** (completed 2026-11-15T21:13:36Z) |
| guard-and-build | not triggered (no `tdash/**` change) | — | n/a |

Soak run [43762151636](https://github.com/chapmandaniel/projectTixmo/actions/runs/43762151636) skipped (not required).

## Conclusions

- `local-gates`: **success** on T107 fix `ad0cf029`, T107 evidence `71b8feb3`, and T122 retrigger `5131a677`. **failure** then recovered on T122 evidence `8c251046` (`users_create.test.ts` beforeAll), unrelated to the timeline fix.
- `configured-image-restore`: **success** on `ad0cf029`, `71b8feb3`, `8c251046`, and `5131a677`.
- Named T106 browser flakes did not hit these runs. No GitHub job re-runs (API 403). T122 retriggered via `5131a677`; that run was green.
- Draft PR only. Do not merge until #208 is merged or this PR is merged with it.
