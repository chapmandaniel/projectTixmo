# V1 architecture and prioritized delivery gaps

Inspection: 2026-10-19. Task: kanban tixmo #21. Author: tixmo-lead.
Source baseline: `2f3a05540b6db6f6bd8c026156e74afcc7b1bf9e`.
All source references below are repository-relative `path:line` anchors at that
baseline, not claims about a deployed environment. This is static inspection;
no build, test suite, browser flow, external request, database, payment or
service mutation was performed. Independent QA must review the report commit.

## Scope and evidence authority

V1 is organization account → venue → event → ticket types → checkout/payment →
orders/attendees → scanner, plus approvals and asset sharing. Authority:
`docs/PRODUCTION_LAUNCH_CHECKLIST.md`, sections 1 and 7. Social, ProMo, QuantMo,
Marketing Hub, resale, live GA4 Data API analytics and broad AI claims remain
outside launch scope. `tdash/src/App.jsx:81`, `:85`, `:95` already label several
of those routes outside V1; this is not an audit of every navigation surface.

Current source outranks historical completion claims in
`tixmoapi2/MASTER_DOCUMENTATION.md`. The June green results in
`docs/LOCAL_MARKET_READINESS_GATES.md` are historical, not today's test evidence.
Existing React/Express/Prisma/Stripe components and root verification helpers
are adequate foundations; this audit proposes no replacement platform,
new dependency, custom orchestration or speculative product module.

## Component and trust-boundary map

| Component | Responsibility and boundaries | Exact source anchors |
| --- | --- | --- |
| Dashboard | React operator UI, session lifecycle; public checkout/review/share routes bypass dashboard login. Browser configuration selects API origin. | `tdash/src/App.jsx:265`; `tdash/src/lib/api.js:11`; `tdash/src/lib/runtimeConfig.js:13` |
| HTTP API | Express mounts `/api/{API_VERSION}`. CORS, rate limits and optional JWT parsing precede per-route authentication. Public routes are not blanket operator-authenticated. | `tixmoapi2/src/app.ts:35`, `:132`; `tixmoapi2/src/api/index.ts:42`, `:66` |
| Tenant authorization | Actor scope is reloaded from DB; global admin means ADMIN with no organization. Requested organization IDs are checked; resource-specific access helpers exist. Presence of helpers does not prove every caller is safe. | `tixmoapi2/src/utils/tenantScope.ts:13`, `:16`, `:43`, `:77`, `:87` |
| Persistence/inventory | Prisma Postgres entities join organizations, venues, events, ticket types, orders, tickets and scan logs. Order creation holds inventory transactionally for 15 minutes; confirmation moves held to sold; cancellation releases holds. | `tixmoapi2/prisma/schema.prisma:97`, `:152`, `:197`, `:258`, `:311`, `:401`; `tixmoapi2/src/api/orders/service.ts:164`, `:192`, `:320`, `:449` |
| Payments | Stripe intent creation uses server order total and configured currency, persists intent ID, then signed webhook processing drives confirmation. Webhook events are persisted separately. | `tixmoapi2/src/api/payments/service.ts:32`, `:54`, `:88`, `:129`, `:201`; `tixmoapi2/prisma/schema.prisma:287` |
| Scanner plane | Operator registers/revokes devices; scanner-key authentication is distinct from dashboard JWT. Online scan and offline sync/batch upload have dedicated routes. | `tixmoapi2/src/api/scanners/routes.ts:50`, `:118`, `:165`, `:256`, `:414`; `tixmoapi2/src/middleware/scannerAuth.ts:31` |
| Approvals/assets | Authenticated management plus token-bearing external review and folder-share endpoints; share expiry/revocation checked in service. Assets depend on object storage configuration. | `tixmoapi2/src/api/approvals/routes.ts:18`; `tixmoapi2/src/api/review/routes.ts:17`; `tixmoapi2/src/api/assets/routes.ts:10`; `tixmoapi2/src/api/assets/service.ts:809`; `tixmoapi2/src/config/s3.ts` |
| Background/runtime | API boot connects DB and Redis, then starts order-expiry and approval-reminder jobs. Email and Sentry are integrations, not proof of delivered notifications or alert routing. | `tixmoapi2/src/index.ts:15`, `:19`, `:31`; `tixmoapi2/src/config/email.ts`; `tixmoapi2/src/config/sentry.ts` |
| Verification/release | Root market gate orchestrates existing API/dashboard checks. API verifier can start Docker services and apply schema: do not run against an inherited/unknown target. | `package.json` scripts; `scripts/verify-api.mjs:76`, `:208`, `:241`; `docs/LOCAL_MARKET_READINESS_GATES.md` |

