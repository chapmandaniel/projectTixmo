# T106 Event Command Center stats coverage

Task: tests only. Close the T90 runner-up coverage gap on Event Command Center numbers (`stats.service.ts` plus HTTP `GET /events/:id/occupancy`, `GET /events/:id/timeline`, `GET /events/:id/scanner-stats`). No application code was changed. Draft PR only; not merged.

Local Node `v24.21.0`, npm `11.19.0`. Disposable Postgres `tixmo_disposable_ci` on `127.0.0.1:5432` and Redis DB `/1`. Synthetic JWT/Stripe env matching `.github/workflows/market-readiness-local.yml`. No staging, production, or Stripe network traffic. Fake data only.

## New tests

### `tixmoapi2/tests/unit/stats.service.test.ts`

Prisma is mocked. The original `getEventStats` targeted-count test is kept.

| Name | Asserts |
| --- | --- |
| `getEventStats` should return event stats using targeted count queries | Existing: ticket/scan count queries and occupancy/success-rate math |
| `getEventStats` throws 404 when the event does not exist | `ApiError` 404 `Event not found`; no ticket queries |
| `getEventStats` reports zero occupancy, zero success rate, and no last scan when there are no scans | All counts 0, `scanSuccessRate` 0, `lastScanAt` omitted |
| `getEventStats` clamps occupancy at zero when successful exits exceed entries | Occupancy 0 while entry/exit counts stay raw |
| `getEntryTimeline` throws 404 when the event does not exist | 404 before `scanLog.findMany` |
| `getEntryTimeline` returns an empty array when there are no successful scans in the window | `[]` |
| `getEntryTimeline` groups successful scans by hour with cumulative occupancy | Two hour buckets; VALIDATION in a mixed hour does not increment entry/exit; lookback honors `hours` |
| `getEntryTimeline` displays occupancy 0 when a bucket goes negative but keeps the running total | Display clamp; next hour still uses the signed running total |
| `getEntryTimeline` omits hours that only contain successful VALIDATION scans | **skipped** — see Bugs |
| `getCurrentOccupancy` throws 404 when the event does not exist | 404 |
| `getCurrentOccupancy` returns occupancy, capacity, and rounded percentage full | 8−1=7, capacity 200, 3.5% |
| `getCurrentOccupancy` treats null or zero capacity as 0% full | `capacity` 0, `percentageFull` 0 |
| `getCurrentOccupancy` clamps occupancy at zero and rounds percentage to two decimals | Over-exit occupancy 0; 1/3 → 33.33 |
| `getScannerStats` throws 404 when the event does not exist | 404 before `scanner.findMany` |
| `getScannerStats` returns zeros and an empty activity list when the event has no scanners | `totalScanners` 0, `activeScanners` 0, `scannerActivity` [] |
| `getScannerStats` includes event and org-wide scanners, counts failed scans, and sorts by scan count | Org-wide `OR` filter; sort by `scanCount`; 71.43 / 100 / 50 / 0 rates; inactive scanners counted in total |

### `tixmoapi2/tests/integration/event-command-center-stats.test.ts`

HTTP against the real app, seeded fake org/event/tickets/scans.

| Name | Asserts |
| --- | --- |
| refuses unauthenticated occupancy, timeline, and scanner-stats reads | No token → 401 `No token provided`; bad token → 401 `Invalid token` on all three paths |
| allows OWNER / ADMIN / MANAGER / PROMOTER / ADMIN_GLOBAL to read command-center stats | Each allowed role gets 200 on all three paths (`it.each`) |
| refuses CUSTOMER / SCANNER / TEAM_MEMBER occupancy, timeline, and scanner-stats reads | 403 `Insufficient permissions` (`it.each`) |
| does not let another organization read this event’s stats | Other-org OWNER → **403** `You do not have access to this organization's resources` |
| returns 404 for an unknown event id | Random UUID → 404 `Event not found` on all three paths |
| returns zeros and empty arrays for an event with no tickets or scans | Occupancy 0 / capacity 100 / 0%; timeline `[]`; scanner-stats zeros and `[]` |
| returns hand-computed occupancy from successful entry and exit scans | Occupancy **7**, capacity **50**, 14% full. Seed: 8 successful ENTRY (including one 30h-old), 1 successful EXIT; duplicate/rejected/VALIDATION/other-event scans excluded. Also asserts `GET /events/:id/stats` ticket counts against the seed: total 12, sold 9, used 2, valid 4, cancelled 3, entry 8, exit 1, success rate 76.92 |
| returns hand-computed 24h timeline buckets excluding scans outside the window | Three buckets: 3/0/3, 2/1/4, 2/0/6 (VALIDATION does not add entries) |
| includes the 30-hour-old entry when timeline hours=48 | Four buckets: 1/0/1, 3/0/4, 2/1/5, 2/0/7 |
| returns hand-computed scanner-stats excluding other-event scanners | total 4, active 3; Door A 7/71.43, Door B 3/100, Roaming 2/50, Door C 1/100; other-event scanner omitted |

