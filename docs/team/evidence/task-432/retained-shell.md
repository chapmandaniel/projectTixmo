# Task432 retained shell: SOURCE/OFFLINE checkpoint only

Base `8eaf5cec7fc62bf093bbf4cb401bcc0396a9b161`; new isolated branch
`tixmo/task-432-held-lifecycle`, worktree `task-432-held-lifecycle`.
Actual lead469 `add81ff1397cf68a40bcfaf23ffc54aca053844e` and QA470
`45ff2f40bcc515125dc6aa26878906a1bfaaa4d8` reports read. Existing solution
preflight: Bash subshell/trap/read plus extracted427 helper suffice; no new
orchestration library, provider or dependency justified.

`retained-shell.sh` is inert until explicitly sourced/called, not wired anywhere.
It reuses genuine427 cleanup/identity definitions in a subshell, installs EXIT
cleanup before partial-state validation, verifies both service identities and
exact loopback PID/listener bindings, then keeps that shell blocked on input.
Literal `close` exits0; EOF/unknown input exits74; incomplete/unowned state exits72.
The existing cleanup may override any status with1 on cleanup/ownership failure.
Two close lines still invoke cleanup only once. No input is evaluated as code.
Parent shell traps/options are unchanged by the subshell. No service provisioner,
installed provider or `compose.openLocal.acquire` connection was added.

The HELD output is a local lifecycle notification, NOT admission, capability,
provenance, security evidence, an authorization token or a task432 PASS. A real
caller must independently establish reviewed native enforcement and installed/
generated/runtime provenance BEFORE provisioning; none exists in this slice.
The function only retains already supplied owned state; it cannot roll back
startup occurring before its invocation. Legacy427 runtime/defaults stay byte
unchanged. Historical note superseded by `held-timeout.md` at fc1c24da:
the current retained helper bounds only the held-input read (default60s, canonical
integer1..300); open or partial input times out75. Readiness, arbitrary cleanup,
parent-death handling and escaped-tree containment remain unproved; the read
deadline is not a whole-session deadline or a granted runtime.
Bash command substitution and existing ownership checks retain existing limits
including live PID identity/PID reuse and escaped-tree containment not proved.

## Actual checks (all exit0)

- `node docs/team/evidence/task-432/offline-retained-shell.mjs`: held child alive
  before close with no cleanup; once-only cleanup on close including repeated
  close input; EOF/unknown74; no-PID/Redis-only partial startup preserve72; foreign
  PG identity denies HELD and cleanup fails closed1; actual no-grant legacy entry2.
- `node docs/team/evidence/task-432/offline-shell-functions.mjs`: exact427 runtime
  reconstruction; own/foreign PID UID executable; original7/9 partial cleanup;
  listener and cleanup failure denial.
- `node docs/team/evidence/task-432/offline-local-phase.mjs`: absent provider,
  boolean/native/provenance/source/revocation denials; exact12/all10 failfast.
- `node docs/team/evidence/task-432/offline-local-session.mjs`: exact10 plus
  in-flight command mutation regressions.
- `node docs/team/evidence/task-432/offline-stub.mjs`: exact12/all12 failfast,
  canonical receipt and source mutation denials.
- `bash -n .../retained-shell.sh`, `node --check .../offline-retained-shell.mjs`,
  `git diff --check`: PASS.

Fixtures inject identity/listener/stop functions inside the new subshell after
loading the real helper. Fake held PIDs never identify real processes. They are
not security/native enforcement proof. Only Bash/Git fixture children, pipes and
read-only source checks ran; all exited/reaped. No actual process/listener
inspection, service signals, provisioning, app/Jest/DB/Redis/HTTP/sockets/network,
audits, install/generation/config/scheduler/cloud/provider/spend/push/merge/deploy.
One fixture-only extra foreign-PG check added after initial passing run; no failed
attempts. Existing exact12 ordered commands/nested4/unfiltered audits/default
terminal refusal/448 files untouched. Missing real provider/native/provenance/
registry-DNS remain OPEN. Original424 FAIL retained;432 REVIEW/INCOMPLETE, no
runtime grant/fullmarketPASS/closure. Fresh independent lead+QA exact-SHA reviews
are required; prior extraction reviews do not approve this new checkpoint.
