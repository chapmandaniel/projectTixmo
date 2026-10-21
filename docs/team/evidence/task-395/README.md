# Independent QA395: REQUEST CHANGES (cleanup provenance)

Reviewed exact source `8b265cfafda374e676fc74ef96810d0b0171a68c`, branch
`tixmo/task-393-http-guard`, against `b0d749d6962f75d6daee2836a4605e505daf4556`.
Independent checkout: `worktrees/review-395`, branch `tixmo/review-395`.
Review scope is source and no-network stub regressions only, 2026-10-21.

## Finding F1: cleanup receipt identity is retained, not validated

`docs/team/evidence/task-393/process-cleanup.cjs` validates only a positive
integer identity PID, listener PID equality, address string and integer port.
It does not validate startStat, PPID, executable, matching process identity
between receipts, or IPv4 family. Consequently an absent arbitrary integer PID
and clear port yield exit0 even for malformed identity and contradictory
listener identity. `independent-regression.cjs` independently reproduces this
with stubbed filesystem, path validator and ss subprocess: identity startStat
`garbage`, invalid PPID/non-Node executable; listener conflicting startStat,
executable and IPv6 family all accepted, exit0. This contradicts the author's
claim that malformed receipts fail cleanup and leaves stale receipt provenance
unqualified. This is not proof that a real current runtime leaked a process.

Request original author repair: validate the complete receipt schema and
cross-receipt identity/IPv4 consistency, with bounded failure-path regressions;
ensure records are tied to this run/attempt rather than merely an absent PID.
Do not signal a recorded PID without verifying live ownership. Preserve
conservative failure for present/recycled PIDs. Exact new source requires review.

## Actual checks

- `node docs/team/evidence/task-393/guard-regression.cjs`: exit0; independently
  rerun log retained as `author-regression.log`. Installed Jest copied-env
  reproduction and native registration closure checks pass; transports stubbed.
- `node docs/team/evidence/task-395/independent-regression.cjs`: exit0; retained
  `independent-regression.log`. Real HTTPServer objects, native Server.address()
  and listening getter, fake handle only (never listen/kernel network): exact
  registration, duplicate rejection, idempotent explicit revoke and close revoke
  pass. Invalid listener address/family/port and Unix, UDP, IPv6, external,
  unowned, malformed and missing-host targets rejected. Exactly one permitted
  transport hits the counter stub, never a socket connector.
- Same independent harness: cleanup rejects missing receipt, invalid PID,
  present/recycled PID, ss nonzero/error, occupied port, listener PID mismatch,
  invalid port. F1 malformed/stale provenance acceptance reproduced explicitly.
- `bash -n docs/team/evidence/task-379/runtime.sh`, `node --check` guard and
  process-cleanup helpers, `git diff --check`: exit0.
- Source diff inspection: all original 100 read/100 order status assertions,
  arrival/concurrency limits, order/user/number/barcode uniqueness, ticket/order
  mapping, HELD and inventory counters, latency limits, cancellation restoring
  100 available/0 held/0 sold and zero leases remain unchanged.
- Runner EXIT cleanup captures original status and exits that status if cleanup
  succeeds; observer failure forces exit1. Jest attempt flag is set immediately
  before timeout command. Existing set-e propagates failed Jest/timeout to EXIT.
  This is source inspection, not actual runner execution or timeout proof.

## Verdict and limits

Guard repair and bounded stub regression checks pass. Overall QA does not
approve exact393 until F1 is addressed; no HTTP100/runtime PASS is granted.
No DB/services/network/download/install/source fix/config/provider/spend/push/
merge/deploy. Only task395 evidence files changed. Actual server binding,
Jest+native integration with live HTTP and new process/listener cleanup receipts
remain unverified. Runtime390 and full246 remain OPEN. Lead review is separately
mandatory; QA396 was not assigned or started. PM retains original task closure.
