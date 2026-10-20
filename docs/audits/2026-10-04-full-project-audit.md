# Tixmo project audit and planning baseline

Audited on October 4, 2026. Tixmo has a substantial working event operations application, but it is not ready for a paid public launch. The next milestone should be a dependable beta built around event setup, customer checkout, ticket admission, and creative approval. Access control, financial state recovery, inventory transitions, and release evidence need to be completed before expanding the feature set.

This audit covers the current working tree, architecture, product flows, security, data lifecycle, tests, dependency locks, deployment configuration, public browser pages, and operational runbooks. It retains the established model of **one business per deployment**. Authorized staff visibility within that business is expected. Customer ownership, staff enrollment/offboarding, reviewer identity, event-specific scanner authority, and destructive actions remain real boundaries.

Only read-only production checks were made. No production login, signup, purchase, refund, admission scan, review decision, database operation, or deployment was performed. Source findings apply to the audited working tree; they are not claims of observed production exploitation.

## Project and release state

| Item | Verified state |
| --- | --- |
| Audit branch | `codex/tixmo-full-audit-2026-10-04` |
| Current commit and remote main | `2f3a05540b6db6f6bd8c026156e74afcc7b1bf9e`, June 16 |
| Existing checkout work | 102 tracked changes and five untracked top-level entries before this audit; preserved |
| Application structure | React/Vite dashboard in `tdash`; Express/TypeScript/Prisma API in `tixmoapi2`; PostgreSQL, Redis, Stripe, S3 and email integrations |
| Data model | 28 Prisma models; 26 migrations |
| Deployment | Railway production API, dashboard, PostgreSQL and Redis report successful active deployments |
| Deployed source | API and dashboard metadata identify the June 16 commit; current uncommitted changes are not a verified release |
| GitHub main | Branch protection API reports unprotected |
| Audit changes | Reports and evidence only; no application source changes or commit/push/merge |

The API contains business operations for events, venues, users, tasks, assets, approvals, customers, orders, tickets, scanners, promo codes, reporting and waitlists. The dashboard deliberately marks QuantMo, Social, ProMo and Marketing Hub outside V1 beta. Those placeholders are a scope decision, not completed integrations. The repository contains scanner administration and sync APIs, but no verified camera/offline scanner client.

## What is already useful

The applications build successfully with fresh lockfile installs. Customer payment intent creation uses a caller-owned order and database-derived amount. Webhooks verify Stripe signatures over raw request bytes. Admission paths check paid orders. Inventory reservation guards available quantity atomically. Several controllers reload current business authority rather than relying only on browser state.

Reviewer links and asset-folder shares are distinct capabilities. Folder shares have random tokens, hashed lookup, expiry and revocation; uploaded objects use generated names. API responses have Helmet headers. Lazy dashboard routes keep the initial bundle below the larger analytics/event chunks. There are extensive automated tests, launch checklists, migration/rollback instructions and evidence helpers.

These controls are worth keeping. Their existence does not prove the complete customer or event-day workflow.

## Launch priorities

| Order | Work | Why it comes first |
| --- | --- | --- |
| 1 | Production bootstrap, staff enrollment/offboarding, reviewer isolation | Current controls can preserve or grant unintended privileged authority |
| 2 | Payment session, fulfillment and refunds | Customers must never pay without a recoverable order/ticket or receive a local refund label without money returned |
| 3 | Admission and inventory state transitions | One ticket must admit once; cancellation/expiry/refund must release stock once |
| 4 | Event lifecycle, dates, checkout recovery and truthful metrics | Operations must preserve event times and show actual business state |
| 5 | Supported runtime, clean CI, staging, backup restore, monitoring and target evidence | A tested checkout must become a reproducible, recoverable deployed release |

The [next-step plan](</Users/danielchapman/Desktop/Project Tixmo/docs/audits/2026-10-04-next-steps.md>) turns these into work packages and acceptance criteria.

## Security findings

The standard source-backed review reports **16 findings: five High and eleven Medium**. The generated [security report](</Users/danielchapman/Desktop/Project Tixmo/docs/audits/2026-10-04-security-report.md>) contains code evidence, attack prerequisites, counterevidence, remediation and coverage. Severity is distinct from scheduling priority: a Medium inventory bug may still block launch.

