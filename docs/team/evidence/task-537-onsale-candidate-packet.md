# #537 / W06: refreshed LOCAL candidate packet

Prepared 2026-10-22 UTC (America/St_Johns project timezone). **Local preparation
only; full #243, staging qualification and launch remain NOT QUALIFIED.**
Independent lead and QA review of this exact documentation commit is required.

## Candidate and evidence boundaries

Product candidate: `a5da21936f4e0c730cab448610d9ecc75d2ef398`, parent
`8b0b5d62fb1b9307d0ba7b5557636943c89915be`; draft PR75 in #528.
Docs branch `tixmo/task-537-candidate-packet`, isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-537`, based exactly there.
This document changes no executable bytes. It succeeds, not edits, immutable
#243 packet at `f82b26c0e741c4ee8e051e4582fb08dbc1cbd324`, whose product base
`317754edc7b43eb8e27b60c5374679330326c575`, 31-migration count and W01-pending
status are historical. Do not infer deployed identity from either packet.

Current source lineage includes main-based sale-window backend/UI, financial
recovery, wallet/receipt, cancellation observation/UTC, checkout admission/busy
feedback and storefront parity ports, then sales pause `6afac91e`, populated
upgrade workflow `8b0b5d62`, and cancellation gate-order test fix `a5da2193`.
#231 records independent source reviews and incremental integration; #524/#526
source preparation approvals are not hosted runtime acceptance. Old #235/#236
and historical #213/#214 evidence are not fresh qualification of this head.
Moosey retains #231 integration, PR and recovery ownership; this worker has no
push, merge, deployment or CI authority.

### Actual hosted evidence, attributed to independent #528

Run `39712412966`, exact candidate above:
https://github.com/chapmandaniel/projectTixmo/actions/runs/39712412966

- Both dependency installs succeeded. Populated-upgrade stage succeeded
  02:48:10–02:48:24Z. Logs showed matching Prisma Client 5.22.0 generated
  02:48:12Z, API compiler build returned, then helper PASS at 02:48:24.899Z.
- [Upgrade helper](../../../scripts/verify-payment-upgrade.cjs) places its PASS
  marker after retained transfer/QR/tier/ambiguous-history/currency/receipt
  assertions, old webhook generation fencing, all remaining DDL, unchanged
  selected legacy event fields, `salesPaused: false`, zero fabricated pause
  audit rows and current checkout constraint assertions. This is actual hosted
  populated-upgrade evidence, not a claim of full SQL race coverage.
- Full-market began 02:48:24.929Z; FIRST API dependency audit failed with npm
  registry advisories/bulk HTTP 503 at 02:53:25.660Z; overall run FAILURE at
  02:53:28Z. Dashboard audit and downstream tooling/API-build/SQL/UI/guard/build
  stages in that full-market invocation were **UNEXECUTED**, not passed.
  The earlier separate API build PASS remains valid bounded evidence.
- Supplemental PR74 exact `c9c9e7f354a72c49f6885e4df31b8713d34065fe`, run
  `39712411270`: API audit zero vulnerabilities, then DASHBOARD audit network
  timeout; downstream unexecuted. Do not conflate that timeout with PR75 API503.
  Both runs stopped their containers successfully. No vulnerability or product
  assertion failure was established by these network failures.

#231 latest supplied official npm incident `xfp75s9j3bp8`: minor outage,
IDENTIFIED latest 03:07:55Z, not recovered at ~04:04UTC. No network request or
rerun here. Preserve recovery: after actual service recovery, #231 owner resumes
failed current-head jobs73/74/75 with intact gates, fixes genuine findings,
merges73 then retargets/merges74, and obtains actual75 green plus a concrete
proxy operational decision before migration-bearing default-branch merge.
No unchanged retry, audit bypass, approval or full-market PASS is implied.

## Actual source build/start and migration contract

[API Dockerfile](../../../tixmoapi2/Dockerfile): `tixmoapi2` context, digest-pinned
Node24.21.0 Alpine, locked `npm ci`; [package](../../../tixmoapi2/package.json)
build is `prisma generate && node scripts/build.cjs`, Prisma CLI/client5.22.0,
Node >=24.21.0 <25. Nonroot container CMD is
`npm run migrate && exec node dist/index.js`; migrate is `prisma migrate deploy`.
Thus deployment/restart may mutate schema. `npm start` alone is only
`node dist/index.js`, not equivalent to container CMD. Compatibility
[seed](../../../tixmoapi2/prisma/seed-minimal.js) is a no-op, not account creation.
Actual platform builder/context/start overrides and deployment-bound image/source
identity remain unverified. [Dashboard Dockerfile](../../../tdash/Dockerfile)
uses locked install, Vite build, digest-pinned Nginx and runtime-config entrypoint.
[App](../../../tixmoapi2/src/app.ts) distinguishes `/health` liveness from `/ready`
DB/Redis readiness (503 if unavailable); no target probe was performed.

**32 tracked migration.sql files**, not five total. Relative to historical
317754e, exactly one migration was added:
[20261021120000_event_sales_pause](../../../tixmoapi2/prisma/migrations/20261021120000_event_sales_pause/migration.sql).
It adds non-null `events.sales_paused DEFAULT false`, a durable
`event_sales_controls` audit table, event FK with DELETE RESTRICT, unique
(event_id,request_id), and event/time index. Existing event defaults and empty
audit history were actually verified by #528, not staging data inspection.

Full ordered inventory: `git ls-files 'tixmoapi2/prisma/migrations/*/migration.sql'`.
[Migration tree](../../../tixmoapi2/prisma/migrations) retains the five historical
release migrations: account revocation/invitations; payment/inventory integrity;
durable approval reminders; inventory reconciliation audit; webhook generation.
Preserve disabled/session-version/bootstrap recovery, transferred QR revocation,
legacy USD versus synthetic CAD, LEGACY_UNKNOWN receipts, ambiguous inventory
reconciliation, reminder leases and webhook generation obligations. Older
`20260309120000_rebuild_creative_approval_system` also remains: review every
actually pending migration, not only recent dates. Target pending count and
checksums are UNKNOWN until authorized target history comparison.

[Hosted workflow](../../../.github/workflows/market-readiness-local.yml) uses
Node24.21.0, job-scoped Postgres14/Redis7, then matching API build/populated
upgrade, then [full-market runner](../../../scripts/verify-market-local.mjs).
The runner audits API then dashboard before tooling/build/API verification,
lint/UI/design/build. Hosted14/7 evidence is not requested Postgres17/Redis8.2.10
parity, native #432 acceptance, restore proof or capacity qualification.

## Presence/mode-only target checklist: all UNVERIFIED

No environment, secrets or provider values were read. Record only presence,
mode, approved reference, exact SHA/deployment, owner/reviewer and timestamp.

- [API config](../../../tixmoapi2/src/config/environment.ts): NODE_ENV, PORT,
  API_VERSION, client/CORS origins, isolated DB/Redis identity, auth/session
  secret presence and rotation custodian; payment keys/webhook consistently
  test-mode, endpoint/account owner, explicit approved currency.
- [Dashboard runtime](../../../tdash/src/lib/runtimeConfig.js): actual API URL,
  publishable-key mode, approved privacy/terms/refund/organizer policy URLs.
- Mail: chosen Postmark or SMTP route, sender/provider owner, authorized inbox
  cohort and real delivery/bounce/resend proof. Storage: [S3 config](../../../tixmoapi2/src/config/s3.ts)
  presence/mode, synthetic namespace and retention/isolation scope.
- Monitoring: release/environment identity, Sentry presence/mode, named on-call,
  alert route and delivered alert/recovery evidence. Source defaults are not
  configured target presence or approved commercial decisions.

#225/#226 and #61 established existing Railway staging origins/control-plane
read access; do not repeat generic hosting/access questions. Dashboard
`https://tixmo-dashboard-candidate-staging-audit-20261005.up.railway.app`, API
`https://tixmo-api-candidate-staging-audit-20261005.up.railway.app` are historical
known origins, NOT current-candidate attestations. #230 lacked deployment-bound
source/archive/image evidence; require full deployment IDs, SHA/checksum,
builder/context/lock identity and immutable image digest. October7 SUCCESS and
snapshot IDs alone do not prove deployed a5da. Approved execution command/window,
capacity and mutation scope remain separate gates.

