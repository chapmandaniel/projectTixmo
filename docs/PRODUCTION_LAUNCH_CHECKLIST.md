# Tixmo Production Launch Checklist

Use this checklist for staging and production releases. Do not treat a deploy as market-ready until every required item is either checked or explicitly marked out of V1 scope with an owner and follow-up date.

Open a launch evidence ticket before running this checklist:

- GitHub issue form: `.github/ISSUE_TEMPLATE/market-launch-evidence.yml`
- Markdown fallback: `docs/MARKET_LAUNCH_EVIDENCE_TICKET_TEMPLATE.md`

## 1. Release Scope

- [ ] V1 scope is limited to the core operator workflow: organization account, venue, event, ticket types, order/payment, orders/attendees, scanner validation, approvals, and asset sharing.
- [ ] Social, ProMo, QuantMo, Marketing Hub, resale, GA4 Data API traffic analytics, and broad AI claims are hidden, labelled post-V1, or excluded from launch messaging.
- [ ] GA4 traffic analytics follows `docs/GA4_TRAFFIC_ANALYTICS_SCOPE.md`: readiness/configuration only, with live Data API metrics deferred from V1.
- [ ] A release branch or commit SHA is selected.
- [ ] Unrelated local work is not included in the release.
- [ ] Public policy drafts are reviewed and approved for publication:
  - `docs/policies/PRIVACY_POLICY_DRAFT.md`
  - `docs/policies/TERMS_OF_SERVICE_DRAFT.md`
  - `docs/policies/REFUND_POLICY_DRAFT.md`
  - `docs/policies/ORGANIZER_TERMS_DRAFT.md`
  - `docs/policies/DATA_RETENTION_NOTES.md`
  - `docs/POLICY_PUBLICATION_CHECKLIST.md`

## 2. Required Services

- [ ] API service is deployed and reachable.
- [ ] Dashboard service/static deployment is deployed and reachable.
- [ ] Postgres is provisioned.
- [ ] Redis is provisioned.
- [ ] Object storage/S3-compatible bucket is provisioned.
- [ ] Stripe account and webhook endpoint are configured.
- [ ] Email provider is configured.
- [ ] Sentry or equivalent error monitoring is configured.
- [ ] Domain and TLS certificates are active for dashboard and API.

## 3. API Environment

Required:

- [ ] `NODE_ENV=production`
- [ ] `SERVICE_NAME=tixmo-api`
- [ ] `PORT`
- [ ] `API_VERSION=v1`
- [ ] `CLIENT_URL`
- [ ] `DATABASE_URL`
- [ ] `REDIS_URL`
- [ ] `JWT_SECRET`
- [ ] `JWT_REFRESH_SECRET`
- [ ] `SESSION_SECRET`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `PAYMENT_CURRENCY`
- [ ] `POSTMARK_SERVER_TOKEN` or SMTP credentials
- [ ] `FROM_EMAIL`
- [ ] `FROM_NAME`
- [ ] `S3_ENDPOINT` or AWS endpoint settings
- [ ] `S3_ACCESS_KEY_ID` or `AWS_ACCESS_KEY_ID`
- [ ] `S3_SECRET_ACCESS_KEY` or `AWS_SECRET_ACCESS_KEY`
- [ ] `S3_BUCKET_NAME` or `AWS_S3_BUCKET`
- [ ] `S3_REGION` or `AWS_REGION`
- [ ] `SENTRY_DSN`
- [ ] `SENTRY_ENVIRONMENT`
- [ ] `SENTRY_RELEASE` or deployment-provided `RAILWAY_GIT_COMMIT_SHA`
- [ ] `SENTRY_ALERT_ROUTE`
- [ ] `SENTRY_TRACES_SAMPLE_RATE`
- [ ] `RELEASE`
- [ ] `RATE_LIMIT_WINDOW_MS`
- [ ] `RATE_LIMIT_READ_MAX`
- [ ] `RATE_LIMIT_WRITE_MAX`
- [ ] `ADMIN_EMAIL`

