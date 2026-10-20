# Task 184: retry fixture contract repair

Base: `4e3664d719c301159b40a58a2fc684c4d84ab905`.
Branch: `tixmo/task-184-retry-fixtures`; isolated worktree `task-184`.

Only retry fixture and this evidence changed. No product/fence bypass.
Converted DB/app/user/order setup to explicit mock order and callback transaction;
this file now checks handler/retry/fence interaction, NOT database integration.
Each real fence attempt reads PROCESSING generation 1n, live lease, then order
lock in order. Current confirmOrderInTransaction receives exact tx/order ID.
No schema/services/dependencies installed or started; existing task177 modules
were temporarily linked and removed. Read package scripts and tests/setup first;
shared setup bootstraps DB and was deliberately excluded from mock-only commands.

## Fresh checks

Initial direct original fixture attempt with inline config exited 1 before tests:
missing alias module mapping (0 tests), environment warnings. This is NOT baseline
acceptance. No DB setup executed. Then introduced only mock fixture scaffold,
keeping original missing-claim calls and legacy confirmation spies/assertions:
retry-only command below exited 1, **2 failed / 2 total**, both fail at missing
claim.eventId; exhaustion expected DB Timeout received undefined eventId instead
(4.692s). This is a scaffolded mock baseline, not a fresh original DB run.

```sh
timeout 40s env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin CI=true NODE_ENV=test node tixmoapi2/node_modules/jest/bin/jest.js --config '{"rootDir":"./tixmoapi2","testEnvironment":"node","transform":{"^.+\\.ts$":"ts-jest"},"testMatch":["**/tests/integration/payments_retry.test.ts"],"setupFilesAfterEnv":[]}' --runInBand
```

After repair, same command with testMatch expanded to the following four files:

- `**/tests/integration/payments_retry.test.ts`
- `**/tests/unit/payments.prepare.test.ts`
- `**/tests/unit/payments.webhook-recovery.test.ts`
- `**/tests/unit/payments.webhook-signature.test.ts`

Exit **0: 4 passed suites, 31 passed / 31 total tests, 0 failures**, 4.724s.
`git diff --check` exit0.

## Assertion parity and current diagnostic contract

Retained exhaustion rejection `DB Timeout`, six confirmation attempts, five
warnings, admin alert; eventual-success three attempts, two warnings and no
false admin alert. Assertions now observe transactional confirmation, not legacy
confirmOrder; legacy confirmation explicitly remains uncalled. Added exact
ordered lock parameter/query checks for every attempt and no transaction-local
mutation for an already-associated intent. Successful completion emails exact
order ID; exhaustion sends no confirmation email.

Two obsolete assertions replaced explicitly, not silently dropped:

- Old alert substring `failed to confirm after payment succeeded` is no longer
  emitted. Current source `tixmoapi2/src/api/payments/service.ts:266` emits
  `Order <id> failed after payment succeeded. Manual intervention required.
  Error: Error: DB Timeout`; test requires this exact contextual substring and
  one alert, retaining final failure diagnostics.
- Old `Critical: Failed to confirm order` error log is no longer emitted by the
  handler. Source lines259-270 sends the above alert and rethrows original
  failure; test requires original rejection plus alert failure detail, no email,
  and no unrelated error log. Product logging was not changed to satisfy fixture.

No DB/schema/API/full-market gate, real SQL locks/rollback/concurrency, Stripe,
email or deployment behavior verified. Retained full gate177 remains nonpassing;
no green inference. Independent exact-SHA lead and QA required before PM closure;
this author submits REVIEW only. No manifests/locks/schema/config changes.


## Task187 independent QA - APPROVE (scoped)

Reviewer: tixmo-qa. Exact target `559b7b74849a082807460d4024a9f7e125766838`,
compared with `4e3664d719c301159b40a58a2fc684c4d84ab905`. New isolated branch
`tixmo/review-187`, worktree `/home/daniel/projects/projectTixmo/worktrees/review-187`.
Independent lead189 evidence `b891f1a55a7cf75c7052591685ca66f0661f0045` was read,
but runs below were independently performed. Verdict applies only to fixture
repair, not DB/API readiness. Task184 remains for PM closure; no merge/deploy.

### Independent source and assertion audit

