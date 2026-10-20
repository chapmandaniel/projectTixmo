# Task 115: double-cancel baseline (intentionally RED)

2026-10-20, author tixmo-backend; branch `tixmo/task-115-double-cancel-baseline`,
worktree `/home/daniel/projects/projectTixmo/worktrees/task-115`.
Exact reviewed base: `98e89576a7c2ee66bcea72ec535607319376e499`.
Only new tests and this evidence changed. No product fix, merge or deployment.

## Harness and command

Reused the reviewed double-confirm real-Prisma fixture/barrier design and
`task-68-plan/docs/team/evidence/task-68-race-harness-plan.md` (977848b).
No new libraries. The existing double-confirm test file is unchanged.
Each case seeds ten tickets of inventory: target pending order holds two,
unrelated pending order holds two; initial counters `[6,4,0]`.
Both initial real findFirst reads must arrive with PENDING snapshots before
release. Invocation-indexed gates are independent of query completion order.
Normal releases call0 then call1; reversed forces read1 before read0 and
releases call1 then call0. First real commit completes before stale read release.
Actual service promises are immediately handled by Promise.allSettled; finally
releases all gates and settles both. Five-second timeouts bound harness failure,
not scheduling. Real committed DB observations assert unrelated full order and
ordered tickets unchanged, target ticket cardinality/identity/fields preserved
except cancellation status/timestamp, exact counters, and a defined 400 loser.
No Prisma result/state/write mocks; only existing external boundary mocks.

PM assigned sole disposable DB/services ownership to this author. Read/reused
approved57 owned runtime procedure and `/tmp/task68-runtime.sh`; derived
`/tmp/task115-runtime.sh` changes only test paths and post-cleanup proof.
Runtime helper SHA256:
`e3f2ba99fe0f80bb93af36c6e25e2a04349bf55abce4949d5d5509ff3d26076a`.

From the task worktree:

```bash
bash /tmp/task115-runtime.sh > /tmp/task115-final-run.log 2>&1
# Inside the guarded, explicitly owned runtime:
npm --prefix tixmoapi2 test -- --runInBand --runTestsByPath tests/integration/order-double-confirm.race.test.ts tests/integration/order-double-cancel.race.test.ts
```

Helper validates UID/executable/PID/datadir or direct-child identity and exact
loopback listener ownership before DB/TCP use, then explicit disposable targets
through verification-safety before schema bootstrap. No inherited DB or .env.

## Actual results

Final run exit **1**, **2 failed / 2 passed / 4 tests**, two suites (one failed,
one passed), 5.439 seconds. Both failures are expected inventory safety-oracle
failures, NOT bootstrap, timeout, compilation or automation failures.
An initial run before comment/variable-name cleanup reproduced identical counts
and outcomes (6.426 seconds); final tested content is authoritative.

- Double cancel normal: trace read0-PENDING, read1-PENDING, call0-committed,
  both-settled; both promises fulfilled; actual `[10,0,0]`, expected `[8,2,0]`.
- Double cancel reversed: trace read1-PENDING, read0-PENDING, call1-committed,
  both-settled; both promises fulfilled; actual `[10,0,0]`, expected `[8,2,0]`.
- Both target orders CANCELLED, payment remains PENDING; both target tickets
  CANCELLED. Full unrelated order/ticket snapshot comparisons pass before the
  inventory assertion. Its two-ticket hold is nevertheless stolen by the
  duplicate inventory release. Nonnegative counters and conservation pass:
  neither alone is a sufficient oracle. Expected stale loser rejection is
  absent (both fulfilled); inventory assertion is the first failing assertion.
- Existing double confirm: **2/2 GREEN**, normal/reversed reads, `[6,2,2]`,
  one fulfillment plus one rejection; target PAID/SUCCEEDED, tickets VALID.

Final tested cancel file SHA256:
`67665989436595979ef2d4c4e6650fb635072445ea43f728788950a78217e26d`.
Unchanged confirm file SHA256:
`244bb6fe775069fcbd6e30946c6ec349b98d316aa71a9fe60126c0fc6de9f8fb`.

## Cleanup and limitations

Final owned PG PID834357 at127.0.0.1:39056, Redis PID834370 at127.0.0.1:48266.
EXIT trap stopped both exact instances; post-cleanup alive checks false and ss
returned no listener on either port. Initial run PG833354/20552 and
Redis833367/43699 likewise stopped, with no listeners. Temporary clusters/logs
retained for inspection, not reused. No active runtime owner after handoff.

Native PostgreSQL18/Redis8 differs from CI14/7; Redis is globally mocked by
existing Jest setup. No Redis acceptance, simultaneous lock contention, full
API/market gate, other lifecycle/webhook schedules or launch acceptance claimed.
This is a test-only intentional RED baseline, not a product repair. Parent68
remains open. Independent exact-commit review remains required; final commit
identity is recorded on115/68 after commit.
