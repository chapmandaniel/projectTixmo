# Task112: atomic confirmation transition

Author: tixmo-backend. Base: `f5a61567b8f2d489d82bb70f78df98e26724d8af`.
Branch: `tixmo/task-112-confirm-guard`; isolated checkout `worktrees/task-112`.

## Scope and existing solution

Uses existing Prisma transaction and conditional `updateMany`, with no new
library, schema, lockfile, refund, webhook, or other lifecycle change.
The first transactional statement claims PENDING -> PAID/SUCCEEDED with the
original actor scope. Losing callers reject with statusCode 400 before inventory
writes. Inventory failure rolls back the transition in the same transaction.
A final `findUniqueOrThrow` preserves the existing included response fields.
The original preflight actor/status checks remain intact.

## Actual verification (2026-10-20)

Dependencies: symlink to existing task70 API node_modules; no dependency install
or lockfile update. Read and reused approved task57 owned-runtime pattern from
`/tmp/task68-runtime.sh`. Each invocation initializes a fresh local cluster,
chooses fresh ports, asserts exact owned PID/executable/listener identity before
access, validates verification safety, and traps bounded exact-instance cleanup.
No inherited DATABASE_URL was used. Redis is supplied locally but mocked by Jest.

1. `bash /tmp/task68-runtime.sh > /tmp/task112-red.log 2>&1`
   before source edit: exit 1; 1 suite, **2 failed**. Both normal/reversed-read
   cases observed `[6,0,4]`, two fulfilled confirms. Expected `[6,2,2]`.
2. Same command after source edit, log `/tmp/task112-green.log`: exit 0;
   **2 tests passed**, both `[6,2,2]`, one fulfilled and one rejected caller,
   target PAID/SUCCEEDED, other order PENDING unchanged, tickets unchanged.
3. `/tmp/task112-contracts.sh` is the same inspected runtime with only the Jest
   paths expanded. `bash /tmp/task112-contracts.sh > /tmp/task112-contracts.log 2>&1`:
   exit 0; **5 suites, 93 tests passed** in 10.07s. Exact inner command:

   ```sh
   npm --prefix tixmoapi2 test -- --runInBand --runTestsByPath \
     tests/integration/order-double-confirm.race.test.ts \
     tests/orders-tenant.unit.test.ts tests/orders-recovery.unit.test.ts \
     tests/unit/payments.prepare.test.ts tests/unit/payments.webhook-recovery.test.ts
   ```

   New unit regression executes the transaction callback with a zero-row scoped
   claim and asserts 400, original organization predicate, and no inventory or
   response read. Existing assertions were preserved.
4. `npm --prefix tixmoapi2 run build > /tmp/task112-build.log 2>&1`: exit 0.
5. `git diff --check`: exit 0.

Helper SHA256:
- task68-runtime.sh: `df72c69e96ec07e3ec8cfacbd42bb23fc94ae0355d875cb066549268eba0c782`
- task112-contracts.sh: `1cf57ec9ec9401c5e882659f966142b013a4b3ce569c16486616ee6de2574fe6`

## Cleanup and limits

All three runtime shells exited after `server stopped`, without cleanup failure.
Owned Postgres ports 34888 (red), 29167 (green), 30953 (contracts) have no remaining
listeners. Postmaster PID files absent in the three fresh runtime directories;
Redis logs confirm shutdown and process inspection found no matching services.
Disposable data/log directories retained under /tmp for review; no live services.

This is bounded confirmation-only evidence, not full parent68 lifecycle or launch
acceptance. Other lifecycle races and stale webhook behavior remain outside this
slice. No full market gate or exhaustive concurrent schedules were run. Required
independent lead AND QA review must target the exact submitted commit before PM
closure. No merge, deployment, live payment, or production access occurred.
