# Tixmo Privacy Policy Draft

Status: launch draft for legal review  
Effective date: [EFFECTIVE_DATE]  
Legal entity: [LEGAL_ENTITY_NAME]  
Contact: [PRIVACY_CONTACT_EMAIL]  

This draft is intended to be reviewed by counsel before publication. Replace every bracketed placeholder and verify that the final policy matches the exact services, vendors, jurisdictions, and data flows used at launch.

## 1. Scope

This Privacy Policy explains how Tixmo collects, uses, shares, and protects personal information when people use:

- The Tixmo organizer dashboard.
- Event ticket checkout and order flows.
- Scanner, check-in, and entry tools.
- External approval review links.
- Shared asset folder links.
- Support, onboarding, and account communications.

This policy does not replace the privacy terms of event organizers, payment providers, email providers, hosting providers, analytics providers, or other third-party services that may process information in connection with Tixmo.

## 2. Information We Collect

### Account and organization information

We may collect name, email address, phone number, title, organization name, role, permissions, authentication data, and account settings.

### Event and ticketing information

We may collect event names, venues, dates, ticket types, ticket tiers, capacities, prices, order records, attendee names, attendee emails, ticket IDs, QR or barcode payload references, inventory state, and related operational metadata.

### Payment information

Payments are processed through Stripe or another configured payment processor. Tixmo stores payment status, order totals, currency, Stripe PaymentIntent IDs, webhook event IDs, and related transaction references. Tixmo does not intentionally store full payment card numbers.

### Scanner and entry information

We may collect scanner names, device identifiers, scanner status, scanner API-key references, ticket validation attempts, scan results, timestamps, duplicate-scan signals, offline sync status, and gate or location labels.

### Assets and approval information

We may collect uploaded filenames, file metadata, storage keys, approval request details, reviewer names and emails, comments, decisions, public review token references, shared-folder token references, expiry and revocation timestamps, and asset access activity.

### Support and communications

We may collect information submitted through support requests, onboarding calls, email, incident reports, and administrative repair workflows.

### Usage, device, and log information

We may collect IP address, browser or device type, pages viewed, API requests, timestamps, error logs, diagnostic events, session identifiers, and security or rate-limit signals.

## 3. How We Use Information

Tixmo uses personal information to:

- Provide accounts, dashboard access, event setup, ticketing, checkout, scanning, approvals, and asset sharing.
- Process orders, payment status updates, refunds, chargebacks, and customer communications.
- Send transactional emails such as account notices, order confirmations, approval invitations, and operational alerts.
- Support organizers, attendees, reviewers, and staff.
- Detect fraud, abuse, duplicate scans, compromised scanner credentials, unauthorized access, and service misuse.
- Maintain audit logs, troubleshoot incidents, and verify production smoke tests.
- Improve platform reliability, security, usability, and market-readiness workflows.
- Comply with legal, tax, accounting, chargeback, safety, and dispute obligations.

## 4. How We Share Information

We may share personal information with:

- Event organizers and their authorized staff for event operations, attendee support, ticket validation, order management, approvals, and asset workflows.
- Service providers that host, process, store, email, monitor, analyze, or secure the platform.
- Payment processors for payment authorization, settlement, refunds, chargebacks, fraud checks, and compliance.
- External reviewers or asset recipients when an organizer creates review links or shared-folder links.
- Professional advisors, legal authorities, or regulators when necessary for compliance, safety, fraud prevention, or dispute handling.
- Successors or assigns in connection with a merger, acquisition, financing, reorganization, or sale of assets.

Tixmo does not sell personal information as part of the V1 beta. If advertising, retargeting, or cross-context behavioral sharing is added later, this policy and any required opt-out controls must be updated before launch.

## 5. Cookies and Similar Technologies

Tixmo may use cookies, local storage, session storage, or similar technologies for authentication, session management, preferences, security, and product diagnostics. If marketing analytics, ad tracking, or non-essential cookies are added, Tixmo should add the required notices, consent controls, and opt-out choices before publication.

## 6. Data Retention

Tixmo keeps personal information only as long as needed for the purposes described in this policy, including active account use, event operations, payment records, ticket validation, fraud prevention, support, legal obligations, tax/accounting obligations, backups, and dispute handling.

See `docs/policies/DATA_RETENTION_NOTES.md` for the launch retention schedule that must be confirmed before publication.

## 7. Security

Tixmo uses administrative, technical, and organizational safeguards designed to protect personal information. Launch controls include role-based access, organization scoping, scanner-key revocation, public-token expiry and revocation, signed asset URLs, production environment validation, monitoring, and documented support repair workflows.

No system can guarantee absolute security. Users should protect account credentials, scanner keys, review links, asset-share links, and ticket QR codes.

## 8. Your Choices and Rights

Depending on location and applicable law, users may have rights to request access, correction, deletion, portability, restriction, or objection to certain processing. Users may also have the right to opt out of certain data sharing or marketing communications.

To make a request, contact [PRIVACY_CONTACT_EMAIL]. Tixmo may need to verify the requester before acting on the request. Some records may be retained when required for payment, fraud prevention, tax, legal, security, backup, or dispute purposes.

## 9. California, EEA, UK, and Other Privacy Rights

Before publication, Tixmo should confirm whether it is subject to CCPA/CPRA, GDPR, UK GDPR, Canadian privacy laws, or other jurisdiction-specific rules. If any apply, add the required notices, lawful bases, data-subject request process, appeal process, authorized-agent handling, cross-border transfer disclosures, and regulator contact details.

Launch assumption to verify: Tixmo is not selling personal information and is not using cross-context behavioral advertising in V1 beta.

## 10. Children

Tixmo is not intended for children under 13. Event organizers should not knowingly collect children's information through Tixmo unless they have the required authority, consent, and notices.

## 11. International Use

Tixmo may process information in the United States, Canada, or other countries where its service providers operate. Users outside those locations should understand that their information may be transferred to and processed in countries with different privacy laws.

## 12. Changes

Tixmo may update this Privacy Policy. Material changes should be announced through the dashboard, email, website notice, or another appropriate channel before or when they take effect.

## 13. Contact

Privacy contact: [PRIVACY_CONTACT_EMAIL]  
Legal contact: [LEGAL_CONTACT_EMAIL]  
Mailing address: [MAILING_ADDRESS]

## Publication Checklist

- [ ] Legal entity, address, contacts, and effective date are filled in.
- [ ] Vendor list is verified: hosting, database, object storage, Stripe, email, Sentry, analytics, support tools.
- [ ] CCPA/CPRA applicability is confirmed.
- [ ] GDPR/UK GDPR applicability is confirmed.
- [ ] Cookie/analytics behavior is confirmed.
- [ ] Public support channel for privacy requests is live.
- [ ] Data retention schedule is approved.
- [ ] Organizer DPA or data-processing terms are prepared if required.

