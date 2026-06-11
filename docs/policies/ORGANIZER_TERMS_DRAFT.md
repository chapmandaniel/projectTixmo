# Tixmo Organizer Terms Draft

Status: launch draft for legal review  
Effective date: [EFFECTIVE_DATE]  
Contact: [LEGAL_CONTACT_EMAIL]  

These Organizer Terms are intended to supplement the public Terms of Service for organizations that create and manage events through Tixmo. Counsel should review them before publication or inclusion in customer agreements.

## 1. Organizer Authority

The person creating or managing an organization represents that they have authority to bind that organization, configure events, invite staff, create ticket types, set prices, upload assets, invite reviewers, process orders, and make support decisions.

## 2. Event Accuracy

Organizers are responsible for accurate event information, including:

- Event name, description, date, time, timezone, venue, address, capacity, age restrictions, accessibility details, lineup or programming, sponsor references, and cancellation terms.
- Ticket type names, pricing, inventory, tiers, availability windows, fees, taxes, and restrictions.
- Images, artwork, approval assets, shared folder content, and brand assets.

Organizers must promptly update Tixmo listings and attendee communications if event details change.

## 3. Legal Compliance

Organizers are responsible for complying with laws and venue obligations that apply to their events, including consumer protection, ticketing, taxes, accessibility, public safety, age restrictions, permits, liquor or controlled-substance rules, marketing consent, privacy, sanctions, anti-fraud, and intellectual-property requirements.

## 4. Ticketing, Payments, Taxes, and Payouts

Organizers are responsible for confirming the launch currency, tax assumptions, payout account, refund policy, and chargeback allocation before selling tickets.

Tixmo records orders, tickets, payment references, and webhook events. Payment settlement, payout timing, reserves, reversals, refunds, chargebacks, and processor holds may be controlled by Stripe or another payment processor.

## 5. Refunds, Cancellations, and Event Changes

Organizers must publish refund and cancellation terms before checkout. If an event is cancelled, postponed, relocated, materially changed, or oversold, the organizer is responsible for attendee communication and refund decisions unless Tixmo separately agrees otherwise in writing.

Tixmo support should not approve discretionary refunds without the organizer approval path defined for the account.

## 6. Staff, Roles, and Scanner Credentials

Organizers are responsible for:

- Inviting only authorized staff.
- Assigning appropriate roles.
- Removing staff who no longer need access.
- Registering scanners with location-specific names.
- Protecting scanner API keys.
- Revoking lost, compromised, or unused scanners.
- Running the real-device scanner field test before doors.

Current role behavior is documented in `docs/ROLE_ACTION_PERMISSION_MATRIX.md`.

## 7. Entry Operations

Organizers and venue staff control door policy and admission decisions. Tixmo scanner results help validate ticket state, but the organizer remains responsible for staffing, device readiness, duplicate-scan escalation, offline-mode decisions, replacement scanner procedures, and attendee support at the gate.

The scanner setup and field-test guide is `docs/SCANNER_SETUP_AND_FIELD_TEST.md`.

## 8. Assets, Reviewers, and Public Links

Organizers are responsible for ensuring they have the rights to upload, review, share, distribute, and use all assets submitted to Tixmo.

Public review links and shared asset folder links should be treated as credentials. Organizers must revoke links if recipients change, tokens are exposed, or access is no longer needed.

## 9. Data Protection

Organizers must use attendee, reviewer, staff, and customer data only for lawful event operations and support. Organizers may not export, sell, share, or market to attendees except as allowed by law, the organizer's own notices, and Tixmo's agreements.

Before publication, Tixmo should decide whether a separate Data Processing Addendum is required for organizer customers.

## 10. Prohibited Events and Conduct

Organizers may not use Tixmo for events, content, or transactions that are unlawful, fraudulent, deceptive, unsafe, infringing, abusive, or prohibited by Tixmo's payment processor, hosting provider, or applicable law.

## 11. Support and Incident Cooperation

Organizers must cooperate with Tixmo on checkout failures, payment disputes, duplicate scans, lost scanner devices, public-token exposure, approval disputes, asset claims, safety issues, and legal requests.

Support actions should be tracked with record IDs, timestamps, actor identity, before/after state, and rollback notes as described in `docs/BETA_SUPPORT_ADMIN_PLAYBOOK.md`.

## Publication Checklist

- [ ] Organizer authority and acceptance flow are approved.
- [ ] Refund, chargeback, fee, tax, and payout responsibilities are approved.
- [ ] Prohibited-events language is approved by payment and legal stakeholders.
- [ ] DPA need is decided.
- [ ] Organizer onboarding references these terms.
- [ ] Event listing flow captures refund/cancellation terms.

