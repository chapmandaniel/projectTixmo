# Task 143 handler-fence checkpoint (unfinished)

Continuation from independently reviewed `c004dd75005ee0656c31d929799ade47805f6349`
on isolated `tixmo/task-143-fenced-processing-recovery`; no default-branch changes.

## Implemented, not recovery acceptance

- New/FAILED admission obtains a DB-sampled time and monotonic BigInt generation,
  observed-generation/status CAS, zero-row loser, maximum-generation fail-closed,
  missing-ID rejection. Terminal writes require PROCESSING plus generation.
- Success binding and internal confirmation, and failure updates, use one
  caller-owned transaction: event FOR UPDATE, then live-lease/generation/status
  validation sampled after lock acquisition, then order FOR UPDATE. Preserve
  PENDING inventory CAS. Failure cannot overwrite PAID/SUCCEEDED or foreign intent.
- Retry waits and all notifications remain outside transactions. Ownership loss
  exits without retry or terminal failure. Specific intent mismatch alert remains
  outside the transaction without retrying the mismatch. Only a committed
  confirmation winner attempts email; no exactly-once delivery claim.
- **Expired admission remains explicitly compile-time disabled.** Do not enable
  until full task139/143 acceptance and independent exact-SHA review. This is not
  a bookkeeping-only enabled takeover, implementation completion, or release.

## Checks and limits

First fresh guarded runtime: build and migrate deploy exit0; new realDB probe
plus tenant/double-confirm/confirm-cancel/confirm-expiry five suites **41/41**.
Owned pg1011098/redis1011149 stopped, ports37183/42160 empty and PIDs absent.
Private existing task143 dependency copy used; no shared generated client changed.
New probe exercises actual FAILED generation admission/fulfillment, single
inventory transition, other-buyer equality, duplicate no-op, paid failure immunity,
stale finish full successor equality, stale handler rejection. A manually seeded
successor is a focused fence probe, NOT real expired takeover acceptance.
Later mismatch/overflow/missing-ID additions and final regression outcomes are
recorded in the board handoff and final owned logs; do not infer they ran here.

Broader existing tests still require adaptation to token-returning admission,
transaction-client reads/confirmation, and BigInt snapshot serialization. Never
weaken their durable oracles. Original failed-retry/distinct-success gates spy on
global order reads/confirmation and no longer intercept the fenced path; a barrier
timeout is harness failure, never recovery evidence or mutation success. Existing
fully mocked webhook suites lack the new raw-query/transaction model. Preserve
historical137 artifacts unchanged.

Outstanding: real expired admission enabled only after deterministic B-still-
PROCESSING stale success AND failure affected-row0/full snapshots before B
release; actual takeover before-handler/missing-intent/failure TOCTOU schedules;
DB exact-cutoff/equal-time/reversed contenders, failed B/C recovery, all prescribed
mutation oracles, broad signature/recovery/payment/tenant regressions, and exact
new-SHA independent lead+QA/PM review. Task143 stays open, no merge/deploy.

## Frozen continuation verification

Final source/test content (including specific mismatch alert/no order mutation,
maxBigInt no-write and missing-ID failclosed assertions) passed API build,
fresh disposable `prisma migrate deploy`, and five suites **41/41** (exit0).
Logs: `.task143-next-build.log`, `.task143-next-migrate.log`,
`.task143-next-tests.log`, `.task143-next-runtime-final.log` in task143 worktree.
Final owned pg1014290/redis1014303, ports22491/55637 cleaned by guarded helper.

Broader run: `.task143-regression-tests.log`, **3 failed/2 passed suites;
11 failed/5 passed tests**, Jest exit1, 40.464s, not timeout-killed.
FAILED retry two cases and distinct-success four cases fail at obsolete global
read barrier timeouts; mocked recovery five cases fail because `$queryRaw` is
absent. Signature suite and new realDB probe pass. These are unresolved red
regressions/harness incompatibilities, not mutation kills, not full acceptance.
Original tests were not weakened or edited. That run independently rebuilt and
applied migrations successfully. pg1012477/redis1012490, ports32038/44135 cleaned.
All these PIDs absent and ports empty checked after helper completion. No
inherited5433/5434/6380/6381 accessed. No production/provider action.

Reviewer should first adapt obsolete outside-transaction gates without waiting
under event/order locks, update mocked DB interfaces preserving error assertions,
and rerun all changed payment-path contracts before considering activation.
This checkpoint changes distinct-event serialization: the second transaction
rereads already-PAID/same-intent and returns the documented no-op, whereas the
old stale global-read race expected one initial failure. That expectation needs
explicit review against the task139 contract, not silent deletion.
