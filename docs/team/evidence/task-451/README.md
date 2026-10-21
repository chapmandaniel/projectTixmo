# Independent QA451 — REQUEST_CHANGES (partial SOURCE/OFFLINE)

Exact candidate `f8f54a476ed171fdc8b9c307aa1316c8113cdc52`, compared with
`510824df9e9bb7f5e57984862728b52929f7f849`. New isolated branch
`tixmo/task-451-independent-qa`, worktree `worktrees/task-451`.
Read actual448 note, RUNNER-CHECKPOINT and four-file delta, process cleanup,
preflight, provenance/path and native guard. No implementation edits.

## Findings

1. **Original process spawn diagnostic lost.** `launch()`'s error listener sets
   `record.result={error}`, then close unconditionally replaces it with
   `{code,signal}`. Real nonexistent-command probe returns only
   `{timedOut:false,result:{code:-2,signal:null}}`: ENOENT, syscall, command/path
   and message are absent from retained result. This violates original error
   retention even in this helper-only checkpoint. Preserve spawn error separately
   or merge close status without overwriting it; test real ENOENT plus evidence
   failure and retain a serializable original diagnostic.
2. **Two distinct service port check compares strings, not port numbers.**
   `02345,2345` passes regex/range and string Set despite representing one TCP
   port. Reproduced after narrowly substituting provenance/path to reach this
   branch (not admission). Require canonical decimal representations and/or
   numeric distinctness; reject leading-zero duplicates before native guard.

These findings return to original author448; no fixes made by reviewer.
Acknowledged incomplete full-tree/setsid containment is not newly represented
as a defect discovered here or approved by these passing direct-process tests.

## Actual evidence

`node docs/team/evidence/task-451/probes.cjs`: exit0, **18 independent checks
PASS plus two deterministic defect reproductions**, results.txt. Real owned
single cooperative child TERM and stubborn child ignoring TERM then SIGKILL:
timeout true, correct signal, /proc disappearance/direct reap before teardown.
Consumed capability cannot repeat teardown. Foreign live child fake authority
rejected without signal; reviewer explicitly stops/reaps its own foreign child.
Original exit37 and stderr sentinel retained despite injected evidence ENOSPC.
Real nonexistent-command fails, but loses original diagnostic as above.
Three preload and six malformed/out-of-range/duplicate port denials; fixture
preflight installs native guard; nonowned TCP and UDP synchronously denied
before native socket calls. No network sockets/services were used.

Probe run twice: both exit0, same two reproductions. Retained last output.
`node docs/team/evidence/task-426/runner-probes.cjs`: exit0, author cooperative
real two-process timeout/reap/order, foreign authority, preflight denials and
exit42/stderr/evidence error checks PASS; output author-results.txt.
Three `node --check` for preflight/process-cleanup/reviewer probes and
`git diff --check`: exit0. No initial failed test runs.

Preflight success/port branch substitutes provenance/path in this probe process
only, restored afterward. This is NOT genuine source/dependency/runtime
admission. Guard installed inside probe process only; process exits afterward.
No dependencies or production files modified to build a fake admission.

## Remaining scope

No runtime approval or448/426 closure. Escaped setsid/full owned tree
containment/adoption/reaping, unbounded teardown callback, scrubbed env-i shell,
preJest integration, immutable deps/source TOCTOU, original shell exit mapping,
426 observer and service identities remain unverified/incomplete as author
acknowledges. Native guard checks are Node scope, not OS containment.

No app/Jest/services/DB/Redis/HTTP/network/install/config/spend/push/merge/deploy.
Only owned offline Node processes run; all direct children reaped. Reviewer
owns this evidence directory only. Report-only commit uses invocation-only
identity/hooksPath due already-inspected inherited missing Husky helper;
no persistent config write/lint-staged claim.