Complete source reads covered 376 distinct repository files, including all 118 API runtime TypeScript files and all 74 frontend runtime JS/JSX files. Security coverage remains partial for explicitly listed unavailable external prerequisites and acceptance checks. Canonical artifacts are [findings](</Users/danielchapman/Desktop/Project Tixmo/docs/audits/2026-10-04-security-findings.json>), [coverage](</Users/danielchapman/Desktop/Project Tixmo/docs/audits/2026-10-04-security-coverage.json>) and [manifest](</Users/danielchapman/Desktop/Project Tixmo/docs/audits/2026-10-04-security-manifest.json>). The authoritative supplemental investigation packets remain in the manifest's scan directory; repository exports are exact copies of the sealed documents.

| Reference | Severity | Finding | Source |
| --- | --- | --- | --- |
| S01 | High | Public registration can grant staff and owner authority without invitation | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/auth/service.ts:101>) |
| S02 | High | External review responses expose other reviewers' bearer links | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/approvals/service.ts:345>) |
| S03 | High | Deleted users retain credentials, roles and renewable access | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/users/service.ts:222>) |
| S04 | High | Removing an admin preserves and broadens administrative authority | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/organizations/service.ts:266>) |
| S05 | Medium | Role demotion leaves prior access-token authority usable | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/middleware/auth.ts:43>) |
| S06 | Medium | Rejected multipart uploads leave staged files on API disk | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/assets/controller.ts:170>) |
| S07 | Medium | Aborted requests permanently consume waiting-room capacity | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/middleware/waitingRoom.ts:34>) |
| S08 | High | Production startup reapplies and logs a fixed administrator credential | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/prisma/seed-minimal.js:27>) |
| S09 | Medium | Ticket transfers and QR regeneration preserve previous admission credentials | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/tickets/service.ts:231>) |
| S10 | Medium | Event-assigned scanner keys can scan tickets for other events | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/middleware/scannerAuth.ts:39>) |
| S11 | Medium | Concurrent entry scans can redeem one ticket more than once | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/scanners/service.ts:350>) |
| S12 | Medium | Concurrent cancellation requests can release the same inventory repeatedly | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/tickets/service.ts:278>) |
| S13 | Medium | Checkout bypasses ticket status and sales-window restrictions | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/orders/service.ts:89>) |
| S14 | Medium | Quantity-limited discounted tiers never exhaust through checkout | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/ticket-tiers/service.ts:133>) |
| S15 | Medium | Runtime configuration inspection exposes the operator's Node process to downloaded JavaScript | [Root control](</Users/danielchapman/Desktop/Project Tixmo/scripts/check-checkout-runtime-config.mjs:127>) |
| S16 | Medium | Approval cache survives logout and exposes the previous session to the next user | [Root control](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/ApprovalsDashboard.jsx:72>) |

Important qualifications:

- Public registration grants staff only when host-based organization resolution succeeds. The current reserved demo/Railway host can resolve a customer. Accepted custom/forwarded hosts remain unsafe; production proxy sanitization was not verified.
- Reviewer exposure requires one legitimate unexpired review link. Internal comments are filtered, but peer bearer links still permit impersonating another reviewer.
- The seed finding includes a freshly confirmed production startup command, `npx prisma migrate deploy && npm run db:seed && npm start`. No privileged login was attempted and no credential value is included here.
- Admission and cancellation races are established from source ordering and unconditional writes. Existing tests do not deliberately force those transactions to overlap.
- Current transfers set ticket status to `VALID`. A separately observed repeated-scan variation for `TRANSFERRED` rows requires legacy/imported/manual state; it is not described as the normal transfer path.
- The runtime-config helper finding requires an attacker-controlled selected dashboard response and an operator-triggered check. The exact parser harmlessly reproduced host `process.version` access. No secret, shell or filesystem effects were exercised. Parent severity is Medium because this additional compromise and operator action are prerequisites; the worker's original higher calibration remains in the investigation packet.
- Dependency advisories below are tracked separately. Package audit counts are not proof of exploitability in Tixmo.

## Product and correctness findings

