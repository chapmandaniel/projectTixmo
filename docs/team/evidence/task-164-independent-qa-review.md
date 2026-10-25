# Task164 independent QA review

2026-10-20, tixmo-qa. **Scoped checkpoint PASS** exact `693477c04b545e9565cc058082624b6d1a8aa2e6` versus `51454f00587c43de7c6e9bae546e63452353fd34`, isolated detached `/home/daniel/projects/projectTixmo/worktrees/review-164`. Task143 OPEN; recovery DISABLED; release NO-GO. Lead165 separate queued gate. No implementation edits or full139 acceptance.

Read task164/latest143 events, new106-line test and26-line author report, full runtime/outer helpers; role/repo/team instructions retained from QA163. Exact diff-check exit0; product/schema diff empty. Existing Jest/Prisma/Stripe infrastructure reused. Runtime full equality after owned path/label/cache-only substitutions asserted; all full141 UID/PID/executable/datadir/direct-child/loopback/listener/readiness/target/deadline/bounded-cleanup guards retained. PM explicitly assigned sole fresh runtime ownership; no inherited services/database used. Author node_modules linked. Temporary local activation was trap-restored byte-exact.

## Fresh execution

Artifact root this worktree; prefix `.task164-distinctfailure-`:

- `build.log`: enabled experimental local-source API build exit0.
- `migrate.log`: fresh owned disposable database27 migrations applied, exit0.
- `focused.log`:1/1 pass4.995s, exit0.
- `regression.log`:17 suites79/79 pass27.916s, exit0.
- `focused-final.log`:final exact focused1/1 pass, exit0.
- `runtime.log`:outer/runtime exit0, SOURCE_RESTORED status0.
- `disabled-build.log`:final disabled-source build exit0.

Backup/source cmp0 and exact HEAD/source cmp0; final product/schema diff exit0. Independently parsed all3 fresh distinct-case JSON records: full successor==afterStale snapshots, B distinct event PROCESSED/gen1, A separate event PROCESSED/gen1, legitimate A terminal counts[1], target PAID/SUCCEEDED, inventory6/2/2, four tickets/two events. Trace orders B completion before A terminal1. Test asserts other-buyer and full ordered-ticket equality, one expected Payment Failed email to buyer and one confirmation. These fixture counts are NOT exactly-once delivery proof, and failure email is not suppressed.

## Scope

Distinct genuine signatures/event IDs share one intent/order. A admits valid generation1 and pauses BEFORE real fence lock/transaction; B commits success independently at generation1. A resumes still owning its event and safely observes paid order; its own terminal affected count1 is legitimate. Full B/business snapshots stay unchanged. This is pre-lock conditional-order serialization, NOT same-event ownership-loss, after-protected-read TOCTOU, handler-fence mutation sensitivity or full139 acceptance. No reverse schedule or mutant attempted. Earlier same-event test's B-as-A trace caveat remains unchanged; new distinct-ID spy is correctly A-only.

## Cleanup

Owned PG PID1148890 port33247 and Redis PID1148903 port58888 stopped via complete guarded cleanup. Independent `/proc` checks both absent and `ss -H -ltnp` checks both ports empty. Source remains byte-identical to disabled HEAD; final disabled build succeeded. No production/provider/financial/default merge/deploy/spend/config/scheduler/secrets/external actions.
