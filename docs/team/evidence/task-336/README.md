# Task336 independent SQL QA: paid-sales UTC bounds

**PASS for scoped task333 acceptance**, exact `b0bc7e833345d847efa84d2a4957e289a1494bfc`, base `4ec8594850eb547dafc145a14bb1b85cdeaa235c`. Independent QA `tixmo-qa`,2026-10-21. Fresh baseline sensitivity and final green, not author artifact reuse. Submit review, not done; PM closure also depends on separate source335 review.

## Source, identity and isolation

- QA branch `tixmo/task-336-independent-qa`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-336`, created directly from exact implementation.
- Complete implementation diff inspected: only paid-sales-query.ts10 additions/2 removals,155-line new SQL test and task333 evidence. Original smoke unchanged versus baseline and exact implementation. No product changes beyond UTC parameter normalization; no session/global TZ changes, filter/window widening, schema/lock changes or other unmerged repairs composed.
- Query retains bare indexed o.created_at and >=/<=, normalizes bound instants through timestamptz AT TIME ZONE UTC, preserves PAID/lowercase currency/event/organization predicates, SOLD ticket aggregation and LEFT JOIN. No index EXPLAIN/performance claim.
- Private dependencies copied using `cp -a /home/daniel/projects/projectTixmo/worktrees/task-333/tixmoapi2/node_modules tixmoapi2/node_modules`; no hardlinks/install/generate/shared writes. Generated client QA inode1446357/nlink1 versus source1225023/nlink1. Fresh red/green provenance hashes match implementation schema/lock/engine.

## Safety and ownership

Explicit PM soleDB336 grant after334 cleanup atded97d5. Independently checked PG2922559/Redis2922572 absent,35689/41418 no listeners, no service sockets/pidfile or task334 Node workers. A broad context glob initially matched a stopped transformed Jest contextsetup cache, not an active context file; this local audit false positive was classified before proceeding, no service ran during the check. Raw prior observations retained in prior334-cleanup.json.

Inspected task333 runner/guard and existing owned PG18/Redis helper, shared target-validation/bootstrap already reviewed in this QA lane. Reused runner with task336 IDs, artifact/runtime paths and disposable role/database names. Environment scrubbed before tool/application imports; synthetic keys only; CHECKPOINT_DISABLE=1 and pre-application Node nonloopback denial. Exact owned user/executable/PID/datadir and exclusive127.0.0.1 listeners verified before database access. Workspace runtime root/run0700, `/dev/nvme0n1p2 ext4`, not /tmp. RedisDB1 and fresh disposable PostgreSQL only. Default DB TimeZone **America/St_Johns** in both runs; no globalTZ override. Node guard is not OS isolation; provider/upload mocks remain inert and unchanged.

## Retained exact independent sensitivity recipe

From QA worktree root:

```bash
python3 docs/team/evidence/task-336/baseline-sensitivity.py
python3 docs/team/evidence/task-336/audit-cleanup.py docs/team/evidence/task-336/red-baseline
```

Standalone committed Python recipe substitutes **only** exact baseline paid-sales-query.ts, runs `bash docs/team/evidence/task-336/red-baseline/runtime.sh` redirecting output to red-baseline/runtime.log, restores exact fixed bytes in finally, and captures hashes of both new test and original smoke before/after. Baseline exit1; restoration/test identity assertions pass (red-baseline/source-identity.json). No fixture/result substitution or fabricated baseline.

Fresh baseline2026-10-21T08:53:23.787Z: **2 suites failed;3 semantic failures/2 passes;0 skipped/todo**. UTC cases pass; StJohns boundary/DST ID cases fail, original smoke totalOrders>=1 fails0. No compile/timeout/harness error. Runtime independently cleaned before green.

After source-preservation diff exit0, final exact implementation executed once:

```bash
bash docs/team/evidence/task-336/runtime.sh > docs/team/evidence/task-336/runtime.log 2>&1
python3 docs/team/evidence/task-336/audit-cleanup.py docs/team/evidence/task-336
```

Exit **0**. Fresh green2026-10-21T08:54:29.751Z: **2 suites passed,5 tests passed,0 failed/pending/todo**. Four actual SQL cases plus original smoke. Full explicit Jest command is committed in runtime.sh (ordinary config/setup, runInBand, selected paid-sales-utc and unchanged v1-market-smoke,180s timeout). Raw logs/results and summary retained. Zero blocked-network logs in both runs. Original smoke assertion and subsequent asset/approval path unchanged, no provider/storage test representation substituted.

## Meaningful SQL qualification

New tests use actual paidSalesSource and actual UUID-scoped Prisma rows in transaction-local set_config(TimeZone,...,true), separately verifying UTC and America/St_Johns. Exact inclusive start/end, exact-point windows, +/-1ms exclusions, start-only/end-only and PAID/currency/foreign-tenant filters retain exact returned-ID assertions. No global/pool timezone alteration or widened time window. Newfoundland2026-11-01 first01:30 at04:00Z and repeated01:30 at05:00Z are asserted as equal local labels but distinct UTC instants; exact windows select one each and combined window both.

QA green runner additionally executes retained `null-bounds-check.cjs` via scrubbed existing environment and ts-node after successful Jest, while owned services remain available. **10 supplemental actual-SQL checks passed (5 per timezone), not added to Jest5 count**: omitted bounds, explicit null/null, null-start/end-only, start-only/null-end and same-tenant different-event exclusion. It calls actual fragment against actual new UUID fixture rows, with local transaction timezones. Exact command in runner:

```bash
TS_NODE_PROJECT=tixmoapi2/tsconfig.json node -r ./tixmoapi2/node_modules/ts-node/register "$artifact_dir/null-bounds-check.cjs" > "$artifact_dir/null-bounds-check.log" 2>&1
```

This supplemental probe is QA evidence only; no product/author test or original smoke change. Author and baseline runners have the same two-suite Jest command; only green adds this separately reported probe.

## Cleanup and preservation

Independent audit script records both runtimes' exact PIDs absent, ports listener-free, no PG/Redis sockets/postmaster files, no task336 Node/Jest workers or runtime-root context files. Baseline PG2934247/Redis2934260 ports28879/52242; green PG2935625/Redis2935638 ports31008/53575. Modes0700, disk-backed ext4. Private stopped data/log/cache files retained for diagnostics, no live services. DB336 released only after final audit. Native parent progress relay failed once with unavailable hook; final report and board carry durable handoff, no retry escalation.

`git diff --exit-code b0bc7e8 -- tixmoapi2 docs/team/evidence/task-333` exit0: implementation source/test and author evidence preserved after baseline restoration and green. source-identity.json retains final hashes. Source/test and whole implementation range `git diff --check 4ec85948 b0bc7e8` both exit0 (diff-checks.json). Final QA evidence check recorded at handoff. Tracked QA worktree clean after evidence commit. Evidence commit uses scoped identity/hooks bypass for missing isolated Husky helper.

## Limits

Focused SQL+original smoke, not full API/market readiness or live provider proof. No broader rawSQL sweep, other analytics customer/date query qualification, performance/index plan guarantee, staging/production/deployment/spend/merge. Local smoke exercises mocked provider/upload paths only. Separate source335 acceptance remains required; scoped pass does not imply launch acceptance.