| Reference | Priority | Verified issue and consequence | Source |
| --- | --- | --- | --- |
| F01 | Before paid beta | Refund only changes local ticket/inventory/order state. It never calls Stripe, so `REFUNDED` does not establish a returned payment. Ticket cancellation also does not initiate the advertised refund. | [Order refunds](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/orders/service.ts:597>) |
| F02 | Before paid beta | Each payment-session request creates a new Stripe intent and overwrites the association. Existing intents remain chargeable; an earlier intent's success is then rejected as a mismatch. | [Payment sessions](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/payments/service.ts:54>) |
| F03 | Before paid beta | Exhausted fulfillment errors are swallowed after an alert, then the webhook is marked `PROCESSED`. Interrupted `PROCESSING` records have no expired lease recovery. Payment can succeed without recoverable ticket fulfillment. | [Webhook tracking](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/payments/service.ts:142>), [fulfillment](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/payments/service.ts:243>) |
| F04 | Before paid beta | Checkout order/payment state lives in React memory. The return URL contains `orderId`, but the page does not restore it or poll authoritative completion. Redirects/refresh can lose the paid flow. No standalone customer wallet/recovery route is mounted. | [Checkout state](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/pages/CheckoutPage.jsx:291>), [return URL](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/pages/CheckoutPage.jsx:612>) |
| F05 | Before beta | Event and tier edit fields put UTC text into a local date-time input, then interpret it as browser-local on save. In Newfoundland, an unchanged October value shifted by 2.5 hours in a standalone reproduction. | [Event initialization](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/EventStudio.jsx:92>), [save](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/EventStudio.jsx:177>) |
| F06 | Before beta | Checkout formats dates in the browser timezone but prints the event's timezone label beside them. A live March event showed Newfoundland-local time labelled America/Los_Angeles. | [Date formatter](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/pages/CheckoutPage.jsx:42>) |
| F07 | Before beta | Event Studio publishes the event before separate ticket/tier requests finish. Failure leaves a partially configured published event. | [Save sequence](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/EventStudio.jsx:170>) |
| F08 | Before beta | Generic event update accepts status and writes it directly. It bypasses dedicated publication readiness checks and cancellation side effects, even though the dedicated status route delegates correctly. | [Generic update](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/events/service.ts:253>) |
| F09 | Before operational use | Event Overview mixes actual summary values with fixed trends, 12.5k views, 4.2% conversion, mock sales chart and fabricated recent activity. Analytics manufactures hourly activity from daily totals using fixed weights. | [Overview](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/ECC_Overview.jsx:65>), [hourly distribution](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/AnalyticsView.jsx:181>) |
| F10 | Before beta | Settings recycle bin uses an all-zero organization ID and hides failures as an empty result. Event settings Delete button displays an unimplemented alert. The stated 30-day purge has no corresponding inspected scheduled job. | [Recycle bin](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/SettingsView.jsx:35>), [Delete](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/ECC_Settings.jsx:128>) |
| F11 | Before event-day pilot | Invalid/missing QR failures try to create scan logs referencing nonexistent tickets, contrary to the required ticket foreign key. Incremental offline sync omits cancelled/refunded tickets instead of returning explicit revocations. Actual client cache behavior is unverified. | [Scan failures](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/scanners/service.ts:327>), [sync](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/scanners/service.ts:620>) |
| F12 | Before paid beta | Duplicate ticket-type items bypass an aggregate per-order limit because each item is checked separately. Promo allowance is consumed when an unpaid cart is created and not restored on cancellation/expiry; intended usage policy needs a decision. | [Item checks](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/orders/service.ts:99>), [promo use](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/orders/service.ts:239>) |
| F13 | Polish with fixes | “Keep me signed in” has no state/behavior connection; sessions always use localStorage. ErrorBoundary says the team was notified but only logs to console. Some task assignee visuals still use mock users. | [Login checkbox](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/LoginView.jsx:135>), [error message](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/components/ErrorBoundary.jsx:42>) |
| F14 | Measure before scale claims | Sales reporting loads matching orders/relations and aggregates in process. Redis behavior is globally mocked in API tests, and periodic jobs live in API processes. Capacity, real Redis, multi-instance jobs and offline admission need dedicated evidence. | [Reports](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/src/api/reports/service.ts:49>), [test setup](</Users/danielchapman/Desktop/Project Tixmo/tixmoapi2/tests/setup.ts:15>) |
| F15 | Before paid beta | Order detail defines a refund handler, but its button only enters a confirmation flag state with no confirmation UI or call to the handler. Resend Receipt and several event-order filter/export/search controls have no handlers. Complete or remove these advertised actions. | [Order detail](</Users/danielchapman/Desktop/Project Tixmo/tdash/src/features/OrderDetailModal.jsx:23>) |

