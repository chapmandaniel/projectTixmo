# Dashboard and public-route V1 readiness

Inspection: 2026-10-19. Task: tixmo #24; author: tixmo-frontend.
Reviewed source baseline: `151a1ab` (reviewed team bootstrap; application sources
unchanged from `2f3a055`). Branch: `tixmo/task-24-frontend-readiness`.
Only this report is changed. This is **not a launch approval**.

## Scope and method

V1 authority is `docs/PRODUCTION_LAUNCH_CHECKLIST.md`, sections 1, 4, 7-9:
organization/operator setup, venues/events/tickets, orders/payment/attendees,
scanners, approvals and asset sharing. Existing React/Stripe components,
Vitest coverage, design guard and screenshot helpers are suitable existing
solutions; no replacement library, new module or behavior change is proposed.
Read the design-system guide, checkout policy/local-smoke/public-route evidence
guides, historical mobile QA guide, and lead's `ARCHITECTURE_AND_GAPS.md` from
task-21 for context; findings below were checked against this worktree's source.

Evidence levels:

- **Static:** source and existing test inspection; indicates implementation,
  not verified behavior, security, accessibility or deployed configuration.
- **Exercised locally:** design guard and two exact-source pure extraction
  fixtures only (details below). No React render, browser or API was exercised.
- **Not exercised:** logged-out routes, responsive/keyboard/screen-reader
  behavior, sessions, tenant boundaries, Stripe, webhook/order fulfillment,
  scanner hardware/offline, storage or deployed origins. Historical June
  screenshots/results in `docs/MOBILE_QA_PASS.md` and
  `docs/public-route-screenshots/` are not current acceptance evidence.

## Source-backed readiness map

| Surface | Existing implementation and source anchors | Remaining proof |
| --- | --- | --- |
| Operator dashboard | `tdash/src/App.jsx:77` routes dashboard, events and event management, analytics, team, orders, settings, assets, venues, approvals, dev and scanners. Authenticated application is gated at `:270`. Social, QuantMo, ProMo and Marketing Hub render outside-V1 placeholders (`:81`, `:85`, `:88`, `:95`). | End-to-end organization/operator workflow and role/tenant checks, including direct navigation, session expiry and refresh. Route presence alone is not authorization proof. |
| Theme/design system | `tdash/docs/dashboard-design-system.md` requires shared primitives, theme tokens and consistent shells. `tdash/src/components/dashboard/DashboardPrimitives.jsx` and `tdash/src/lib/dashboardTheme.js` are the extension points. | Guard passed with **1055 tracked baseline violations**, not zero styling debt or visual/accessibility approval. No baseline update performed. |
| Public route boundary | Checkout `/checkout/:slug`, review `/review/*`, share `/assets/shared/:token` are outside the login-gated catch-all (`tdash/src/App.jsx:265-270`). Review/share fetch directly rather than requiring dashboard login (`ExternalReviewPage.jsx:77`, `SharedAssetFolderPage.jsx:93`). | Fresh private-browser proof, deep links, invalid/expired/revoked tokens and no dashboard-auth dependency on the actual origin. |
| Checkout handoff | `tdash/src/features/EventCommandCenter.jsx:35-37` builds checkout URL with public status set PUBLISHED/ON_SALE/SOLD_OUT; copy/open handlers at `:64`, `:76`. `CheckoutPage.jsx:315` fetches current public event, selects ticket IDs/quantities and posts `/orders` at `:377`. | Verify draft/cancelled actions disabled; published link works; updated ticket types and inventory appear; sold-out behavior is clear. Public status is not proof of available inventory. |
| Policy/payment gate | `CheckoutPage.jsx:75-86` shows policy links; `:357-358` requires all three, attendee identity and selection, plus publishable key for nonzero subtotal. Inline registration/login is at `:188-190`; preparation creates intent at `:391`; Stripe confirmation at `:104`; free-order path at `:386`. | Approved deployed policy destinations, currency agreement, test PaymentElement/decline/redirect flows and backend fulfillment. The browser's payment completion text (`:620`) is not webhook fulfillment evidence. |
| External reviewer | `ExternalReviewPage.jsx:76-130` defines token fetch, decision, comment, delete and reviewer invitation calls. Initial error state at `:584`; action error banner at `:625`; reason modal submission at `:459`. | Decision/note persistence, failed-action recovery, reviewer-specific permissions and expiry, mobile/keyboard/modal behavior. Existing test names describe these scenarios but were not run. |
| Shared folder | `SharedAssetFolderPage.jsx:93-107` handles token loading/error; nested browsing, back control at `:251`, asset link at `:340`. | Read-only nested/multi-folder navigation; usable signed asset links; revocation/expiry; empty/error states and keyboard/mobile usability. |

