# Public Route Screenshot Evidence

Use this when the launch ticket needs logged-out/private-browser proof for public checkout, review, and shared-asset routes.

## Local Capture

Start the local API and dashboard, seed the market demo, then run:

```bash
npm run demo:market
npm run evidence:public-routes
```

Default targets:

- Dashboard: `http://127.0.0.1:5173`
- Checkout: `/checkout/market-demo-harborlight-summer-session`
- Review: `/review/market-demo-approval-token`
- Shared assets: `/assets/shared/market-demo-share-token`

Output:

- Screenshots: `docs/public-route-screenshots/`
- Manifest: `docs/public-route-screenshots/public-route-evidence.json`

The command opens each route in a fresh headless Chrome profile, so it does not reuse dashboard login state. It captures desktop and mobile screenshots and verifies stable page text before writing a passing manifest.

## Staging Or Production-Like Capture

Run the same command against the deployed dashboard:

```bash
TIXMO_DASHBOARD_URL=https://app.example.com \
npm run evidence:public-routes
```

Optional overrides:

```bash
TIXMO_SMOKE_CHECKOUT_SLUG=event-slug \
TIXMO_SMOKE_REVIEW_TOKEN=review-token \
TIXMO_SMOKE_SHARE_TOKEN=share-token \
TIXMO_PUBLIC_CHECKOUT_TEXT="Expected checkout page text" \
TIXMO_PUBLIC_REVIEW_TEXT="Expected review page text" \
TIXMO_PUBLIC_SHARE_TEXT="Expected shared asset page text" \
TIXMO_PUBLIC_EVIDENCE_PATH=docs/public-route-screenshots/staging \
npm run evidence:public-routes
```

For final policy evidence, require visible policy links:

```bash
TIXMO_PUBLIC_EVIDENCE_REQUIRE_POLICIES=true \
TIXMO_DASHBOARD_URL=https://app.example.com \
npm run evidence:public-routes
```

Do not mark checkout policy-link evidence complete until the production-like capture shows approved Terms, Refund Policy, and Privacy Policy links before payment.

## CI Evidence

Manual GitHub workflow:

- Workflow: `.github/workflows/public-route-screenshot-evidence.yml`
- Trigger: manual `workflow_dispatch`
- Targets: `staging`, `production`, or `both`
- Artifact: `tixmo-public-route-screenshot-evidence-<target>-<run_id>`

Required secrets:

- `STAGING_DASHBOARD_URL` for staging captures.
- `PRODUCTION_DASHBOARD_URL` for production captures.

Optional overrides:

- `STAGING_SMOKE_CHECKOUT_SLUG`
- `STAGING_SMOKE_REVIEW_TOKEN`
- `STAGING_SMOKE_SHARE_TOKEN`
- `STAGING_PUBLIC_CHECKOUT_TEXT`
- `STAGING_PUBLIC_REVIEW_TEXT`
- `STAGING_PUBLIC_SHARE_TEXT`
- `PRODUCTION_SMOKE_CHECKOUT_SLUG`
- `PRODUCTION_SMOKE_REVIEW_TOKEN`
- `PRODUCTION_SMOKE_SHARE_TOKEN`
- `PRODUCTION_PUBLIC_CHECKOUT_TEXT`
- `PRODUCTION_PUBLIC_REVIEW_TEXT`
- `PRODUCTION_PUBLIC_SHARE_TEXT`

Run with `require_policy_links=true` only after approved policy URLs are configured on the target dashboard.
