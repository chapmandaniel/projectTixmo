# Task311 — ambiguous synthetic provider effect / actual process crash

Author scoped PASS; independent QA and technical review required. Full #241/W04, remote provider and operational-owner acceptance remain NO-GO.

Product baseline unchanged `4ec8594850eb547dafc145a14bb1b85cdeaa235c`.
Tested harness `2e6c52e62861e915b7b2b512645ee74dd6d9a8a8`.
Branch `tixmo/task-311-ambiguous-crash`; checkout `/home/daniel/projects/projectTixmo/worktrees/task-311`.
Only this harness/evidence directory changed; no product bug discovered or product edits.

## Reproduction and fresh checks

```
ln -s /home/daniel/projects/projectTixmo/worktrees/task-235/tixmoapi2/node_modules tixmoapi2/node_modules
bash docs/team/evidence/task-311-ambiguous-crash/runtime.sh > docs/team/evidence/task-311-ambiguous-crash/runtime.log 2>&1
unlink tixmoapi2/node_modules
```

Fresh runtime exit0 captured by execution tool; PG18/31 migrations. An earlier successful first run was repeated solely because its execution-session status had not been retained. Committed logs/ledger/cleanup describe the last run. Temporary dependencies removed. Runtime copied from reviewed308 c8424ca6, with task identity/path and durable-ledger environment added; prior postcommit proof not relabelled.

Static `bash -n runtime.sh`, `node --check check.cjs`, `sha256sum --check source-sha256.txt`, product src/Prisma diff against baseline, and final diff-check all exit0. TypeScript uses existing ts-node transpileOnly, not a fresh build/typecheck. Runtime scrubs inherited env before imports, uses only explicit synthetic keys, own restrictive disk-backed task311 directory, guarded owned loopback PG18/Redis listeners, verification-safety guard before application imports. Sole DB owner after QA309 cleanup.

## Precise observed crash boundary

Real PaymentService.recoverRefunds/reconcileRefund and OrderService.finalizeRefund execute against real Prisma/PG; none mocked. Only Stripe module transport is synthetic, logger no-op, notification boundary throws. Synthetic transport records create arguments, metadata refundId/orderId, idempotency key, and matching succeeded amount/currency/payment_intent response in a file outside child memory. File and directory are fsynced before IPC barrier. The create promise then never resolves. Parent reads actual SQL while child remains blocked: entire healthy refund/order/ticket/inventory snapshot equals before, REQUESTED/null stripeRefundId, PAID/SOLD. Ledger has one succeeded effect. Parent SIGKILLs that exact owned child and reaps exit with SIGKILL.

A distinct second OS process reconnects to SAME running database and SAME disk ledger, lists by payment_intent and discovers matching refundId metadata; zero create calls. Real finalizer commits SUCCEEDED/re_311, REFUNDED, ticket RELEASED and stock [available,held,sold]=[1,0,0]. Third distinct worker replay makes zero transport calls and leaves all healthy/order/ticket/inventory SQL unchanged. One durable synthetic effect remains. Logs contain in-gap SQL, call traces, exact child PIDs, final SQL and ledger; provider-ledger.json independently copied after shutdown.

Separate >23h-old uncertain row sees no prior matching refund and fails closed with no create. Unknown-ledger row's list rejects immediately and likewise creates nothing, persists REQUESTED/null ID and owner=tixmo-backend cooldown message. A fourth process tests an explicit SQL-aged unknown cooldown retry: intent/list only, again no create, durable fresh owned exception, no changes to healthy SQL or ledger. This is SQL timestamp aging, NOT native elapsed60s. Manual LATE_PAYMENT row remains Prisma-deep-equal under #73; no automatic late-paid refund permission.

## Limitations and cleanup

Synthetic module transport / local fsync is not a real provider, HTTP/SDK outage-duration test, external exactly-once guarantee, provider retention guarantee, remote listing completeness test, concurrency stress or host/power-loss test. No actual timeout tested. No notifications/receipts/fulfillment delivered; stock/bookkeeping assertions do not prove financial/fulfillment exactly-once. Exceptions have persisted owner text, not operational human acceptance. Aged fixture is strictly >23h, not exact boundary. No new retry authorization inferred.

All four exact owned worker PIDs plus PG/Redis PIDs absent independently; both TCP listeners and PG/Redis sockets/pidfiles absent, runtime mode0700; cleanup.txt records details. No HTTP server was started. DB released. Runtime artifacts remain in task311's owned disk directory, not tmpfs. Source hashes identify harness and relevant product sources. No provider/email/environment secrets, external network target, spending, production actions, config changes, push, merge or deployment.
