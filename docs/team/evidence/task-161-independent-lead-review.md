# Task161 independent lead checkpoint review

2026-10-20, tixmo-lead. **SCOPED PASS**, static/log-only. Exact `8bd93fa4b76f6631c41d0618d5ee9eec50055252` versus `d5010c3b2804dbf1f34663311ed44de03f794e38`; detached isolated `/home/daniel/projects/projectTixmo/worktrees/review-161`. No lead runtime, DB operations, fresh test/build/migration, product changes, or activation. Task143 remains OPEN, recovery DISABLED, release NO-GO. Approval is only for this test/evidence checkpoint, not whole-handler/full139 acceptance.

## Actual independent review

Read role/repository/team instructions, task161/160/143 notes, task139 contract, exact two-file diff (54-line test and32-line report), admission/fence/failure implementation, author/QA reports and actual logs/helpers. Existing Jest/Prisma instrumentation is sufficient; no new dependency/custom service needed. `git diff --check d5010c3 HEAD` passed. Tracked product/schema diff is empty; source recovery constant remains false. Reviewed helper ownership/loopback/readiness/verification-target/bounded cleanup guards; author and QA160 runtime bodies equal after only own checkout/task-label normalization.

A pauses after reading generation7 before actual updateMany, outside any transaction; B genuinely admits generation8. Fixture-only update deliberately restores eligible FAILED/ancient PROCESSING state while retaining8. Control stale A must affect0 rows and return null. Full event equality plus target/other-buyer order/ordered tickets, inventory, ticket/event counts and notification negatives make this materially stronger than call-count assertions. Finally releases/drains and5s barriers/15s Jest deadlines are retained. Synthetic eligible-state ABA is explicitly labelled; it does not prove a public successor lifecycle.

Independently parsed BOTH author and QA160 focused/mutant JSON (eight observations): full business snapshots equal before B/after B/after A; control full successor equality; actual counts0 controls and1 mutants; generations7->8->8 versus7->8->9. Control stale predicate contains observed generation; mutant removes only that predicate, retaining id and both OR status/expiry branches. Mutant returns fabricated8 while durable generation reaches9, exposing the actual correctness failure. Actual mutant logs fail twice at line50 Expected0/Received1, not timeout. No findings blocking this scoped checkpoint.

## Execution evidence audited, NOT executed by lead

Absolute artifact roots:

- Author `/home/daniel/projects/projectTixmo/worktrees/task-143/`, prefix `.task143-admissionaba-`.
- QA `/home/daniel/projects/projectTixmo/worktrees/review-160/`, prefix `.task160-admissionaba-`; QA report `docs/team/evidence/task-160-independent-qa.md`.

Read `focused.log`, `mutant.log`, `regression.log`, `runtime-final.log`, `build.log`, `migrate.log`, `disabled-build.log`, `runtime.sh`, `outer.sh` in both roots, plus QA `oracle-check.log`/`cleanup-check.log`. Author control2/2 4.991s; mutant2 durable failures4.423s; restored15suites76/76 24.941s. QA control2/2 4.903s; mutant2 durable failures4.398s; restored15suites76/76 24.826s. Both migration logs explicitly report all migrations successfully applied; build/final disabled build logs show Prisma generation/TypeScript command completion without errors; exit0 attribution comes from guarded runtime exit/restoration and author/QA handoffs, not a new lead run. Both runtime logs show expected mutant rc1 and SOURCE_RESTORED status0.

Fresh static byte comparisons independently confirm both current author/QA source equals their disabled-source backups AND exact reviewed source. QA enabled-source differs only in recovery false->true activation. Cleanup logs record author1115822/1115836 ports23457/40186 and QA1120196/1120209 ports35506/50242 stopped; QA independent recorded PID absence/listener emptiness. Lead did not restart or access services.

## Genuine remaining gaps / next smallest slice

Do not relist already addressed millisecond cutoff controls, maxBigInt failclosed skip, reversed/equal-time private admission, failed-B/C, or finish-generation mutation as wholly absent. Their scope remains limited: sampled-clock seam is not submillisecond timing; maxBigInt skips before increment, not an executed SQL overflow exception; private synthetic ABA is not arbitrary public lifecycle proof.

Still required for139/143 full acceptance: dedicated missing-intent/failure handler TOCTOU durable oracles, relevant remaining expired-admission/handler-fence/generation-reuse mutation sensitivity, integrated public whole-handler recovery acceptance and consolidated exact-SHA independent gates before any activation. Existing historical checkpoint greens do not close these.

Smallest next slice: test/evidence-only missing-intent stale-success admission. Signed A genuinely claims then pauses immediately BEFORE withWebhookFence acquires its event lock (no waiting under event/order locks). Explicit fixture expiry; signed successor B takes over from null paymentIntentId, binds/fulfills and completes. Snapshot full successor event, target+other order/tickets and inventory; resume A and assert no stale binding/order effects, no duplicate inventory/email and unchanged snapshots. Add a fresh-fixture stale-failure variant using same pre-lock schedule to prove SUCCEEDED cannot be overwritten, if bounded cycle permits. This schedule verifies ownership revalidation, not a pause after a read already protected by a lock; distinct-event conditional-order race coverage remains a separate concern. Mutation must reach a durable oracle, never timeout. Reuse guarded disposable harness only after PM grants sole fresh runtime; exact-SHA lead+QA again. No implementation or activation proposed by this review.
