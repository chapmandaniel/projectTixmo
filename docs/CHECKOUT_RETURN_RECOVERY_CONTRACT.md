# Checkout redirect-return recovery: task 72 contract for review

Date: 2026-10-19. Base: `3299e0cb569e7f7b042671370b2fbf4802445828`.
Branch: `tixmo/task-72-return-contract`; worktree: `/home/daniel/projects/projectTixmo/worktrees/task-72`.
Status: proposed contract plus current-behavior proof, **not implementation or launch acceptance**.

## Existing requirement and exact source proof

The existing V1 checkout path is documented in `docs/PRODUCTION_LAUNCH_CHECKLIST.md:136` onward. This is recovery of that purchase, not a new checkout feature. Reuse React Router, authenticated `api.get`, and existing Vitest/Testing Library/Stripe mocks; no new dependency or service is needed.

At the base, `tdash/src/pages/CheckoutPage.jsx:104-110` calls Stripe `confirmPayment` with `return_url` and `redirect: 'if_required'`. Line 612 supplies `/checkout/${slug}?orderId=${order?.id || ''}`. A redirect can therefore remount checkout with an existing order identifier. Lines 289-300 read only route `slug` and initialize order/payment state to null; lines 310-345 fetch the public event only. There is no search-parameter/status recovery. Lines 378-395 prepare a **new** order and payment intent when a buyer explicitly prepares another checkout. Return itself currently performs neither purchase nor recovery.

`tdash/src/test/CheckoutPage.test.jsx` already proves the emitted return URL using mocked Stripe. The added diagnostic test mounts the real CheckoutPage with an orderId and forged `redirect_status=succeeded`; it proves the current fresh selection UI, only public-event fetch, no authenticated GET, no POST and no Stripe confirmation. This passing test records the defect, not desired future behavior. Replace its expectations with recovery acceptance assertions when the reviewed implementation lands; do not preserve this defect as a permanent requirement.

## Existing GET: precise capability, not a universal consumer contract

`GET /api/v1/orders/:id` uses `router.use(authenticate)` (`tixmoapi2/src/api/orders/routes.ts:11,86`). Controller lines 62-71 call `getOrderById(id, undefined, req.user!.userId)` and return 404 for no scoped match, otherwise `successResponse(order)`. The client wrapper `tdash/src/lib/api.js` supplies bearer auth, refreshes sessions and normalizes response data; do not use public fetch for recovery.

`service.ts:53-67,275-295` resolves the actor from the database and scopes the read:

- Roles other than OWNER, ADMIN, MANAGER (including PROMOTER) get `{ userId: actor.userId }`: owner-of-order, not the OWNER role.
- OWNER, ADMIN, MANAGER use event organization scope. `tenantScope.ts:12-13,72-83` gives ADMIN without organization an unrestricted filter; organization-less non-global operators are rejected. This documents current code, not approval of disputed global-role policy.
- The optional `userId` service argument is not passed by this HTTP controller. A client-supplied query user ID must not be assumed to restrict it.
- GET includes tickets, event details and buyer details, not merely a status projection. Ordinary buyers cannot read another buyer's order, including within the same tenant; operators may have legitimate broader reads.

**Dependency:** this endpoint meets ordinary-buyer owner filtering, but does not guarantee owner-only recovery for every authenticated account. Backend/lead must independently review and select a server-enforced consumer-owner read contract before product implementation. Do not change existing operator roles, infer that frontend userId checks create an authorization boundary, or silently reuse broad operator access as consumer-owner access. No endpoint or authorization change is proposed here.

## Proposed recovery contract (review required)

Return is authenticated, **owner-of-order**, read-only status recovery. Query `orderId` identifies a candidate only; all Stripe URL fields, including `redirect_status`, `payment_intent`, and client secrets are untrusted and cannot authorize or prove payment. An absent/malformed identifier in a return context shows a neutral recovery error, no GET with an empty ID, and no automatic purchase. Ordinary checkout with no return context remains available as the existing entry path. Preserve the candidate across sign-in without exposing order details before authentication.

Once the consumer-owner server contract is approved, use authenticated GET by encoded order ID. Do not POST orders, confirm orders, create/recreate intents, call Stripe confirm/retrieve to drive financial state, or retry purchasing on mount, refresh, auth restoration, status retry or request failure. Recovery must not require the public event still being on sale. Any future explicit new purchase remains separate from recovery.

| Authoritative result | Recovery behavior |
| --- | --- |
| `status=PAID`, `paymentStatus=SUCCEEDED` | Show confirmed order and server-authorized ticket/receipt details; no mutation. |
| `status=PENDING`, payment PENDING/PROCESSING | Show awaiting server confirmation; explicit read-only status retry, no duplicate purchase or claim of success. |
| `paymentStatus=FAILED` | Show payment failed/not confirmed; status retry only in this slice, no automatic financial action. FAILED is a PaymentStatus, not an OrderStatus. |
| CANCELLED, REFUNDED, PARTIALLY_REFUNDED or inconsistent status combination | Show server status conservatively, no success/ticket entitlement inference and no late-paid policy decision. |
| 401/session expired | Require sign-in through existing session handling; retain candidate and disclose no order details. |
| 403, or 404 for nonexistent/not-owned | Neutral unavailable-order state without distinguishing ownership or exposing details; no mutation. |
| Network/5xx | Unconfirmed/retryable lookup error, never payment failure/success inferred from transport. |

No pending timeout, inventory expiry, refund, or paid-after-expiry policy is established here. Task 73 remains unchanged.

## Concrete follow-up acceptance plan

Using the existing CheckoutPage mocks, stub the reviewed authenticated GET contract for pending, paid, failed, 401, 403/404, network error and missing ID. Assert rendered states, identity changes, query changes and stale-response cancellation. Assert zero purchase/intent/confirm calls across remount, reload-equivalent mount, sign-in restoration and manual status retry. Forged Stripe success must not override pending/failed GET; a different buyer's identifier must never render details. Cover terminal/inconsistent server states without financial decisions. Verify ordinary fresh checkout separately.

Backend mocked scope tests must independently verify server-enforced ownership for every permitted consumer identity, same-tenant other buyer and cross-tenant denial, while preserving existing operator behavior on its approved path. Then, only after runtime task 57 is resolved, rehearse authenticated HTTP and Stripe test-mode redirect/webhook sequencing with pending-to-paid recovery. No live Stripe or actual HTTP/payment integration has been verified here.

## Executed verification and limits

- `npm --prefix tdash test -- --run src/test/CheckoutPage.test.jsx`: PASS: 4/4 mocked CheckoutPage tests, including diagnostic return-gap proof.
- Dependencies reused via temporary untracked local `tdash/node_modules` symlink to task-49's existing installation, removed after tests; no install, lockfile, environment or configuration changes.
- `git diff --check`: whitespace check before commit.
- Only this document and the existing mocked checkout test are owned changes. No product source/API/auth/payment changes; no database/services, full build, HTTP integration, live payment, merge, push or deployment. Implementation awaits independent contract review and consumer-owner dependency; task 57 still blocks runtime proof.
