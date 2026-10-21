# Task344 independent QA - bounded observation repair

Reviewed exact `bc3384cf316c9efa86fc9510d6a905cd032fd52a`, baseline product `65b75bc1ea35f63df9c3171ae2faaf2414385fd6`. Independent branch `tixmo/task-344-independent-qa`, isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-344`. No product/test modifications retained.

## Fresh independent execution

Before starting, corroborated all six task325 continuation PIDs absent (2987873,2987888,2989478,2989491,2988740,2988753) and ports25477,59707,30934,44235,24539,58207 empty. Sole disposable-local DB grant was explicit. Inspected harness, guard, verification-safety and Jest setup before execution. Reused existing local harness rather than introducing a new test framework.

Copied writable node_modules with `cp --reflink=auto -a` from task325 to this independent worktree. Generated client index has different inode (1860406 vs1722766), no shared symlink/client writes. PG18/Redis executables reused read-only. Runtime under `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task344`, fresh0700 runs, env-i, synthetic fixtures, inert Stripe Jest provider, preimport NODE_OPTIONS nonloopback deny guard. Redis is provisioned/verified loopback, but application Redis is mocked by existing setup. Existing test setup applies schema only to explicit disposable loopback database.

Baseline: temporarily restored only orders/service.ts and payments/service.ts from65b75bc, retaining unmodified exact final test file. Ran:

`bash docs/team/evidence/task-344/runtime.sh --testNamePattern='denied|matching inert|pending inert|stale scoped' > docs/team/evidence/task-344/runtime-red.log 2>&1`

Exit1; one failed suite,4PASS1FAIL,2 intentionally filtered (stableFAILED/direct-preflight final-only additions). Scoped ADMIN real Prisma snapshot SUCCEEDED then committed FAILED produced actual REFUNDED/refundSUCCEEDED, not expected400. This is semantic assertion sensitivity, not infrastructure/hook/timeout failure. Retained jest-red.json/log. This reproduction uses baseline product and final regression, not an untouched baseline full suite.

Restored both product files exactly frombc3384cf, then:

`bash docs/team/evidence/task-344/runtime.sh > docs/team/evidence/task-344/runtime-green.log 2>&1`

Exit0;1suite7PASS0FAIL0SKIP. `git diff --exit-code -- tixmoapi2/src tixmoapi2/tests` and `git diff --check` exit0. No source/assertion weakening, historical tests unchanged.

## Inspection and bounded outcome

APPROVE bounded repair. OrderService captures actual scoped or noactor findFirst observation, passes it through; direct PaymentService uses actual findUnique preflight if absent. Locked equality compares both status and paymentStatus before ledger/provider effects. Captured values are not a new SUCCEEDED-only policy. StableFAILED with matching inert succeeded provider proof passes and finalizes; scoped/direct stale tests assert unchanged target order/tickets/type, zero ledger and zero provider calls. Noactor observation path inspected, not a separate noactor stale/status matrix test.

Pending ledger explicitly asserts target order/intent, amount2000,currencycad,reasonORDER_REFUND,statusPROCESSING,providerID re_pending325,errornull; ticket/stock unchanged. Existing provider amount/currency/intent matching and durable SUCCEEDED ledger check before finalizeRefund are unchanged. Successful SOLD->RELEASED once and sequential retry remain green. This is not proof of concurrent provider-idempotency or complete refund API correctness.

## Cleanup and limits

Both harness cleanup traps stopped owned services. cleanup.json independently checks actual PID absence, listener absence, socket/pidfile absence, mode0700 and no remaining node/postgres/redis workers associated with this worktree/runtime. Red PIDs2998793/2998806 ports20230/52275; green2999197/2999210 ports39636/51888. Zero blocked-network records. DB RELEASED. Audit directories retained, unrelated services untouched.

Original325 remains OPEN/REVIEW. No contention/inverse-schedule, foreignbuyer, insufficientSOLD rollback, slow-provider terminal monotonicity, noactor/status matrix, processor tuple-change fencing, HTTP route-entry snapshot, manual/fairness, fullAPI/build/browser/live provider inference. No cloud, real provider, real secrets, spend, config, scheduler, push, merge or deploy.
