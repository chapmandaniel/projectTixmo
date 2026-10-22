# Independent QA534: candidate interoperability map

## Verdict: APPROVE scoped SOURCE/DOCUMENTATION only

Reviewed report `cde214229938cae06fc5acc324a12efa64f2e520`, candidate/base
`a5da21936f4e0c730cab448610d9ecc75d2ef398`, prepared499 source
`09dfb648a87eb4f006555f88a93147bf5c34d523`, product lineage
`5526991b45eb8cf93eeda23205f8341b5637ae90`, historical HTTP source
`971275ba7c87b7d6d3d8831d6334922dcf618a05`.
Independent reviewer tixmo-qa; new worktree task-534-source-qa, branch
`tixmo/task-534-source-qa`, based on exact report. No blocking material
source/documentation finding in the bounded review.

## Actual independent checks

Read role/repository/team instructions, exact534 body and actual531/532 reports
at `58dcbe6e8f7af9b00a8cbcc0f19977f55b244f69` and
`75008af84138d4ae3a20b96af73156997bcd368c`. Those receipts approve only
source/inert capture repair, explicitly not compiler/Jest/runtime acceptance.
No capture probes were repeated.

Read-only `git rev-parse`, `show`, `ls-tree`, `diff`, `git grep`, numbered
source reads and `rg` independently establish:

- App, orders routes, auth, rateLimiter and Prisma schema have no diff from552
  to candidate. Older80c6710b map lineage DOES differ in app/routes/schema.
  Candidate app:144 and orders routes:12,61 give optional auth/limiters then
  authenticated checkout validation/admission, versus971 app:73 global waiting
  room. Public read/write pairs are not two current admission leases.
- Candidate orders service:87,112 locks event and ticket type; :126-127 retains
  exact sold-out error before :156 update.552 conditional updateMany/count check
  changed; cancellation/confirmation changed too. No parity/runtime conclusion.
- WaitingRoom:8-16,37-52,64-102 retains Redis leases, detached releases/renewals,
  503 saturation and unavailable-Redis fail-open. Config:43-50 default5000 is
  not a proved budget; :127-136 test1000/production240 write limits and limiter
  :19-25 user key agree with map. Auth:42,72 resolves actual account sessions.
- Exact09df qualification:72-150 contains100 buyers/barrier, measured client
  maxInFlight100, ten201/ninety exact400, unique PENDING/HELD orders/tickets,
  0/10/0 then cancellation10/0/0 and foreign snapshots. :46-51 originals are
  captured before spies; helper:14-58,63-97 preserves uncertainty/raw-work
  tracking and original invocation. These are source assertions, not results.
- Candidate schema:199-200,917 has salesPaused/EventSalesControl and matching
  migration path exists. Candidate API lock differs552: handlebars4.7.9 ->
  4.7.10/minimist range change. No dependencies/generated-client validation.
- Candidate ls-tree returns no499 qualification or historical379/HTTP100 test
  paths. Jest config:5 excludes `.local.ts`; :17 loads setup, whose :7-9 invokes
  schema bootstrap and :23-45 installs mocks BEFORE test body.09df :12-14
  admission check is inside that body. Git grep over09df API/scripts finds only
  the admission-symbol read, not an implementation. Renaming is not safe admission.
- Historical971 runtime:161 migrates and :163 hardcodes old HTTP100 test;
  network guard:30-31 explicitly permits native TCP null path while rejecting
  Unix paths/unowned targets. Historical test:72 stock100, :83 cap30 and
  :104-109 schedules100 at30/sec; not last-ten/100-concurrent/60-second proof.
- Candidate CI:74-96 installs/builds/upgrades then verify:market; absent499 is
  not collected. Read latest231 notes: migration-upgrade partial evidence only,
  downstream SQL/UI unexecuted after npm outage, existing integration owner kept.

`git diff --check a5da2193 cde21422` exited0; staged report whitespace check
also required before commit. Git/source inspection only: no application, Jest,
compiler, evaluation/probes, services, DB/Redis/HTTP, network, install/generation,
env/secrets, provider, config, spend, push/merge/deploy actions. Shared main
untracked files preserved. Documentation commit bypasses hooks command-locally;
no persistent Git config edit.

## Disposition and limitations

APPROVE means this exact533 map accurately frames source reuse and blockers;
not executable acceptance, actual type/mock compatibility, runtime/capacity,
paid fulfillment, browser sessions or full CI. Compiler diagnostics NOT PRODUCED.
Matching generated dependencies and precollection admission remain unresolved.
No current historical measurement was reproduced. Full499/246 remain INCOMPLETE.
Only review534 closes; parent533 disposition belongs to PM. Integration231 and
native432 remain untouched. No runtime grant or launch/default-merge approval.
