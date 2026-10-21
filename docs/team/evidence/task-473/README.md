# Task473 independent lead: REQUEST_CHANGES

Exact candidate `0d79445dce1b3c4f71db13c3e00838696bc094a4` versus
`8eaf5cec7fc62bf093bbf4cb401bcc0396a9b161`. NEW isolated task-473 worktree,
branch `tixmo/task-473-lead-review`. Read473/432 actual notes and candidate
report/helper/fixtures. No author code edits. Bounded SOURCE/OFFLINE review.

## F1: cleanup listener-observation failure becomes successful close

`retained-shell.sh` delegates EXIT cleanup to genuine427 `owned-lifecycle.sh`.
Its cleanup sets `+e`, emits TASK379_CLEANUP, then assigns
`listeners=$(ss -H -ltnp ...)` WITHOUT checking command status. If readiness
listener inspection succeeds but final inspection fails23 with no output,
empty listeners pass all subsequent checks and retained close exits0. Failure
to observe listeners is not evidence of their absence. This is an inherited
helper defect exposed by the new retained-shell cleanup-success contract,
not a demand for absent native admission or real provisioning.

Minimal deterministic reproduction is final case in `check.mjs`: genuine
retained-shell and cleanup bodies, injected inert identities/listeners only;
ss returns valid exact rows during readiness, then returns23/no output for
cleanup's combined `sport ... or ...` query. Input `close\n`. Actual output:
TASK432_SHELL_HELD, STOP:redis:910002, TASK379_CLEANUP; exit0, empty stderr.
No real services, signals or listener inspection occur. The probe explicitly
asserts the faulty0 so its exit0 means defect REPRODUCED, not acceptance.

Original author should check final listener-observer exit status, fail nonzero
on observation failure, and avoid emitting unqualified cleanup-success before
all final checks pass. Preserve genuine primary nonzero status when cleanup
succeeds; fresh independent exact-SHA review required after repair.

## Actual checks

- Independent12 passing inert groups plus1 concrete defect reproduction:
  held child remains alive/no cleanup until close; close/repeated-close cleanup
  once; EOF/unknown/unterminated close/trailing-space74; cleanup-stop failure1;
  leftover-listener failure1; readiness observer failure denies HELD; no-PID
  partial startup72; inert sourcing preserves parent traps/options.
- Existing retained-shell, extracted-shell, local-phase, local-session and stub
  suites each exit0. Exact12/default/fail-fast and nested composition regressions
  remain intact. Candidate changes ONLY three NEW files: retained shell, report,
  offline fixture; legacy runtime/default command table/nested4/provider wiring
  unchanged. No acquire/provider connection added.
- Bash syntax, independent Node syntax, diffcheck all0. checks.json and raw logs
  retained. Initial fixture expected readiness failure72, but deliberately still-
  alive fake PG correctly produced cleanup override1 (nonexistent pg_ctl path);
  fixture expected status corrected, no product changes. All final checks pass
  except intentional reproduced behavioral defect above.

## Limits

Identity/listener/stop functions are injected fixtures, not live ownership or
native security evidence. Only Bash/Node fixture children/pipes executed, all
closed/reaped. No app/Jest/services/sockets/network/DB/Redis/HTTP/install/config/
spend/push/merge/deploy. Trusted supplied shell state/CWD/callbacks are not an
admission boundary; PID reuse/escaped-tree/native containment not proved.
No parent-death guarantee or held-input timeout; input may remain open forever.
Caller owns startup before invocation. No runtime grant/fullmarket PASS or432
closure; absent provider/native/provenance/registryDNS machinery remains OPEN.
Evidence-only commit with invocation-local identity/hooks override, no config write.
