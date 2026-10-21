# Task432 cleanup observer repair (SOURCE/OFFLINE)

Base `0d79445dce1b3c4f71db13c3e00838696bc094a4`; NEW isolated
`tixmo/task-432-observer-fix`, worktree `task-432-observer-fix`.
Read actual independent lead473 REQUEST_CHANGES immutable
`bc46d6dee26a482fa7d1de3af9e733b8525f016e` report, minimal fixture and actual
results. Defect accepted: cleanup sets+e, so failed final ss/no output was
misrepresented as no listeners with successful close and premature marker.

Shared427 helper now captures observer status immediately, emits diagnostic
with cleanup-listener phase/status and exits1 on failure. Success marker moves
after ALL final checks. Successful cleanup still preserves original exit status;
cleanup failure retains existing override1 semantics. No identity/signalling/
provisioning/order/default command change. This intentionally changes inherited
427 cleanup behavior; extraction fixture explicitly asserts COMPLETE helper
bytes equal immutable8eaf helper plus exactly this correction, and separately
reconstructs original legacy runtime bytes with immutable pre-fix definitions.
It does not drop or weaken parity assertions.

Actual checks all exit0: offline-retained-shell (new readiness-success then
cleanup-ss23/nooutput => close1, no cleanup-success marker, phase/status23);
offline-shell-functions (same observer failure from primary0 and37 =>1;
original7/9 retained when cleanup succeeds; complete helper-byte correction
and original runtime reconstruction); offline-local-phase; offline-local-session;
offline-stub. Two Node syntax checks; three Bash syntax checks (helper, retained
shell, legacy runtime); diffcheck PASS. No failed author checks. All fixture
children exited/reaped. No real services/signals/process-listener inspection/
sockets/network/app/Jest/DBRedisHTTP/audits/install/generation/config/scheduler/
cloud/provider/spend/push/merge/deploy. Invocation-local identity/hooks override
only. Exact12/nested4/default missinggrant/missingprovider unchanged,448 untouched.
Fixtures remain inert, not capability/security proof. No provider/acquire wiring,
native/provenance/registryDNS proof or runtime grant. Original424 FAIL retained;
432 REVIEW/INCOMPLETE. Prior source checkpoint has REQUEST_CHANGES, not approval;
fresh independent lead+QA exact repaired SHA required. No selfapproval/closure.
