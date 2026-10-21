# #243 / W06 — LOCAL PREPARATION checkpoint

Prepared 2026-10-21; timezone America/St_Johns. **Not staging qualification,
not full W06 completion, not deployment or launch approval.** Independent lead
and QA must review this packet and the exact product candidate before acceptance.

## Candidate, provenance and existing evidence

- Product base: `317754edc7b43eb8e27b60c5374679330326c575`, #235,
  parents `0d193a6e8f8180d509f5cfdbb793203904047237` and
  `f699a5340b467fffbe92fccf9eb494dbd5b47e93`. Combined candidate is awaiting
  independent acceptance. This documentation commit does not change product bytes.
- Branch `tixmo/task-243-onsale-packet`; isolated worktree
  `/home/daniel/projects/projectTixmo/worktrees/task-243`. Own this file only.
- [#235 source integration evidence](task-235-release-integration.md) reports
  author-only 125 mock API, 202 dashboard, 45 root and 6 tooling/development
  checks, builds/design/lint. No new execution here; no real-DB race, populated
  upgrade or full-market acceptance for this merge is established.
- #236 `152064e17ff1c58b6b15ac938106b017991c04b6` is **separate**, not in this
  base: config-output regression and historical evidence/handoff imports need
  their own independent review and parent #231 integration. Historical #213/214
  green applies to `0d193a6`, not this merged candidate. Moosey owns #231; this
  packet neither publishes nor merges its work.
- #225 / independently reviewed #226 established existing Railway read-only
  control-plane access and staging `staging-audit-20261005`. Known dashboard:
  `https://tixmo-dashboard-candidate-staging-audit-20261005.up.railway.app`;
  API: `https://tixmo-api-candidate-staging-audit-20261005.up.railway.app`.
  Do not repeat generic hosting/access questions. No fresh platform calls here.
- #227 diagnosed missing Dockerfile, absent `/ready` and unsafe seed in the old
  `0d193a6` source. #230 recovered historical Docker source at `dc45798` /
  `f699a53`. Current merge now contains Dockerfile and `/ready`, with seed a
  compatibility no-op; this is source reconciliation, **not deployed repair**.
- #230 could not link successful staging API deployment `c8436e3e` and dashboard
  `068df481` (ID prefixes) to exact source/image. Obtain a deployment-bound
  manifest for each: full deployment ID, source SHA or archive checksum,
  builder/context/lock identity and immutable image digest. Snapshot UUID,
  source Dockerfile hash and October 7 SUCCESS alone do not attest deployed SHA.

## Source build/start contract (not built in this task)

[API Dockerfile](../../../tixmoapi2/Dockerfile) uses context `tixmoapi2`, pinned
Node `24.21.0-alpine` digest, OpenSSL, lock-preserving `npm ci`,
`prisma generate && node scripts/build.cjs`; separate production dependencies
retain Prisma 5.22 CLI/client, dist, schema/migrations and guarded operator
scripts. Nonroot startup runs `npm run migrate && exec node dist/index.js`:
**a restart/deploy can mutate schema**, even though
[seed](../../../tixmoapi2/prisma/seed-minimal.js) is now a no-op.
[API package](../../../tixmoapi2/package.json) requires Node >=24.21.0 <25.
[Dashboard Dockerfile](../../../tdash/Dockerfile) uses locked npm install,
Vite build, digest-pinned Nginx and a runtime-config entrypoint. Confirm real
builder/context/start override and PORT; source EXPOSE is not platform proof.

[App](../../../tixmoapi2/src/app.ts) now has `/health` liveness and `/ready`
DB/Redis readiness returning 503 when unavailable. Do not replace readiness
with liveness just to green a deployment. Actual staging probe remains untested.

## Actual migration inventory and upgrade risks

There are **31 tracked migration.sql files**, not five total. The plan's five
recent release migrations are below; only four are added relative to `0d193a6`
because webhook generation already exists there. **Pending target count is
unknown** until authorized migration-history/checksum comparison. Never assume
these five are the only pending migrations.

| Migration | Source-backed upgrade obligation |
| --- | --- |
| `20261004234000_account_revocation_and_invitations` | Disabled/session-version/platform identity and invitations; legacy bootstrap identity disabled; named owner/rotation and access recovery plan required |
| `20261005003000_payment_and_inventory_integrity` | Order currency default `usd` vs runtime default `cad`; historical receipt UNKNOWN; attempts/inventory backfill; transferred barcodes reissued and cached QR cleared; ambiguous tier stock blocked for reconciliation |
| `20261005052000_durable_approval_reminders` | Delivery statuses/leases/retry fields; historical sent timestamps retained; review uncertain-delivery handling |
| `20261005134000_ticket_inventory_reconciliation_audit` | Durable operator reconciliation audit; retain evidence and named operator |
| `20261020120000_add_webhook_attempt_generation` | BIGINT generation default 0; qualify old rows, fenced ownership and race cases |

Full ordered inventory, reproducible without DB access:
`git ls-files 'tixmoapi2/prisma/migrations/*/migration.sql'`.
[Migration tree](../../../tixmoapi2/prisma/migrations) also includes destructive
`20260309120000_rebuild_creative_approval_system`; assess every actually pending
SQL file, not just recent dates. Compare schema/row counts, legacy currency and
receipt disposition, tier conservation, transferred credential revocation,
account/session rotation, and reminders before/after a populated upgrade.

## Presence/mode checklist — no values

Every runtime item below is **UNVERIFIED on target**. A source variable or
fallback is not evidence of configured presence. Later authorized owner records
only present/absent, test/live or enabled/disabled, approved reference, reviewer,
SHA/environment/deployment/time; never credentials, connection strings or raw logs.

| Area / source | Required presence/mode check and outstanding decision |
| --- | --- |
| [API config](../../../tixmoapi2/src/config/environment.ts) | NODE_ENV, PORT, API_VERSION, CLIENT_URL, CORS_ORIGIN match approved staging API/dashboard and route prefix; DATABASE_URL and Redis target isolation; JWT_SECRET/JWT_REFRESH_SECRET/SESSION_SECRET present, rotation custodian named |
| Payments / same source | STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET present and consistently test-mode; webhook endpoint/account ownership verified; PAYMENT_CURRENCY explicitly approved (default cad is not a decision); legacy USD reconciliation required |
| [Dashboard runtime](../../../tdash/src/lib/runtimeConfig.js) and [entrypoint](../../../tdash/docker-entrypoint.d/40-runtime-config.sh) | apiUrl/VITE_API_URL and publishable-key mode agree with API; privacyPolicyUrl/termsUrl/refundPolicyUrl and organizerTermsUrl approved. Missing checkout policy links cannot be replaced by draft URLs or publication inferred |
| Mail / API config | POSTMARK_SERVER_TOKEN + message stream/from identity, or EMAIL_HOST/PORT/USER/PASSWORD/FROM route deliberately selected; authorized inbox cohort, provider owner, delivery/bounce/resend evidence pending |
| [Storage config](../../../tixmoapi2/src/config/s3.ts) | S3 endpoint/region/bucket/credentials or AWS equivalents present, URL style and isolation chosen; authorized synthetic asset namespace plus retention/deletion scope pending; no storage/provider calls here |
| Observability / API config | SERVICE_NAME, release/SENTRY_RELEASE, environment, SENTRY_DSN, trace mode and SENTRY_ALERT_ROUTE presence/mode; named on-call/incident/support owner and approved destination; delivered alert/recovery proof pending |

PM reuses #61 and launch-parent decisions: currency/refund/tax-fee policy,
approved policy text/URLs and publication authority, provider/test-inbox owner,
actual scanner client/device/gate lead, recovery owner + second approver,
on-call/support coverage, exact runtime/CI command/window and capacity. No new
hosting questionnaire or credential request is created by this packet.

## Authority: preserve #61, do not expand it

Recorded proxy decision **BB61-20261020-STAGING-ONLY** was for approach/scope at
`0d193a6`: local preparation now; bounded **non-mutating**, zero-incremental-cost
staging evidence/native CI only after PM records approved existing target,
secure access references, candidate deployment mapping, exact window/commands
and verified preapproved runner capacity. It is not blanket approval for this
new SHA. Reconcile exact-candidate scope before execution. Inherited credentials
are not authority. Authentication last-used writes, scanner/review/test-data
writes are not silently exempt. Billable workflows without documented existing
allocation, target/config changes and notifications are outside that decision.

No production, deploy/restart, default-branch merge, mutations, restore,
monitoring/scheduler changes, publication, subscription or unbudgeted spending
is authorized by #243 intake. Exposure authorized: zero. Named human/legal/device
participation and independent technical/QA acceptance cannot be invented or
waived. Parent #231's integration authority is not inherited by this worker.

## Runnable next steps, gated separately (not executed)

1. **W06 release + lead/QA:** review exact `317754e` and this document; reconcile
   #236 separately; obtain deployment-bound manifest and intended startup/probe
   override. Record current candidate checks, not historical CI. PM resolves
   concrete command/window/capacity/target-write authority. Only then separately
   execute authorized staging setup/deploy and capture exact identity/config.
2. **W08 #245 release + QA/backend:** reserve the single DB-mutating lane; create
   owned disposable local Postgres 17 / Redis 8.2.10 with loopback-only dedicated
   ports/DB and synthetic data. Use a scrubbed allowlist environment, never an
   inherited DATABASE_URL or .env. Read [verify-api](../../../scripts/verify-api.mjs)
   and its safety helper before commands: it runs migrations and mutation tests.
   `npm --prefix tixmoapi2 run migrate`, `npm run verify:api`, then
   `npm run verify:market` are execution-stage commands only after disposable
   ownership/opt-in are verified. Full market also performs network audits.
   Run both empty migration chain and populated prior-schema/checksum upgrade;
   no db push shortcut. Reconcile inventory/currency/QR/accounts and measure
   isolated restore + schema-compatible rollback. Existing
   [CI](../../../.github/workflows/market-readiness-local.yml) uses Postgres 14 /
   Redis 7, so a green run does not prove requested 17 / 8.2.10 parity.
3. **W07 #244 QA + backend:** after W06 and explicit provider/test-data/inbox
   authority, use small synthetic cohort and real Stripe **test-mode** browser
   success/decline/3DS/retry/late callback/refund cases. Correlate order, intent,
   webhook, ticket and receipt IDs; observe inbox and authenticated retrieval.
   Mocks, fabricated mail records or platform SUCCESS are not this proof.
4. **W11 #248 release + named on-call:** qualify deployed `/ready` failure/recovery,
   backlog visibility (payment/refund/receipt), owner coverage and safe pause-sales.
   Separately authorize monitor/alert/Sentry tests and any branch-protection edit;
   capture delivered alert and recovery at intended recipient. Do not cancel an
   event to pause sales: preserve paid admission, wallet and reconciliation.

## Rollback and evidence acceptance

Use [backup/rollback runbook](../../DB_BACKUP_AND_MIGRATION_ROLLBACK.md), but its
production commands are not authorized here. Before migration obtain verified
backup/retention/checksum, exact deployed app/schema mapping, named recovery
owner + second approver and isolated restore acceptance. After customer writes,
restore into a **separate recovery DB**, reconcile all post-backup processor-paid
orders/refunds/tickets and only then consider reopening. Never overwrite live
state with an old backup or run automatic destructive down-migrations. For a
code-only regression pause new sales and select only a known-good build proven
compatible with the migrated schema. Do not assume old account/QR/currency
semantics can safely return. Proposed restore <=60 minutes / loss window <=15
minutes remain unmeasured targets, not an SLA or accepted result.

Each future artifact requires exact SHA, environment/deployment ID, timestamp,
owner, independent reviewer, commands/scenarios, actual outcome and limits.
[Runtime evidence](../../CHECKOUT_RUNTIME_CONFIG_EVIDENCE.md),
[policy checklist](../../POLICY_PUBLICATION_CHECKLIST.md), and
[uptime runbook](../../UPTIME_STATUS_MONITORING.md) are existing inputs, not passes.
Strict evidence status alone does not enforce freshness or candidate identity.

## Intake source, dependencies and next critical path

User-supplied proposed source: inbound
`NOVEMBER_9_ONSALE_PLAN---fa93ad48-8e6a-48c0-8cd9-583432d660cf.md`
at `/home/daniel/.openclaw/media/inbound/` (read locally, not copied or published).
Its estimates, proposed gates and decision deadlines do not authorize launch.
Board parent #237 maps W01–W12 to #238–249; #250 owns business/proxy decisions.

- #238–242 / W01–05: schedule, editor/selection, refund, recovery and buyer
  access correctness. #238 currently investigates/repairs ignored event
  salesStart/salesEnd; no acceptance or integration is claimed here.
- #243 / W06: this LOCAL checkpoint, then separately gated staging qualification.
- #244 / W07: real test-mode purchase/refund and inbox proof, after relevant
  W01–06 and provider authority; first full journey target October 27.
- #245 / W08: schema-stable parity/upgrade/restore; #246 / W09 capacity depends
  on W04 and W06–08. #247 / W10 needs real scanner client/devices and relevant
  purchase/admission flows. #248 / W11 requires current deployed identity and
  named operations ownership. #249 / W12 requires every mandatory gate plus
  independent exact-candidate reviews and explicit production action authority.

Immediate critical path: #231-owned independent #235/#236 acceptance/integration
plus W01–05 corrections → fresh exact candidate/local qualification → bounded
W06 authority/config/deployment identity → W07 purchase proof and W08 upgrade
in the coordinated single DB lane → capacity/device/operations → W12 go/no-go.
#250 policy/owner decisions run alongside local work, not as fabricated inputs.
Autonomous overnight recovery uses existing scheduled board processing; this
packet creates no schedule or ongoing monitoring commitment.

## Actual checks and limits of this checkpoint

Local source/board/plan reads only. Verified Git base and parents, source files,
31 migration inventory and four added-vs-0d193a6 migrations, relative references,
and documentation whitespace. Some exploratory reads guessed absent paths and
returned diagnostics; corrected using tracked source names; no runtime inference.
No dependencies installed, builds/tests/evidence gates executed, platform/HTTP
calls, env/secret reads, services, DB, CI dispatch, config edits, push, merge,
publication, spend or deploy. Full W06 and launch remain **NOT QUALIFIED**.
