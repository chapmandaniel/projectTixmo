# Task 182: isolated schema/API timing diagnosis

Owner: tixmo-release. Branch: `tixmo/task-182-timing`.
Candidate/base: `7574eea362ea827c1da85a0bf60002352a355dd1`.
Scope is timing diagnosis only, **not full-market acceptance**. Task177 remains
nonpassing;175/177 remain REVIEW and release remains NO-GO.

## Execution and safety

PM granted sole disposable runtime ownership for this cycle. Independently
checked process state before start: no competing daniel-owned PostgreSQL,
Redis, Jest or verifier; unrelated UID70/999 services left untouched.
Read role/repo/team instructions,57/141 guard and173/177 runtime exemplars.
Existing177 helper reused, with only task labels/paths and timed commands
adapted; guard and exact owned cleanup unchanged. Shell syntax passed.
Fresh runtime `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task182.WvwDaY`
is UID1000, mode0700, disk-backed ext2/ext3. PG1289227 port26315;
Redis1289240 port55877. UID/executable/datadir/PID-file and Redis unreaped
direct-child PPID validation, exact unique loopback listeners, SQL identity
and disposable target guard all passed before schema operations. No inherited
DATABASE_URL used; recovery flag explicitly1, synthetic local keys only.

No installs: temporary node_modules symlink reuses task177 API npm-ci tree,
with byte-identical API lockfile. No lifecycle hooks executed; no shared Git
configuration changed by182. Prior177 Husky side effect is not repaired here.
This is dependency reuse, not a new clean npm-ci parity result. Node24 and
native PG18/Redis8 differ from CI Node20/PG14/Redis7. Product source,
assertions, manifests, schema, locks and configuration remain immutable.

## Measurements

Commands and raw stdout/stderr, exit files and `/usr/bin/time` outputs are
retained in `task-182-artifacts`. Schema uses the same Prisma db-push options
as verify:api (explicit binary, explicit schema; no npx resolution overhead).
API command is the complete verifier command, not a focused subset:
`npm --prefix tixmoapi2 test -- --runInBand`, ceiling240s plus5s kill grace.
Schema separate ceiling30s. No product verifier suppression was changed.
Jest setup itself invokes guarded schema bootstrap per test file, so API
wall-time includes those repeated pushes and is not pure test execution time.

- Separate schema bootstrap: **exit0, wall0.83s**, fresh empty disposable DB.
- Complete API suite: **exit1, wall148.20s**; Jest reports147.399s.
- Final counts: **79 suites:3 failed/76 passed;493 tests:7 failed/486 passed**;
  snapshots0. This is a completed failing suite, not timeout124.
- `payments.prepare.test.ts` is PASS in this complete run.
- Wrapper exits1 because the API suite fails; source identity check PASS.
- Exact owned cleanup PASS; independent `/proc` absence for1289227/1289240
  and no listeners26315/55877. No competing daniel-owned DB/Jest remains.
  Raw runtime data/logs retained under the runtime directory, not deleted.

### Exact failures (raw API log is authoritative)

1. `payment-paused-owner.baseline.test.ts`: `paused owner phase=fresh` and
   `phase=before-handler` fail with `Barrier timeout (harness failure)` at
   line11. `phase=before-finish` fails line74 `expect(afterB).toEqual(beforeB)`:
   expected PROCESSING/generation1, observed PROCESSED/generation2.
   Source explicitly calls that equality a baseline observation, not candidate
   acceptance. No product-vs-fixture conclusion is established for the two
   barrier timeouts without a dedicated diagnosis.
2. `payment-old-processing.baseline.test.ts`: `PROCESSING duplicate (crashed
   ancient owner=false)` and `...=true` both throw `Do not know how to serialize
   a BigInt` at line43 JSON.stringify of durable diagnostic data. These errors
   are directly at fixture logging, before following assertions; they do not
   establish the remaining assertions passed or product behavior is correct.
3. `payments_retry.test.ts`: `Order Confirmation Retry Logic > should retry
   order confirmation on failure and alert admin after exhaustion` expects
   `DB Timeout`, receives missing `claim.eventId` TypeError. `... > should stop
   retrying if it succeeds eventually` has the same TypeError. Stack points to
   service.ts212 via direct handlePaymentSuccess calls at fixture76/114.
   Dedicated fixture/contract review is needed; no repair performed.

### Future budget recommendation, not a guarantee

For this native environment, reserve **240s for a complete API phase**, versus
observed148.20s, and separately allow30s bootstrap. Recommend a future full
market command deadline of **300s**, with **at least60s additional runtime
setup/owned-cleanup/evidence reserve** (total grant at least360s, dependencies
prepared first). This is a bounded starting budget based on one observed full
API run; dashboard/build totals were not timed here, so300s is not a proven
full-market completion bound. If the total grant cannot accommodate that
reserve, do not dispatch the full gate. Future fixes or slower CI versions
require reassessment. A larger deadline cannot repair these seven failures.


## Boundaries and next gate

No market gate, dashboard rerun, API build, deployment, default-branch merge,
production/provider interaction, scheduler/config changes or spend. Separate
full-market verification remains required on the independently accepted exact
candidate, with a fresh sole-owner grant and cleanup reserve. Historical177
150s timeout cannot be interpreted as a pass or as a complete suite budget.
