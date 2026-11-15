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

## Conclusions

- `local-gates`: success on the fix commit.
- `configured-image-restore`: success on the fix commit.
- `scanner-browser` / `wallet-browser-recovery` flakes named in T106 did not hit this run.
- Draft PR only. Do not merge until #208 is merged or this PR is merged with it.