All `*.jsx` anchors above other than App/primitives/theme are under
`tdash/src/pages/` unless a feature path is explicitly supplied.

## Concrete findings and bounded follow-up candidates

### F1 — Scanner and scan-log pagination contract mismatch (high, confirmed)

`tdash/src/features/ScannersView.jsx:15-38` reads `pagination.pages` from array
or nested bodies. API controller sends array data and passes pagination as
successResponse's third argument (`tixmoapi2/src/api/scanners/controller.ts:86-87`
and `:209`). `tixmoapi2/src/utils/response.ts:13-37` stores that argument in
**meta**; scanner service produces **pages**, not totalPages
(`tixmoapi2/src/api/scanners/service.ts:212-216`, `:486-490`). The response type's
optional totalPages property is not the actual service payload key.

A Node fixture evaluated each complete extraction function taken verbatim from
current source, with `{success:true,data:[{id:'fixture-1'}],meta:{page:1,limit:10,
total:21,pages:3}}`. Both returned one item and **pages=1**, not 3. This is a
pure-function reproduction, not API, React or browser execution. Pagination
controls are conditional on totalPages > 1 (`ScannersView.jsx:371`), so source
predicts later pages are inaccessible through those controls for this envelope.

**Scoped candidate:** support `body.meta.pages` in both extractors, retaining
legacy payload forms. Add API-shaped multi-page component fixtures for scanner
and logs; assert Next sends page=2, scanner limit=10/log limit=20; Previous and
tab reset work. Preserve the default **raw Axios** import and query options
(`ScannersView.jsx:3`, `:98-103`, `:117-120`); do not substitute the named
normalized helper (`tdash/src/lib/api.js:124-162`), whose get wrapper takes only
URL. Existing scanner tests (`tdash/src/test/ScannersView.test.jsx:23-60`) use
nested data with one-page pagination and do not cover the actual envelope.

### F2 — Scanner fetch failures have no local error/retry state (medium, static)

`ScannersView.jsx:107-110`, `:124-127` only log request errors and clear loading;
no local request-error state is established. Initial failure can leave the
same empty content as a successful zero-result response; later failure can
retain old items. Shared Axios can dispatch global errors
(`tdash/src/lib/api.js:102-118`), so this is not a claim that all errors are
invisible globally.

**Scoped candidate:** explicit scanner/log error and retry affordance, keeping
success-empty separate and preserving global handling. Acceptance: reject the
initial fetch and page/tab fetch in component tests; display failure, retry
same query and recover, without presenting stale items as fresh success.

### F3 — Redirect payment return recovery lacks UI source handling (medium, static)

`CheckoutPage.jsx:612` supplies a return URL with orderId, but this page does
not read query parameters or restore order/payment status from that ID; state
starts empty (`:296`) and the loading effect fetches only event detail
(`:309-342`). Thus a full return navigation has no source-backed confirmation
recovery here. This does **not** establish that backend payment fulfillment
fails, or that a specific deployed payment method redirects.

**Scoped candidate:** first reproduce a redirect-required Stripe **test-mode**
return with an independently approved disposable setup; then define a small
read-only authorized order-status recovery and honest pending/error UI using
existing order APIs. Do not confirm orders client-side or infer success from
query strings. Acceptance: return, refresh and pending/failed/paid order states
are accurate without duplicate order creation. Backend contract and lead/QA
review required before implementation.

