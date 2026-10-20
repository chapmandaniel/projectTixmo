# Task143 regression-harness repair checkpoint

Baseline: `0ac140c348883a99261ac9cdfd0bf7d7fda59ee1`; same task143 branch/worktree.
Scope is three test files only plus this evidence. No production implementation,
expired takeover activation, schema change, or historical137 artifact edits.

- FAILED retry retains both actual FAILED admission reads, reversed winners,
  exactly one PROCESSING admission and explicit losing affected-row0. Handler
  scheduling waits now precede withWebhookFence, never hold event/order locks.
  Admission-only updateMany instrumentation excludes terminal CAS. Full event-row
  JSON evidence handles BigInt without dropping fields. Inventory, tickets,
  other buyer, email and sequential genuine FAILED retry assertions remain.
- Distinct signed deliveries retain both initial PENDING pre-fence observations,
  both winner directions and both observation directions. Per139/146 the
  serialized paid/same-intent delivery is now explicitly PROCESSED, not a 400
  FAILED outcome. Both complete event rows must remain immutable on repeats;
  one inventory transition/email and full order/ticket/otherbuyer snapshots stay.
- Recovery unit mocks model DB time, transaction callback, event lock/live query,
  generation/status OR admission, observed-generation CAS/increment, rollback
  and transaction-client confirmation. Reads return snapshots, not references.
  Six-attempt error identity, alert failures, retry and email-failure assertions
  preserved, as is already-paid no-op.

Checks use `.task143-repair-runtime.sh`, copied from the existing guarded143
helper (same141 complete guard prefix, owned runtime/log/cache labels and check
selection adaptations only). Private existing dependencies; no shared Prisma
client generation. All checks bounded by subprocess deadlines.

First iteration: build0/migrate0; nine suites, eight passed/one failed,
53 passed/3 failed tests, exit1 in16.881s. Remaining failures were mock read
reference aliasing on FAILED admission; repaired snapshot semantics before final
rerun. First runtime cleanup pg1032571/redis1032584, ports35595/41285; no listeners.

Full143 remains unfinished: actual expired takeover, B-still-PROCESSING durable
successor/otherbuyer snapshots and stale row0 oracles, cutoff/equal timestamp/
overflow/reversed FAILED-expired/TOCTOU schedules and139 mutations are NOT
certified here. No timeout counts as a mutation kill. Exact new SHA requires
independent LEAD and QA; do not close143 or infer release readiness.

Final repaired rerun: API build exit0, fresh Prisma migrate deploy exit0, nine
Jest suites56/56 tests PASS exit0 in13.524s. Selection: failed-retry2,
distinct-success4, mocked recovery5, signature4, fenced-checkpoint1, tenant unit
and three order races (double-confirm, confirm-cancel, confirm-expiry)40.
Final runtime cleanup pg1033990/redis1034003 ports37861/54577, no listeners;
inherited5433/5434/6380/6381 untouched. Logs `.task143-repair-{build,migrate,tests}.log`
and `.task143-repair-runtime-final.log`. `git diff --check` exit0.
