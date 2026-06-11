# Tixmo Data Retention Notes

Status: launch draft for legal and operations review  
Owner: [DATA_RETENTION_OWNER]  
Contact: [PRIVACY_CONTACT_EMAIL]  

Use this as the launch retention schedule behind the Privacy Policy. Final values must be reviewed against legal, tax, accounting, payment, chargeback, fraud, backup, and customer-contract requirements before publication.

## Retention Principles

- Keep data only as long as needed for product operation, legal obligations, tax/accounting, payment disputes, fraud prevention, support, security, backups, and auditability.
- Retain payment, order, ticket, scan, refund, and chargeback records long enough to handle disputes and required financial records.
- Delete, anonymize, or aggregate data when detailed personal information is no longer needed.
- Treat scanner keys, public review tokens, shared asset tokens, JWT/session secrets, and raw QR payloads as credentials.
- Do not store full card numbers.

## Proposed Schedule

| Data category | Examples | Proposed retention | Notes |
| --- | --- | --- | --- |
| Account and organization records | Users, roles, permissions, org membership, profile data | Active account life plus 3 years | Retain longer when tied to paid orders, disputes, fraud, or legal holds. |
| Event records | Venues, events, ticket types, tiers, capacity, status | Active event life plus 7 years | Supports financial history, attendee support, and organizer reporting. |
| Order and payment records | Orders, tickets, PaymentIntent IDs, webhook event IDs, refunds, chargebacks | 7 years | Align with tax/accounting and dispute evidence; verify jurisdiction-specific rules. |
| Attendee ticket records | Customer email/name when collected, ticket IDs, QR references, ticket status | Event life plus 7 years | Needed for entry disputes, refunds, chargebacks, and organizer reports. |
| Scanner records | Scanner registration, status, device ID, scan logs, offline uploads | Event life plus 2 years | Consider longer retention for chargeback/fraud-heavy events. |
| Approval records | Requests, reviewers, comments, decisions, revision metadata | Active org life plus 3 years | Tokens should expire or be revoked earlier. |
| Asset library records | Folders, files, metadata, storage keys, share records | Active org life plus 3 years | Delete assets sooner when the organizer requests deletion and no legal hold applies. |
| Public-token records | Review tokens, share tokens, expiry/revocation state | Token life plus 1 year | Preserve token reference hashes and audit events; avoid storing raw tokens in tickets/logs. |
| Support records | Support tickets, repair notes, incident evidence | 3 years | Payment/chargeback/legal incidents may need 7 years. |
| Security logs | Auth logs, API logs, rate-limit data, Sentry events | 90 days to 1 year | Keep high-risk incident records longer under legal/security hold. |
| Backups | Database/object-storage backups | 30 to 90 days rolling | Final value depends on provider settings and recovery objectives. |
| Marketing contacts | Leads, opt-ins, unsubscribe state | Until opt-out plus suppression record | Only applicable if marketing email is enabled. |

## Deletion and Access Requests

When a user requests deletion or access:

1. Verify requester identity.
2. Identify whether the user is an organizer staff member, attendee, reviewer, scanner operator, or asset recipient.
3. Export or delete data that can be handled without harming legal, payment, fraud, tax, security, backup, or dispute obligations.
4. Keep a minimal record of request handling when required.
5. Tell the requester when retained records cannot be deleted immediately and why.

## Backups

Production backup and restore evidence is managed in `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md`.

Backup deletion is not immediate deletion from all systems. Published privacy copy should explain that deleted records may remain in backups until those backups expire, unless immediate deletion is required and operationally supported.

## Legal Holds

Suspend deletion for records related to active disputes, chargebacks, fraud investigations, security incidents, legal requests, tax inquiries, or regulator inquiries.

## Open Decisions Before Publication

- [ ] Confirm final retention periods with counsel.
- [ ] Confirm whether organizer contracts require custom retention windows.
- [ ] Confirm backup retention in the production database provider.
- [ ] Confirm object-storage lifecycle rules.
- [ ] Confirm Sentry/log retention settings.
- [ ] Confirm Stripe dashboard retention and data-export handling.
- [ ] Confirm whether attendee deletion requests should be routed through organizers, Tixmo, or both.
- [ ] Confirm whether a DPA/subprocessor page is needed.

