# QA458 — scoped SOURCE/OFFLINE APPROVE

Exact candidate `59d3cd722ea14af778feb8048839ab81b8a95aad` versus
`c21be3d31d7b491d691dc5e0c9f96ee39b55853d`. NEW isolated task-458 worktree,
branch `tixmo/task-458-independent-qa`. Read role/repository/team instructions
this session;458/448 notes and actual454 a59d6380 immutable README. Claimed458
only. No author edits, evidence-only commit.

## Verdict and actual evidence

454 concurrent-cleanup capability defect repaired in this helper slice.
WeakSet authority is now consumed synchronously immediately after membership
validation, before the first await and before teardown/evidence callbacks.
Independent probes found no blocker within this minimal repair.

`node docs/team/evidence/task-458/probes.cjs` exit0, **11 counted independent
checks PASS**, retained results.txt. Two real live owned Node children exercise
TERM and ignoring-TERM SIGKILL timeout. Concurrent finish while first finish is
waiting rejects. Reentrant awaited finish from BOTH teardown and evidence
callbacks rejects; original callbacks each execute once and duplicate callbacks
zero times. Direct children are reaped and /proc absent before teardown.
Sequential reuse rejects. Two further real closed/reaped children hold either
teardown OR evidence behind an explicit gate while duplicate finish rejects;
original callbacks each once, duplicates zero, exit28 preserved. A teardown
failure consumes capability, rejects and writes evidence once. Foreign live
fixture child is denied without signal, then explicitly stopped/reaped by its
creator. Real missing-executable ENOENT, awaited close -2/null and false timeout,
all8 explicit diagnostic fields through JSON, separate injected evidence ENOSPC
preserved. Evidence failure does not allow reuse. Exit38 plus stderr sentinel
survive separate evidence failure. Expected ENOSPC stacks retained, not test
failures. Each check executed once, no failed harness runs. All direct fixture
children reaped; foreign server processes untouched.

`node docs/team/evidence/task-426/runner-probes.cjs` exit0, author-results.txt.
Actual existing cooperative two-process timeout/direct reap/process-first
teardown, foreignPID, realENOENT/close/8fieldJSON/ENOSPC, exit42stderr/ENOSPC,
canonical ports and preload/wrongSHA denials PASS plus author's new concurrent
and reentrant checks. Read helper/preflight/runner scripts before execution.
`node --check docs/team/evidence/task-426/process-cleanup.cjs`, `node --check
docs/team/evidence/task-458/probes.cjs`, `git diff --check`: exit0.

## Limits

Scoped repair acceptance only, NOT full448 safe-runner acceptance,426 closure
or runtime grant. Full escaped-session/tree containment/adoption/reaping,
scrubbed env-i shell/before-Jest integration, immutable dependency/source TOCTOU,
observer/service identity wiring, bounded teardown callbacks and shell exit
mapping remain OPEN. Direct-child/group tests do not prove escaped-tree safety.
No app/Jest/DB/Redis/HTTP/services/network/install/generation/config/scheduler/
cloud/spend/push/merge/deploy. No full admission exercised. Fresh lead exactSHA
review still required by PM. Evidence commit uses invocation-local Git identity
and hooksPath override for inspected inherited missing Husky helper; no config
write or lint-staged claim.