## Authority, blockers and next handoff

Actual **BB250-20261021-LOCAL-ONSALE** permits individual-event-only LOCAL work,
synthetic CAD fixtures, current refund reproductions/specs/simulator tests and
secure verified-ownership self-service design, fail-closed without ownership.
It does NOT choose actual charge/settlement/payout currency, prices, taxes,
fee inclusivity/bearer, payout/refund entitlement/window/authority, legal entity
or assisted-recovery staffing/identity bypass. Those facts and named commercial,
policy, recovery/support owners remain unresolved on #250/#61, not zero.
Retain policy73: no-org ADMIN-only global access, no global OWNER expansion,
scoped promoter confirm/own-order cancel, paid-after-expiry owned manual
reconciliation with NO automatic financial refund. Cancellation is not pause-sales.

BB61-20261020-STAGING-ONLY remains conditional non-mutating, zero-incremental-cost
staging evidence/native-CI approach after exact target/deployment mapping,
secure access references, approved commands/window and runner allocation.
It is not a blanket grant for this head. Authentication last-used and test-data,
scanner/review writes are not exempt. #231 integration authority is not delegated
here. Zero new spend or financial exposure; no production/provider/deploy/config,
restore/monitor/scheduler/publication actions authorized by this packet.

- W06/#243: independent lead+QA exact-document review, candidate qualification,
  deployment identity and scoped target execution inputs remain; do not close243.
