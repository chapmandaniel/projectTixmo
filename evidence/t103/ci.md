# T103 CI notes

Product head: `6d447420afbb255efa09194eca88ea7b47889627` (email normalisation). This note records required-check outcomes; it does not change product code.

## Local suites on `6d447420`

Disposable Postgres `tixmo_disposable_t103`, Redis `/1`. API Jest **1723 passed** / 0 failed / 0 skipped. tdash Vitest **506 passed** / 0 failed / 0 skipped. `scanner-browser.test.ts` passed in that API run.

## Required checks on `6d447420`

| Check | Workflow run | Job | Status |
| --- | --- | --- | --- |
| local-gates | [43473347354](https://github.com/chapmandaniel/projectTixmo/actions/runs/43473347354) | [132050703319](https://github.com/chapmandaniel/projectTixmo/actions/runs/43473347354/job/132050703319) | fail, 14m46s — `scanner-browser.test.ts` worker diagnostic **stage 8 / detail 2** (`stopped(browsers[1])` after `mark(8)`). `raceArrivals=2`. Not a T103 test. Not weakened. |
| configured-image-restore | [43473347354](https://github.com/chapmandaniel/projectTixmo/actions/runs/43473347354) | [132050702828](https://github.com/chapmandaniel/projectTixmo/actions/runs/43473347354/job/132050702828) | pass |
| guard-and-build | [43473346914](https://github.com/chapmandaniel/projectTixmo/actions/runs/43473346914) | [132050700250](https://github.com/chapmandaniel/projectTixmo/actions/runs/43473346914/job/132050700250) | pass |

`http-soak` skipped (opt-in). Receipt: `passed: false`, `diagnosticStage: 8`, `diagnosticDetail: 2`, `diagnosticReason: 0`.
