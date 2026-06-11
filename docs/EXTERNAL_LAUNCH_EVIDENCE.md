# Tixmo External Launch Evidence Packet

Use this when local work is green and the remaining question is whether the target environment is ready. Do not mark market launch ready until each evidence item is attached to the launch ticket or release notes.

Launch ticket templates:

- GitHub issue form: `.github/ISSUE_TEMPLATE/market-launch-evidence.yml`
- Markdown fallback: `docs/MARKET_LAUNCH_EVIDENCE_TICKET_TEMPLATE.md`
- Manual evidence artifact guide: `docs/MANUAL_LAUNCH_EVIDENCE_ARTIFACTS.md`

Local gate before collecting external evidence:

- Run `npm run verify:market`.
- Run `npm run evidence:dependency-audit`.
- Attach the GitHub Actions run from `.github/workflows/market-readiness-local.yml` when available.
- Use `docs/LOCAL_MARKET_READINESS_GATES.md` for the exact command list and limits.
- Run `npm run evidence:status` to see which local and target evidence artifacts are currently present.
- Run `npm run evidence:status:strict` only at go/no-go; it exits non-zero while any evidence gap remains.

Target evidence can be collected from a shell when the target URLs and demo credentials are available:

```bash
TIXMO_API_BASE_URL=https://api.example.com \
TIXMO_DASHBOARD_URL=https://app.example.com \
TIXMO_SMOKE_EVIDENCE_PATH=docs/external-smoke-runs/staging-smoke.json \
npm run smoke:external

TIXMO_DASHBOARD_URL=https://app.example.com \
TIXMO_CHECKOUT_CONFIG_EVIDENCE_PATH=docs/checkout-config-evidence/staging-runtime-config.json \
npm run evidence:checkout-config

TIXMO_DASHBOARD_URL=https://app.example.com \
TIXMO_PUBLIC_EVIDENCE_PATH=docs/public-route-screenshots/staging \
TIXMO_PUBLIC_EVIDENCE_REQUIRE_POLICIES=true \
npm run evidence:public-routes
```

Use the GitHub workflows instead when secrets should stay in GitHub Actions rather than a local shell.

## 1. Staging Or Production-Like Smoke

Runbook: `docs/PRODUCTION_LAUNCH_CHECKLIST.md`

Read-only demo smoke command:

```bash
TIXMO_API_BASE_URL=https://api.example.com \
TIXMO_DASHBOARD_URL=https://app.example.com \
TIXMO_SMOKE_EVIDENCE_PATH=docs/external-smoke-runs/staging-smoke.json \
npm run smoke:external
```

This command expects the target environment to contain the resettable market demo organization from `docs/MARKET_DEMO_DATA.md`. It checks API health, dashboard reachability, demo operator login, events, public checkout event detail with available ticket types, reports, scanner auth/sync, public review token, and public asset share token. It intentionally avoids creating orders, scanning tickets, approving reviews, revoking shares, or mutating event/customer records. Login and scanner auth may update last-used timestamps.

GitHub evidence workflow:

- Workflow: `.github/workflows/external-smoke-evidence.yml`
- Trigger: manual `workflow_dispatch`
- Targets: `staging`, `production`, or `both`
- Artifact: `tixmo-external-smoke-evidence-<target>-<run_id>`

Public route screenshot workflow:

- Workflow: `.github/workflows/public-route-screenshot-evidence.yml`
- Trigger: manual `workflow_dispatch`
- Targets: `staging`, `production`, or `both`
- Artifact: `tixmo-public-route-screenshot-evidence-<target>-<run_id>`
- Use `require_policy_links=true` only after approved checkout policy links are configured.

Checkout runtime-config workflow:

- Workflow: `.github/workflows/checkout-runtime-config-evidence.yml`
- Trigger: manual `workflow_dispatch`
- Targets: `staging`, `production`, or `both`
- Artifact: `tixmo-checkout-runtime-config-evidence-<target>-<run_id>`
- Checks served `runtime-config.js` for policy URLs, Stripe publishable key, and payment currency.

Dependency audit workflow:

- Workflow: `.github/workflows/dependency-audit-evidence.yml`
- Trigger: manual `workflow_dispatch`
- Artifact: `dependency-audit-evidence`
- Checks production-only dependency advisories for `tdash` and `tixmoapi2`.

Required secrets for staging:

- `STAGING_API_BASE_URL`
- `STAGING_DASHBOARD_URL`

Optional staging overrides:

- `STAGING_SMOKE_EMAIL`
- `STAGING_SMOKE_PASSWORD`
- `STAGING_SMOKE_REVIEW_TOKEN`
- `STAGING_SMOKE_SHARE_TOKEN`
- `STAGING_SMOKE_SCANNER_KEY`
- `STAGING_SMOKE_CHECKOUT_SLUG`

Required secrets for production:

- `PRODUCTION_API_BASE_URL`
- `PRODUCTION_DASHBOARD_URL`

Optional production overrides:

- `PRODUCTION_SMOKE_EMAIL`
- `PRODUCTION_SMOKE_PASSWORD`
- `PRODUCTION_SMOKE_REVIEW_TOKEN`
- `PRODUCTION_SMOKE_SHARE_TOKEN`
- `PRODUCTION_SMOKE_SCANNER_KEY`
- `PRODUCTION_SMOKE_CHECKOUT_SLUG`

Evidence to capture:

- Target dashboard URL.
- Target API URL.
- Release commit SHA.
- Operator account used.
- Organization ID/name.
- Event ID/name.
- Public checkout event ID/slug/name and available ticket type IDs.
- Order number.
- Stripe PaymentIntent ID.
- Stripe webhook event ID.
- Scanner ID.
- Approval request ID and reviewer token reference.
- Asset folder/share ID and share token reference.
- Screenshot or log for the first passing full smoke.
- JSON output from `npm run smoke:external` when using the seeded market demo org.
- JSON output from `npm run evidence:checkout-config`.
- JSON output from `npm run evidence:dependency-audit`.
- Public route screenshot manifest from `npm run evidence:public-routes`.
- GitHub artifact URL from `.github/workflows/external-smoke-evidence.yml` when using CI evidence.
- GitHub artifact URL from `.github/workflows/checkout-runtime-config-evidence.yml` when using CI config evidence.
- GitHub artifact URL from `.github/workflows/public-route-screenshot-evidence.yml` when using CI screenshot evidence.
- GitHub artifact URL from `.github/workflows/dependency-audit-evidence.yml` when using CI dependency evidence.

Pass condition:

- The full V1 smoke path passes in the target environment: event setup, ticket types, checkout, payment intent, webhook confirmation, orders/attendees visibility, scanner validation, approval review, asset share, and share revocation.
- The read-only demo smoke also passes when the market demo seed is present.

## 2. Real-Device Scanner/Offline Field Test

Runbook: `docs/SCANNER_SETUP_AND_FIELD_TEST.md`

Status artifact: `docs/scanner-field-test-evidence/<staging-or-production>-<date>.json`

Evidence to capture:

- Device type, OS/browser/app, and network mode.
- Scanner name, scanner ID, event ID, and sync timestamp.
- Valid scan result.
- Duplicate scan denial.
- Wrong-event ticket denial.
- Cancelled ticket denial.
- Invalid payload denial.
- Offline scan result and upload result.
- Revocation result.
- Replacement scanner result.

Pass condition:

- Gate lead can authenticate, sync, scan, handle duplicate/invalid cases, continue through an approved offline scenario, upload offline scans, and revoke/replace a scanner.

## 3. External Reviewer Production-Like Flow

Runbook: `docs/PRODUCTION_LAUNCH_CHECKLIST.md` Section 7

Status artifact: `docs/external-review-share-evidence/<staging-or-production>-<date>.json`

Evidence to capture:

- Production-like dashboard origin.
- Approval request ID/title.
- Reviewer email/name.
- Token reference, not raw token.
- Logged-out/private browser screenshot.
- Comment or decision submitted.
- Dashboard status update screenshot.
- Revocation or expiry behavior when tested.

Pass condition:

- Reviewer can open the link without dashboard auth, review the asset, submit a decision/comment, and the dashboard reflects the review state.

## 4. Backup And Migration Rollback

Runbook: `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md`

Status artifact: `docs/backup-rollback-evidence/<staging-or-production>-<date>.json`

Evidence to capture:

- Scheduled backup setting and latest successful backup timestamp.
- Manual pre-migration backup ID/timestamp.
- Migration command and release SHA.
- Restore target database/service.
- Restore verification query or smoke result.
- Named rollback owner.
- Decision timestamp for go/no-go.

Pass condition:

- A backup exists before migration, restore is tested outside production, and the team can name the person responsible for rollback during the launch window.

## 5. Policy Approval

Runbook: `docs/POLICY_PUBLICATION_CHECKLIST.md`

Status artifact: `docs/policy-approval-evidence/<staging-or-production>-<date>.json`

Evidence to capture:

- Approved Privacy Policy URL or artifact.
- Approved Terms URL or artifact.
- Approved Refund Policy URL or artifact.
- Approved Organizer Terms URL or artifact.
- Approved Data Retention notes.
- Legal/payment/support/security approver names.
- Checkout screenshot showing Terms/Refund links.
- Production-like `/checkout/<event-slug>` screenshot showing Terms, Refund Policy, and Privacy Policy before payment.
- Production-like `npm run evidence:checkout-config` evidence showing policy URLs, Stripe publishable key, and matching payment currency.
- Production-like `npm run evidence:public-routes` manifest with `TIXMO_PUBLIC_EVIDENCE_REQUIRE_POLICIES=true`.
- Production-like `runtime-config.js` evidence showing policy URLs, Stripe publishable key, and payment currency.

Pass condition:

- Policy drafts are either approved and linked publicly or explicitly marked internal-only with a launch owner accepting the risk.

## 6. Uptime And Status Monitoring

Runbook: `docs/UPTIME_STATUS_MONITORING.md`

Status artifact: `docs/uptime-status-evidence/<staging-or-production>-<date>.json`

Evidence to capture:

- Staging API and dashboard monitor targets.
- Production API and dashboard monitor targets.
- GitHub Actions secret names or hosted monitor configuration.
- Passing manual monitor run URL.
- Passing scheduled monitor run URL.
- Alert destination.
- Sentry test event URL or ID.

Pass condition:

- API and dashboard status checks are configured, have passed on a schedule, and notify the launch/support owner on failure.

## Go / No-Go Summary

Ready for market launch only when:

- [ ] Staging/production-like full V1 smoke passes.
- [ ] Real-device scanner/offline field test passes.
- [ ] External reviewer flow passes on production-like domain.
- [ ] Backup/restore/rollback evidence is attached.
- [ ] Policy approval/publication evidence is attached.
- [ ] Uptime/status monitoring has a passing scheduled run and alert route.
- [ ] `npm run evidence:status:strict` passes with zero open evidence gaps.
