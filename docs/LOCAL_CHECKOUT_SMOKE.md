# Local Checkout Smoke

Use this after Postgres, Redis, the API, and the dashboard are running locally.

## Setup

```bash
npm run demo:market
npm --prefix tixmoapi2 run dev
npm --prefix tdash run dev
```

Open the seeded buyer checkout route:

```text
http://127.0.0.1:5173/checkout/market-demo-harborlight-summer-session
```

From the operator side, Event Command Center should expose copy/open checkout-link actions for the seeded on-sale event.

## API Smoke

```bash
npm run smoke:checkout:local
```

The smoke:

- Loads the seeded public event.
- Registers a temporary buyer.
- Creates a one-ticket pending order.
- Calls payment-intent creation.
- Cancels the pending order to release inventory.

Public event detail is intentionally loaded fresh from the database for checkout. Do not reintroduce Redis caching around `getPublicEventBySlug()` unless ticket-type and event mutation invalidation is implemented and covered by tests.

With placeholder local Stripe keys, payment-intent creation should return `503` with:

```text
Payment service is not configured (Missing Stripe Key).
```

With real local Stripe test keys, payment-intent creation may return `200`; the script still cancels the pending order and does not submit a card payment.

## Evidence

Capture these before checking off production-like checkout evidence:

- `/checkout/<event-slug>` screenshot showing Terms, Refund Policy, and Privacy Policy before payment.
- Event Command Center screenshot showing the enabled checkout copy/open actions for the same event.
- Stripe PaymentElement screenshot after creating a test PaymentIntent.
- Served `runtime-config.js` showing policy URLs, Stripe publishable key, and payment currency.
- API `PAYMENT_CURRENCY` matching dashboard `paymentCurrency`.

Use `docs/PUBLIC_ROUTE_SCREENSHOT_EVIDENCE.md` and `npm run evidence:public-routes` for repeatable logged-out checkout, review, and shared-asset screenshots.
