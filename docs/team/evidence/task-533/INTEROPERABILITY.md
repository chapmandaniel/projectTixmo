# Task 533: final-candidate W09 interoperability (source only)

## Immutable scope and verdict

Candidate/base: `a5da21936f4e0c730cab448610d9ecc75d2ef398`.
Prepared last-ten source: `09dfb648a87eb4f006555f88a93147bf5c34d523`,
product lineage `5526991b45eb8cf93eeda23205f8341b5637ae90`.
Earlier map376: `024e15f107d20af08f9c037bc463b9dd6836ac2b`, targets
`80c6710b89d147588e1514aa99a4e55c5630d38a`.
HTTP100/401 transport successor: `971275ba7c87b7d6d3d8831d6334922dcf618a05`.

**Reusable source, not drop-in executable acceptance.** Candidate does not contain
499 qualification files or historical379/390 test/runtime files. Locate them at
these immutable source commits, not guessed candidate paths. Existing Express,
Jest/ts-jest, Supertest, Prisma and Redis are adequate; no new framework needed.
No product/test changes made here.

## Exact source matrix

Line references are at candidate unless explicitly prefixed with a source hash.

| Seam / exact path | Reuse and candidate-specific limits |
| --- | --- |
| `09dfb648:tixmoapi2/tests/qualification/orders-http-last-ten.local.ts:9-23,72-150` | Reuse 100 preallocated buyers, barrier, actual client start-to-settlement maxInFlight, ten positive-price untiered units, 10x201/90x400 exact sold-out message, unique orders/tickets, 0/10/0 then owned cancellation 10/0/0, foreign-fixture snapshots. These are PENDING holds, not paid fulfillment. No broad rewrite needed. |
| `09dfb648:tixmoapi2/tests/qualification/task499/ownership.cjs:14-58,63-97` and qualification `:41-67,151-169` | Reuse permanent uncertainty latch, raw work/close tracking, preallocated inventory, pre-captured original middleware, detached zRem/eval/sendCommand interception. Preserve these repairs; do not repeat capture probes as new compatibility evidence. Source approval does not prove actual Jest/CJS/Redis overload assignability or runtime settlement. |
| `tixmoapi2/src/app.ts:144`; `src/api/orders/routes.ts:12,61` | Current app optional-auth then read/write limiters; checkout authentication then validation then waitingRoom. `971275ba:src/app.ts:73` globally admitted requests, including public reads. Thus HTTP100 read+write pair no longer means two admission leases. Importantly app/routes/auth/limiter are already byte-identical between5526991b and candidate: this is map376/HTTP100 drift, NOT a new499 admission regression. |
| `tixmoapi2/src/middleware/waitingRoom.ts:8-16,37-52,64-102`; `src/config/environment.ts:43-50` | Same Redis lease algorithm, detached release and renewal; unavailable Redis remains fail-open. New configurable admission default5000 is explicitly not a capacity budget. Last-ten exact 10/90 requires separately pinned capacity >=100 and healthy realRedis; otherwise503 is possible and must not be mislabeled sold-out. Public reads bypass checkout admission. |
| `tixmoapi2/src/middleware/rateLimiter.ts:19-25,49-58,92-98`; `src/config/environment.ts:127-136`; `src/middleware/auth.ts:30-52,56-80` | Same-IP synthetic JWT buyers remain reusable: authenticated limiter key is user ID, not IP; test write budget1000 versus production default240. Tokens resolve actual account sessions; fixtures must retain valid account/sessionVersion. Same-IP header does not establish browser session/auth-login load or production budget acceptance. |
| `tixmoapi2/src/api/orders/service.ts:78-102,125-127,153-163,430-466` | Current event lock, eligibility/salesPaused guard and exact sold-out400 remain compatible with future published/not-paused fixture.552 conditional updateMany inventory check is now update under existing event lock: do not claim identical reservation source/parity. Cancellation observation+locked revalidation and confirm/refund paths changed; last-ten PENDING cancellation expectations remain relevant but require fresh SQL/HTTP evidence, not inherited financial approval. |
| `tixmoapi2/prisma/schema.prisma:67,199-200,917`; `prisma/migrations/20261021120000_event_sales_pause/migration.sql` | Schema is byte-identical552->candidate, but differs from80c map lineage; salesPaused defaultfalse/EventSalesControl must exist in matching generated client and migrated DB.513 found stale available generated dependencies; matching lock alone was insufficient. No new generation or compiler diagnostics here. Candidate lockfile also differs552; resolve candidate dependencies only under future authority. |
| `tixmoapi2/jest.config.js:5,17`; `tests/setup.ts:7-9,23-45`; `09dfb648:tests/qualification/orders-http-last-ten.local.ts:1-16` | `.local.ts` deliberately uncollected by standard testMatch. In-body guard precedes product imports but NOT setupFilesAfterEnv: default setup bootstraps schema before test body and installs Redis/store mocks. Therefore renaming to `.test.ts`/forcing default Jest collection is unsafe and not an execution plan. Required task499 pre-collection admission symbol has no implementation supplied by this source. |
| `971275ba:docs/team/evidence/task-379/runtime.sh:145-163`; `docs/team/evidence/task-379/network-guard.cjs` at971275ba | Reusable historical owned-target and loopback guard ingredients, including401 native TCP null-path fix. Old runner explicitly migrates DB and hardcodes original HTTP100 path at163; it is neither499 admission nor a generic approved runner. Do not execute unchanged or copy it wholesale. |
| `971275ba:tixmoapi2/tests/integration/orders-http-pressure.local.test.ts:66-78,83-123,127-158` | Reuse route-pair fixtures/scheduler/latency/locks/resource observations only as source ingredients after owned-lifetime adaptation.100 buyers scheduled at30/sec over~3.3s; pump cap30 and historical observed maxActive2 are not100 simultaneous requests, last-ten contention, or60s burst. Stock100 means no sell-out loser proof. |
| `.github/workflows/market-readiness-local.yml:74-96` | Existing candidate CI installs dependencies, builds, exercises populated migration upgrade, then verify:market with disposable job services. It does not collect absent499 `.local.ts`. Integration231 owner retains all qualification/retry/PR work. Latest231 reports upgrade partialPASS followed npm audit outage; downstream SQL/UI qualification absent. No current green full-market claim. |

Paths abbreviated `src/`, `tests/`, `prisma/` inside cells retain the
`tixmoapi2/` prefix. Historical path prefixes likewise refer to that API root
except explicit `docs/` paths.

## Smallest concrete future port sequence (not executed/authorized here)

1. Keep499 author lane and231 integration lane separate. On an explicitly
   selected candidate successor, port ONLY the two499 qualification files above
   with exact09dfb648 provenance; retain original files and all assertions.
   Do not cherry-pick the old product lineage into candidate.
2. Resolve pre-collection admission before any collection: adapt existing
   owned-process/verification-safety infrastructure to bind exact source,
   sole disposable `tixmo_disposable_*` DB and Redis DB1..15, owned listener,
   provider/network denial and fail-closed uncertain teardown BEFORE setup.
   Candidate `scripts/verification-safety.cjs` is existing infrastructure;
   no new general runner or duplicated CI lane is justified. If this cannot
   be established safely, stop with that precise blocker, not a renamed test.
3. Under separate dependency authority, use matching candidate lock/schema
   generated dependencies and existing ts-jest/Jest tooling for focused actual
   diagnostics including qualification source/CJS/Redis spy overloads. Ordinary
   production compilation does not establish excluded qualification test types.
   Pin and disclose test admission capacity >=100 rather than relying on default.
   Independently review exact successor before any separately granted execution.
4. Only after sole-owner disposable-runtime authorization run the focused
   last-ten HTTP test, preserving raw middleware/Redis/close lifetimes and fixture
   retention on uncertainty. Record actual statuses, in-flight client metrics,
   stock/foreign invariants and cleanup; failures do not grant broader runtime.
   Separately port HTTP100 paired-read semantics if required, not as prerequisite
   busywork for499, and do not replace its lifecycle with unsafe old joins.

This is a concrete existing-source port, not a claim that an executable approved
command currently exists. Pre-collection safety and checked dependency bindings
remain the immediate blockers, not missing frameworks.

## Acceptance boundary and checks

HTTP actors are synthetic accounts with server-minted bearer tokens. They are NOT
browser sessions: no browser rendering, cookies/login UX, navigation, checkout
payment, receipt/scanner fulfillment, or real provider behavior is established.
100 simultaneous client promises also does not prove100 concurrent DB operations.
Original246 remains open for250/500 sessions,200-session30-minute soak,
30-arrivals/sec60-second burst, production latency/error/lock/recovery behavior,
paid fulfillment and corresponding browser-session scope. Historical284/287
service results and390 HTTP results are not current candidate acceptance.

Read board376/499/513/531/532 and latest231 notes. Exact531 receipt
`58dcbe6e8f7af9b00a8cbcc0f19977f55b244f69` and532
`75008af84138d4ae3a20b96af73156997bcd368c` approve ONLY source/inert capture
repair; not current runtime/type/mock/capacity acceptance.

Actual checks: read-only git rev-parse/show/ls-tree/diff, numbered source reads
and rg searches; final git diff --check. Candidate-absent historical paths
initially returned missing, then located through git show --stat/ls-tree and
read at exact971275ba; no files invented. No app evaluation, tests/probes/Jest,
compiler, services, DB/Redis/HTTP, network, installation, generation, env/secrets,
config changes, provider calls, spend, push, merge or deployment. Commit hooks
bypassed command-locally for docs-only scope; no Git config writes. Independent
QA must review exact report commit before scoped533 closure. No499/246 closure,
full-market acceptance, runtime grant or duplicate231 integration activity.