The deployment boundary is dashboard → API → Postgres/Redis plus Stripe,
email, object storage and monitoring. Local source does not establish that any
of those production services, origins, owners or credentials are configured.

## UI/API integration contracts

Paths in this table are relative to `/api/v1` unless explicitly browser paths.
Version defaults and deployed routing must agree: API router is configurable,
but raw Stripe webhook handling is explicitly `/api/v1/payments/webhook` in
`tixmoapi2/src/app.ts:54` (keep V1 fixed or review all version-sensitive paths).

| UI/user action | Wire contract and invariant | Source evidence |
| --- | --- | --- |
| Sign up/sign in/session | `POST /auth/register`, `/auth/login`, `/auth/refresh`; authenticated `/auth/me` and `/auth/logout`. Shared Axios adds Bearer access token, retries once with refresh, then expires session. | `tixmoapi2/src/api/auth/routes.ts:90`, `:157`, `:215`, `:249`, `:283`; `tdash/src/lib/api.js:32`, `:55`, `:69` |
| Operator setup | Authenticated CRUD families `/venues`, `/events`, `/ticket-types`; role gates on writes, service/controller scope checks require separate review. Publish is `POST /events/:id/publish`; event stats use `/events/:id/stats`. | `tixmoapi2/src/api/venues/routes.ts:11`, `:87`; `tixmoapi2/src/api/events/routes.ts:11`, `:80`, `:348`, `:402`; `tixmoapi2/src/api/ticket-types/routes.ts:11`, `:72` |
| Public event checkout | Browser `/checkout/:slug` fetches `GET /events/public/:slug` unauthenticated. Public detail is deliberately uncached to keep ticket identifiers and availability fresh; published/on-sale/sold-out visibility is not equivalent to purchasability. | `tdash/src/App.jsx:267`; `tdash/src/pages/CheckoutPage.jsx:315`; `tixmoapi2/src/api/events/public.routes.ts:94`; `tixmoapi2/src/api/events/service.ts:777` |
| Create order | Authenticated `POST /orders` body `{items:[{ticketTypeId: UUID, quantity: positive integer}], promoCode?: string}`; 201 success envelope contains order. UI sends IDs/quantities, not trusted prices. Free orders auto-confirm server-side. | `tixmoapi2/src/api/orders/validation.ts:3`; `tixmoapi2/src/api/orders/controller.ts:10`; `tdash/src/pages/CheckoutPage.jsx:377`; `tixmoapi2/src/api/orders/service.ts:247` |
| Paid checkout | `POST /payments/create-intent` body `{orderId}`, returns `{clientSecret,paymentIntentId}` inside success data. UI Stripe Elements confirmation is not server order fulfillment. Policies and key gate UI preparation. | `tixmoapi2/src/api/payments/routes.ts:49`; `tixmoapi2/src/api/payments/service.ts:32`; `tdash/src/pages/CheckoutPage.jsx:104`, `:357`, `:391` |
| Fulfillment/order operations | Stripe posts raw signed body to `/payments/webhook`; service persists processing outcome and retries order confirmation. Operator repair confirm and refund are privileged routes; customer checkout does not call confirm directly. Refund endpoint updates platform tickets/inventory, not Stripe money movement. | `tixmoapi2/src/app.ts:54`; `tixmoapi2/src/api/payments/service.ts:96`, `:122`, `:247`; `tixmoapi2/src/api/orders/routes.ts:114`, `:174`; `tixmoapi2/src/api/orders/service.ts:580`; `docs/BETA_SUPPORT_ADMIN_PLAYBOOK.md:59` |
| Scanner | Operator JWT registers device; `/scanners/auth` accepts `{apiKey}`; scanner Authorization header accepts Bearer or raw scanner key. `/sync` uses eventId/since; `/scan` accepts qrData/scanType; `/validate` accepts offline scans. Do not confuse API support with a verified camera/offline client. | `tixmoapi2/src/api/scanners/routes.ts:50`, `:85`, `:118`, `:165`, `:256`; `tixmoapi2/src/middleware/scannerAuth.ts:31`; `docs/SCANNER_SETUP_AND_FIELD_TEST.md:25` |
| External review | Browser `/review/*`; direct fetch `GET /review/:token`, POST decisions/comments/reviewers, DELETE comment. No dashboard JWT required on token routes; expiry/access restrictions must hold server-side. | `tdash/src/App.jsx:265`; `tdash/src/pages/ExternalReviewPage.jsx:77`; `tixmoapi2/src/api/review/routes.ts:17` |
| Folder shares | Browser `/assets/shared/:token` directly fetches `GET /assets/shares/:token`. Authenticated folder share creation/revocation separate from public access. Service rejects expired/revoked shares. | `tdash/src/App.jsx:266`; `tdash/src/pages/SharedAssetFolderPage.jsx:93`; `tixmoapi2/src/api/assets/routes.ts:10`, `:14`, `:15`; `tixmoapi2/src/api/assets/service.ts:809` |

