# Task 68 double-confirm baseline reproduction

Date: 2026-10-20 UTC (2026-10-19 America/St_Johns).
Base: `e6a752c0d39ec42ad3ef222011dd6d3c84d0c3fe`.
Branch: `tixmo/task-68-baseline`; isolated worktree `task-68-baseline`.
Reused existing plan at `977848bcd5bbe5ce0377cae4916bf0966e088f59` in
`task-68-plan`; existing Jest/Prisma libraries suffice. No lifecycle source fix.

## Harness and result

`tests/integration/order-double-confirm.race.test.ts` calls the actual
OrderService and real Prisma/Postgres. Only notification delivery is mocked
locally (shared Jest setup also mocks Redis/rate-limiter/logger). A spy wraps
and awaits the real initial order read, preserving actual immutable snapshots.
Both reads must return PENDING; release first, await commit, then release second.
Gates have bounded timeout and finally release/restore. No sleeps or fake DB.
Fixture has total10, available6, held4, sold0, two pending orders each with two
VALID tickets. The second order/tickets are compared in full before/after.

Actual trace on BOTH executions:

```json
{"trace":["read-0-PENDING","read-1-PENDING","first-committed","second-settled"],"outcomes":["fulfilled","fulfilled"],"counters":[6,0,4],"target":"PAID","payment":"SUCCEEDED","other":"PENDING","ticketStates":["VALID","VALID"]}
```

Both runs: **1 suite failed, 1 test failed, exit1** at inventory expectation
`[6,2,2]`, received `[6,0,4]`. Final run 4.318s (test116ms).
Earlier assertions passed: exactly two gated reads, nonnegative counters,
conservation sum10, unchanged unrelated order/tickets, target PAID/SUCCEEDED,
unchanged target tickets (no creation/deletion). Later one-winner/one-400-loser
assertions are present but not reached because exact inventory fails first.
Thus aggregate conservation alone misses consumption of another order's hold.

## Actual commands and owned runtime

Inspected existing status/worktrees before creating the new isolated worktree:

```bash
git worktree add -b tixmo/task-68-baseline /home/daniel/projects/projectTixmo/worktrees/task-68-baseline e6a752c0d39ec42ad3ef222011dd6d3c84d0c3fe
ln -s /home/daniel/projects/projectTixmo/worktrees/task-70/tixmoapi2/node_modules tixmoapi2/node_modules
bash -n /tmp/task68-runtime.sh
bash /tmp/task68-runtime.sh > /tmp/task68-baseline.log 2>&1
bash /tmp/task68-runtime.sh > /tmp/task68-baseline-final.log 2>&1
```

The host-local `/tmp/task68-runtime.sh` is the **existing reviewed lifecycle
block** from `docs/release-evidence/task-57-owned-native-runtime.md`, extracted
verbatim except runtime_root explicitly points to task57's extracted binaries,
and this invocation was inserted after the SQL/guard checks:

```bash
export DATABASE_URL="postgresql://tixmo57@127.0.0.1:$pgport/tixmo_disposable_57" REDIS_URL="redis://127.0.0.1:$redisport/1" TIXMO_ALLOW_DESTRUCTIVE_TESTS=1 NODE_ENV=test
export STRIPE_SECRET_KEY=sk_test_verify_api STRIPE_PUBLISHABLE_KEY=pk_test_verify_api STRIPE_WEBHOOK_SECRET=whsec_verify_api
npm --prefix tixmoapi2 test -- --runInBand --runTestsByPath tests/integration/order-double-confirm.race.test.ts
```

Values above are synthetic test placeholders, not live credentials. No inherited
application env file was loaded. Each run created a fresh unique local cluster
and Redis child with no persistence, verified UID/executable/PID/listeners,
SQL identity, unique socket/PONG, and verification guard BEFORE schema push.
Jest setup applied schema only to this explicit disposable database.
Dependencies reused task70's existing installation; no lockfile changes or
package installation/generation. The node_modules symlink is untracked/local.

First run `/tmp/tixmo57.LEZHWU`: PG29156, Redis55749/PID807475.
Final run `/tmp/tixmo57.lOUtE9`: PG34980, Redis53701/PID808029.
Each EXIT trap gracefully stopped exact PG and terminated exact Redis child.
Both PG PID files absent; both Redis logs report exit; final `ss -H -ltnp`
showed no postgres or redis-server listeners. Data/logs preserved for inspection.
`/tmp/task68-baseline-final.log` retains actual final failure output.

## Limits / handoff

Baseline is deliberately RED, not a product pass. New tests and evidence only;
no application change, financial refund, secrets/config mutation, merge,
deployment or external message. Shared main's existing untracked docs untouched.
Native PG18.6/Redis8.0.5 differ from CI versions; Redis is mocked in Jest.
Only serialized-commit stale-read double-confirm schedule executed. No same-time
row-contention variant, cancel/refund/expiry/webhook/lease cases or full API gate.
A future conditional-transition fix may need admission-gate adaptation as the
existing plan explains. Scope task68 remains TODO, pending independent exact-SHA
review, authorized narrow fix and broader race acceptance. No active runtime owner
or owned services remain after this slice.
