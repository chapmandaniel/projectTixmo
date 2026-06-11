# Market Demo Data

Use this when Tixmo needs a resettable sales demo organization for local walkthroughs, screenshots, QA, or a production-like staging demo.

## Commands

From the repo root:

```bash
npm run demo:market
npm run demo:market:verify
npm run demo:market:reset
```

From the API package:

```bash
npm --prefix tixmoapi2 run demo:market
npm --prefix tixmoapi2 run demo:market:verify
npm --prefix tixmoapi2 run demo:market:reset
```

`demo:market` resets only the scoped demo organization and then reseeds it.

## Safety Guard

The script refuses to run when:

- `NODE_ENV=production`
- `DATABASE_URL` does not look local

To intentionally seed a production-like staging database, set:

```bash
ALLOW_MARKET_DEMO_DATA_IN_PRODUCTION=true
```

Do not use that override for a real customer production database.

## Production-Like Smoke

After seeding a staging or production-like environment, verify the read-only demo path from the repo root:

```bash
TIXMO_API_BASE_URL=https://api.example.com \
TIXMO_DASHBOARD_URL=https://app.example.com \
npm run smoke:external
```

To save a JSON evidence artifact:

```bash
TIXMO_API_BASE_URL=https://api.example.com \
TIXMO_DASHBOARD_URL=https://app.example.com \
TIXMO_SMOKE_EVIDENCE_PATH=docs/external-smoke-runs/staging-smoke.json \
npm run smoke:external
```

This checks health endpoints, demo operator login, events, public checkout event detail, reports, scanner auth/sync, public review token, public asset share token, and dashboard public routes. It does not create orders or change launch records beyond login/scanner last-used timestamps.

CI evidence can be captured through `.github/workflows/external-smoke-evidence.yml`. Configure the staging or production API/dashboard URL secrets, run the workflow manually, then attach the uploaded JSON artifact to the launch evidence packet.

## Seeded Login

- Organization: `Tixmo Market Demo`
- Slug: `tixmo-market-demo`
- Owner: `demo.admin@tixmo.test`
- Password: `DemoPass123!`

All seeded demo users use the same password.

## Seeded Coverage

The market demo org includes:

- Two venues.
- Four events: two on sale, one completed, one published future event.
- Ticket types, VIP tiers, and promo code `MARKETDEMO15`.
- Paid sales history, one pending order, tickets, Stripe-style payment intent IDs, and webhook event records.
- Completed-event scan logs for attendance reporting.
- Active scanner setup data.
- Brand and event asset folders, assets, and an active share token.
- One approval request with a reviewer, comment, decision, revision, and approval asset.
- Operator tasks, task comment, waitlist entries, notifications, and notification preferences.

## Useful Demo Tokens

- Asset folder share token: `market-demo-share-token`
- Approval reviewer token: `market-demo-approval-token`
- Harborlight scanner API key: `sk_scanner_market_demo_main_gate`

These are deterministic so external share/review/scanner walkthroughs can be reset and repeated.
