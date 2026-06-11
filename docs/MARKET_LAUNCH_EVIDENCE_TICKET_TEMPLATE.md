# Market Launch Evidence Ticket Template

Use this when GitHub issue forms are not available. The GitHub issue form version lives at `.github/ISSUE_TEMPLATE/market-launch-evidence.yml`.

## Release

- Environment:
- Release commit SHA:
- Dashboard URL:
- API URL:
- Release owner:
- Support owner:
- Rollback owner:

## Local And CI Gates

- [ ] `npm run verify:market` passed.
- [ ] `npm run evidence:dependency-audit` passed.
- [ ] `.github/workflows/market-readiness-local.yml` passed.
- [ ] `.github/workflows/dependency-audit-evidence.yml` uploaded JSON evidence.
- [ ] `npm run evidence:status` reviewed for missing target artifacts.
- [ ] `npm run evidence:status:strict` passes for go/no-go.
- [ ] Manual evidence artifact paths follow `docs/MANUAL_LAUNCH_EVIDENCE_ARTIFACTS.md`.

Evidence:

- Local output or CI run URL:
- Dependency audit artifact:
- Commit SHA:

## Staging Or Production-Like V1 Smoke

- [ ] Full V1 smoke from `docs/PRODUCTION_LAUNCH_CHECKLIST.md` passed.
- [ ] `npm run smoke:external` passed when using seeded demo data.
- [ ] `.github/workflows/external-smoke-evidence.yml` uploaded JSON evidence.
- [ ] `.github/workflows/checkout-runtime-config-evidence.yml` uploaded JSON evidence.
- [ ] `.github/workflows/public-route-screenshot-evidence.yml` uploaded screenshot evidence.

Evidence:

- Operator account:
- Organization ID/name:
- Event ID/name:
- Order number:
- Stripe PaymentIntent ID:
- Stripe webhook event ID:
- Scanner ID:
- Approval request ID/token reference:
- Asset folder/share ID/token reference:
- Screenshots/logs:
- Scanner field-test JSON artifact:

## Real-Device Scanner/Offline Field Test

- [ ] Valid scan passed.
- [ ] Duplicate scan denied clearly.
- [ ] Wrong-event ticket denied.
- [ ] Cancelled ticket denied.
- [ ] Invalid payload denied.
- [ ] Offline scan path tested.
- [ ] Offline upload tested.
- [ ] Revocation/replacement tested.

Evidence:

- Device/OS/browser/app:
- Scanner ID/name:
- Event ID/name:
- Sync timestamp:
- Screenshots/logs:
- External reviewer/share JSON artifact:

## External Reviewer And Shared Asset Flow

- [ ] External review link opened logged out.
- [ ] Reviewer comment or decision submitted.
- [ ] Dashboard reflected reviewer action.
- [ ] Shared asset link opened logged out.
- [ ] Shared asset revocation or expiry behavior verified.

Evidence:

- Approval request ID/title:
- Reviewer token reference, not raw token:
- Asset share ID/token reference, not raw token:
- Screenshots/logs:
- Backup/rollback JSON artifact:

## Backup, Migration, And Rollback

- [ ] Scheduled backups enabled.
- [ ] Manual pre-migration backup taken.
- [ ] Migration command and SHA recorded.
- [ ] Restore tested outside production.
- [ ] Rollback owner named.

Evidence:

- Latest scheduled backup timestamp:
- Manual backup ID/timestamp:
- Restore target:
- Rollback owner:
- Screenshots/logs:

## Policy Approval And Publication

- [ ] Privacy Policy approved.
- [ ] Terms approved.
- [ ] Refund Policy approved.
- [ ] Organizer Terms approved.
- [ ] Data Retention notes approved.
- [ ] Checkout links to Terms and Refund Policy.
- [ ] Runtime config includes approved Privacy, Terms, and Refund URLs.
- [ ] Runtime config includes Stripe publishable key for paid checkout.
- [ ] Runtime config payment currency matches API `PAYMENT_CURRENCY`.
- [ ] `/checkout/<event-slug>` blocks checkout if policy URLs or Stripe publishable key are missing.

Evidence:

- Privacy Policy URL/artifact:
- Terms URL/artifact:
- Refund Policy URL/artifact:
- Organizer Terms URL/artifact:
- Checkout policy-link screenshot:
- Checkout Stripe PaymentElement screenshot:
- Checkout runtime-config evidence:
- Public route screenshot manifest:
- Policy approval JSON artifact:
- Approvers:

## Uptime, Status, And Sentry Monitoring

- [ ] API/dashboard status checks configured.
- [ ] Manual monitor run passed.
- [ ] Scheduled monitor run passed.
- [ ] Failed monitor alerts route to launch/support owner.
- [ ] Sentry staging test event received with release and alert-route tags.

Evidence:

- Monitor targets:
- Manual run URL:
- Scheduled run URL:
- Alert destination:
- Sentry test event:
- Uptime/status JSON artifact:

## Go / No-Go

- [ ] Go
- [ ] No-go
- [ ] `npm run evidence:status:strict` passed with zero open evidence gaps.

Decision owner:

Decision timestamp:

Notes:
