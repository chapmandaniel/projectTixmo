**Tixmo — current state of the world, September 7, 2026**

**Assessment: substantial beta implementation; not ready for a public, paid launch as a single-tenant platform.** Tixmo has a deployed dashboard, a substantial API, durable data models, useful operational workflows, and broad automated test coverage. Its strongest implemented areas are event administration, asset management, and creative review. The production administrator seed, reviewer identity exposure, incomplete payment operations, admission correctness, misleading dashboard metrics, and missing live acceptance evidence prevent a launch-ready judgment.

**Architecture scope, corrected following owner clarification:** Tixmo will be single tenant. This report assumes one operating business per deployment, with customer data isolated at the deployment/database boundary. That infrastructure isolation is an architectural assumption, not something this audit verified across deployments. Broad OWNER/ADMIN/MANAGER access to that business's orders and tickets is not inherently a defect. The earlier cross-tenant isolation finding and its remediation requirement are withdrawn from launch blockers. Customer ownership, staff authorization, individual reviewer identity, and event-specific scanner rules still apply.

The immediate priority is the production administrator seed described below. Its behavior is confirmed in the deployed source and configured startup command; the account's current password and whether it has been used by anyone were not tested.

This audit created branch `codex/current-state-audit-2026-09-07`. It assessed the current working tree, including 102 pre-existing changed tracked files and four untracked entries, and compared that state with GitHub and Railway. Existing work was preserved. Application code and deployed services were not changed. The new report and [structured evidence snapshot](</Users/danielchapman/Desktop/Project Tixmo/docs/audits/2026-09-07-current-state-evidence.json>) are the audit deliverables.

**What is deployed today**

