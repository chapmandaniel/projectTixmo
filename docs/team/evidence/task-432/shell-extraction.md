# Task432 inert owned-lifecycle extraction

Base `d5fec56e99a37218ef06a512e265c99942290340`; new isolated branch
`tixmo/task-432-shell-functions`. Only existing alive/owned_identity/stop_exact/
cleanup definitions moved verbatim from427 runtime.sh into explicitly sourced
`docs/team/evidence/task-427/owned-lifecycle.sh`. Helper performs no top-level
operations or trap registration. Original traps stay at their original point;
all provisioning, listener checks, environment, grant checks and gate commands
remain byte/order identical after expanding the source line. Fixture asserts
this against the immutable base, using literal callback replacement.

Actual PASS:

- `node docs/team/evidence/task-432/offline-shell-functions.mjs`: exact source
  reconstruction, inert source/no traps, own Redis identity accepted, foreign
  PID/UID/executable denied, foreign live identity never signalled; partial
  startup/no PID and Redis-only failure retain original exit7/9; foreign
  listener and cleanup failure deny success. All shell commands that could
  signal, inspect service processes/listeners, or wait are injected stubs.
- Existing offline-local-phase, offline-local-session, offline-stub,
  offline-shell-publication and offline-publication suites PASS unchanged.
- bash syntax on both shell files, node syntax on new fixture, diffcheck PASS.

Two initial fixture-only failures corrected: JS replacement interpreted $$
(rather than literal text; fixed callback); cleanup diagnostic is stderr
(fixed fixture capture). Production function bodies were never altered.
No application/services/PGRedis/HTTP/network/native capability tests ran.
Only short synchronous inert Bash fixture children and source-reading Git ran;
all exited/reaped. No install/config/scheduler/spend/push/merge/deploy or448 edits.

This does NOT implement a provider, ready/close protocol, pre-provision native
admission or dependency/generated-client provenance. Existing default missing
provider and terminal missing-grant denial retained. Cleanup/listener probes
are behavior tests, not real service identity or security enforcement proof.
Task432 remains REVIEW/INCOMPLETE, original424 FAIL retained; no runtime grant,
fullmarketPASS, selfapproval. Independent lead and fresh QA required for this
exact code successor; previous reviews do not approve it.
