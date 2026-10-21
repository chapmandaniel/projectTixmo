# Independent QA399: PASS (source/stub-only)

Reviewed exact `5a64d9739f148d966534ba802ddd162fc17e053d` against
`8b265cfafda374e676fc74ef96810d0b0171a68c`, 2026-10-21.
Independent branch `tixmo/task-399-independent-qa`, worktree
`/home/daniel/projects/projectTixmo/worktrees/task-399`. Only task399 evidence
changed. Read prior394/395 findings, current CLEANUP-RECEIPTS.md, exact repair
diff and lead398 report/harness; independently authored the retained QA harness.

## Verdict

Prior F1 is addressed within this scope. Both receipts require complete positive
safe PID/PPID, distinct parent, exact executable, structured Linux stat with
matching embedded PID/PPID and positive starttime, exact current runtime root
and separately expected invocation challenge. Complete identities must match
across receipts; listener must be exact IPv4 127.0.0.1 with bounded integer port.
Consistent stale pairs fail closed, not merely conflicting pairs. All malformed
receipt cases tested reject before ss. Present/recycled PID still fails and is
never signalled; clear exact port plus absent PID succeeds only with valid
current provenance. No TCP probe is introduced.

Producer fragment was executed exactly under fs/proc stubs, not rewritten;
listener spreads that same identity. Parent creates challenge after fresh owned
run directory validation, exports it for Jest, and passes same owned root to
observer. Independently executed only the exact challenge assignment twice,
with stale inherited value: both produced distinct valid fresh challenges.
Observer obtains expected binding from current environment, not receipt data.
This prevents accidental stale/mixed evidence, not malicious same-user forgery.
Runner original status/cleanup failure propagation is unchanged by repair.

## Actual checks (all exit 0)

- `node docs/team/evidence/task-399/independent-qa.cjs`: **84 independent observer
  cases**, exact producer success plus 2 rejection cases, 2 actual challenge-only
  shell assignments; retained log. Missing/malformed receipts and every identity
  field, stat PID/PPID/start/length, crossreceipt valid conflicts, consistent stale
  roots/challenges, independent expected invocation, malformed endpoints,
  present/reused PID, occupied port and failed/unavailable/malformed ss covered.
- `node docs/team/evidence/task-393/cleanup-regression.cjs`: **46 author cases**,
  independently rerun, retained log.
- `node docs/team/evidence/task-393/guard-regression.cjs`: copied Jest environment,
  exact listener registration/revocation and failclosed target checks PASS;
  exactly 2 transport calls are counter stubs, no kernel sockets. Retained log.
- `bash -n docs/team/evidence/task-379/runtime.sh` and
  `node --check docs/team/evidence/task-393/process-cleanup.cjs`: PASS.
- Python exact baseline comparison: all HTTP100 `expect(` lines identical,
  network-guard.cjs byte-identical. Inventory, uniqueness, cancellation and
  pressure assertions preserved; repair changes only invocation receipt producer
  in that test, challenge assignment in runner and receipt observer validation.
- `git diff --check`: PASS.

## Limitations

No DB, runtime harness, services, listeners, network, install/download,
configuration, provider, spend, push, merge or deploy. Candidate fs/proc/ss and
path validation are stubbed; actual runtime-path permissions, real process
cleanup, HTTP100 server/native integration and live timeout cleanup remain
unverified. No full typecheck or live acceptance claimed. No task390/full246
closure or runtime grant; implementation393/397 closure belongs to PM after
required reviews. This PASS is independent source/stub-only acceptance of the
exact source SHA, not release readiness.
