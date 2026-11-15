# T122 timezone-independent hour-bucket tests + husky leftover cleanup

Draft only. No merge, deploy, staging, branch-protection, force-push, or `workflow_dispatch`. No retries, skips, or weakened assertions.

Local Node `v24.21.0`. Disposable Postgres `tixmo_disposable_t122` (TZ Jest) / `tixmo_disposable_t122hook` (hook proof) on `127.0.0.1:5432`, Redis `/1` and `/2`. Synthetic JWT/Stripe env matching `.github/workflows/market-readiness-local.yml`. No staging, production, or Stripe network traffic.

## Which PR added the failing tests

DevOps T121 (draft [PR #216](https://github.com/chapmandaniel/projectTixmo/pull/216)) reported two `tixmoapi2` `EventStatsService` hour-bucket failures on merge-train `cursor/t119-merge-train-v3` @ `33528da` under `TZ=America/St_Johns` (UTC−3:30).

Reproduced on that train head with `TZ=America/St_Johns npx jest --runInBand tests/unit/stats.service.test.ts`:

| Test | Originating PR | Pre-fix failure |
| --- | --- | --- |
| `EventStatsService getEntryTimeline groups successful scans by hour with cumulative occupancy` | [#208](https://github.com/chapmandaniel/projectTixmo/pull/208) T106 (`65f27543`) | expected `2026-11-13T18:00:00.000Z` / `19:00:00.000Z`; received `17:30:00.000Z` and split counts (18:10 stayed in the 17:30 bucket, 18:40/18:50 crossed into 18:30) |
| `EventStatsService getEntryTimeline counts ENTRY in a mixed hour and omits a neighboring VALIDATION-only hour` | [#209](https://github.com/chapmandaniel/projectTixmo/pull/209) T107 (`71b8feb3`), stacked on #208 | expected `17:00:00.000Z` / `18:00:00.000Z`; received `16:30:00.000Z` |

Both tests live in `tixmoapi2/tests/unit/stats.service.test.ts`. #208 still skips `omits hours that only contain successful VALIDATION scans` (`it.skip`); T107 un-skipped that case and added the mixed-hour test.

## Root cause

Not a product timezone bug. `getEntryTimeline` (`tixmoapi2/src/api/events/stats.service.ts`) floors each `scannedAt` with `Date#setMinutes(0, 0, 0)` (local) then uses `toISOString()` as the map key. That is existing bucket behavior.

The tests hardcoded UTC hour-start keys (`18:00Z`, `19:00Z`, …) and used scan instants that straddle a half-hour offset (`:10` vs `:40`/`:50`). On `America/St_Johns` (UTC−3:30) and `Asia/Kolkata` (UTC+5:30), `setMinutes(0,0,0)` lands on `:30` UTC, so one UTC hour becomes two local-hour buckets and the expected ISO keys never match.

Service code was left unchanged.

## Fix

Timezone-independent expectations: pin every scan inside a 20-minute window away from `:00`/`:30`, and build expected timestamps with the same local-hour floor the service uses.

```ts
function localHourTimestamp(scannedAt: Date): Date {
  const hour = new Date(scannedAt);
  hour.setMinutes(0, 0, 0);
  return new Date(hour.toISOString());
}
```

| PR | Commit | Change |
| --- | --- | --- |
| #208 | `edf4b048c990cd5cfb501d5420917006497dc979` | grouping test: 18:10/18:20 ENTRY, 18:25 EXIT, 19:10 ENTRY, 19:20 VALIDATION; expected keys via helper |
| #209 | `8ddc008f` | `git merge` of #208's new head (no rebase / no force) |
| #209 | `b4ebe54b1fe8281da34e1f3466b8f99911212a10` | mixed-hour test: 17:10 ENTRY, 18:10/18:25 VALIDATION, 18:20 ENTRY, 19:10 VALIDATION-only omitted; expected keys via helper |

Assertions still check length, `entryCount`/`exitCount`/`occupancy`, and that the VALIDATION-only hour is absent. No product behavior change.

## Local TZ proof (affected suite)

Node `v24.21.0`. `npx jest --runInBand tests/unit/stats.service.test.ts`.

### #208 @ `edf4b048` (`tests/unit/stats.service.test.ts`)

The 1 skip is T106's `it.skip('omits hours that only contain successful VALIDATION scans')`, un-skipped on #209. Not introduced by T122.

| TZ | Suites | Tests |
| --- | --- | --- |
| `America/St_Johns` | 1 passed / 1 | 1 skipped, 15 passed / 16 |
| `UTC` | 1 passed / 1 | 1 skipped, 15 passed / 16 |
| `Asia/Kolkata` | 1 passed / 1 | 1 skipped, 15 passed / 16 |

### #209 @ `b4ebe54b` (`tests/unit/stats.service.test.ts`)

| TZ | Suites | Tests |
| --- | --- | --- |
| `America/St_Johns` | 1 passed / 1 | 17 passed / 17 |
| `UTC` | 1 passed / 1 | 17 passed / 17 |
| `Asia/Kolkata` | 1 passed / 1 | 17 passed / 17 |

### Integration (not one of the two failing unit tests; same service)

`TZ=America/St_Johns npx jest --runInBand tests/integration/event-command-center-stats.test.ts` on #209 @ `b4ebe54b`: **1** suite, **16** passed / **16**.

## Full tixmoapi2 Jest (once)

On #209 @ `b4ebe54b`. `NODE_OPTIONS=--max-old-space-size=8192`, default reporter (not `--json`). Disposable `tixmo_disposable_t122`, Redis `/1`, receipts cleared first, `npm --prefix tixmoapi2 run build` already present.

```
START 20:07:38Z SHA=b4ebe54b1fe8281da34e1f3466b8f99911212a10 NODE=v24.21.0
Test Suites: 183 passed, 183 total
Tests:       1743 passed, 1743 total
Snapshots:   0 total
Time:        568.251 s
EXIT=0 20:17:07Z
```

No retries, skips, or loosened assertions.

## (b) Separate draft PR: husky leftover receipts

[PR #217](https://github.com/chapmandaniel/projectTixmo/pull/217) `cursor/t122-husky-receipt-cleanup-5658` @ `487027e78214dd1b5dc8872dad3cf0c30ab0ae30`, branched from `main`. Draft. Not stacked on #208/#209.

`tixmoapi2/.husky/pre-push` now starts with `rm -f runtime/task6[0-9][0-9]-*.json` (scoped glob; `rm -f` is safe if none exist), then the same typecheck + `verify:api`.

Proof in one clone (`/tmp/t122-husky`), disposable `tixmo_disposable_t122hook` / Redis `/2`:

1. Planted leftovers: `runtime/task608-http-pressure.json`, `task609-http-ramp.json`, `task612-native-recovery.json`, `task615-scanner-browser.json`, `task616-payment-http.json`.
2. `./tixmoapi2/.husky/pre-push` run 1 @ 20:24:00Z → `[verify:api] API verification passed.` `HOOK1_EXIT=0` 20:34:25Z. Fresh receipts written by that run.
3. Immediate run 2 @ 20:34:25Z with those leftovers still on disk → passed. `HOOK2_EXIT=0` 20:44:31Z.

The second run no longer fails for leftover `runtime/task6NN-*.json`. Glob is `task6[0-9][0-9]-*.json` so it covers task608–616 (a `task60*-*.json` glob would miss `task612`).

## Refreshed stacked PRs

| PR | Branch | Head | Notes |
| --- | --- | --- | --- |
| [#208](https://github.com/chapmandaniel/projectTixmo/pull/208) | `cursor/event-command-center-stats-67db` | `edf4b048c990cd5cfb501d5420917006497dc979` | grouping-test fix |
| [#209](https://github.com/chapmandaniel/projectTixmo/pull/209) | `cursor/t107-timeline-validation-buckets-2cc7` | this commit (evidence on top of `b4ebe54b`) | merge `8ddc008f` of #208 + mixed-hour fix `b4ebe54b` |
| [#217](https://github.com/chapmandaniel/projectTixmo/pull/217) | `cursor/t122-husky-receipt-cleanup-5658` | `487027e78214dd1b5dc8872dad3cf0c30ab0ae30` | (b) independent of the stack |

## CI run ids (test-fix heads)

`guard-and-build` (`tdash-design-system.yml`) is path-filtered to `tdash/**` and `.github/workflows/tdash-design-system.yml`. These PRs are API/test/docs only, so that required check does not run until #198's path rules land (or a tdash path is touched). Soak is not required.

### #208 @ `edf4b048`

| Check | Run | Job | Conclusion |
| --- | --- | --- | --- |
| local-gates | [43757814754](https://github.com/chapmandaniel/projectTixmo/actions/runs/43757814754) | [132945657006](https://github.com/chapmandaniel/projectTixmo/actions/runs/43757814754/job/132945657006) | **success** (completed 2026-11-15T20:35:54Z) |
| configured-image-restore | [43757814754](https://github.com/chapmandaniel/projectTixmo/actions/runs/43757814754) | [132945656909](https://github.com/chapmandaniel/projectTixmo/actions/runs/43757814754/job/132945656909) | **success** (completed 2026-11-15T20:26:36Z) |
| guard-and-build | not triggered (no `tdash/**` change) | — | n/a (path-skipped) |

Soak [43757814800](https://github.com/chapmandaniel/projectTixmo/actions/runs/43757814800) skipped. No job re-runs.

### #209 @ `b4ebe54b` (TZ fix + merge, before this evidence file)

| Check | Run | Job | Conclusion |
| --- | --- | --- | --- |
| local-gates | [43757815392](https://github.com/chapmandaniel/projectTixmo/actions/runs/43757815392) | [132945658776](https://github.com/chapmandaniel/projectTixmo/actions/runs/43757815392/job/132945658776) | **success** (completed 2026-11-15T20:40:06Z) |
| configured-image-restore | [43757815392](https://github.com/chapmandaniel/projectTixmo/actions/runs/43757815392) | [132945658593](https://github.com/chapmandaniel/projectTixmo/actions/runs/43757815392/job/132945658593) | **success** (completed 2026-11-15T20:26:26Z) |
| guard-and-build | not triggered (no `tdash/**` change) | — | n/a (path-skipped) |

Soak [43757815398](https://github.com/chapmandaniel/projectTixmo/actions/runs/43757815398) skipped. No job re-runs.

This docs commit retriggers #209 CI; report the new run ids with the T122 closeout. #217 CI is on `487027e7` (hook-only).

## Conclusions

- Failures were test fixtures, not `getEntryTimeline` timezone bugs.
- #208 owns the grouping test; #209 owns the mixed-hour test. Fixes landed on those branches; #209 was `git merge`d forward from #208.
- Affected unit suite passes under `America/St_Johns`, `UTC`, and `Asia/Kolkata`. Full Jest 183/1743 pass on #209.
- Pre-push leftover receipts: draft #217; two consecutive hook runs in one clone both exited 0.
- Draft PRs only. Do not merge.
