# T99: wrong-event validate `reasonCode`

Head under test: branch `fix/t99-wrong-event-reason-code`, fix commit `a0af3073`, based on `origin/main` `aee54592`.
Draft PR: https://github.com/chapmandaniel/projectTixmo/pull/202
Do not merge. No settings, deploy, staging, or admin bypass.

## Cause

`scanTicket` records `WRONG_EVENT` on the scan log, then throws
`ApiError.forbidden('Scanner is not assigned to this event', presentScanResult(...))`.
`processOfflineScans` caught that throw and copied only `error.message`. It looked
for `error.data.code` (EXTERNAL_TICKETING), not the presented `reason` /
`reasonCode`. Offline `POST /scanners/validate` therefore returned
`reason: 'Scanner is not assigned to this event'` with no `reasonCode`.

Live `POST /scanners/scan` already 403'd with `data.reason === 'WRONG_EVENT'`.
`GET /scanners/sync` for an unassigned event uses the same assignment message
without a scan code (different path: `authorizeSync`).

## Fix

- Thrown wrong-event denial now includes `reasonCode: 'WRONG_EVENT'` next to the
  presented public scan payload.
- Offline catch maps that payload onto the validate row: human `reason`
  (`This ticket is for {eventName}.`) and `reasonCode: WRONG_EVENT`.
- Bare assignment 403s (no `reasonCode` on `error.data`) are not rewritten as
  `WRONG_EVENT`. EXTERNAL_TICKETING is still rethrown.

Live scan stays HTTP 403 with message `Scanner is not assigned to this event` so
the dashboard classifier is unchanged; `data.reasonCode` is now present there too.

## Tests

Ported un-skipped from draft PR #200 (`cursor/t98-offline-door-scanning-0a66` /
`99cf4e6a`, file `tixmoapi2/tests/integration/scanner-offline-field-contract.test.ts`,
`it.skip('keeps a wrong-event denial on the validate row as WRONG_EVENT rather than a throw-only 403')`).
That file is new on #200, so this branch uses the same path with the QA case
plus a live-scan/sync companion. After this merges, #200 should merge main,
keep all tests, drop the duplicate skip, and update the field-sequence row
assertion that currently expects the assignment message without `reasonCode`.

Local Node `v24.21.0`, disposable Postgres `tixmo_disposable_t99` on
`127.0.0.1:5432`, Redis `redis://127.0.0.1:6379/1`,
`TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`. Synthetic JWT/session/Stripe values match
`.github/workflows/market-readiness-local.yml`.

| Suite | Result |
| --- | --- |
| `scan-reasons.unit.test.ts` + `scanner-offline-field-contract.test.ts` | 14 passed |
| `scanners-offline.test.ts` + `scanner-doors.test.ts` + `tickets.test.ts` + `order-scan-privacy.unit.test.ts` | 53 passed |
| `payment-inventory-integrity.test.ts` `-t 'enforces scanner event scope'` | passed (name filter) |
| `npx tsc --noEmit` | pass |

Counts vs `origin/main` `aee54592` (182 suites / 1711 tests / 0 skipped, per T98):
183 suites / 1716 tests / 0 skipped (+1 suite, +5 tests: 3 unit, 2 HTTP).

## CI

Required checks on fix commit `a0af3073cd8a4926c371c047b4bd5722280b822a` (draft PR #202).
All finished with no failures. `wallet-browser-recovery` did not flake in CI
`local-gates` (it failed only on this cloud VM's pre-push, no frontend harness).

| Check | Conclusion | Duration | Link |
| --- | --- | --- | --- |
| local-gates (required) | success | 12m48s | https://github.com/chapmandaniel/projectTixmo/actions/runs/43301167820/job/131472427111 |
| configured-image-restore (required) | success | 2m19s | https://github.com/chapmandaniel/projectTixmo/actions/runs/43301167820/job/131472428001 |
| guard-and-build | did not run | — | Tdash Design System path filter: this PR does not touch `tdash/**`; main is still pre-#198. Not dispatched. |
| http-soak | skipped | — | https://github.com/chapmandaniel/projectTixmo/actions/runs/43301167812/job/131472429193 |

Workflow runs:

- [Tixmo Market Readiness Local Gates](https://github.com/chapmandaniel/projectTixmo/actions/runs/43301167820) — success. Job `Run market readiness gates` 11m46s (`20:32:35Z`–`20:44:21Z`).
- [HTTP soak](https://github.com/chapmandaniel/projectTixmo/actions/runs/43301167812) — skipped, as on a normal pull request.
- Tdash Design System / `guard-and-build` — no workflow run for this SHA.
