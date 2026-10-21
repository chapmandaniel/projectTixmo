# Task 357 independent BACKEND source/contract review

Reviewer: tixmo-backend, not task356 author tixmo-lead. Decision: PASS for the bounded tests-only repair; not QA role signoff, full API readiness, or merge approval. Task357 remains REVIEW for PM aggregation; task356 is not closed.

Exact reviewed test-code target: `ccdab1394863c0457cdc78f2563ffe56e049af21`.
Implementation base: `cdb41d4d3aa4ccc323a2a1cc6b04a490feafe6a6`.
Reviewed evidence-only successor and fresh-run checkout: `199cb9afa6ce1785bc956951e6e6590faec32119`.
Isolated worktree `/home/daniel/projects/projectTixmo/worktrees/review357`, branch `tixmo/review357`.

## Review

Complete base-to-target diff is one test file, 2 insertions/1 deletion. Two parameterized ADMIN cases (organization org-a and null/global platform admin) now expect refundOrder('a', orders[0]) and exact second-argument reference identity with toBe(orders[0]). No invented paymentStatus or fixture changes. orders.service.ts:552-557 performs actor scope, scoped findFirst, missing-order rejection, then delegates the observed object intact. payments/service.ts:481-499 compares status/paymentStatus observation equality under lock; this mock tests delegation, not payment eligibility. Existing PENDING fixture without paymentStatus is intentional at this mocked seam.

Same-org and global administration remain unchanged. Global here means ADMIN with isPlatformAdmin true and no organization, not a literal STAFF role. actorOrderScope permits refund only OWNER/ADMIN; MANAGER/CUSTOMER/PROMOTER and any other role remain forbidden. tenantScope reloads actor and limits global bypass to that explicit ADMIN predicate. All original cross-org, customer/promoter, HTTP actor forwarding, no-transaction, and no-email assertions remain byte-for-byte unchanged. Processor is mocked before imports; processor-error propagation and no-local-transaction assertions remain. Existing suite does not explicitly assert the mocked payment method was never called in every denial case; do not inflate coverage into an exhaustive provider-call audit.

Successor changes only five evidence files; diff for tixmoapi2 between target and successor is empty. Author baseline JSON inspected: 28PASS/2FAIL/30; repaired JSON 30PASS/0FAIL/30. Baseline failures concern extra observation argument. Historical baseline is author evidence, not a fresh independent baseline rerun.

## Fresh verification

Inspected package scripts, default Jest config, tests/setup.ts, complete unit file, imports/mocks, order service and tenantScope. Default setup bootstraps DB and is deliberately excluded. Attached jest.json adapts author config only to this isolated worktree, with empty setup arrays, single test match, cache false and existing ts-jest. Attached deny-network.cjs is author's inspected preimport guard. Existing offline task354 node_modules linked temporarily, no install/generation/dependency mutation, then unlinked.

Command (from worktree):

```sh
ln -s /home/daniel/projects/projectTixmo/worktrees/task-354/tixmoapi2/node_modules tixmoapi2/node_modules
env -i PATH="$PATH" HOME=/tmp NODE_ENV=test node --require /home/daniel/projects/projectTixmo/worktrees/review357/docs/team/evidence/task-357/deny-network.cjs tixmoapi2/node_modules/jest/bin/jest.js --config docs/team/evidence/task-357/jest.json --runInBand --json --outputFile docs/team/evidence/task-357/fresh.json
unlink tixmoapi2/node_modules
```

Exit0; 1 suite PASS, 30 tests PASS, 0 FAIL, 0 snapshots, 4.043 seconds. Raw fresh JSON attached. git diff --check exit0. No assertions changed by reviewer.

## Limits

No DB/runtime grant used; QA359 retains soleDB. No .env/secrets, install, generation, provider/cloud/spend, product changes, persistent config mutation, push, merge, deploy, Gateway or scheduler actions. The in-process guard blocks net connect/listen, TLS, datagram and global fetch; it is not an OS firewall, subprocess sandbox, or caught-attempt counter. No measured zero-attempt audit is claimed. Full API gate and real payment eligibility/races were not rerun; task325 legacy failures remain outside scope. Independent QA and PM aggregation remain pending.

Evidence commit uses command-scoped reviewer identity and core.hooksPath=/dev/null to avoid unknown hooks; no hook-pass claim or Git configuration edit.
