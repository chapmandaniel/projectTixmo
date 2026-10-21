# Task397 source-only receipt repair

Base: 8b265cfafda374e676fc74ef96810d0b0171a68c. No runtime executed.

The owned runtime shell creates a fresh 256-bit invocation challenge after its
new validated runtime directory is created. The Jest process inherits it; both
receipts carry that challenge and exact runtime directory. Cleanup takes its
expected challenge from the still-current parent shell environment, never a
receipt or persisted manifest. Missing challenge fails closed, including manual
observer calls without the current invocation context. This is stale/mixed-run
protection, not defense against malicious code running as the same Unix user.

Observer validates both complete process records, executable equal to the
observer's Node executable, numeric PID/PPID and structurally valid Linux stat
including embedded PID/PPID and positive starttime. Both process records must
match exactly, including the full stat snapshot. Listener must be exact IPv4
127.0.0.1 with an integer port in range. Present PID (including recycled PID)
remains failure; there are no signals and no TCP probes. Invalid receipts fail
before the exact-port ss observation. All HTTP100 inventory/uniqueness and
cancellation assertions and the exact owned-loopback network guard are unchanged.

Checks (installed tools only):

- `node docs/team/evidence/task-393/cleanup-regression.cjs`: PASS 46 stub-only cases.
  Includes valid current-run absence/clear-port success; either missing receipt;
  invalid JSON; each missing identity field in either receipt; malformed, stale,
  conflicting process provenance; wrong runtime root/challenge; malformed IPv4
  endpoints; missing current challenge; paired stale receipts; present/recycled
  PID; occupied port; failed/unavailable ss. No actual ss/process/network access.
- `node docs/team/evidence/task-393/guard-regression.cjs`: PASS existing Jest-copy
  environment and owned listener registration/revocation/target-denial regression;
  two transport calls are stubs only.
- `node --check docs/team/evidence/task-393/process-cleanup.cjs`: exit 0.
- `bash -n docs/team/evidence/task-379/runtime.sh`: exit 0.
- `git diff --check`: exit 0.

Initial cleanup regression harness incorrectly defaulted explicit null fixtures;
corrected fixture selection with own-property detection, then all 46 passed.
No DB, services, runtime harness, network, install, downloads, configs, provider,
production, spend, push, merge or deploy. Fresh independent lead AND QA reviews
of the exact final SHA are required before closure or any task390 runtime.
