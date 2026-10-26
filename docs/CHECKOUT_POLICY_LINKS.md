# Checkout Policy Links

Status: runtime configuration support and the buyer checkout route are ready. Final launch evidence remains open until approved public URLs and Stripe credentials are configured on a production-like domain.

## Decision

Before live ticket sales, the customer checkout must link to the approved:

- Terms of Service.
- Refund Policy.
- Privacy Policy.

Organizer Terms are not part of attendee checkout. `getPolicyLinks()` in `tdash/src/lib/runtimeConfig.js` reads `organizerTermsUrl` from runtime config or `VITE_ORGANIZER_TERMS_URL` and returns it. No page, onboarding flow, or settings screen under `tdash/src` reads that returned value.

## Runtime Configuration

Dashboard runtime config supports these public URLs and keys:

| Runtime key | Environment variable | Required before live sales |
| --- | --- | --- |
| `privacyPolicyUrl` | `VITE_PRIVACY_POLICY_URL` | Yes |
| `termsUrl` | `VITE_TERMS_URL` | Yes |
| `refundPolicyUrl` | `VITE_REFUND_POLICY_URL` | Yes |
| `organizerTermsUrl` | `VITE_ORGANIZER_TERMS_URL` | No. Parsed by `getPolicyLinks()` and not read by any page |
| `stripePublishableKey` | `VITE_STRIPE_PUBLISHABLE_KEY` | Yes for paid checkout |
| `paymentCurrency` | `VITE_PAYMENT_CURRENCY` | Yes, must match API `PAYMENT_CURRENCY` |

The Docker entrypoint writes these into `runtime-config.js` alongside `apiUrl`.

What the dashboard actually reads from `getPolicyLinks()`:

- `tdash/src/pages/CheckoutPage.jsx` reads `privacyPolicyUrl`, `termsUrl`, and `refundPolicyUrl`.
- `tdash/src/pages/EventOnSalePage.jsx` reads `refundPolicyUrl`, `termsUrl`, and `privacyPolicyUrl`.
- `tdash/src/pages/FestivalPage.jsx` reads `termsUrl` and `privacyPolicyUrl`.
- `tdash/src/lib/runtimeConfig.js` reads those keys and also `organizerTermsUrl`. No other file under `tdash/src` reads `organizerTermsUrl`.
- `tdash/docker-entrypoint.d/40-runtime-config.sh` writes all four URL keys into `runtime-config.js`.
- `scripts/check-checkout-runtime-config.mjs` records `organizerTermsUrl`. It requires and fetches only the privacy, terms, and refund URLs.
- `tdash/src/test/runtimeConfig.test.jsx` asserts that `getPolicyLinks()` returns `organizerTermsUrl`.

`scripts/local-checkout-smoke.mjs` does not read policy URLs.

## Checkout Placement Requirement

The buyer checkout UI is available at:

```text
/checkout/:eventSlug
```

Event operators can open or copy this buyer checkout link from Event Command Center for events with public launch statuses: `PUBLISHED`, `ON_SALE`, or `SOLD_OUT`.

The checkout page shows the links before the order/payment action and blocks checkout when Terms, Refund Policy, or Privacy Policy URLs are missing.

Required copy pattern:

```text
By placing this order, you agree to the Terms of Service and acknowledge the Refund Policy and Privacy Policy.
```

Required behavior:

- Terms link opens the approved Terms URL.
- Refund Policy link opens the approved Refund Policy URL.
- Privacy Policy link opens the approved Privacy Policy URL.
- Links are visible before payment confirmation.
- The final payment action is not hidden behind the policy copy.
- If a required URL is missing in production, the checkout should fail closed or block launch in smoke evidence.
- Paid checkout blocks when `stripePublishableKey` is missing.
- Public event detail must not serve stale ticket type IDs into checkout.
- Draft/cancelled/internal events must not expose enabled checkout-link actions in Event Command Center.

## Evidence To Capture

Before launch, attach to the launch evidence ticket:

- Production `runtime-config.js` showing non-empty policy URLs.
- Production `runtime-config.js` showing non-empty `stripePublishableKey` for paid checkout.
- Production `runtime-config.js` showing `paymentCurrency` matches API `PAYMENT_CURRENCY`.
- JSON evidence from `npm run evidence:checkout-config`.
- Checkout screenshot showing policy links before final payment.
- Link-click smoke for Terms, Refund Policy, and Privacy Policy.
- Payment form screenshot after a test order creates a Stripe PaymentIntent.
- Approver names from legal/payment/support/security review.

For local rehearsal, follow `docs/LOCAL_CHECKOUT_SMOKE.md`.