## Acceptance scenarios for independent QA

These are required checks, **not passes from this review**. Use approved local
disposable fixtures or production-like test environments; no live payment or
production data mutation is authorized by this document.

1. **Operator V1:** authenticate as org A; create venue/event/two ticket types;
   publish; check copy/open link. Confirm org B resources are inaccessible and
   role-restricted actions remain restricted. Verify expiry/refresh and logout.
2. **Public checkout:** fresh logged-out desktop and 390px viewport; current
   event/ticket edits appear; invalid and sold-out event states are clear;
   zero, maximum and unavailable quantities behave correctly. Register/sign in
   inline without losing intended checkout; no horizontal overflow.
3. **Policy/config:** each approved policy link opens correct destination before
   action; independently omit each URL and paid publishable key and confirm
   preparation disabled with explanation. Capture served runtime configuration
   and browser/API currency agreement per `docs/CHECKOUT_POLICY_LINKS.md`.
4. **Payment:** free and paid test orders, decline and intent-service failure,
   repeat submission, redirect return and refresh; visible errors permit a
   safe recovery. Verify paid fulfillment exactly once, inventory, attendees
   and email through backend evidence, not frontend success copy. Local smoke
   in `docs/LOCAL_CHECKOUT_SMOKE.md` mutates orders and requires coordinated DB.
5. **Scanners:** API-shaped >1-page scanner/log data; Next/Previous and tab
   reset requests; explicit failed-load/retry and successful-empty states.
   Real-device/duplicate/offline entry remains separate field evidence under
   `docs/SCANNER_SETUP_AND_FIELD_TEST.md`.
6. **Review:** private link opens without operator login; approve and request
   changes with note persist; comment and permitted deletion/invitation work;
   failures preserve current work; expired token denies access. Verify keyboard
   focus, modal close/return and accessible action names.
7. **Share:** private nested/multi-folder link, navigation, empty folder,
   asset open, expiry and revocation. Verify no write controls and server-side
   denial after revocation; authenticated dashboard state must not be needed.
8. **Evidence:** rerun focused suites, full frontend tests, design guard/build,
   and fresh desktop/mobile public capture following
   `docs/PUBLIC_ROUTE_SCREENSHOT_EVIDENCE.md`; enable required policies only
   after approved URLs exist. Do not equate text/screenshot smoke with payment,
   keyboard/accessibility, tenant authorization or real-device scanner proof.

## Actual local checks and limitations

Run in `/home/daniel/projects/projectTixmo/worktrees/task-24`:

| Check | Actual outcome |
| --- | --- |
| `npm --prefix tdash run design:guard` | Exit 0; 1055 tracked baseline violations, no regressions. |
| `npm --prefix tdash test -- --run src/test/CheckoutPage.test.jsx src/test/ExternalReviewPage.test.jsx src/test/SharedAssetFolderPage.test.jsx src/test/ScannersView.test.jsx` | Exit 127: vitest not found; **no tests executed**. |
| `npm --prefix tdash run build` | Exit 127: vite not found; **no build executed**. |
| `ls tdash/node_modules/.bin/vitest` | Exit 2: absent. Bounded diagnosis: this isolated worktree lacks installed dependencies. No installation/lockfile change or reuse of another checkout's dependencies. |
| Exact-source Node extraction fixtures (inline, no repository artifact) | Exit 0; both extractors reproduce meta.pages=3 -> pages=1 with item retained. Assertions verify the defect, not correctness. |
| `git diff --check` | Exit 0 after report creation. |

No services started, API/market scripts run, DB changes, secrets accessed,
external requests, browser capture, dependency installation or live payments.
Only the docs report is submitted; independent review and PM integration remain
pending. Existing test source (`CheckoutPage.test.jsx:119,153,173`,
`ExternalReviewPage.test.jsx:88,108,198,254,305`,
`SharedAssetFolderPage.test.jsx:140,171`) supplies useful starting scenarios,
but its presence cannot substitute for reruns on the review SHA.