### Response/configuration compatibility details

- API success envelope: `{success:true,data?,message?,meta?}`;
  `tixmoapi2/src/utils/response.ts:13`. Named `api` helpers normalize the body
  (`tdash/src/lib/api.js:126`); default export is raw Axios (`:124`). Consumers
  of these two exports must not assume identical response shapes.
- Runtime `window.__TIXMO_CONFIG__` takes precedence over Vite values. Keys:
  apiUrl, privacyPolicyUrl, termsUrl, refundPolicyUrl, stripePublishableKey,
  paymentCurrency (`tdash/src/lib/runtimeConfig.js:3`, `:13`, `:19`, `:26`, `:30`).
  Default browser currency is usd, not evidence of intended launch currency.
- Concrete scanner pagination mismatch: controller returns array data and
  pagination under **meta** (`tixmoapi2/src/api/scanners/controller.ts:82`),
  but UI extraction reads **pagination**, falling back to one page
  (`tdash/src/features/ScannersView.jsx:15`). Default Axios import at `:3`
  means its request params are valid; do not misdiagnose this as named-helper
  query-parameter loss. Runtime impact still needs a multi-page fixture.

## Prioritized gaps and duplicate check

Board inspected 2026-10-19: #21 architecture, #22 verification baseline,
#23 release inventory, #24 frontend review, #25 backend review. #22 was active;
#23-25 were todo at inspection. Gap candidates below refine those assignments;
**no duplicate tasks were created**. Also checked
`docs/REPO_CLEANUP_FOLLOWUPS.md` and launch checklist/runbooks. Priorities are
proposed launch triage, not claims that every untested path is broken.