Validation:

- [ ] Secrets are not placeholder values.
- [ ] JWT, refresh, and session secrets are unique and high entropy.
- [ ] `CLIENT_URL` points to the production dashboard origin.
- [ ] CORS trusted-origin logic allows the dashboard domain and rejects unrelated origins.
- [ ] `PAYMENT_CURRENCY` matches the intended launch currency.
- [ ] API boot fails if required production env vars are missing.

## 4. Dashboard Runtime Config

- [ ] `VITE_API_URL` or runtime config points to `/api/v1` or the production API URL.
- [ ] Dashboard served `runtime-config.js` contains the expected API URL.
- [ ] Dashboard login can reach the production API.
- [ ] External review routes work without dashboard authentication.
- [ ] Shared asset folder routes work without dashboard authentication.
- [ ] Dashboard served `runtime-config.js` contains approved `privacyPolicyUrl`, `termsUrl`, and `refundPolicyUrl` values before live checkout.
- [ ] Dashboard served `runtime-config.js` contains `stripePublishableKey` before paid checkout.
- [ ] Dashboard served `runtime-config.js` contains `paymentCurrency` matching API `PAYMENT_CURRENCY`.
- [ ] `npm run evidence:checkout-config` passes against the production-like dashboard and its JSON artifact is attached to the launch ticket.

## 5. Database And Migrations

- Runbook: `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md`

- [ ] Production database backup is taken before migration.
- [ ] Migration command is documented and run once: `npm --prefix tixmoapi2 run migrate`.
- [ ] Prisma client generation is part of build or deploy.
- [ ] New migrations are present and ordered.
- [ ] Rollback plan exists for schema and deploy, with evidence attached using `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md`.
- [ ] Seed/demo scripts are not run against production unless intentionally scoped.

## 6. Verification Gates

Local or CI:

- [ ] `npm run verify:market`
- [ ] `npm --prefix tixmoapi2 run build`
- [ ] `npm --prefix tdash run build`
- [ ] `npm --prefix tdash test -- --run`
- [ ] `npm --prefix tdash run design:guard`
- [ ] `npm run verify:api`

Notes:

- `npm run verify:market` is the one-command local market gate documented in `docs/LOCAL_MARKET_READINESS_GATES.md`.
- `npm run verify:api` starts/checks Postgres and Redis, applies Prisma schema for test verification, and runs the API suite.
- `npm run smoke:checkout:local` is the local checkout rehearsal documented in `docs/LOCAL_CHECKOUT_SMOKE.md`.
- If Docker uses Colima and verification fails before tests, repair Colima/Docker before treating API verification as complete.

## 7. V1 Smoke Test

Run this against staging or a production-like environment:

- [ ] Optional read-only seeded demo smoke passes: `npm run smoke:external`
- [ ] Optional CI evidence workflow passes and uploads JSON artifact: `.github/workflows/external-smoke-evidence.yml`
- [ ] Open dashboard domain.
- [ ] Register or sign in as an operator.
- [ ] Confirm operator belongs to the expected organization.
- [ ] Create a venue.
- [ ] Create an event.
- [ ] Create at least two ticket types.
- [ ] Event Command Center exposes enabled copy/open checkout-link actions after publish/on-sale.
- [ ] Open `/checkout/<event-slug>` in a logged-out/private browser.
- [ ] Confirm `/checkout/<event-slug>` uses current ticket types after ticket edits or demo reseed.
- [ ] Confirm approved Terms, Refund Policy, and Privacy Policy links are visible before payment.
- [ ] Register or sign in as an attendee from checkout.
- [ ] Place a customer order containing both ticket types.
- [ ] Create a Stripe payment intent.
- [ ] Complete test payment.
- [ ] Confirm Stripe webhook marks the order paid exactly once.
- [ ] Confirm ticket inventory moved from available to held to sold correctly.
- [ ] Confirm order confirmation email is sent to the customer.
- [ ] Confirm failed-payment test email goes to the customer email, not the user ID.
- [ ] Confirm order appears in dashboard orders/attendees.
- [ ] Confirm event sales analytics reflect the paid order.
- [ ] Register a scanner.
- [ ] Follow scanner setup and real-device checks in `docs/SCANNER_SETUP_AND_FIELD_TEST.md`.
- [ ] Validate a ticket.
- [ ] Attempt duplicate scan and confirm the UX is clear.
- [ ] Upload an approval asset.
- [ ] Invite an external reviewer.
- [ ] Submit reviewer decision.
- [ ] Upload a brand or event asset.
- [ ] Create an external folder share.
- [ ] Open the share link in a logged-out/private browser.
- [ ] Revoke the share and confirm the link no longer works.

