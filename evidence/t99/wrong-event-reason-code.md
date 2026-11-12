# T99: wrong-event validate `reasonCode`

Head: branch `fix/t99-wrong-event-reason-code`, based on `origin/main` `aee54592`.
Draft PR: (filled after open). Do not merge. No settings, deploy, staging, or admin bypass.

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

Ported un-skipped from draft PR #200 (`cursor/t98-offline-door-scanning-0a66`,
file `tixmoapi2/tests/integration/scanner-offline-field-contract.test.ts`,
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

Filled after required checks finish.

| Check | Conclusion | Link |
| --- | --- | --- |
| local-gates (required) | pending | |
| configured-image-restore (required) | pending | |
| guard-and-build | expected skipped: this PR does not touch `tdash/**`; workflow path filter on main (pre-#198) |