Entire target diff: exactly this report and
`tixmoapi2/tests/integration/payments_retry.test.ts`. No product, manifests,
lockfiles, schema or config changes. `git diff --exit-code 559b7b7 -- tixmoapi2`
and `git diff --check` exit0 after checks, before evidence commit.
Shared main had untracked AGENTS.md/docs/team content; untouched.

Unchanged service.ts208-223 executes the real withWebhookFence: event FOR UPDATE,
then live lease sample, status PROCESSING/matching bigint generation eligibility,
then order FOR UPDATE before work. Fixture claim supplies eventId/generation1n,
returns PROCESSING/matching generation/live true, and verifies exact event/event/order
bound IDs and ordered query shapes for every attempt. No fence stub or bypass.
These are mock observations, not proof of actual SQL locks; positive-owner tests
alone do not prove negative ownership rejection. Separate recovery suite remains.
Current confirmation spy is confirmOrderInTransaction with exact tx/order ID;
legacy confirmOrder explicitly uncalled. Real retry implementation executes.
Exhaustion retains DB Timeout rejection, six confirmations/five warnings, one
contextual admin alert/no email. Eventual success retains three attempts/two
warnings/no false alert and checks email order ID/no error log.

Source service.ts262-265 justifies exact current alert text and replacing obsolete
Critical error-log expectation: this path rethrows original failure and logs only
alert-transport failure. No such transport failure is simulated; expecting no error
log is faithful. Author's line266 alert citation is offset (correct262-265), not a
behavioral defect. Diagnostic detail, exhaustion and no-false-alert semantics
remain, rather than simply deleting obsolete assertions.

### Independently reproduced scaffold red and candidate green

Existing task177 node_modules temporarily symlinked, then unlinked; no install.
Read package scripts/setup first; setup bootstraps DB, so inline Jest configuration
explicitly uses setupFilesAfterEnv=[]; sanitized env has only PATH, CI=true,
NODE_ENV=test. No DB/service/runtime grant used. Commands run from review root:

```sh
timeout 40s env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin CI=true NODE_ENV=test node tixmoapi2/node_modules/jest/bin/jest.js --config '{"rootDir":"./tixmoapi2","testEnvironment":"node","transform":{"^.+\\.ts$":"ts-jest"},"testMatch":["**/tests/integration/task-187-baseline.test.ts"],"setupFilesAfterEnv":[]}' --runInBand
```

Temporary sibling baseline (candidate unchanged): candidate imports/mock setup and
beforeEach through afterAll (everything before `function expectFenceAttempts`),
then original base file from its first `it('should retry` through EOF, obtained by
`git show 4e3664d:tixmoapi2/tests/integration/payments_retry.test.ts`. This retains
original missing-claim calls, legacy spies and original semantic assertions while
substituting mock-only scaffold. Temporary file removed after run.

First scaffold attempt accidentally retained unused expectFenceAttempts, causing
TS6133 before 0 tests; this is NOT accepted red evidence. Removed that unused
helper from temporary scaffold only, then independently obtained **exit1, one
suite failed, 2 failed/2 total, 4.655s**, both missing claim.eventId. Exhaustion
expected DB Timeout but received missing-eventId error. Raw accepted output:
`docs/team/evidence/task-187-baseline.log`. Baseline reproduction requirement is
satisfied for scaffolded mock baseline, NOT for original DB integration baseline.
Author's initial alias-mapping 0-test failure likewise is not accepted red.

Candidate green: same command/config, replacing testMatch with exactly
payments_retry integration, payments.prepare unit, payments.webhook-recovery unit,
and payments.webhook-signature unit paths listed above. **Exit0, 4 suites passed,
31 passed/31 total, 5.044s**. Raw `docs/team/evidence/task-187-green.log`.

### Explicit coverage limitations

Original fixture used DB/app registration, event creation, HTTP order creation and
cleanup; candidate replaces all with mock order/transaction. This is a real loss
of database/app setup integration coverage even though old confirmation was also
spied. File location under integration does not make the new tests integration
proof. No SQL/locking/rollback/concurrency, real notification/email, API build,
full-market or production evidence. Reuse of existing dependencies is not clean
install reproducibility.175/177 remain open/nonpassing; no release acceptance.
QA evidence adds only documentation/raw logs, leaving candidate source identical.
