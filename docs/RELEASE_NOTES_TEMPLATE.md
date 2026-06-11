# Tixmo Release Notes Template

Use this for beta releases, staging deploys, and production launch notes. Keep the notes short enough for operators to read, but specific enough that support can debug issues by release.

## Release

- Version or commit SHA:
- Date:
- Environment: staging / production / demo
- Release owner:
- Support owner:
- Rollback owner:
- Launch evidence ticket:

## Summary

One-paragraph description of what changed and why this release matters.

## Included Changes

### Operator Workflow

- [ ] Organization/account:
- [ ] Venue/event setup:
- [ ] Ticket types/tiers:
- [ ] Orders/attendees:
- [ ] Analytics/reports:

### Checkout And Payments

- [ ] Order lifecycle:
- [ ] Payment intent/webhook:
- [ ] Refund/chargeback:
- [ ] Email:

### Entry And Scanner

- [ ] Scanner registration:
- [ ] Scanner auth/sync:
- [ ] Online scan:
- [ ] Offline scan:
- [ ] Scan logs:

### Approvals And Assets

- [ ] Approval requests:
- [ ] External review:
- [ ] Asset library:
- [ ] Shared folders:

### Security, Reliability, And Support

- [ ] Auth/session:
- [ ] Role/tenant boundaries:
- [ ] Rate limits:
- [ ] Monitoring/alerts:
- [ ] Support/admin playbooks:

## Out Of Scope

- Social:
- ProMo:
- QuantMo:
- Marketing Hub:
- Resale:
- Other:

## Required Verification

- [ ] `npm run verify:market`
- [ ] `npm --prefix tixmoapi2 run build`
- [ ] `npm --prefix tdash run build`
- [ ] `npm --prefix tdash test -- --run`
- [ ] `npm --prefix tdash run design:guard`
- [ ] `npm run verify:api`
- [ ] Production/staging smoke test from `docs/PRODUCTION_LAUNCH_CHECKLIST.md`
- [ ] Scanner real-device field test from `docs/SCANNER_SETUP_AND_FIELD_TEST.md`
- [ ] External review link test on production-like domain
- [ ] Shared asset link test on production-like domain
- [ ] Backup/rollback evidence from `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md`

## Known Risks

- Risk:
  - Impact:
  - Mitigation:
  - Owner:

## Rollback Plan

- Previous known-good release:
- Database migration rollback note:
- Backup ID/timestamp:
- Rollback command or platform action:
- Verification after rollback:

## Customer/Operator Notes

- What operators should know:
- What support should watch:
- What changed in onboarding:
- Required customer action:
