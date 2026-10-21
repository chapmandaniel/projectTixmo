# QA396: ACCEPT bounded LOCAL NONPARITY evidence only

Independent review of exact evidence commit
`aa422d361d13fe4715aec56e2886185200cde8e5`, source parent
`28b403252555ba9917e482cfbcd5d287c57afa47`, branch
`tixmo/task-391-upgrade-runtime`. QA checkout `worktrees/review-396`, branch
`tixmo/review-396`; 2026-10-21. No runtime rerun or source changes.

## Verified independently

`node docs/team/evidence/task-396/check.cjs`: exit0, retained check.log.
Read-only checks against committed evidence AND the original retained runtime:

- All 19 SHA256SUMS entries match. Original retained five JSON files byte-match
  committed copies; modes0400, finalized child0500, runtime parent0700.
- Separate original and committed build0/harness0/outer0/cleanup0 receipts match;
  raw build/harness/outer logs and runner/guard match original runtime files.
- Terminal `Populated upgrade passed:` exists in actual retained harness output.
  Source emits this only after required finalization including directory seal and
  only without failure status. Separate process exit0 is present: this is not a
  verdict inferred from result.json. Its passed:null/verificationPassed:true and
  unconfirmed finalization correctly remain explicitly PRE-finalization.
- Four result artifact hashes match. Ledger before26/after31 names and checksums
  match all31 migration SQL source files; before ledger matches source too.
- Before/after legacy row snapshots deep-equal, populated8tickets/5types/6tiers.
  All eight expected ticket inventory/tier mappings, all five type totals,
  availability/reconciliation status, all six tier limit/sold/held counters match.
- Source/harness/fixture/schema/lock/generated schema/client JS hashes match
  provenance. Donor task354 lock byte-identical; generated schema whitespace-
  normalized identical. Retained provenance identifies exact source28b40325.
  Harness source also inspected for assertions and finalization ordering; no
  additional live API/auth/security behavior is claimed by this review.

Independent process observation at `2026-10-21T13:05:41Z` retained in cleanup.log:
PG3234779 and Redis3234792 /proc entries absent; ss exit0 with no listeners on
34722/57178; run.aVUlMz/pg/postmaster.pid and owned PG socket absent. Observation
only; no connection, service startup, signal or DB command. This corroborates
recorded cleanup rather than relying solely on author postcheck.txt.

`git diff --check`: exit0. Evidence diff from source parent is documentation only.
Source runner cleanup prints ss output without independently making occupied
ports/ss failure fatal; this review's current independent ss/proc/postmaster
observations supply cleanup evidence for THIS run only, not generic runner proof.

## Verdict and boundaries

ACCEPT honest bounded local nonparity populated-upgrade evidence for391; PM owns
closure. PostgreSQL18.6/Redis8.0.5 are explicitly NONPARITY against required
PG17/Redis8.2.10. Full245 remains OPEN/NO-GO: parity, dump/separate-new-DB restore,
old-code compatibility, write-preserving rollback and operational timing were
not performed. Retained tiny-fixture timing is not RTO/RPO. This is not a fresh
runtime PASS or full release acceptance. No failure-injection/crash/WORM claim.
No services/rerun/install/sourcefix/config/provider/cloud/spend/push/merge/deploy.
Only task396 QA report, read-only checker and logs committed.
