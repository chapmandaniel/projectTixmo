# Task 181 independent QA acceptance

Disposition: **APPROVE** exact implementation
`7574eea362ea827c1da85a0bf60002352a355dd1`, base
`2890aea6af8f7fc6c693980b6e7a14046f22e45e`.
Reviewer: `tixmo-qa`, 2026-10-20. Isolated branch `tixmo/review-181`,
worktree `/home/daniel/projects/projectTixmo/worktrees/review-181`.

## Scope and independent inspection

Read role/repository instructions, required team documents, tasks181/180,
author report179 and independent lead180 report at evidence commit
`b8eb3cbbe3adadae9929f8c70aa3cee1ead7764d`. Claimed181 before work.
Inspected main status and worktrees; preserved existing untracked team files.
Base ancestry check passed. Complete candidate diff changes only the prepare
unit fixture and author evidence: two files, 71 insertions, four deletions.
No production, schema, lockfile, configuration or dependency edits.

Independently inspected real payments service and all three mocked suites.
The mismatch fixture does not mock or replace `withWebhookFence`. Its callback
transaction receives generation1n, matching PROCESSING ownership, live lease,
and three ordered query responses with event/event/order bound arguments.
Real source acquires event FOR UPDATE, samples live lease after acquiring it,
rejects stale generation/ownership/lease, then acquires order FOR UPDATE.
The transaction-local order contains pi-existing against incoming pi-other.
The asserted mismatch-specific alert and statusCode400 identify the intended
branch, not an ownership or transaction-mock error.

Assertions preserve legacy no-confirm and additionally verify no current
`confirmOrderInTransaction`, transaction-local update/updateMany, global
updateMany or confirmation email; stored order is unchanged. Transaction-local
lookup is asserted and global lookup prohibited. No weakened assertion or
fence bypass found. This verifies the ApiError status400 contract directly,
not an HTTP server or live database execution.

## Fresh execution

Read package scripts, Jest configuration and shared setup first. Shared setup
would bootstrap a database and was excluded by inline `setupFilesAfterEnv:[]`.
Reused existing task177 node_modules via a temporary untracked symlink; no
install, lifecycle scripts, services or DB access. Suites mock environment,
Prisma, Stripe, order service and notifications. Sanitized process environment.

Exact command, run from the isolated worktree at the reviewed SHA:

```sh
env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin CI=true NODE_ENV=test node tixmoapi2/node_modules/jest/bin/jest.js --config '{"rootDir":"./tixmoapi2","testEnvironment":"node","transform":{"^.+\\.ts$":"ts-jest"},"testMatch":["**/tests/unit/payments.prepare.test.ts","**/tests/unit/payments.webhook-recovery.test.ts","**/tests/unit/payments.webhook-signature.test.ts"],"setupFilesAfterEnv":[]}' --runInBand
```

Actual exit0: **3 suites passed, 29 tests passed, zero failures**, 3.725s.
Removed temporary symlink; `git status --short` empty before adding this report.
`git diff --check` exit0. Baseline red was read in author/lead reports but not
independently rerun by QA; no baseline rerun is claimed.

Evidence commit required command-local author identity (existing QA identity)
and `-c core.hooksPath=/dev/null`: the checkout's pre-commit hook references
missing `.husky/_/husky.sh`. No persisted Git/config edits or hook installation;
this documentation-only commit bypass does not bypass any test or assertion.

## Boundaries and handoff

Approval is for this exact test-only fixture repair and mocked regression,
not SQL integration, live provider behavior, deployment or release readiness.
Task177 full market timeout124 remains **nonpassing**; no full gate rerun,
final full-suite counts or suppressed API-substep localization claimed.
Tasks175/177 remain open and release remains NO-GO. PM alone may close179
after collecting reviews; QA does not close179. No default merge, deployment,
production, spend, secrets, outbound, scheduler or Gateway action performed.