## 8. Payment Safety

- [ ] Payment intent ID is persisted on the order.
- [ ] Stripe webhook event IDs are persisted.
- [ ] Duplicate webhook events are skipped safely.
- [ ] Paid orders are not confirmed twice.
- [ ] Failed payments update payment status and notify the customer email.
- [ ] Admin alert fires if paid order confirmation exhausts retries.
- [ ] Refund/chargeback process is documented.
- [ ] Currency, tax, fee, and payout assumptions are signed off.
- [ ] Checkout links to approved Terms, Refund Policy, and Privacy Policy before purchase, following `docs/CHECKOUT_POLICY_LINKS.md`.
- [ ] Checkout blocks launch when policy URLs or the Stripe publishable key are missing.

## 9. Security And Tenant Boundaries

- [ ] Org-scoped users cannot read or mutate another organization's resources.
- [ ] Global admin behavior is intentionally documented in `docs/ROLE_ACTION_PERMISSION_MATRIX.md`.
- [ ] Team role creation and downgrade behavior is verified.
- [ ] Scanner auth is limited to the intended event/org.
- [ ] External review links expire.
- [ ] Asset share links expire and can be revoked.
- [ ] Signed asset URLs are short-lived.
  - Code-path evidence: `tests/unit/asset-library.service.test.ts` verifies expired/revoked share rejection and fresh URL resolution; `tdash/src/test/AssetLibraryView.test.jsx` verifies create/copy/revoke controls. Re-run on the production-like origin before checking this section off.
- [ ] Rate limits are enabled for auth, reads, and writes.

## 10. Observability And Support

- Runbook: `docs/UPTIME_STATUS_MONITORING.md`

- [ ] Health endpoint returns healthy status.
- [ ] `npm run status:check` passes against staging or production-like URLs.
- [ ] `npm run status:check` passes against production URLs before launch.
- [ ] `.github/workflows/uptime-status.yml` is configured with staging/production URL secrets or an equivalent hosted uptime provider is configured.
- [ ] At least one scheduled status-monitor run has passed.
- [ ] Sentry receives test error in staging.
- [ ] Sentry test event has `service`, `deployment_environment`, `release`, and `alert_route` tags.
- [ ] Sentry alert rule routes `alert_route=<launch owner or team>` to the launch on-call destination.
- [ ] Logs include release identifier.
- [ ] Admin alert email is monitored.
- [ ] Support runbook has been reviewed for the target environment: `docs/BETA_SUPPORT_ADMIN_PLAYBOOK.md` covers failed payment, paid order not confirmed, duplicate scan, lost scanner, org membership repair, asset share revocation, approval link issues, and staging smoke escalation.
- [ ] On-call owner is identified for launch window.

## 11. Go / No-Go

Go only when:

- [ ] Verification gates pass.
- [ ] V1 smoke test passes.
- [ ] Uptime/status monitoring is configured and has a passing scheduled run.
- [ ] Checkout/payment lifecycle passes.
- [ ] Production backup and rollback are confirmed with the evidence listed in `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md`.
- [ ] Unfinished modules are out of the launch path.
- [ ] Support owner has the repair playbooks.
- [ ] Privacy, terms, refund, organizer, data-retention, onboarding, and release-note docs are approved or explicitly marked internal-only for launch.