| Priority / candidate | Evidence and classification | Existing owner/task; concrete completion condition |
| --- | --- | --- |
| P1: Current gate evidence absent in this audit | Historical June results do not establish current health; verifier can mutate schema. Evidence gap, not a demonstrated test failure. | QA #22: exact SHA/commands/results or explicit blocked prerequisites, verified disposable DB before schema work. Reuse that report, do not run competing database gates. |
| P1: Payment/inventory recovery acceptance | createPaymentIntent always invokes Stripe create then overwrites stored intent (`payments/service.ts:54`, `:72`); repeated prepare/retry deserves analysis. This is a bounded risk candidate, not a reproduced duplicate-charge bug. Webhook dedupe exists (`:129`), so do not report idempotency wholly absent. | Backend #25: exercise repeated intent preparation, duplicate/concurrent success delivery, expiry/payment race and failed-confirm retry on disposable fixtures/mocked Stripe. Document accepted intent/amount/currency invariants before any fix task. |
| P1: Tenant/role contract verification | Scope helper distinguishes global admin and org actors; route-level role checks alone are insufficient (`tenantScope.ts:13`, `:77`; `orders/routes.ts:114`). No authorization pass asserted here. | Backend #25: negative cross-org read/write, downgraded-role, scanner event/org and privileged repair cases against `docs/ROLE_ACTION_PERMISSION_MATRIX.md`; scoped fixes only for evidenced failures. |
| P2: Scanner pagination contract | Source mismatch described above: API meta versus UI pagination. Static finding, not exercised UI. | Frontend #24: multi-page API-shaped fixture in ScannersView test; verify page count and page-two request for scanner/log views; if reproduced, PM slices small frontend fix, preserving raw Axios contract. |
| P1 before release: Real-origin public/payment workflow evidence | Source routes exist, but origin rewrites, served runtime config, webhook delivery, signed object URLs and notification delivery unverified. | Frontend #24 + release #23: launch section 7 smoke against approved production-like environment; attach checkout-config artifact, logged-out review/share revoke/expiry and order/email proof. No live payment authorization implied. |
| P1 before doors: Scanner field readiness | Scanner API routes exist; runbook requires actual device and offline/reconnect checks, not just dashboard registration. | Release #23 coordinates owner/device; frontend/backend #24/#25 map client/API issues. Attach `docs/SCANNER_SETUP_AND_FIELD_TEST.md` checklist including duplicate scan and lost-device revocation before entry go/no-go. |
| P1 before release: Environment/recovery/legal evidence | Required services, backup/rollback, monitoring run, policy/payment currency/fee signoff are checklist requirements, not current environment facts. Refund code is platform-only by design per support playbook, not automatically a missing Stripe-refund feature. | Release #23 inventories evidence/owners; PM routes genuine approvals to Daniel. Completion requires backup restore/rollback evidence, on-call/support owner, monitoring run and approved policy/config artifacts. No provisioning or publication in this task. |
| P2: Existing webhook/config regressions | `payments/service.ts:97` catch uses any; follow-ups already request signature-failure/non-Error coverage and no sensitive environment import logging regression. | Backend #25 refines existing `docs/REPO_CLEANUP_FOLLOWUPS.md` items; inspect tests first, do not add duplicate backlog entries or claim coverage absent from filenames alone. |

Deferred cache invalidation is **not** a current V1 gap: public detail is
explicitly uncached (`events/service.ts:777`) and cleanup follow-ups make cache
invalidation conditional on reintroduction. Deferred AI/social rebuilds remain
outside this delivery plan.

## Integration and review order

1. Independent QA checks this exact report commit and anchors against baseline;
   author cannot approve it. PM integrates only after authorization.
2. Complete #22 current safe baseline and #23 prerequisite inventory; those may
   proceed independently without shared database mutation. Missing services
   are blockers with owners, not reasons to install or provision silently.
3. Complete #25 backend contract/risk review and #24 frontend contract review;
   reconcile envelope, pagination, tenant, money/state and runtime-config
   expectations before implementation slicing. Keep documented refund repair
   semantics; business policy changes require Daniel, not an invented feature.
4. PM creates only confirmed, duplicate-checked bounded fixes. For coupled API
   and UI work: define backward-compatible contract → backend implementation
   and independent lead/QA review → frontend consumer/fixture → integration
   regression. A frontend-only pagination adaptation can proceed separately
   if it preserves existing API envelopes. One database-mutating owner at a time.
5. Re-run relevant gates on selected integration SHA, then production-like
   end-to-end checkout, public token routes and scanner field checklist.
   Payment/auth changes need independent architecture and QA review. Preserve
   raw signed webhook parsing and persisted event/order idempotency invariants.
6. PM compiles release evidence for Daniel: exact SHA, deployment/config
   inventory, backup/rollback proof, policy/financial signoffs, status-monitor
   evidence and support owner. No merge, deploy, production mutation, live
   financial action or launch approval is authorized by this report.

## Checks and limitations

Read-only source/launch-document/board inspection plus document diff checks
only. No dependency installation and no current functional pass. No secrets,
production state, private agent memory, CI run results or external platform
state were read. Some broad V1 surfaces (analytics, attendee UI and all upload
validation paths) are mapped via mounted components rather than exhaustively
reviewed; #24/#25 remain responsible for deeper findings. This report is a
bounded integration guide and gap triage, not a security or launch certificate.
