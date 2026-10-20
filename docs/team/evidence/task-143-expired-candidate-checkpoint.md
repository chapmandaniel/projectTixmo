# Task 143 experimental expired-recovery test checkpoint

Base `f4889fdfc25df320c53c22e4c96bae9270100762`, branch
`tixmo/task-143-fenced-processing-recovery`, isolated `worktrees/task-143`.
This checkpoint adds tests/evidence ONLY; product source and historical 137/141
artifacts remain unchanged. Committed expired recovery is **DISABLED**.
No implementation closure or release acceptance is asserted.

## Reproduce and distinguish activation

The two new suites default to skipped. `TIXMO_EXPERIMENTAL_RECOVERY=1` merely
opts the tests in; it does NOT activate product recovery. Tests validate real
signed public webhook delivery, real PostgreSQL admission/CAS/transactions and
observer snapshots. Only notification delivery is mocked. All scheduling waits
are outside event/order transactions; finally releases and boundedly drains both
invocations before restoring spies.

Experimental activation changed exactly this line in
`tixmoapi2/src/api/payments/service.ts`:

```diff
-const EXPIRED_WEBHOOK_RECOVERY_ENABLED = false;
+const EXPIRED_WEBHOOK_RECOVERY_ENABLED = true;
```

Before activation the exact source was copied to `.task143-disabled-source`.
After EVERY runtime shell exit, that copy was restored and `cmp` checked equality;
final `git diff --exit-code -- tixmoapi2/src/api/payments/service.ts` is required.
No experimental activation is committed.

Runtime helper `.task143-mutation-runtime.sh` derives from inspected
`.task143-repair-runtime.sh`: original full141 UID/PID/executable/datadir/direct
child/loopback/listener/readiness/target and bounded cleanup guard body unchanged;
only owned mktemp prefix `.runtime143mutation.`, cache/log labels and check tail
changed. Approved task57 binaries; no inherited environment DB or ports used.
Build40s, migrate30s, Jest65s deadlines, each kill-after5s. PM explicitly assigned
sole fresh disposable PostgreSQL/Redis ownership. Existing Jest/Prisma helpers
are sufficient; no dependency/custom infrastructure was introduced.

Exact runtime command: `TIXMO_EXPERIMENTAL_RECOVERY=1 bash .task143-mutation-runtime.sh`
(after activation above, followed unconditionally by source restore/compare).
Its check tail runs `npm --prefix tixmoapi2 run build`,
`tixmoapi2/node_modules/.bin/prisma migrate deploy --schema tixmoapi2/prisma/schema.prisma`,
then `npm --prefix tixmoapi2 test -- --cacheDirectory "$PWD/.jest-cache143-candidate" --runInBand --runTestsByPath`
with the two new suites plus the nine previously reviewed regression suites
listed in `.task143-restored-tests.log` (failed-retry, distinct-success,
fenced-checkpoint, signature, mocked recovery, tenant, double-confirm,
confirm-cancel and confirm-expiry).

## Durable evidence

- Fresh ownerless PROCESSING preserves full event/order/inventory and other buyer
  snapshots with zero email; ancient ownerless delivery recovers generation1,
  PROCESSED/PAID/SUCCEEDED, counters6/2/2, four tickets and exactly one email.
- A's actual generation1 claim pauses before handler; fixture-only timestamp
  expiration is explicitly recorded. Signed B redelivery actually acquires
  generation2 and fulfills. A resumes while B remains PROCESSING; A cannot
  mutate any successor/order/ticket/inventory row or add an email.
- Separate success/failure schedules pause A after committed fulfillment and
  before terminal finish. Real B takeover runs the paid same-intent no-op and
  pauses outside transactions before terminal finish. A resumes: actual database
  terminal updateMany count0 for PROCESSED and FAILED respectively. Full successor
  row (including generation/status/error/all timestamps), target and other buyer
  orders/tickets, inventory and row cardinalities compare equal BEFORE B release.
  B then finishes generation2 PROCESSED; exactly one inventory transition/email.
- Failure is a bounded injected postcommit error, propagated by identity; no fake
  takeover, mocked claim, sleep-based expiry or wait beneath database locks.

Finish-generation-only mutation changed exactly
`where: { id: claim.eventId, status: 'PROCESSING', attemptGeneration: claim.generation }`
to `where: { id: claim.eventId, status: 'PROCESSING' }`, KEEPING PROCESSING predicate.
Command selected `tests/integration/payment-expired-successor.test.ts -t 'phase=(success|failure)'`.
Both tests must fail at `expect(afterStale).toEqual(successor)`: terminal status
changes to PROCESSED/FAILED while B is paused. This is a durable mutation kill,
not a timeout nor just call counting. Experimental candidate was copied to
`.task143-experimental-source`, restored with `cp`, verified with `cmp`, then the
complete 11-suite regression set rerun. Actual full snapshots are retained in
`task-143-experimental-snapshots.json`; local full logs listed below.

## Actual checks and limitations

Initial run: build0/migration0; ownerless2/2 passed; successor suite TypeScript
spy return-signature compile failure (not behavioral test failure). Fixed spy
cast, then two suites5/5 passed. First mutation both variants failed at durable
snapshot equality, restored eleven suites61/61 passed. Instrumentation was then
clarified to record actual terminal counts regardless of generation predicate
and log pre-release snapshots before assertions; final frozen rerun follows.

This is experimental coverage of a disabled candidate, NOT recovery acceptance.
Outstanding139 acceptance includes after-B-terminal controls, reversed expired
contenders, cutoff both sides/exact boundary, identical-time generation uniqueness,
failed B/C recovery, missing-intent and failure-write TOCTOU, other required
mutations, and full independent lead+QA verification of the new exact SHA.
MaxBigInt/missingID/FAILED-generation probes in existing suites are not substitutes
for those missing schedules. No merge/deploy/provider/production/config/scheduler/
spend/secrets/external messaging actions.

Final frozen experimental build0/migration0; finish-generation-only mutant exit1,
both success/failure tests fail at the durable snapshot assertion (actual count1);
restored candidate eleven suites61/61 exit0. Logs `.task143-mutation-build.log`,
`.task143-mutation-migrate.log`, `.task143-mutation-tests.log`,
`.task143-restored-tests.log`, `.task143-mutation-runtime-final.log`.

Owned runtime cleanup all reported success and no listeners: initial
pg1046988/redis1047001 ports36200/50988;
second pg1047822/redis1047835 ports28612/50029; first mutation
pg1048821/redis1048872 ports20068/43532; final frozen mutation
pg1050587/redis1050606 ports34359/48957. Final source byte comparison and product
git diff show exact disabled restoration.

Final committed-disabled API build independently rerun after source restoration:
`timeout --signal=TERM --kill-after=5s 40s npm --prefix tixmoapi2 run build`, exit0,
log `.task143-disabled-final-build.log`. Cleanup independently checked with `ps`
for all eight PIDs and `ss` for all eight ports: both empty. Initial commit attempt
had no configured author; committed using one-command identity matching prior
checkpoint, no Git config changed.
