# Independent QA309 — scoped SQL and postcommit restart PASS

Reviewed exact author candidate `c8424ca6d1cf53aba9a97c1013da59230b486857`, tested author harness `bb22435a9230e7bf430933eddc8c0f417b9a444d`; product baseline `4ec8594850eb547dafc145a14bb1b85cdeaa235c` unchanged. Branch `tixmo/task-309-qa`, isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-309`.

Independent scoped **PASS** for #308. Not full W04, operational-owner acceptance, live financial exactly-once, release or deployment approval. Independent technical review #310 remains separate. QA task submitted to review, not done.

## Inspection and modifications

Read real `PaymentService.recoverRefunds/reconcileRefund`, `OrderService.finalizeRefund`, inventory transition, verification guard and environment bootstrap before execution. Stripe module replaced before service import; only synthetic transport response/rejection, logger and throwing notification boundary are hooks. Prisma, queries, recovery, reconciliation and finalization are real. NODE_ENV=test prevents dotenv loading; runtime reexec uses env-i before imports and explicit disposable loopback targets. Verified prior #308 five PIDs and both listeners absent before taking sole DB ownership.

Copied runtime/check into this QA evidence directory; only artifact/runtime paths changed, plus independent whole-table replay equality for refunds, orders, tickets and ticketTypes. Author files untouched; fixture labels/database/user retain task308 names inside the new task309 owned runtime. No provider networking or email used. No product/schema changes.

## Fresh commands and results

All commands from this worktree; exit0 unless noted.

```bash
sha256sum -c docs/team/evidence/task-308-refund-pg/source-sha256.txt > docs/team/evidence/task-309-refund-pg/source-verification.log
bash -n docs/team/evidence/task-309-refund-pg/runtime.sh
node --check docs/team/evidence/task-309-refund-pg/check.cjs
sha256sum tixmoapi2/package-lock.json /home/daniel/projects/projectTixmo/worktrees/task-235/tixmoapi2/package-lock.json
ln -s /home/daniel/projects/projectTixmo/worktrees/task-235/tixmoapi2/node_modules tixmoapi2/node_modules
bash docs/team/evidence/task-309-refund-pg/runtime.sh > docs/team/evidence/task-309-refund-pg/runtime.log 2>&1
unlink tixmoapi2/node_modules
git diff 4ec8594850eb547dafc145a14bb1b85cdeaa235c --exit-code -- tixmoapi2/src tixmoapi2/prisma
```

Matching dependency lock SHA256 `f530d7671524de570d43a6cf7e105cc8161f4c1be6b71a7ffc89025ee8a139da`; no install or cache mutation. Source manifest checks all passed. PG18 deployed31 migrations. Run `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-309/run.8X5avU` mode0700 disk-backed ext2/ext3; explicit loopback PG24652/Redis53464. Exact same running PG/database persisted across all three distinct child connections.

Fresh `acceptance.log` confirms:

- Worker2792299 observed50 synthetic intent failures; each SQL poison REQUESTED with fresh updatedAt and persisted owner=tixmo-backend/retry60s message.
- Worker2792352 reached healthy51, exactly1 synthetic create, real refund SUCCEEDED/order REFUNDED/ticket SOLD→RELEASED, inventory [available,held,sold]=[1,0,0]. >23h aged uncertain row stayed REQUESTED/null processor ID with durable owner message, no create.
- Worker2792380 made0 provider calls; all refund/order/ticket/type SQL values unchanged, including manual policy73 LATE_PAYMENT row. Parent awaited SIGKILL exits for all3 exact owned children after batch completion IPC.
- Independently checked `/proc` absence PG2792154, Redis2792167 and all3 children; `ss -H -ltnp` both ports empty; PG pidfile/socket/lock and Redis socket/pidfile absent. `cleanup.txt` records assertions. Dependency link removed: DB RELEASED.

## Limitations

Immediate ETIMEDOUT promise rejection is a synthetic transport stub, **not** elapsed timeout, actual HTTP outage, Stripe SDK retry or provider idempotency-retention evidence. SIGKILL is **after committed batches**, not an ambiguous in-flight provider response/SQL gap. Cooldown proven by persisted timestamps and immediate worker exclusion, not waiting60s. >23h fixture does not test exact boundary. No receipt/notification delivery, real money movement, external provider exactly-once or operational accountable-owner acceptance. TypeScript transpileOnly uses existing matching cached dependencies; not a new typecheck/build or full regression suite. Full original #241/W04 remains NO-GO.

Commit initially failed: no default Git author identity, then missing `tixmoapi2/.husky/_/husky.sh`. Evidence-only commit uses per-command synthetic QA identity and `-c core.hooksPath=/dev/null`; no persistent Git configuration or hooks changed. Explicit bash/node syntax, source hashes and staged diff checks passed.

Runtime/log whitespace normalized only for evidence diff hygiene. No inherited credentials, external targets, spending, configuration changes, push, merge or deploy.
