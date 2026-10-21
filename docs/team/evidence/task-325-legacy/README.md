# Task 325 historical refund suite modernization

Source baseline: `2d7490a45685f7dd66a50bf4d7bda1d38c2685ce`, isolated branch
`tixmo/task-325-refund-races`. No product/schema/dependency changes. Task354
full gate on composed `cdb41d4d3aa4ccc323a2a1cc6b04a490feafe6a6` remains
historically FAIL; this focused run is not a replacement full gate.

## Changes and retained invariants

Historical `order-double-refund.race.test.ts` now uses inert Stripe mocks,
processor-bound orders and SOLD inventory, instead of invalid mixed tickets
and a bookkeeping-only bypass. The original two opposite observation-release
schedules still assert exactly one successful request, one stale 400 refusal,
full other paid/pending buyer row equality, exact target ticket IDs/full fields,
nonnegative/conserved inventory and exactly one release. The observation gate
now checks scalar request status and independently reads real ticket rows;
the entrypoint no longer includes tickets in its observation DTO. Provider
create count and durable confirmed refund ledger are additionally asserted.
These historical schedules are observation races, not simultaneous row-lock
proof; the unchanged 13-case current-path suite supplies genuine SQL contention.

The insufficient-stock fixture reaches confirmed-provider finalization:
409 `Order inventory is inconsistent` rolls back order/ticket/inventory local
finalization, while the independently committed PROCESSING order marker and
SUCCEEDED provider ledger remain durable. Original all ticket/scalar fields
except that explicit processing marker/timestamp and full stock row remain
compared. No financial success is undone or bypassed to recover old 500 logic.

Success preserves exact scalar/payment fields with explicit SUCCEEDED refund
status; all valid SOLD tickets cancel/release. Accepted idempotent retry has
identical scalar fields, no further provider effect or inventory writes; its
existing relation-bearing DTO is checked separately. USED/TRANSFERRED are now
separate denied fixtures with complete unchanged order/ticket/stock snapshots,
no ledger and no provider calls. Both original stale status/paymentStatus cases
remain and additionally require no provider/ledger writes.

## Actual execution

Command: `bash docs/team/evidence/task-325-legacy/runtime.sh`.
First attempt exit1: 2 suites, 20 passed, 1 failed, 0 skipped (9.978s).
The retry returns extra existing tickets/event relations, so exact comparison
to the first scalar response was incorrect; logs/JSON/runtime retained with
`initial-` prefix. One bounded test-shape repair extracts and compares every
scalar, checks tickets and unchanged stored order; no product edit.

Final attempt exit0: 2 SQL suites, **21 passed, 0 failed, 0 skipped** (9.605s):
historical suite 8 plus unchanged current-path suite 13.
Existing setup-free manual/fairness regressions: **2 suites, 17 passed,
0 failed, 0 skipped** (4.385s). Total this final run 38 passed, 0 failed,
0 skipped. No full API/build gate or fresh external-refund six-case run claimed.

`git diff --check`, `bash -n runtime.sh`: PASS. Known repository Husky
bootstrap missing `_ /husky.sh` (without space); commit uses command-scoped
`core.hooksPath=/dev/null`, no configuration edit or hook-gate claim.

## Runtime and cleanup

Task354 cleanup independently read and live PIDs3050089/3050102 and
ports32499/41722 confirmed absent before starting. No other task325-owned
service process was active. Existing writable independent task325 dependencies
reused, no install/generation/shared writes. Disk runtime under the assigned
PM runtime directory, umask077, fresh loopback PostgreSQL18/Redis DB1,
`env -i` synthetic-only credentials, preimport nonloopback deny guard and inert
provider mocks. No .env/secret/provider/cloud/outbound access. Guard log absent
(no blocked attempts). Both attempts' service PIDs/ports/socket files/pidfile
and owned workers independently checked absent in cleanup.json. DB RELEASED.

Requires independent lead and QA review of the exact resulting commit, then
composition and a fresh full gate. REVIEW, not task closure or release GO.
