# November 9 onsale readiness audit

Assessed October 21, 2026, America/St_Johns. Source baseline: `87bbad00da8ee2e6ddddd2658b743103cf2bc467`.
Target: November 9, 2026. There are 19 elapsed days, or 20 calendar dates including October 21.
Owner: Daniel Chapman. Audit owner: this local Codex chat. Single business per deployment.

**Verdict: NO-GO today. A tightly scoped individual-event onsale on November 9 is a credible conditional target, not an established capability or delivery promise.** Current source has substantial payment, inventory, admission and recovery safeguards. The highest risks are the gap between tested source and deployed applications, missing checkout configuration, scheduled-sale correctness, refund exceptions, and absent end-to-end operational evidence.

The executable delivery proposal is [the November 9 plan](../NOVEMBER_9_ONSALE_PLAN.md). Synthetic volumes and prices are planning assumptions, not sales forecasts or approved commercial policy.

## What was actually examined

- Current main and remote main, both at the baseline above; GitHub open PR inventory returned none.
- Exact-baseline hosted market and design gates, recent scheduled uptime runs, branch protection and active branch rules.
- Read-only Railway deployment/configuration inventory for the existing API/dashboard project, in production and staging.
- Anonymous HTTP readiness, health and dashboard checks; served checkout runtime configuration.
- Fresh production dependency audits and 47 local verification-safety contract tests.
- Independent read-only specialist reviews of customer storefront/checkout/operator paths and API payments/inventory/refunds/admission.
- Existing V1 checklist, support, scanner, migration, policy, customer journey and evidence documents.

No production login, transaction, refund, scan, migration, restore, configuration change, deployment, external message, new paid service, or public publication was performed. No private worker workspace was accessed. This is a comprehensive launch-readiness assessment, including targeted security boundaries; it is not a new exhaustive security scan or penetration test.

The local kanban CLI is unavailable. No task claim, board status or team availability is asserted. Work packages below are proposed assignments for reconciliation by the PM. The repository is public; the audit and integration handoff remain on a local purpose-specific branch until publication is authorized.

## Verified status