- W07/#244: genuine test-mode browser/payment/webhook/inbox journey requires
  provider/inbox/test-data authority; mocks and populated migration are not it.
- W08/#245: parity, backup/isolated restore and schema-compatible rollback still
  require named recovery owner/second approver and separately approved scope.
  Follow [existing rollback runbook](../../DB_BACKUP_AND_MIGRATION_ROLLBACK.md):
  never overwrite live post-backup writes or assume old QR/account semantics safe;
  separate recovery DB and paid/refund/ticket reconciliation before reopening.
- W09/#246 capacity remains open; separate original-backend #499/source-port
  reviews do not prove current-candidate HTTP, runtime, concurrency or capacity.
- W10/#247 requires real scanner client/build, device/model/OS, actual operator
  and gate lead, connectivity/dataset/key-loading and mutation scope. No physical
  participation or acceptance is fabricated.
- W11/#248 needs deployed readiness failure/recovery, sales-pause and backlog
  evidence plus named on-call/support. #432 native containment/provenance and
  lifecycle acceptance remain blocked; available tool/socket is not permission.
- W12/#249 requires every mandatory gate, exact-candidate independent reviews
  and explicit production-action authority. #61 named scanner/policy/recovery/
  on-call participants and #250 commercial inputs remain existing gates.

## Actual checks and limits

Source/Git/board reads only; original immutable packet used as checklist, not
copied as current evidence. Static checks verify exact base/parent, 32 migration
files and sole added migration versus317754e, package/Docker/workflow/helper
contracts, relative link existence and whitespace. Two guessed source filenames
were absent; corrected to tracked names without execution. No compiler, tests,
helper/runtime/DB/Redis/HTTP/network, install/generation, env/secret/config access,
CI dispatch, push, merge, deploy, spend or unrelated memory work. Independent
review remains required; this packet is not launch or full W06 closure.
