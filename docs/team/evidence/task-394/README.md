# Task394 independent lead review

Reviewed exact `8b265cfafda374e676fc74ef96810d0b0171a68c` on
`tixmo/task-393-http-guard` against
`b0d749d6962f75d6daee2836a4605e505daf4556`.
Independent branch `tixmo/review-394`, isolated `worktrees/review-394`.
Read author393 evidence and QA392/PM board handoff. No product source changed.

## Verdict: request changes for cleanup provenance

**F1 (P2, blocking the requested fail-closed cleanup acceptance):**
`docs/team/evidence/task-393/process-cleanup.cjs:10-17` validates integer PID,
same listener PID, address string and port only. It never validates or compares
the persisted executable, PPID, or Linux start identity; it does not bind receipts
to a current invocation. Thus absent-PID/clear-port observations produce exit0
even when identity fields are absent, the two receipts carry different process
start identities, or old-run receipts are substituted. The mocked regression
retains these actual outcomes. Family IPv6 paired with the IPv4 address string
also passes receipt validation. This is a provenance false positive, not evidence
that the real runtime left a process alive or that an attacker can defeat the
owned0700 directory. Fresh mktemp directories reduce accidental stale-receipt
exposure but do not make malformed/mismatched evidence fail closed.

Original author should validate required receipt shapes/start identities, match
all duplicated identity fields, and bind them to the current owned invocation;
add non-network malformed/mismatched/stale regression coverage. Keep observer
observation-only and conservative on PID reuse. Independent review is required
for the resulting new exact SHA; no source fix was made here.

## Guard and HTTP contract findings

- Installed Jest copied-env/native-preload mismatch reproduced with author's
  installed jest-util VM harness: copied env gains51001, native env retains
 31001,41001; exact HTTP target rejected before registration. No kernel connect.
- Native built-in net symbol closure accepts an HTTP Server instance only,
  checks listening and captured native Server.address(), requires exact IPv4
 127.0.0.1 integer bound port, rejects duplicate active registration; close and
  finally revoke admission. Exact host/path checks remain; Unix, UDP, external,
  IPv6, hostname localhost and unregistered-port attempts rejected by stub checks.
- Non-writable/non-configurable symbol property defaults are appropriate here.
  No broad localhost allowlist, guard disable, or environment-copy workaround.
- Every expect-containing line in the HTTP100 test is byte-identical to base,
  including100GET/100POST, inventory, uniqueness, latency and cancellation checks.
- Receipt producer now records PID/PPID/executable/startStat and HTTP address;
  runner invokes observer after Jest attempt. Missing receipt/invalid JSON/invalid
  PID, present PID (including reuse), occupied HTTPport and ss failure reject.
  PID reuse is conservatively rejected, never signaled; no start-stat comparison
  occurs. No real listening-server behavior was exercised under source-only scope.

## Actual checks

All commands run from isolated review checkout using existing installed tools:

- `node docs/team/evidence/task-393/guard-regression.cjs`: exit0; retained
  `guard-regression.log`; two allowed transports hit counter stub only.
- `node docs/team/evidence/task-394/cleanup-regression.cjs`: exit0; retained
  `cleanup-regression.log`. Harness assertions confirm six rejection cases and
  four false-positive cases; exit0 is the harness passing, NOT observer acceptance.
  Candidate fs/proc/ss/path-validation interactions are mocked; this does not
  independently qualify the runtime-path helper or any actual process cleanup.
- `bash -n docs/team/evidence/task-379/runtime.sh`: exit0.
- `node --check docs/team/evidence/task-393/process-cleanup.cjs`: exit0.
- Installed task354 TypeScript transpileModule: zero syntax diagnostics; not
  full typecheck. Independent Node assertion-line equality check: PASS.
- `git diff --check`: exit0.

No listeners, services, DB, network calls, installs/downloads, configuration,
provider, spend, push, merge, deploy, or runtime qualification. Existing library
preflight: repair uses installed Node built-ins/Jest, no custom service needed.
Task393 remains unapproved pending F1 and QA395. Task390 and full246 remain OPEN.
