# Task 121: double bookkeeping-refund real-DB baseline

2026-10-20, tixmo-backend. Test/evidence only, no product source changes.
Base `9b9623e2daa4002d11a527812122f244cc7bcd98` (closed task118).
Branch `tixmo/task-121-double-refund-baseline`; isolated `worktrees/task-121`.
Reused task68 plan `977848b` and current confirm/cancel real-read Jest gates.
Existing maintained Jest/Prisma dependencies reused from task65 via local
node_modules symlink; no dependency/schema/config/lockfile edits.

## Actual result

Command from worktree: `bash /tmp/task121-runtime.sh > /tmp/task121-baseline-final.log 2>&1`.
Its guarded final command is:

```bash
npm --prefix tixmoapi2 test -- --runInBand --runTestsByPath \
  tests/integration/order-double-confirm.race.test.ts \
  tests/integration/order-double-cancel.race.test.ts \
  tests/integration/order-double-refund.race.test.ts
```

Exit **1**, 6.970s: **2 refund tests RED, 7 existing tests GREEN**, 9 total;
3 suites: refund failed, confirmation/cancellation passed. No harness timeout.
Both refund invocation identities are allocated before awaited real queries.
Both real PAID snapshots include two eligible tickets before either commit.
Normal read trace `read-0-PAID, read-1-PAID, call-0-committed, both-settled`;
forced reverse `read-1-PAID, read-0-PAID, call-1-committed, both-settled`.
Release first selected invocation, await actual commit, release other stale read.
No sleeps choose the operation schedule; bounded timers only detect gate faults.

Fixture uses THREE distinct buyers, same ticket type total10: target PAID2,
unrelated PAID2, unrelated PENDING2, initial available/held/sold `[4,2,4]`.
Required one-effect result `[6,2,2]`, one success and explicit statusCode400 loser.
**Both actual schedules produce `[8,2,0]`, fulfilled/fulfilled.**
Target REFUNDED, both eligible tickets CANCELLED, paymentStatus SUCCEEDED
unchanged. Full unrelated paid AND pending order/ticket snapshots equal their
original values. All counters remain nonnegative and conserve total10. Those
assertions execute and pass before exact inventory assertion fails. This
reproduces ownership corruption despite conserved/nonnegative aggregates:
the other paid order still has two valid tickets while sold is zero.
The explicit single-winner/400 assertions remain in the regression test after
the failing exact inventory oracle; baseline does not reach/pass them.
Only local OrderService.refundOrder bookkeeping runs, no provider refund.

## Runtime and exact cleanup

Read approved task57 upstream lifecycle/safety guard and task118 runner before
reuse. Task118 helper SHA256
`f58d331ddc9fbe0607d9e31db4a8acd7378abe8c4857d00b56e3a5089dfc5938`.
Task121 runner SHA256
`67e6a3d543888c487016deb7cc33698eb660aeab3603b4a64e253a973dc8c31f`.
Changes: Jest paths above; cleanup label; fresh mktemp location in own worktree;
empty-PID guard in final liveness check. Existing UID/executable/datadir/PID,
Redis unreaped direct-child ownership, loopback exact-listener guards and
bounded exact-instance cleanup retained. Explicit fresh disposable URLs only;
no inherited environment or unknown services. PM granted sole runtime ownership.

Initial `/tmp/task121-baseline.log`: 7 existing tests passed but new suite had
TS2339 snapshot include typing error, not product evidence. Repaired explicit
Prisma OrderGetPayload type. Its PG858800/37863 Redis858813/49468 stopped.
Next fresh `/tmp/tixmo57.IcCRtE` initdb exited during post-bootstrap before any
service start. Root cause unconfirmed; /tmp tmpfs was80% full (6GB used).
No global cleanup. PM authorized bounded own-runtime repair. Switched fresh
mktemp to disk-backed own worktree; final run succeeded through actual oracle.

Final owned runtime `.runtime121.ZFaKUq` (untracked, retained for inspection):
PG859863/127.0.0.1:37835 and Redis859876/127.0.0.1:40801.
EXIT trap stopped both. Independent `ps -p 858800,858813,859863,859876 -o
pid,stat,args` showed header only; `ss -H -ltnp` for all four ports empty.
Final postmaster.pid absent; PG log says database system shut down and Redis
log confirms exit/socket removal. No owned services remain; ownership released.
`git diff --check` exits0.

## Limits / handoff

Native PostgreSQL18/Redis8 differ from CI14/7; global Redis Jest mock remains.
Deterministic stale-read/serialized-commit schedules, not row-contention stress.
No API build/full API/market/browser test, mixed USED-ticket policy, other
lifecycle/webhook/expiry races, financial refund, merge or deployment performed.
This is an intentionally RED regression artifact, not a product repair or
launch acceptance. Independent exact-commit QA/lead review required. Task68
remains open. Local runtime files/dependency symlink are not committed.