## Testing and dependencies

Tests and migrations ran in a copied source workspace with explicitly configured disposable loopback PostgreSQL/Redis. The original application files were preserved. Fresh installs used `npm ci --ignore-scripts --no-audit --no-fund`, so they prove lockfile resolution without exercising installation hooks.

| Check | Result and limitation |
| --- | --- |
| API build and typecheck | Pass |
| API lint | Pass with zero errors and 291 warnings |
| Dashboard build | Pass; initial JS 279.83 kB, gzip 92.04 kB; analytics chunk 398.23 kB, gzip 126.38 kB |
| Dashboard design guard | Pass against a baseline of 1,055 accepted existing violations; this is regression protection, not full design compliance |
| API full suite, final clean-install run | 52/53 suites and 331/332 tests pass. Asset-library fixture is already expired on the audit date |
| Dashboard full suite, final clean-install run | 23/24 suites and 113/114 tests pass. Event-list fixture dates are already past |
| Fixed-clock diagnostic | The two date-dependent suites pass in a temporary copy with a June clock; repository tests were not repaired |
| Smoke stability | First full API run also failed the V1 smoke with a socket hang-up; isolated rerun and final fresh-install run pass. Cause remains unproven |
| Fresh migration replay | All 26 migrations pass against PostgreSQL 17 |
| Schema comparison | Only approval-reminder unique-index naming differs; no table/column drift found in the fresh replay |
| Strict launch evidence | Fails with nine reported gaps; eight missing target/manual categories plus an always-counted local-evidence warning |

Fresh `npm audit` results for the current lockfiles:

| Scope | Dashboard affected package entries | API affected package entries |
| --- | --- | --- |
| Production only | 3 total: 2 High, 1 Moderate | 7 total: 4 High, 3 Moderate |
| Including development | 18 total: 12 High, 5 Moderate, 1 Low | 51 total: 47 High, 4 Moderate |

Production entries include Axios/React Router in the dashboard, and Express/body-parser/qs, brace-expansion, js-yaml, Multer and Nodemailer in API dependency chains. The exact machine-readable audits are included in the evidence folder. Their reachability must be assessed for the actual deployed bundle: for example, server-specific router/Axios advisories are not automatically exploitable in a browser SPA.

