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
