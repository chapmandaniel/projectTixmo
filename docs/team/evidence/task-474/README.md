# Independent QA474: scoped APPROVE

Exact candidate dca0223422ad266a6f4e66836a1910ff445de7e0 versus
0d79445dce1b3c4f71db13c3e00838696bc094a4. New isolated worktree task-474,
branch tixmo/task-474-qa-review, based on candidate. Read actual lead475
554f723c6a8bbb05fc72c08bbb818dc6e952cb67 report and probe, and task474/432/473/475
notes. Author implementation untouched. This is fresh independent source/offline
acceptance of observer repair, not approval of predecessor or runtime execution.

## Actual checks

Reproduce: `node docs/team/evidence/task-474/run.mjs`.
Exact 11 commands/statuses in results.json; raw merged output in named logs.
All 11 exit0: own independent probe, five existing offline suites
(retained-shell, shell-functions, local-phase, local-session, stub), three Bash
syntax checks, own Node syntax, git diff --check.

Own check.mjs passes 16 independent groups. Four adversarial final ss failures
cross primary0/67 and no-output/with-output: readiness succeeds, cleanup exits1,
phase/status23 diagnostic, NO TASK379_CLEANUP. Two successful cleanup cases
preserve0/67. Close/repeated-close/EOF/unknown/partial-line/trailing-space cases
clean exactly once; two partial-start cases preserve72 with no held marker.
Held child remains alive without cleanup while stdin is open; close then reaps
that child. Cleanup stop precedes success marker. Entire shared427 helper equals
immutable8eaf helper plus only explicit status check and relocated marker;
original runtime reconstructs byte-for-byte using immutable old definitions.
Exact candidate changed-path whitelist excludes commands/defaults/nested4/API
and provider wiring. Existing stub verifies immutable exact12 ordered stages
and all12 failure positions; local-session verifies exact10 local steps/mutations;
existing retained fixture verifies default missing-grant2, local-phase verifies
missing-provider denial before child operations. Nested4 unchanged by exact diff,
not claimed newly executed as actual API operations.

One own fixture assertion initially failed because real cleanup intentionally
redirects wait output to /dev/null; corrected only expected mock output (not
implementation or status/ordering assertions), then all checks passed. A follow-up
read-only rg used nonexistent guessed verifyApi paths (exit2); candidate diff
whitelist, not that search, establishes nested code unchanged.

## Limitations

Only trusted inert injected Bash/Node fixtures: no real services, signals to
unrelated processes, process/listener inspection, sockets, app/Jest, DB/Redis/HTTP,
network, audits, installs, generated dependencies, config/scheduler/cloud/spend,
push/merge/deploy or runtime grant. All own fixture children reaped. No native
admission, provenance, registry/DNS isolation, provider acquisition integration,
PID-reuse/tree containment, parent-death guarantee or held-input timeout proven.
Caller owns startup before invocation. Original424 full-market failure retained;
432 remains REVIEW/INCOMPLETE, not closed. Source checkpoint acceptance ONLY.
Commit uses invocation-local identity/hooks override, no persistent config change.
