# Task 384: contained upgrade evidence finalization

Author: tixmo-release, 2026-10-21. Base exact
`1d9e2f74355bf978f47d32c002b8d4e42d0f1f7b`.
Branch `tixmo/task-384-evidence-finalization`; isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-384`.
Responds only to lead380 report `bf05ab85154e90983b3ba0850fe933ace74315b8`.

## Source changes and consumer contract

- Disconnect and staging removal have separate guarded failure paths. Removal
  runs before result persistence and directory sealing. Failure does not skip
  later cleanup. Logging failures cannot interrupt that sequence.
- Immutable `result.json` is explicitly a **pre-finalization record**, never
  an overall success receipt: `passed` is false for known failure, otherwise
  null, not true. `verificationPassed` means only that the verification body
  reached complete. `finalization: unconfirmed-until-process-exit` applies
  even if subsequent chmod succeeds. Consumers must not interpret null,
  verificationPassed, the complete phase, or presence of this file as overall
  success. Independently capture the process exit status and terminal output;
  this change intentionally does not add a durable final-success marker.
- Result persistence, staging removal, disconnect, or directory chmod failure
  sets exitCode 1. Fixed sanitized stage labels are used; no raw errors, URLs,
  credentials or environment are added to disk. Distinct exclusive failure
  records are attempted before seal or after seal failure where writable.
  Failure to write those records also fails closed, retaining earlier files.
- Success output moves after all required finalization operations. A final
  catch contains unexpected finalization rejection without rethrowing over
  the original runtime diagnostic already printed by the existing catch.
- Existing artifact exclusive create/fsync/0400 protection, 0700 owned parent,
  symlink checks, unique directory and attempted 0500 final mode are preserved.
  Existing pre-finalization source is byte-identical, including the default
  evidence opt-out, target guard and eight ticket/five type/six tier assertions.
  No migrations or dependencies changed.

## Actual checks

- `node --check scripts/verify-payment-upgrade.cjs`: exit 0.
- `git diff --check`: exit 0.
- Python text-only checks: exit 0. Compared complete script prefix before the
  relocated success output byte-for-byte with exact base; checked guard before
  evidence/client, eight ticket expectations, five type labels and six tiers;
  checked passed false/null, explicit pre-finalization status, removal before
  result before seal before success output, all four guarded failure labels,
  distinct failure records and terminal catch.
- The first text-check attempt failed because its plain substring search for
  passed:true matched an explanatory comment, not a JSON property. Corrected
  the check to anchored property matching and reran successfully. No harness
  code was executed by either attempt. Syntax and diff checks also passed in
  that initial shell invocation; the shell's last status did not stand in for
  the failed Python assertion.

These are source/syntax checks only, not behavioral fault injection. A chmod
failure may leave an unsealed directory; an unwritable filesystem may prevent
any final failure artifact. Missing/partial artifacts and null passed are not
success. Read-only files remain application-level protection, not WORM or
crash-durability proof. Fresh independent lead and QA must review the exact
committed repair SHA; author does not approve or close 377. Task377 stays
REVIEW; parent245 OPEN/NO-GO.

No harness/helper runtime, SQL, DB, services, installs/downloads/network,
env/secret loading, config/scheduler/Gateway changes, spend/provider, push,
merge or deployment. No parity, dump/new-database restore, old-code
compatibility or rollback acceptance. Runtime requires a fresh separate PM
sole-DB grant and the existing ownership/scrubbed-loopback/disk/network plan.
Commit hooks are intentionally NOT RUN; Git identity/hooks flags are scoped
only to the commit command, not persistent configuration.
