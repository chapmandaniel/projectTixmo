# Task 179: fenced webhook mismatch fixture

Base: `2890aea6af8f7fc6c693980b6e7a14046f22e45e`.
Branch: `tixmo/task-179-webhook-fixture`.

Test-only repair in `tixmoapi2/tests/unit/payments.prepare.test.ts`: callback
transaction mock, valid event/generation claim, matching PROCESSING generation,
live lease, ordered event/lease/order lock query responses and transaction-local
mismatched stored intent. The production fence is not mocked or bypassed.
Retained HTTP 400 and legacy no-confirm assertion; added current transactional
confirmation, mutation, unchanged stored order and confirmation-email assertions,
and mismatch-specific alert evidence. No product/schema/dependency/config changes.

Read package scripts and Jest setup before running; reused task-177 dependencies
through a temporary untracked symlink, without installation or lifecycle execution.
The inline config disables shared DB setup; environment, Prisma, Stripe, order
service and notifications are mocked by the suites. No DB/services started.

Baseline command (before repair):

```sh
env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin CI=true NODE_ENV=test node tixmoapi2/node_modules/jest/bin/jest.js --config '{"rootDir":"./tixmoapi2","testEnvironment":"node","transform":{"^.+\\.ts$":"ts-jest"},"testMatch":["**/tests/unit/payments.prepare.test.ts"],"setupFilesAfterEnv":[]}' --runInBand
```

Exit 1: 1 failed suite; 1 failed, 19 passed, 20 total tests. Mismatch expected
statusCode 400 but received `$transaction is not a function` TypeError (4.242s).

Repaired focused command:

```sh
env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin CI=true NODE_ENV=test node tixmoapi2/node_modules/jest/bin/jest.js --config '{"rootDir":"./tixmoapi2","testEnvironment":"node","transform":{"^.+\\.ts$":"ts-jest"},"testMatch":["**/tests/unit/payments.prepare.test.ts","**/tests/unit/payments.webhook-recovery.test.ts","**/tests/unit/payments.webhook-signature.test.ts"],"setupFilesAfterEnv":[]}' --runInBand
```

Exit 0: 3 passed suites, 29 passed tests, 0 failures (3.724s).
`git diff --check`: exit 0. No full gate executed or claimed. Retained task177
market timeout exit124 remains non-passing, with suppressed API substeps not
localized and no final full-suite counts inferred. Independent lead and QA review
of the final exact commit remain required; unmerged and undeployed.