| Area | Current evidence | Assessment |
| --- | --- | --- |
| Source integration | Main and origin/main at `87bbad0`; no open PRs at inspection | Auditable baseline exists |
| Hosted full market gate | [Run 39527401260](https://github.com/chapmandaniel/projectTixmo/actions/runs/39527401260) passed on exact baseline; API verifier/build/lint, safety checks, dashboard tests/build/design guard | Green code gate; not customer acceptance |
| Dashboard | 35 files / 233 tests passed; [design workflow](https://github.com/chapmandaniel/projectTixmo/actions/runs/39527401290) passed | Includes mocked Stripe/browser data |
| Dependency advisories | Fresh `npm audit --omit=dev --json`: API 0, dashboard 0 | No reported production dependency advisories at capture time |
| Local safety contracts | 47/47 passed | Disposable-target and CI wiring contracts only |
| Production application | API and dashboard still deployed from `2f3a055`; API deployed June 16, dashboard July 26 | Current fixes and storefront are not live there |
| Staging application | Both application deployments date to October 7; deployment metadata does not expose a Git SHA | Not proven to run current main |
| Railway health | All eight services online; production Postgres reports two warnings, zero critical notifications; no pending work | Warning details not investigated; online is not readiness |
| Production HTTP | `/health`, `/api/v1/health`, dashboard: 200; `/ready`: 404 | Current readiness gate fails |
| Staging HTTP | `/ready`, both health routes and dashboard: 200 | Dependency readiness only |
| Checkout configuration | Both runtimes have empty privacy/terms/refund URLs and Stripe publishable key | Paid onsale is blocked |
| Currency | Served production runtime: USD; staging: CAD | Commercial decision and API/frontend alignment needed |
| Required evidence | Strict checker exits 1 with eight missing target/manual categories | No launch signoff |
| Monitoring | [Scheduled run 39540481002](https://github.com/chapmandaniel/projectTixmo/actions/runs/39540481002) failed on production `/ready` 404; multiple recent repeats | Cause is verified; incident/recovery alert delivery unproven |
| Main protection | Classic protection API: “Branch not protected”; active branch rules API: empty array | Independent review is procedural, not enforced by GitHub |

Detailed sanitized observations and exact commands/results are in [current-observation.json](2026-10-21-onsale-evidence/current-observation.json). Separate runtime-config and dependency artifacts are in the same directory. Hosted checks were inspected live; the full runtime suite was not rerun locally after an exact-baseline hosted pass.

The market gate has 337 API lint warnings and a design guard with 926 grandfathered violations. Neither invalidates its pass; neither proves a warning-free or fully accessible product. Broad cleanup is not the critical path.

## Launch-critical findings

Priority here means order of launch work: P1 must be resolved or covered by a tested, explicit launch constraint; P2 must have a bounded disposition. Static findings below were not exercised against production.

### F01 — Tested source and deployed applications differ

Production metadata identifies `2f3a055`. Current main contains five additional migration files relative to that source. The live migration ledger and production data were not queried. Staging was last deployed October 7 and its SHA is unverified.

The current Railway API start override is `npm run migrate && exec node dist/index.js`, without `db:seed`; do not repeat the old seed-startup finding as the current configured command. This does not establish that credential/session rotation or the newer application cutover occurred.

**Required:** select a release SHA, rehearse a populated upgrade and reconciliation, verify actual deployed SHA and runtime config, then obtain approval for coordinated production release. Do not treat an old deployment's SUCCESS state as current acceptance.

### F02 — Checkout configuration is incomplete

Fresh served runtime snapshots show blank policy URLs and publishable key in both environments. Production displays USD; staging CAD. Service variable-name inventories did not report Stripe credentials for either API. Secret values were deliberately not read; this is not a complete secret validation.

**Required:** approved currency, prices/taxes/fees/refund rules and URLs; target-specific test/live Stripe setup; webhook signing configuration; exact currency/amount/mode agreement; real test-mode lifecycle acceptance. Do not populate invented business terms or treat synthetic amounts as approval.

Sources: [production config](2026-10-21-onsale-evidence/production-runtime-config.json), [staging config](2026-10-21-onsale-evidence/staging-runtime-config.json), [checkout checks](../../scripts/check-checkout-runtime-config.mjs).

### F03 — Event-level onsale windows are not enforced by order creation (P1)

The public storefront uses event `salesStart`/`salesEnd` in `tdash/src/lib/publicEvent.js:13-23`. Order eligibility at `tixmoapi2/src/api/orders/service.ts:89-96` checks event status/deletion/start time, but not those sale dates. Ticket-level dates ARE enforced at lines 113–118.

**Required:** one authoritative server rule covering event and ticket windows, tested one millisecond before/at/after opening and closing, with direct checkout/API access. A constrained ticket-level schedule on every ticket type is only an interim option after independent verification; a hidden button is not a gate.

### F04 — Editing ticket schedules can move their instant (P1)

`tdash/src/features/TicketTypeModal.jsx:27-28` fills a datetime-local input using UTC text, then lines 62–63 interpret that text in the browser timezone. A local reproduction of these exact date expressions in America/St_Johns changes saved `2026-11-09T13:30:00Z` to `2026-11-09T17:00:00Z` on an unchanged save: a 3.5-hour shift. The full UI was not reproduced during this audit.

Studio's ticket mapping at `tdash/src/features/EventStudio.jsx:197-207` also omits ticket-level sale-window fields. The ticket editor/list use `quantity`/`sold` while raw API records use `quantityTotal`/`quantitySold` (`ECC_Tickets.jsx:140`, `TicketTypeModal.jsx:25`, `ticket-types/service.ts:193`).

**Required:** preserve sale windows, counts and caps across all supported editor paths; reuse the existing event-time helpers. Test with browser zones different from the event zone, before/after DST, and unchanged saves. Correct inventory labels and blank edit quantities.

### F05 — Refund instructions and executable behavior disagree (P1)

The support runbook at `docs/BETA_SUPPORT_ADMIN_PLAYBOOK.md:59-62` and draft refund policy direct a Stripe refund first, followed by Tixmo bookkeeping. Tixmo now initiates real processor refunds: `payments/service.ts:459-471,537-554`. It recognizes previous processor refunds only by its local refund identity. An external refund can therefore leave the app trying another full refund or retaining stale paid/admission state.

Refund webhooks reconcile existing local records only (`payments/service.ts:152-155`); `charge.dispute.*` has no dedicated handler. Event cancellation invalidates tickets but does not itself refund paid orders (`events/service.ts:571-601`).

The buyer's `request-refund` route immediately begins processing (`orders/controller.ts:132-140`), whereas the policy draft describes organizer approval. Current normal eligibility is a full order, unused/untransferred, before event start. Used/transferred cancellations and terminal failed refunds need a deliberate exception path.

**Required:** Daniel chooses the supported refund rule; code, UI, policy and support instructions match. Prove app refunds, external full/partial refund exceptions, failed/pending refunds, disputes and event cancellation without duplicate money movement or false admission. A bounded audited reconciliation procedure is acceptable; do not expand into a general finance product.

### F06 — Poison records can starve payment recovery (P1)

`payments/service.ts:632-650` repeatedly selects the oldest 50 refund records. Failures before the record update can log without changing selection order. Fifty persistent failures can exclude later recoverable records. The webhook loop at lines 682–697 has the same pattern when provider event retrieval fails. This is source-backed failure analysis, not a reproduced runtime result.

**Required:** fair retry scheduling/backoff or a bounded exception queue, visible backlog age and errors, and a regression fixture with at least 50 permanently failing entries followed by a healthy entry. Restart must not duplicate fulfillment, refunds or stock changes.

### F07 — Complete buyer recovery and retrieval need acceptance (P1/P2)

Wallet requires login. Password-reset schemas exist but the auth router/customer interface expose no recovery flow. Receipts lack a wallet link (`tixmoapi2/src/utils/emailTemplates.ts:47,70`), and confirmed redirect return lacks wallet navigation (`CheckoutPage.jsx:720-739`).

Receipt resend already exists at `POST /orders/:id/receipt`; receipt recovery is durable in current source. Older runbook text saying no resend endpoint exists is stale. The same runbook documents `POST /orders/:id/confirm`, which is no longer mounted. Do not reintroduce a manual “mark paid” endpoint to satisfy old prose.

**Required:** browser closure → login or verified account recovery → same purchased ticket/QR; receipt and confirmed-return links to wallet; actual inbox delivery plus resend; identity-checked support for missing access. Either implement secure self-service recovery or obtain explicit acceptance of a rehearsed support-assisted process.

### F08 — Checkout offer selection and tier visibility can disagree with the API (P2)

Checkout controls at `CheckoutPage.jsx:406-413,535-566` use stock and per-order caps, without the storefront's full sale-window/tier/reconciliation checks. The server rejects many invalid requests, but the UI can offer an impossible purchase.

The public API returns only active tiers (`events/service.ts:765-770`); an inactive-only tier schedule appears to have no schedule, while order creation correctly rejects it. This is also documented in `docs/CUSTOMER_EVENT_ONSALE.md:58-62`.

**Required:** align checkout offer eligibility and boundary updates. Either expose schedule presence or disallow inactive-only schedules in the validated launch configuration. Prove sold-out, early/closed, tier-cap and expired-hold behavior.

## What is already implemented

Do not reopen old issues solely because historical reports list them:

- Aggregated per-ticket-type order caps, row locks, tier/promo reservations and decimal monetary arithmetic.
- Durable payment attempts with stable idempotency keys, ownership, amount/currency checks and retry limits.
- Signed webhooks with persisted event IDs, generation-based ownership and transaction fences.
- Atomic fulfillment and inventory transitions; late success queues refunds instead of reviving expired stock.
- Processor-backed refund requests, frozen admission during refund processing, reconciliation before local finalization.
- Atomic online admission, scanner scope/revocation checks, transfer/reissue credential rotation.
- Receipt leases/recovery and existing order-email resend.
- Resumable checkout/order status, buyer wallet, atomic event configuration and dependency-aware readiness probes.
- Guarded disposable test targets, including refusal to load application .env files in test mode.

Relevant source: `orders/service.ts:69-223,328-416,530-555`; `payments/service.ts:31-283,287-381,424-594,653-681`; `services/order-inventory.service.ts`; `services/ticket-admission.service.ts`; `scanners/service.ts:323-362`. Existing integration and race tests cover these paths, including `payment-inventory-integrity.test.ts` and the webhook-generation suites. This audit's full-suite evidence is the hosted run, not specialist test execution.

## Acceptance still missing

| Gate | Missing proof and implication |
| --- | --- |
| Real payment lifecycle | Actual Stripe test-mode PaymentElement, 3DS/redirect, decline/retry, lost/duplicate/delayed webhook and refund outcomes. Existing tests mock provider calls. |
| Email and customer access | Authorized test-inbox delivery, sender-domain/provider status, links, resend and account recovery; submission to a provider is not delivery. |
| Capacity | No measured onsale burst acceptance found in inspected scripts/docs/workflows. Existing 30-requests-for-20-tickets test establishes a small inventory invariant, not 500-user capacity. Event-row serialization and same-IP rate limits require measurement. |
| Deployment parity | CI uses Postgres 14/Redis 7; Railway deployment images are Postgres 17/Redis 8.2.10. Test the candidate on matching versions and production-like topology. |
| Upgrade/restore | Five migration files differ from old app source; populated upgrade helper exists but is not invoked by the full market workflow. No current restore drill or production migration-ledger evidence captured. |
| Security operations | Credential/session/token rotation evidence, reviewed operator roster, customer/staff boundaries on deployed SHA, protected integration and secret-safe logs. Current dependency result does not replace these. |
| Monitoring | Current production readiness mismatch; no delivered incident/recovery notification proof or measured payment/receipt backlog alerts. |
| Admission | API exists; this checkout does not establish a camera scanner client/device deployment. Identify the actual client and demonstrate real-device ticket use. Offline duplicate admission across two devices is an acknowledged limitation. |
| Storage/reviewer/share | No fresh target upload/download, expiry/revocation and logged-out reviewer/share acceptance attached. Existing V1 requires these unless Daniel explicitly defers scope with owner/date. |
| Policy/support | Published policy approval, refund/cancellation rules, currency/fees/taxes, support contact and staffed launch/incident ownership. |

The strict evidence script reports eight missing categories: target smoke, target checkout config, target public screenshots, scanner/device, backup/rollback, reviewer/share, policy, and uptime. This is not the total number of launch risks. The script accepts result fields and selects files lexically; it does not prove freshness, tested SHA equals deployed SHA, every environment, full payment/load coverage, or the contents of manual attestations. Keep a release-specific evidence index and human go/no-go review.

## Scope and recommendation

Launch the existing individual-event path: published event → scheduled ticket selection → account/checkout → payment → durable tickets/receipt → wallet/support → admission. Keep the exact supported configuration small and tested.

Festival pages/passes are development previews, not a production festival model or pass fulfillment system. Booking intelligence, AI/marketing modules, resale, seat-map expansion, new payment methods and broad redesign are outside this deadline plan. Existing approvals/assets stay internal and require their existing V1 acceptance or an explicit recorded deferral.

Reach a demonstrated test-mode purchase by October 27, a capacity/restore-tested candidate by November 2, and production readiness by November 5. November 6 is the firm go/no-go; November 7–8 are a stability buffer. If those gates slip, reduce scope or arrange an explicitly approved alternative sales path rather than sell against unproved money/inventory behavior.