## Coverage before / after

Jest `--coverage` with `--collectCoverageFrom` limited to `stats.service.ts`, `controller.ts`, and `routes.ts`. Coverage threshold overridden to 0 so a three-file collect does not fail the global 70% gate. Baseline used the original `stats.service.test.ts` only (controller/routes not loaded). After used the new unit + integration files.

| File | Before statements | After statements |
| --- | --- | --- |
| `tixmoapi2/src/api/events/stats.service.ts` | **17.46%** (11/63) | **100%** (63/63) |
| `tixmoapi2/src/api/events/controller.ts` | not loaded (0% for these endpoints) | **36.22%** (46/127) overall; handlers at `controller.ts:158-193` (`getEventStats`, `getEventOccupancy`, `getEntryTimeline`, `getScannerStats`) are covered. Remaining uncovered lines are other event mutations |
| `tixmoapi2/src/api/events/routes.ts` | not loaded | **100%** (27/27) — route registration runs on import |

`stats.service.ts` also: lines 18.03% → 100%, branches 6.89% → 100%, functions 8.33% → 100%.

## Test counts before / after

New cases: 30 passing + 1 skipped = 31. One original `getEventStats` unit test remains.

| Suite | Before | After (local) |
| --- | --- | --- |
| API Jest | 182 suites, 1711 passed / 1711 total, 0 skipped | **183** suites, **1741** passed / **1742** total, **1** skipped |
| tdash Vitest | 66 files, 500 passed (unchanged) | 66 files, 500 passed |

API after command: `npm --prefix tixmoapi2 test -- --runInBand` (pretest build), env as above, receipts cleared, `TIXMO_BROWSER_PATH=/usr/bin/google-chrome`. 614.318s. `wallet-browser-recovery` **passed** on this run; it is still the known flake and was not changed.

tdash: `npm --prefix tdash test -- --run`, 30.38s, 0 skipped.

## Bugs found

1. **Medium — VALIDATION-only timeline buckets.** `tixmoapi2/src/api/events/stats.service.ts:142-148` (`getEntryTimeline`). Successful `VALIDATION` scans (and any `scanType` other than `ENTRY`/`EXIT`) still open an hourly map entry, so a validation-only hour is returned as `{ entryCount: 0, exitCount: 0, occupancy: <prior> }`. The route is documented as an entry/exit hourly breakdown. Repro: call `getEntryTimeline` with only a successful `VALIDATION` scan in the window; it returns one zero-count bucket instead of `[]`. Test skipped: `EventStatsService getEntryTimeline omits hours that only contain successful VALIDATION scans`. Mixed hours that also have ENTRY/EXIT are asserted as passing (validation does not increment those counts).

No other product bugs found. Org-scoped cross-org reads return **403**, not 404.

## CI run ids

Required checks on tests commit `3e37fa57bfba6ad9fe5903d67a954922c9f21ed5`. Workflow: [Tixmo Market Readiness Local Gates run 43489550265](https://github.com/chapmandaniel/projectTixmo/actions/runs/43489550265). `guard-and-build` (tdash-design-system) is path-filtered and does not run unless `tdash/**` changes.

| Check | Run | Job | Conclusion |
| --- | --- | --- | --- |
| local-gates | [43489550265](https://github.com/chapmandaniel/projectTixmo/actions/runs/43489550265) | [132106779956](https://github.com/chapmandaniel/projectTixmo/actions/runs/43489550265/job/132106779956) | **success** (completed 2026-11-13T19:25:46Z) |
| configured-image-restore | [43489550265](https://github.com/chapmandaniel/projectTixmo/actions/runs/43489550265) | [132106780300](https://github.com/chapmandaniel/projectTixmo/actions/runs/43489550265/job/132106780300) | **success** (completed 2026-11-13T19:12:37Z) |
| guard-and-build | not triggered (no `tdash/**` change) | — | n/a |

Opt-in soak workflow run [43489550306](https://github.com/chapmandaniel/projectTixmo/actions/runs/43489550306) skipped (not required).

This evidence-only follow-up is `17840f8b039a7e5c506dcdd53a3d93a40183567a` on top of `3e37fa57`. After it is pushed, the same required checks re-run on that tip.

## Final head SHA

`17840f8b039a7e5c506dcdd53a3d93a40183567a`
