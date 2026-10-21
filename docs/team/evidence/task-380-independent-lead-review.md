# Task 380 independent lead source review

Reviewer: tixmo-lead, 2026-10-21. Implementation task 377.
Exact reviewed SHA: `1d9e2f74355bf978f47d32c002b8d4e42d0f1f7b`.
Comparison base: `f8a407cd789ecdebf11927debc3e3b26c4ea5267`.
Review branch: `tixmo/task-380-independent-review`.
Worktree: `/home/daniel/projects/projectTixmo/worktrees/task-380`.
Only this independent report is reviewer-owned; author code is unchanged.

## Verdict: REQUEST CHANGES (one medium finding)

At `scripts/verify-payment-upgrade.cjs:187`, the immutable `result.json`
records `passed: true` after an otherwise successful run, but before final
`chmodSync` and staging `rmSync` at lines 192-193. Both can throw. Those calls
are outside the finalization catch, so a cleanup failure rejects the terminal
`.finally()` promise and leaves a retained success manifest for a failed
process. A chmod failure also skips staging removal. If an earlier operation
failed, its message is printed by the original catch, but the new unhandled
cleanup rejection becomes the terminal exception instead of being contained.
This contradicts the task-377 report's claim that cleanup failures mark failure
and weakens retained evidence as the authoritative result.

Return this to the author: contain cleanup/final-permission failures without
replacing the original diagnostic, and arrange final status/evidence so it
cannot claim overall success when required cleanup/finalization fails. A
sanitized distinct failure artifact or explicit pre-finalization status is a
possible approach; do not overwrite immutable evidence. Re-review the exact
repair SHA. This finding is control-flow inspection, not an executed fault
injection or observed filesystem failure.

## Accepted source observations

- All eight expected ticket IDs exactly match fixture tickets. Expected
  state/tier pairs follow the migration CASE/candidate rules: ambiguous and
  unmatched SOLD/null; cancelled UNKNOWN/null; held HELD/known tier;
  inconsistent SOLD/inconsistent tier; released RELEASED/null; transferred
  and used SOLD/known tier.
- All five type total/available counters are explicit 100/90. All six tier
  limit/sold/held tuples are explicit, including unchanged ambiguous/unmatched
  zeros, cancelled sold1 and inconsistent sold5. Before/after conservation
  now includes original type/tier counters; known sold2 stays unchanged.
- Persistence is opt-in. Target guard remains before evidence initialization
  and client construction. Parent ownership, exact0700 mode, no symlink path
  traversal, unique0700 child, exclusive file create, fsync and0400 files are
  present. Final0500 is application-level immutability, not owner-proof WORM.
- Selected before/after rows and ordered ledgers, full migration source
  checksums, commit and harness/fixture hashes are retained. Bigints use
  tagged decimal strings; Dates use JSON ISO conversion. Current synthetic
  fixture values contain no live URLs/secrets in persisted selected fields;
  sensitive known keys are omitted. Scrubbing is not a generic arbitrary-data
  redactor and must not be treated as authorization to capture real data.
- Earlier successful/partial evidence files are not removed with staging;
  missing after data on migration/query failure is not falsely claimed.
  Original catch still prints the original runtime message. Raw errors and
  environment/connection strings are not added to disk evidence.
- Default opt-out avoids disk evidence; it does add intended assertion/query
  coverage. No dependency, guard or released migration change is in the diff.

## Actual checks

All exit0 on the exact reviewed source:

- `node --check scripts/verify-payment-upgrade.cjs`.
- `git diff --check f8a407cd789ecdebf11927debc3e3b26c4ea5267 HEAD`.
- Independent Python text-only assertions: eight ticket IDs equal fixture
  IDs; five type labels; six tier tuples; target-guard ordering; confirmed
  result persistence precedes fallible final chmod/removal.
- Manual diff, fixture, migration inventory rules, scan-log schema and
  task-377 evidence review. These are source checks, not behavior tests.

No harness/helper execution, SQL, DB/service access, installs, network,
envsecret inspection, config changes, spend, push, merge or deploy. No
runtime/parity/dump/new-database restore/old-code compatibility/rollback
acceptance. Hooks not run for this documentation-only commit; synthetic
identity and disabled hooks are command-scoped, not persistent config.
Task377 remains REVIEW for PM disposition after author repair and independent
lead plus QA review. Parent245 remains OPEN/NO-GO; any future runtime requires
a fresh separate PM sole-DB grant and operator safety prerequisites.