| Component | Observed state |
| --- | --- |
| GitHub main | `2f3a05540b6db6f6bd8c026156e74afcc7b1bf9e`, “chore: clean stale repo artifacts,” June 16 |
| Railway project | “tixmo API and Dashboard”; one visible environment, production |
| Backend API | Successful active deployment from June 16, same commit; Railpack resolved Node 18.20.8 |
| Dashboard | Successful active deployment from July 26, still the June 16 commit |
| Data services | PostgreSQL 17 and Redis, both reported SUCCESS; S3-compatible media bucket exists |
| Primary dashboard | [demo.tixmo.co](https://demo.tixmo.co/login) returns HTTP 200 and the sign-in screen renders |
| Working Railway alias | [dash-production-7487](https://dash-production-7487.up.railway.app/login) returns HTTP 200 |
| Broken configured alias | [frontend-dash-production](https://frontend-dash-production.up.railway.app/) returns HTTP 502 |
| API | [health endpoint](https://api-production-fbaf.up.railway.app/health) and versioned health return HTTP 200 |
| Public catalog | Public events endpoint returned successfully and reported seven listed events |
| Checkout configuration | [Live runtime config](https://demo.tixmo.co/runtime-config.js) has empty privacy, terms, refund, organizer terms, and Stripe publishable key values |
| Monitoring | GitHub uptime workflow is `disabled_inactivity`; its last run, August 24, skipped both environments because URL secrets were missing |

A browser visit to a catalog event's checkout rendered the event and a disabled payment action with the explicit message that approved policy links must be configured. That sample event had no active ticket types. No account was created and no payment was attempted.

The successful [June 16 readiness run](https://github.com/chapmandaniel/projectTixmo/actions/runs/27656154242) applies to committed code at that time. The [August 24 uptime run](https://github.com/chapmandaniel/projectTixmo/actions/runs/32681987003) did not actually check an environment. Neither establishes that the dirty local working tree is deployed or that today's purchase flow works.

**Product and architecture**

The repository contains two independently packaged applications: React 18/Vite dashboard in `tdash`, and Express/TypeScript/Prisma API in `tixmoapi2`. Root scripts coordinate development and verification. There are 28 Prisma models and 26 committed migrations. PostgreSQL owns domain state; Redis supports locks, rate limits, and waiting-room behavior; Stripe handles payment intents and webhooks; S3-compatible storage serves assets; email and optional Sentry support operations.

| Product area | Current capability | Qualification |
| --- | --- | --- |
| Workspace and team | Login, token refresh, session handling, team and organization management, role helpers | Broad staff visibility may fit the single-tenant model; public staff onboarding needs review; recovery UX is incomplete |
| Event operations | Event Studio creation/editing, venues, ticket types/tiers, event workspace, order and attendee views | Event editing changes times outside UTC; event Overview mixes real and fake data |
| Ticket purchase | Public event route, ticket selection, buyer authentication, order reservations, Stripe Payment Element | Live configuration blocks checkout; durable completion and processor refunds are incomplete |
| Ticket admission | Scanner registration/revocation, API-key authentication, sync/offline endpoints, scan logs, manual check-in | Scanner enforcement needs correction; no actual camera-scanning client is implemented in this dashboard |
| Asset library | Upload, folders, organization/event grouping, previews, move/delete, external share links, expiration and revocation | Substantial source implementation; real storage delivery and access acceptance were not exercised |
| Review Portal | Review requests, assets, revisions, reviewer decisions/comments, reminders, archives, external token review | Strong feature depth, but public response exposes other reviewers' credentials |
| Tasks | Task CRUD, drag/drop workflow, comments, assignment | Some assignee display still reads mock users |
| Analytics | API-backed sales/event/customer reporting and filters | Event activity and hourly purchase patterns include invented data; GA traffic is explicitly unsynced |
| Settings | Restore workflow shell and general settings surface | Recycle-bin organization query is wrong; General remains a placeholder |
| Deferred products | QuantMo, Social, ProMo, Marketing | Explicitly outside V1 beta; do not count as delivered capabilities |

These are implementation observations, not a claim that every feature has passed live end-to-end acceptance. The review/assets consolidation plan and HTML mockups in the untracked documents are planning artifacts, not implemented changes.

**Priority findings**

**1. Critical — production startup resets a global administrator to a hardcoded credential.** Railway's live backend startup is `npx prisma migrate deploy && npm run db:seed && npm start`. The seed script hashes a password embedded in source, upserts an ADMIN user, replaces the existing password and organization on every execution, and logs the password. This exact JavaScript is tracked and unchanged from deployed HEAD. There is no production guard. Changing the account password alone will not survive another startup.

Remove this seed from production startup, replace bootstrap with a controlled one-time process, rotate the affected credential, invalidate affected sessions, and examine access/deployment logs. Treat this as urgent containment until assessed. This report deliberately does not reproduce the credential. Evidence: [seed entry point](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/package.json:21>), [credential declaration](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/prisma/seed-minimal.js:9>), [admin overwrite](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/prisma/seed-minimal.js:27>), [credential logging](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/prisma/seed-minimal.js:47>).

**2. High if enabled — public signup can grant staff access through organization bootstrap.** When host/deployment resolution returns an organization, registration assigns OWNER to its first member and TEAM_MEMBER to later registrants, then issues authentication tokens without a staff invitation. This is a customer-versus-staff concern even in a single-tenant deployment. Broad privileges for an authorized owner are not the issue. The live login screen describes administrator-issued credentials, so this automatic staff path needs to match the intended onboarding policy. Whether the current deployment activates that path, and how its ingress normalizes forwarded host input, were not established; no live unauthorized staff grant was demonstrated.

Keep public buyer registration in the CUSTOMER role. If staff access remains administrator-issued, require an authorized invitation or administrator action for staff creation and make the initial owner bootstrap explicit. Evidence: [registration host context](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/auth/controller.ts:20>), [automatic staff roles](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/auth/service.ts:101>), [token issuance](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/auth/service.ts:131>). No live signup was attempted.

**3. High — an external reviewer receives other reviewers' bearer links.** The shared approval serializer includes a `reviewUrl` derived from every reviewer's token. The public token-read path calls that serializer and only restricts internal comments. Decisions are authenticated by the same tokens. Consequently, a recipient can obtain credentials representing other reviewers of that request, undermining attribution and approval integrity.

Return a restricted public representation and omit all other reviewers' authentication material; consider reissuing affected links after the fix. Evidence: [reviewer serialization](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/approvals/service.ts:345>), [public serializer call](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/approvals/service.ts:1529>), [token-authenticated decisions](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/approvals/service.ts:1831>). No production review links or decisions were used.

**4. High — scanner admission does not enforce all ticket/scanner invariants.** Scanner authentication knows its assigned event, but the scan controller passes only its ID to the service. The service compares the ticket's event with the event claimed in the QR payload, without enforcing the scanner's assigned event, and does not validate the parsed barcode. Multiple events can belong to the same single-tenant business, so an event-specific scanner still needs its event restriction. Entry validation and the later ticket update are separate operations, so simultaneous requests can both read VALID and report success. TRANSFERRED tickets are also not transitioned by the VALID-only update branch.

Enforce the assigned event for event-specific scanners, validate the ticket credential, and make the admission transition atomic with its log. Organization-wide scanners can remain supported where intended. Evidence: [available scanner scope](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/middleware/scannerAuth.ts:41>), [scan arguments](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/scanners/controller.ts:169>), [QR fields used](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/scanners/service.ts:348>), [admission checks](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/scanners/service.ts:394>), [non-atomic state update](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/scanners/service.ts:428>). These are code-path findings, not a production load-test result.

**5. High — refund and payment recovery are incomplete.** `refundOrder` cancels tickets, restores inventory and marks an order REFUNDED, but never asks Stripe to refund money. It also leaves payment status unreconciled. Separately, a successful payment whose order confirmation exhausts retries can be treated as a successfully processed webhook after an administrator alert is sent: the inner catch does not rethrow. A ledger entry left PROCESSING after a crash is skipped on replay, with no age-based recovery.

Implement processor refunds with idempotent reconciliation, and retain recoverable failed/stale webhook work. Evidence: [refund implementation](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/orders/service.ts:597>), [webhook completion](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/payments/service.ts:122>), [existing webhook handling](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/payments/service.ts:137>), [swallowed fulfillment failure](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/payments/service.ts:260>). Stripe signature verification and a persisted webhook ledger are useful foundations, but do not close these failure paths.

**6. High — ordinary event edits can silently shift event times.** Event Studio places a UTC ISO string without its timezone into a `datetime-local` input, then interprets that value in the browser's local timezone on save. In America/St_Johns, `2026-09-07T20:00:00.000Z` becomes `2026-09-07T22:30:00.000Z` even when the user does not change the time. Both start and end are affected.

Use a consistent event-timezone conversion on display and save. Evidence: [input initialization](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/EventStudio.jsx:92>), [save conversion](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/EventStudio.jsx:177>). The conversion was reproduced locally without changing data.

**7. High for operational trust — visible dashboards invent activity and metrics.** The default event Overview populates named purchases/check-ins, a fixed revenue-growth percentage, 12.5k page views, 4.2% conversion, and a mock sales chart. Analytics distributes daily order totals across hardcoded hourly weights while presenting the result as purchase timing. These screens can mislead event operators and campaign decisions.

Remove invented values, show an unavailable state, or clearly identify actual estimates; compute hourly activity from real timestamps. Evidence: [simulated live activity](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/ECC_Overview.jsx:65>), [fixed metrics](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/ECC_Overview.jsx:91>), [mock chart](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/ECC_Overview.jsx:139>), [fabricated hourly distribution](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/AnalyticsView.jsx:191>). This does not mean every dashboard metric is fake: other sales/customer reports use the API, and GA traffic is explicitly marked unsynced.

**8. Medium — purchase completion does not survive redirects or refresh.** Checkout sends Stripe returns to a URL containing `orderId`, but reads only the event slug and retains order/payment state in React memory. There is no order-status recovery, confirmation polling, or receipt/ticket screen. A completed redirect-based payment can return the buyer to a fresh checkout.

Add a durable order confirmation route with server status retrieval and ticket access. Evidence: [in-memory state](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/pages/CheckoutPage.jsx:289>), [return URL](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/pages/CheckoutPage.jsx:612>), [completion message](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/pages/CheckoutPage.jsx:619>).

**9. Medium — verification and release gates need correction.** The API helper imports `.env` and performs `prisma db push --accept-data-loss` on the selected URL without requiring an isolated database; Jest setup repeats it and swallows errors. This audit used dedicated disposable containers with explicit credentials. The strict launch-evidence checker also treats the permanent “local non-launch evidence” warning as a blocker, so it still fails when all required artifacts are supplied.

Require disposable database targeting, surface bootstrap failures, run migrations in CI, and distinguish informational warnings from missing launch evidence. Evidence: [environment import](</Users/danielchapman/Desktop/Project Tixmo/scripts/verify-api.mjs:70>), [schema mutation](</Users/danielchapman/Desktop/Project Tixmo/scripts/verify-api.mjs:236>), [Jest bootstrap](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/tests/setup.ts:6>), [permanent warning](</Users/danielchapman/Desktop/Project Tixmo/scripts/evidence-status.mjs:46>), [blocker aggregation](</Users/danielchapman/Desktop/Project Tixmo/scripts/evidence-status.mjs:204>). The strict-gate behavior was reproduced using temporary synthetic artifacts.

**10. Medium — settings and operational controls have visible gaps.** Settings queries deleted events for the all-zero organization ID, which is not the deployment's real organization ID. Scoped users receive a rejection and elevated users query the wrong organization; the UI can then show an empty recycle bin. General Settings is a placeholder. Health endpoints report process availability rather than database/Redis readiness, and the monitor accepts successful HTTP status even for degraded JSON or fallback HTML. The Sentry debug-error route is public whenever a DSN is present. Jobs run within API processes without a complete shutdown/drain lifecycle.

Evidence: [recycle-bin query](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/SettingsView.jsx:35>), [general settings](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/SettingsView.jsx:195>), [health and debug routes](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/app.ts:102>), [status acceptance](</Users/danielchapman/Desktop/Project Tixmo/scripts/check-status.mjs:89>), [process startup/jobs](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/index.ts:24>). The monitor's false-positive behavior was reproduced against a disposable local server; the public production debug route was not triggered.

**Fresh verification results**

| Check | Result on September 7 |
| --- | --- |
| API build | Pass |
| API TypeScript check | Pass |
| API ESLint | Exit success; 0 errors, 291 warnings |
| API complete Jest run | 52 suites / 331 tests pass; 1 suite / 1 test fails |
| Frontend build | Pass |
| Frontend complete Vitest run | 23 suites / 113 tests pass; 1 suite / 1 test fails |
| Design guard | Pass; 1,055 existing violations are grandfathered |
| Fresh migration replay | All 26 migrations pass on disposable PostgreSQL 14 |
| Migration/schema comparison | One approval-reminder unique-index name differs; no table/column differences reported |
| Strict launch-evidence status | Fail: eight missing evidence categories plus one permanent local warning |

Both full-suite failures are date-dependent fixtures. The API share fixture expired on June 18; the frontend expects July/August events to remain upcoming. With only Date fixed temporarily to June 1, the affected API suite passed 16/16 and the frontend suite passed 2/2. Source tests were not edited, so the normal full commands still fail today. Evidence: [fixed share expiry](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/tests/unit/asset-library.service.test.ts:115>), [fixed event dates](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/test/EventsView.test.jsx:70>).

Checks ran with local Node 24.0.2 and installed dependencies. CI specifies Node 20; deployed API uses Node 18.20.8 and the dashboard Dockerfile builds on Node 18. Node 18 and 20 are now end-of-life, while the deployed lockfiles also contain packages requiring at least Node 20. Align local, CI and deployment on a supported LTS and verify a clean installation. [Official Node release status](https://nodejs.org/en/about/previous-releases).

Jest globally mocks Redis, so successful integration cases do not validate real distributed lock or rate-limit semantics. Migration replay validates a fresh PostgreSQL 14 database, not an upgrade of the live PostgreSQL 17 dataset or a backup restore. No new coverage measurement was taken; historical coverage badges were not accepted as current evidence.

**Dependencies and design**

Current npm registry audits of the working-tree lockfiles report:

| Package set | Production dependencies | Including development dependencies |
| --- | --- | --- |
| API | 5 affected packages: 2 high, 3 moderate | 13: 10 high, 3 moderate |
| Frontend | 3 affected packages: 2 high, 1 moderate | 10: 7 high, 2 moderate, 1 low |

Production findings include API transitive `brace-expansion`, `js-yaml`, `qs`/Express chains, and frontend Axios/React Router chains. npm reports fixes available for these production findings. Package counts include propagated dependency findings; they are not counts of demonstrated exploitable application bugs. Some advisories concern server-side adapters or framework modes that this SPA may not use. The evidence snapshot retains advisory URLs for applicability review. These counts describe local locks, not a measured SBOM of the deployed images.

Design fit is **partially aligned**. Shared dark surfaces, theme tokens, Exo typography, energetic accents, and reusable primitives establish a recognizable Tixmo system; the live sign-in page renders coherently. A passing guard only says the 1,055 accepted violations did not increase. Feature-level palettes and one-off surfaces still diverge from the [documented rules](</Users/danielchapman/Desktop/Project Tixmo/tdash/docs/dashboard-design-system.md:22>). The art-director skill's referenced CreativeComposer brand source is absent, so its fallback brand cues and the live design-system documentation informed this assessment. Authenticated dashboard pages were reviewed in source, not visually certified in a browser.

**Recommended sequence and acceptance criteria**

| Order | Work | Proof needed before moving on |
| --- | --- | --- |
| Immediate | Remove production credential-reset seeding; rotate affected access; assess logs; protect reviewer identity; verify customer/staff onboarding | Controlled owner bootstrap; public buyers remain customers; reviewer authorization regression checks; verification of deployed remediation |
| Before real ticket money or admission | Implement actual refunds and durable fulfillment recovery; correct scanner checks/concurrency and event time conversion | Stripe test-mode purchase/refund/webhook-replay flows, redirect/refresh recovery, concurrent admission tests, non-UTC edit tests |
| Before operator beta expansion | Replace fabricated metrics; repair settings and date fixtures; align runtimes and dependencies | Real-data UI checks, stable complete test runs, reviewed dependency results, clean installation/build |
| Before launch approval | Configure target checkout/policies; restore real monitoring; validate backup/restore and field devices; fix evidence gate | Release-bound staging/production evidence with owner, timestamp and commit |

Eight launch-evidence categories are absent from the repository: target external smoke, target checkout configuration, target public-route screenshots, physical scanner/offline acceptance, backup/restore and rollback, external review/shared-asset acceptance, policy approval/publication, and uptime/alert routing. Runbooks exist for these, which is useful preparation; completed operational evidence is still required.

No production data was modified, no external messages were sent, and no production login, payment, refund, scan, review decision or restore was attempted. The assessment supports prioritizing remediation; it does not establish compromise, sales volume, customer adoption, revenue, or comprehensive production security. Those outcomes require evidence beyond this bounded audit.

