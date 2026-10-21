# Task398 independent lead acceptance

Exact reviewed source: `5a64d9739f148d966534ba802ddd162fc17e053d`, original
backend branch `tixmo/task-397-cleanup-receipts`, against
`8b265cfafda374e676fc74ef96810d0b0171a68c`.
Independent checkout `worktrees/task-398`, branch
`tixmo/task-398-independent-review`. No backend source fixes.

## Verdict: PASS within source/stub-only scope

Prior394/395 F1 is addressed. Parent runner generates a new 32-byte random
challenge after creating/validating its fresh owned run directory, overwriting
any inherited challenge. It exports that value to the Jest producer and retains
it for cleanup's observer; observer does not obtain expected identity from the
receipts. Producer records challenge and exact artifact root in both receipts.
Observer separately checks expected challenge and argv root against both,
validates positive safe PID/PPID, executable equality to its own Node binary,
Linux stat structure/embedded PID/PPID/positive start time, byte-identical
cross-receipt identity, exact IPv4 127.0.0.1 and bounded integer port.
Consistent stale pairs and same-run wrong-root pairs fail closed. Missing/bad
current invocation also fails before acceptance. No circular receipt-only
current-run inference was found. This is accidental stale/mixed evidence
protection, not authentication against malicious same-user code.

Present PID remains failure even on PID reuse: observer only checks existence,
never signals or assumes ownership from stale stat. Only exact-port read-only
ss subprocess is permitted by independent harness. PID missing and port clear
are success only after complete validated current-run receipt provenance.
Runner original-status/cleanup failure behavior and sole-owner guards are
unchanged. Original exact native loopback guard unchanged; all expect-containing
HTTP100 lines byte-identical (inventory, uniqueness, scheduling, cancellation,
latency assertions retained).

## Actual checks

- `node docs/team/evidence/task-398/independent-regression.cjs`: exit0, 81
  independent observer cases plus execution of exact candidate producer fragment
  under fs/proc stubs; missing/malformed producer challenge rejected. Includes
  both missing/invalid JSON receipts, scalar/null/array, every missing identity
  field, numeric bounds/types, embedded stat mismatch/length/starttime, executable,
  conflicting valid snapshots/PPIDs, paired stale run/root, independent expected
  challenge mismatch, invalid IPv4 endpoints, PID reuse, occupied/failed ss.
  Producer fragment generated the positive fixture; runner challenge generation,
  export/inheritance and observer current-root call source-inspected separately.
- `node docs/team/evidence/task-393/cleanup-regression.cjs`: exit0, 46 author
  cases independently rerun.
- `node docs/team/evidence/task-393/guard-regression.cjs`: exit0, retained log;
  installed Jest copied-env reproduction and native registration/revocation
  target-denial checks; two transports are counter stubs only.
- `bash -n docs/team/evidence/task-379/runtime.sh`: exit0.
- `node --check docs/team/evidence/task-393/process-cleanup.cjs`: exit0.
- Installed task354 TypeScript transpileModule: zero syntax diagnostics, not full
  typecheck. Independent assertion-line comparison and unchanged guard: PASS.
- `git diff --check`: exit0.

No actual runtime, server bind, DB, services, network, downloads/install,
configuration, provider, spend, push, merge or deploy. Candidate filesystem,
proc and ss interactions are stubbed, including runtime-path validation; its
existing path helper is not newly runtime-qualified. No HTTP100 runtime PASS,
cleanup-on-real-process proof, task390 or full246 closure is granted. Fresh
independent QA remains mandatory; PM alone owns implementation397 closure.