Railway API metadata uses Node 18.20.8, the dashboard Dockerfile uses Node 18, local checks used Node 24.0.2, and root CI uses Node 20. Node 18 and 20 are now EOL according to the [official Node release table](https://nodejs.org/en/about/previous-releases). Standardize on a supported patched LTS runtime and rerun release checks there.

## Live deployment and operations

| Surface | October 4 observation |
| --- | --- |
| [Demo dashboard](https://demo.tixmo.co/) | HTTP 200; login renders on desktop and at 390 px without horizontal overflow |
| Dashboard assigned Railway host | `dash-production-7487.up.railway.app` returns 200 |
| Legacy frontend Railway alias | `frontend-dash-production.up.railway.app` returns 502; observed alias lacks target port |
| [API health](https://api-production-fbaf.up.railway.app/health) | HTTP 200, production label; handler does not probe DB/Redis/external dependencies on each check |
| Public events | HTTP 200 with seven records; expired events remain labelled on sale/sold out |
| Private events/scanners without auth | HTTP 401 |
| Invalid reviewer token | API 404; browser shows review link unavailable |
| Frontend runtime config | API URL populated; privacy, terms, refund, organizer terms and Stripe publishable key empty; currency USD |
| Backend variables | Database, Redis, JWT/session, Postmark and S3 references populated; Stripe secret/webhook and Sentry DSN/release not configured in the inspected environment variables |
| Checkout browser | Renders ticket selection and buyer form; missing policy configuration disables progression. No purchase was submitted |
| Frontend response headers | Sample lacks CSP, HSTS, Referrer-Policy and nosniff; API provides Helmet headers |

Configured S3 and email references do not prove object privacy or message delivery. The app reports payment capability as unavailable when the Stripe secret is absent. These live configuration findings are independent of source-level payment correctness.

The uptime workflow is disabled through inactivity. Its latest inspected August 24 run was green while skipping both staging and production checks because URL secrets were missing. Restore scheduling, fail on absent required targets, and prove alert delivery. Nested `tixmoapi2/.github/workflows/ci.yml` is not a root GitHub Actions workflow; the actual root market-readiness workflow exists, but this audit did not trigger a fresh hosted run.

Verification helpers require hardening. `verify:api` and Jest setup can run `prisma db push --accept-data-loss` against the selected inherited/.env database; `NODE_ENV=test` is not a target safety boundary. The rollback runbook calls this a local gate without forcing a disposable target. Root `backups/` is not excluded by the root gitignore, although package-local backups are excluded. The verifier also prints REDIS_URL without redaction. Bind test tooling to explicit disposable targets and protect backup/log destinations.

The evidence-status script always counts the local-config informational warning as a blocker. Even complete future target evidence cannot make that unchanged gate green. Repair the distinction between local diagnostic warnings and launch acceptance; do not manufacture evidence to make the indicator pass.

Fresh migration replay proves clean database construction, not safe upgrades of populated databases. Historical approval migrations include table replacement; verify the actual applied migration history and run upgrade/restore tests against representative retained data before future schema releases. Legacy seed/admin/reset tools also require target guards and secret-safe bootstrap behavior.

The broader tooling review found stale approval seed fields/enums and a setup script containing Prisma schema text after its shell steps. Retire or repair these paths so onboarding uses one verified setup sequence. Approval reminders send email before claiming their unique database reminder record, allowing duplicate messages when API processes overlap; durable job ownership needs testing before horizontal scaling.

## UX and design assessment

The public login and checkout retain Tixmo's dark composition, light typography and restrained pink/orange accents. Desktop/mobile login and mobile checkout were inspected; sampled pages had no browser console errors. The sampled widths pass, but this is not a complete accessibility audit or an authenticated dashboard walkthrough.

The most consequential UX work is operational truth: real data, correct event times, visible failed writes, resumable orders, clear scan failures, and implemented actions. Preserve the visual direction while replacing unsupported charts and controls with actual data or explicit unavailable states. Gradually move touched components onto the shared primitives instead of treating the 1,055 grandfathered violations as a redesign mandate.

The existing review/assets consolidation plan and mockups are useful design inputs. Sequence consolidation after reviewer isolation and upload cleanup so one integrated surface does not carry the existing capability defects forward.

## Remaining evidence and decisions

A full project review is not a certification or a claim that every production capability was exercised. The security coverage file lists actual fully reviewed paths and any residual supporting material. Authenticated dashboard workflows, actual scanner devices/cache behavior, payment-provider test transactions/refunds, live mail/S3 permission behavior, backup restore, production proxy rules, load/concurrency behavior and accessibility remain unproven.

Before paid beta, decide the intended refund/cancellation and promo-allocation policies, currency/business policy text, pilot event/venue/device scope, and the named operator who approves restore/rollback and monitors alerts. These are planning decisions; this audit did not assume approval or alter production.

The recommended next milestone is a small end-to-end pilot with an approved release SHA and recorded acceptance for event creation/editing, buyer checkout/recovery, gate admission, staff offboarding, and external review/share. QuantMo, Social, ProMo and broader marketing remain deferred until those workflows are dependable.

## Audit integrity and usage

The workbench noted that working-tree contents changed during the scan because the audit added reports/evidence. Results are sealed against the original source snapshot. All 457 tracked files included in the initial audit copy match the original checkout byte for byte; tracked environment examples were excluded from the copy. Pre-existing git status entries were preserved. Temporary database services and the audit browser were closed, and the initially stopped Colima profile was stopped again.

The workbench reports 42,333,807 total tokens across five threads, including 40,402,432 cached input tokens, 42,163,227 input tokens and 170,580 output tokens. These are measured rollout totals returned by the security plugin, not a billing calculation or an estimate of unique source text.
