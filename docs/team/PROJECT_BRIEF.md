# Tixmo project brief

Inspected 2026-10-19 at baseline `2f3a055` (local `main`).
Repository: `https://github.com/chapmandaniel/projectTixmo`.

## Product and current priority

Tixmo is an event ticketing and operator platform. The existing launch
checklist defines V1: organization accounts, venues, events, ticket types,
orders/payments, attendees, scanner validation, approvals and asset sharing.
Default priority is making this documented path verifiably ready, not adding
speculative features. Daniel can override priorities with board tasks.

Social, ProMo, QuantMo, Marketing Hub, resale, live GA4 Data API analytics,
and broad AI claims are deferred or excluded from V1 messaging by the
existing `docs/PRODUCTION_LAUNCH_CHECKLIST.md`.

## Technical map

| Area | Stack | Source of guidance |
| --- | --- | --- |
| Dashboard | React 18, Vite, Tailwind, Vitest | `tdash/docs/dashboard-design-system.md` |
| API | Express, TypeScript, Prisma, Jest | `tixmoapi2/MASTER_DOCUMENTATION.md` |
| Data | Postgres, Redis, object storage | API schema, compose config, backup runbook |
| Payments | Stripe intent/webhook lifecycle | launch checklist and checkout docs |
| Gates | root Node scripts and GitHub Actions | `docs/LOCAL_MARKET_READINESS_GATES.md` |

## Known evidence limitations

The local checkout was clean at inspection. Dependencies and current test
health have not yet been verified. Documentation contains historical passing
results from June and earlier; these are not evidence for today's runtime.
No production/staging deployment, credentials, current CI state, scanner
field test, legal signoff, or backup restoration has been verified by setup.

First assignments therefore establish an architecture/readiness audit, a
safe reproducible verification baseline, and an environment/release inventory.
The PM should turn evidenced gaps into bounded board tasks, not check off
launch requirements from documentation alone.

## Existing authoritative launch inputs

- `docs/PRODUCTION_LAUNCH_CHECKLIST.md`
- `docs/LOCAL_MARKET_READINESS_GATES.md`
- `docs/ROLE_ACTION_PERMISSION_MATRIX.md`
- `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md`
- `docs/SCANNER_SETUP_AND_FIELD_TEST.md`
- `docs/BETA_SUPPORT_ADMIN_PLAYBOOK.md`
- `docs/REPO_CLEANUP_FOLLOWUPS.md`

Product, business policy, live payments, release approval and spend authority
remain with Daniel. The PM prepares evidence and actionable decisions.
