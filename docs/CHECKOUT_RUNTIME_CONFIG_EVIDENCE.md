# Checkout Runtime Config Evidence

Use this before paid checkout is enabled on a staging or production-like dashboard.

## Command

```bash
TIXMO_DASHBOARD_URL=https://app.example.com \
TIXMO_EXPECTED_PAYMENT_CURRENCY=usd \
npm run evidence:checkout-config
```

The command fetches `/runtime-config.js`, evaluates it in an isolated JavaScript context, and writes JSON evidence to:

```text
docs/checkout-config-evidence/runtime-config-evidence.json
```

It verifies:

- `privacyPolicyUrl`
- `termsUrl`
- `refundPolicyUrl`
- `stripePublishableKey`
- `paymentCurrency`

Optional checks:

```bash
TIXMO_EXPECTED_API_URL=https://api.example.com/api/v1 \
TIXMO_VERIFY_POLICY_URLS=true \
TIXMO_DASHBOARD_URL=https://app.example.com \
npm run evidence:checkout-config
```

For a local non-launch check where policy URLs and Stripe are intentionally absent:

```bash
TIXMO_REQUIRE_POLICY_URLS=false \
TIXMO_REQUIRE_STRIPE_PUBLISHABLE_KEY=false \
npm run evidence:checkout-config
```

Do not use the non-launch mode as market-readiness evidence.

## CI Evidence

Manual GitHub workflow:

- Workflow: `.github/workflows/checkout-runtime-config-evidence.yml`
- Trigger: manual `workflow_dispatch`
- Targets: `staging`, `production`, or `both`
- Artifact: `tixmo-checkout-runtime-config-evidence-<target>-<run_id>`

Required secrets:

- `STAGING_DASHBOARD_URL` for staging checks.
- `PRODUCTION_DASHBOARD_URL` for production checks.

Optional secrets:

- `STAGING_EXPECTED_API_URL`
- `STAGING_EXPECTED_PAYMENT_CURRENCY`
- `PRODUCTION_EXPECTED_API_URL`
- `PRODUCTION_EXPECTED_PAYMENT_CURRENCY`

Attach the JSON artifact to the launch evidence ticket before enabling live paid checkout.
