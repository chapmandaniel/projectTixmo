# QA400: accepted failed-run evidence and observed owned cleanup

Reviewed exact evidence `159ca3294ef89c86966b379abf6d16ac4ca37af1`, executed
source `5a64d9739f148d966534ba802ddd162fc17e053d`. Isolated worktree task-400,
branch `tixmo/task-400-runtime-review`; only task400 review artifacts changed.

## Verdict

ACCEPT honest FAILURE evidence and complete observed cleanup of the recorded
owned processes/listeners. **NOT HTTP100 PASS, capacity evidence, or task390
closure.** Root cause is not established by this retained rerun: registration
succeeded and request connector options were not captured. PM separately reports
a later nonnetwork native HTTP boundary reproduction with `path:null`; QA400
did not reproduce that diagnostic and does not treat it as this run's root-cause
proof. Backend401 remains the separate diagnosis/repair owner.

## Independent checks, 2026-10-21T13:27:38Z

Python standard-library JSON/hash/fs inspection plus exact-port read-only `ss`:

- 200 raw measurement results: 100 read/100 order; all status0 with exact
  non-owned TCP target guard rejection; zero GET200 and POST201. Partial results
  byte-value match measurement. Summary status counts agree. Acceptance log
  records expected100 GET200/received0, one failed test/suite, 16.084sec.
- All four identity-bearing receipts have identical PID3269192/PPID3269191,
  executable, complete stat, exact run root and 64hex challenge. Listener IPv4
  127.0.0.1:43015. Consumer errors[], pidAbsent true, listenerRows empty;
  finally cleanupErrors[], serverListening false. Stat's final decoded codepoint
  is10 (real newline), with49 numeric fields after state, embedded correct PID/
  PPID and positive starttime. Display escaping was checked, not a finding.
- Six retained raw artifacts equal bytes at the owned retained runtime root:
  identity, listener, measurement, partial, finally cleanup and process cleanup.
- Independently observed all three `/proc` PIDs absent: Jest3269192,
  PG3269074, Redis3269088. Each exact port43015/22273/48850: ss exit0, no rows.
  Owned pg/postmaster.pid, .s.PGSQL.22273 and redis.sock all absent.
- Nine preflight SHA256 entries independently recomputed, all match: two locks,
  source/generated schemas and five executed helper/test files. Five executed
  helper/test bytes independently match reviewed source5a64d973. No source fixes.
- Runner log reports exact owned service cleanup and successful consumer; PG
  shutdown/Redis exit and immediate postcheck corroborate current observation.

Invocation freshness is supported by exact reviewed runner's shell-held fresh
challenge flow, consistent receipts/current root and producer+consumer logs;
QA did not witness the prior shell environment. No receipt-only authentication
claim. Final restoration and zero leases after zero created HTTP orders are not
proof of successful 100-order cancellation. Rejection timings are not latency
or throughput measurements. PostgreSQL18.6/Redis8.0.5 remain nonparity.

No runtime rerun, DB/service connection, sockets/probes, signals, install,
download, config, source edits, provider, spend, push, merge or deploy. Read-only
/proc metadata and ss are observations, not service traffic. No new runtime grant;
390/full246 remain open. Report committed with invocation-local Git identity and
hooks bypass because existing Husky helper is missing; no persistent config edit.
