# T98: offline door scanning test gap

Head under test: branch `cursor/t98-offline-door-scanning-0a66`, based on `origin/main` `aee54592`.
Tests only. No app, product, lockfile, or guard-baseline changes. No staging, production, Stripe, or other external calls.

## Coverage map check

The map was right on the existing surfaces and wrong to treat them as the field sequence.

- `tixmoapi2/tests/integration/scanners-offline.test.ts` covers `GET /api/v1/scanners/sync` (VALID download, `since` filter, cancelled barcode redaction) and `POST /api/v1/scanners/validate` (one unpaid denial, one successful admit). It does not authenticate then sync then queue while another door admits, and it does not assert wrong-event, refunded, already-used, or unknown QR outcomes on reconnect.
- `tixmoapi2/tests/integration/scanner-doors.test.ts` covers doors-window live scans and offline timestamps (`processOfflineScans` during/before doors, future/ancient stamps). It does not drive HTTP auth/sync/validate or a two-device conflict.
- `docs/SCANNER_SETUP_AND_FIELD_TEST.md` (lines 25–27, 47, 73) states that dashboard `/scan` is **online only**: it does not sync tickets, queue scans, or authorize offline entry. The offline procedure is an uncompleted acceptance gate until a separate client exists.
- Confirmed in code: `tdash/src/pages/ScannerPage.jsx:49` returns when `navigator.onLine === false` and writes nothing; `tdash/src/lib/scannerClient.js` only posts `auth` and `scan`. There is no queue, sync download, retry, or stale-sync UI.

No offline client was added. Contract coverage is at the API. The dashboard test only records that the current page still has no offline path.

## New tests

| File | Name | What it proves |
| --- | --- | --- |
| `tixmoapi2/tests/integration/scanner-offline-field-contract.test.ts` | `authenticates the scanner and downloads one event snapshot, then preserves server outcomes on reconnect` | Full field sequence over HTTP: `POST /scanners/auth`, `GET /scanners/sync?eventId=` for one event, a local queue built from that snapshot (including tickets a second device admits while this key makes no API calls), refund of a previously VALID ticket, then `POST /scanners/validate` on reconnect. Server outcomes are preserved rather than replaying the optimistic local admits: fresh VALID → `ADMITTED`/`USED`; same-batch duplicate → one `ADMITTED` then `ALREADY_USED`; ticket used before sync → `ALREADY_USED`; ticket admitted by the other device while “offline” → `ALREADY_USED` and `checkedInBy` stays the online scanner; unpaid → `UNPAID` and ticket stays `VALID`; refunded after sync → `REFUNDED` and ticket stays `CANCELLED`; wrong-event QR → denied, ticket stays `VALID`, scan log `WRONG_EVENT`; unknown well-formed QR → `NOT_FOUND`; garbage QR → `INVALID_QR`. A follow-up sync shows `USED` / cancelled+empty barcode, not the stale snapshot. |
| `tixmoapi2/tests/integration/scanner-offline-field-contract.test.ts` | `keeps a wrong-event denial on the validate row as WRONG_EVENT rather than a throw-only 403` | **Skipped.** Would require `POST /scanners/validate` to return `reasonCode: WRONG_EVENT` on that row. See bug below. |
| `tdash/src/test/ScannerPage.test.jsx` | `does not download a ticket sync, persist an offline queue, or call validate while offline` | Documents the missing client: while `navigator.onLine` is false the page shows the pause copy, does not mention sync, does not call `/scanners/sync` or `/scanners/validate`, and writes no localStorage keys other than the scanner API key. |

The existing dashboard test `does not queue offline scans` still passes; it only checked the pause notice and that `fetch` was not called for the scan.

## Test counts

Local Node `v24.21.0`, disposable Postgres `tixmo_disposable_t98` on `127.0.0.1:5432`, Redis `redis://127.0.0.1:6379/1`, `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`. Synthetic JWT/session/Stripe values match `.github/workflows/market-readiness-local.yml`. `TIXMO_BROWSER_PATH=/usr/bin/google-chrome`. Receipt files cleared first. `npm test` in `tixmoapi2` (`pretest` build, then `jest --runInBand`). Dashboard: `npx vitest run` and `npm run design:guard`.

| Suite | Before (`origin/main` `aee54592`) | After this branch |
| --- | ---: | ---: |
| API Jest | 182 suites / 1711 tests / 0 skipped | 183 suites / 1712 passed + 1 skipped (1713 total) |
| Dashboard Vitest | 66 files / 500 tests / 0 skipped | 66 files / 501 tests / 0 skipped |

API before = after minus the two new cases (one passing, one skipped). Dashboard before = after minus the one new ScannerPage case. Existing scanner suites `scanners-offline.test.ts` and `scanner-doors.test.ts` still pass (11 passed + 1 skipped across those three files together).

`wallet-browser-recovery` did not run in this Jest suite and did not flake here. `node scripts/wallet-browser.test.cjs` passed 50/50.

## CI

Filled after the draft PR’s required checks finish. See the follow-up section at the bottom of this file once the run URLs exist.

## Bugs found (not fixed)

### 1. Offline validate omits `reasonCode` for wrong-event tickets

- **Severity:** medium. An offline client that classifies reconnect results by `reasonCode` (as it can for `ALREADY_USED`, `UNPAID`, `REFUNDED`, `NOT_FOUND`, `INVALID_QR`) cannot see `WRONG_EVENT` on the batch row. The ticket is still not admitted. Scan logs do record `WRONG_EVENT`.
- **File / line:** `tixmoapi2/src/api/scanners/service.ts:451-457` (`scanTicket` throws `ApiError.forbidden('Scanner is not assigned to this event', denial)` after the scan log commit) and `tixmoapi2/src/api/scanners/service.ts:756-770` (`processOfflineScans` catch copies `error.message` and does not copy `reasonCode`; it only looks for `error.data.code`, which this denial does not set).
- **Repro:**
  1. Register an active scanner assigned to event A.
  2. Create a paid VALID ticket on event B in the same organization.
  3. `POST /api/v1/scanners/validate` with `{ scans: [{ qrData: "TICKET:<id>:<barcode>:<eventB>", scannedAt: <ISO now>, scanType: "ENTRY" }] }` and the event-A scanner key.
- **Expected:** HTTP 200, `results[0].success === false`, `results[0].reasonCode === "WRONG_EVENT"`.
- **Actual:** HTTP 200, `results[0].success === false`, `results[0].reason === "Scanner is not assigned to this event"`, `results[0].reasonCode` omitted (`undefined`). Scan log `failureReason` is `WRONG_EVENT`. Ticket remains `VALID`.
- **Test:** skipped `keeps a wrong-event denial on the validate row as WRONG_EVENT rather than a throw-only 403`. The passing field-sequence test still asserts the scan-log `WRONG_EVENT` and that the ticket is not consumed.

No other product bugs were found in this gap. Missing dashboard offline admission is the documented V1 limitation, not a regression.

## Client missing

There is no dashboard offline scanner client (no ticket snapshot, no scan queue, no reconnect upload, no stale-sync block). T98 does not build one. `/scan` remains online-only per `docs/SCANNER_SETUP_AND_FIELD_TEST.md`.
