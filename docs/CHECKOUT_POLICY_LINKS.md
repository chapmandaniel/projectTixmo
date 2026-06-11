# Checkout Policy Links

Status: runtime configuration support and the buyer checkout route are ready. Final launch evidence remains open until approved public URLs and Stripe credentials are configured on a production-like domain.

## Decision

Before live ticket sales, the customer checkout must link to the approved:

- Terms of Service.
- Refund Policy.
- Privacy Policy.

Organizer Terms should be linked from organizer onboarding/settings, not from attendee checkout unless counsel requires it.

## Runtime Configuration

Dashboard runtime config supports these public URLs and keys:

| Runtime key | Environment variable | Required before live sales |
| --- | --- | --- |
| `privacyPolicyUrl` | `VITE_PRIVACY_POLICY_URL` | Yes |
| `termsUrl` | `VITE_TERMS_URL` | Yes |
| `refundPolicyUrl` | `VITE_REFUND_POLICY_URL` | Yes |
| `organizerTermsUrl` | `VITE_ORGANIZER_TERMS_URL` | Organizer onboarding/settings |
| `stripePublishableKey` | `VITE_STRIPE_PUBLISHABLE_KEY` | Yes for paid checkout |
| `paymentCurrency` | `VITE_PAYMENT_CURRENCY` | Yes, must match API `PAYMENT_CURRENCY` |

The Docker entrypoint writes these into `runtime-config.js` alongside `apiUrl`.

Code source:

- `tdash/src/lib/runtimeConfig.js`
- `tdash/docker-entrypoint.d/40-runtime-config.sh`
- `tdash/src/test/runtimeConfig.test.jsx`
- `scripts/local-checkout-smoke.mjs`
- `scripts/check-checkout-runtime-config.mjs`

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
