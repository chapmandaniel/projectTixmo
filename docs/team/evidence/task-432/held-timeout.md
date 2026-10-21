# Task432 bounded held-input checkpoint

SOURCE/OFFLINE only. Base dca0223422ad266a6f4e66836a1910ff445de7e0;
branch tixmo/task-432-held-timeout. Read actual independent lead475
554f723c6a8bbb05fc72c08bbb818dc6e952cb67 and QA474
fd0d178691e908ea7441dcdce361060cd17931c4 reports. The assignment's
concatenated task/SHA labels were resolved against those actual objects.

Only retained-shell.sh and its offline fixture change, plus this report.
Existing Bash builtin read -t is the maintained mechanism, no dependency or
orchestrator. TASK432_HELD_WAIT_SECONDS defaults to 60 when unset; explicit
empty/zero/noninteger/leading-zero/over-300 values fail76 before HELD, after
installing genuine427 cleanup. Valid range is integer 1..300 seconds. A failed
read never accepts its partial buffer. Timeout fails75 with a rejection
diagnostic; EOF/unknown still74, close newline still0. Cleanup's existing
failure override1 and observer-failure denial are untouched. TASK379_CLEANUP
means cleanup checks passed only, NOT a successful held session or market gate;
timeout retains nonzero75 even with that marker.

## Actual checks

All five commands exit0:
- node docs/team/evidence/task-432/offline-retained-shell.mjs
- node docs/team/evidence/task-432/offline-shell-functions.mjs
- node docs/team/evidence/task-432/offline-local-phase.mjs
- node docs/team/evidence/task-432/offline-local-session.mjs
- node docs/team/evidence/task-432/offline-stub.mjs

Retained fixture rerun after adding explicit partial-EOF and trailing-space
cases exits0. Real Bash subprocess stdin remains OPEN, with either no bytes or
partial `close` without newline: status75, elapsed1045.8ms/1032.2ms, each exactly
one mocked Redis stop and one genuine cleanup-success marker; asserted >=900ms
and <3500ms with a 4000ms watchdog. Eight invalid bounds fail76 before HELD
with partially owned startup, exactly one cleanup; valid300 closes0 immediately.
Existing default close/repeated close, EOF/unknown/partial EOF/trailing space,
partial startup72, foreign denial, cleanup observer23=>1 with NO success marker
remain asserted. All fixture children reaped; no temporary disk files created.
No service, real process identity/listener inspection or real signal needed on
passing paths. Fixtures inject inert hooks but execute genuine shell/cleanup.

Existing full immutable427 helper correction parity and legacy runtime byte
reconstruction assertions all PASS unchanged. Exact12/default refusal/all12
failfast and exact10 local suites PASS unchanged. Nested4 and unfiltered audit
commands untouched, not newly executed. Bash syntax retained/helper/runtime,
Node fixture syntax, git diff --check all exit0. Read of absent .husky/pre-commit
returned1; no hook/lint-staged pass claimed. Commit uses invocation-only identity
and hooks override, not persistent configuration.

## Limits

This bounds ONLY the held-input read after readiness. It does not cancel or
bound arbitrary native cleanup, readiness, parent-death handling, escaped trees
or enforce OS/native containment. Cleanup may extend elapsed time. Trusted
injected offline elapsed measurements are not native runtime evidence.
No provider/acquire wiring, provisioning, native/provenance/registryDNS proof,
app/Jest/services/network/audit/install/generation/config/scheduler/cloud/spend/
push/merge/deploy/runtime grant. Author448 untouched. Original424 FAIL retained;
432 INCOMPLETE, no fullmarket PASS or closure. Fresh independent exact-SHA lead
and QA review required; prior approvals cover only the predecessor.
