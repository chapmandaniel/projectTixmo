# Independent QA task342: partial baseline accepted, not task325 acceptance

Reviewed exact author commit **65b75bc1ea35f63df9c3171ae2faaf2414385fd6** on tixmo/task-325-refund-races, base f8bac3e1f53e64533b65bf6a1c3c7f0aebe2cb3d. Independent worktree task-342 / branch tixmo/task-342-independent-qa. Reviewer tixmo-qa; no product/test edits.

## Fresh execution

Read repository/team/role instructions and claimed task342. Sole disposable DB grant from PM. Independently read author cleanup.json: PIDs2976960/2976973 absent and TCP35766/46524 no listeners before execution. Inspected author harness and preimport guard before adapting only task/evidence identity and safe local artifact/runtime paths. Existing harness/dependencies used; no custom replacement, downloads, or shared client generation. Separate writable node_modules copied using `cp --reflink=auto -a` from task-325, not symlinked. Local PG18/Redis binaries read from existing task-57 runtime.

Executed `bash docs/team/evidence/task-342/runtime.sh > docs/team/evidence/task-342/runtime.log 2>&1`, exit0. Runtime re-execs under env-i; new mode0700 disk path beneath tixmo-pm/runtime/task342. Explicit owned loopback listener/PID/executable checks precede schema bootstrap and queries. Synthetic local DB tixmo_disposable_342, Redis DB1, inert synthetic Stripe keys. NODE_OPTIONS preloads deny-nonloopback JS guard before app/Jest/Prisma bootstrap imports. Guard blocked records0. Stripe mocked before imports; no live provider, email, cloud or external network calls. Guard is JavaScript-level protection, not an OS namespace firewall. Redis service is real but application Redis is mocked by existing tests/setup.ts; no Redis behavior proof claimed.

Exact Jest command in runtime.sh: `timeout --signal=TERM --kill-after=5s 100s node tixmoapi2/node_modules/jest/bin/jest.js --config tixmoapi2/jest.config.js --runInBand --runTestsByPath tixmoapi2/tests/integration/order-refund-current-path.test.ts --json --outputFile=docs/team/evidence/task-342/jest-result.json` (artifact flag absolute at runtime). Fresh result **1/1 suite, 4/4 tests passed; 0 failed/skipped; 6.087s**. Lockfile/schema/engine hashes in provenance.sha256. Only this suite executed.

## Independent source/assertion findings

Diff from base adds only four tests and author evidence; product files and historical order-double-refund.race.test.ts unchanged. OrderService actorless refund delegates to PaymentService; only actor-scoped path uses findFirst, so historical no-actor observation barriers are not current contention proofs. PaymentService locks and rereads order, checks tickets/window, binds provider intent amount/currency, uses persistent ledger identity in `refund-${record.id}`, validates provider refund amount/currency/intent, and does not regress terminal ledger success. Finalization requires matching SUCCEEDED ORDER_REFUND amount/currency before inventory transaction.

Positive test checks REFUNDED, two CANCELLED/RELEASED tickets, exact [available,held,sold]=[10,0,0], ledger SUCCEEDED/2000/ORDER_REFUND, provider create amount and ledger-derived key, single create and unchanged inventory on sequential retry. This is not concurrent idempotency evidence. USED/TRANSFERRED controls assert full order+ordered-ticket and ticket-type equality, zero refund ledger, and no intent retrieval/create. Pending test asserts PAID/PROCESSING and complete unchanged ticket/inventory snapshots; it does NOT independently assert pending ledger contents or whole-order equality. Positive test does not explicitly assert every provider/ledger identity field; matching defenses were independently inspected in source. These are bounded fixture proofs, not exhaustive payment acceptance.

## Cleanup and remaining gates

Cleanup trap exit0, followed by independent cleanup.json: owned PG2979879 / Redis2979892 absent; loopback TCP37397/43308 absent; no owned Unix sockets, PG/Redis pidfiles or runtime workers. Runtime retained on disk. No shared services touched.

**Task325 remains OPEN.** Preserve stale-request red/green sensitivity (not blanket SUCCEEDED eligibility), real overlapping contention and concurrent provider idempotency, foreign-buyer snapshots, inverse schedules, insufficient-sold rollback, slow-provider monotonicity, manual/fairness regression coverage. Historical stale tests were neither weakened nor run. No full gate, regression-suite green, product repair, full325 acceptance, integration, push, merge, deploy or launch claim.
