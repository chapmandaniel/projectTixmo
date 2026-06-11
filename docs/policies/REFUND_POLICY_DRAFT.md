# Tixmo Refund Policy Draft

Status: launch draft for legal review  
Effective date: [EFFECTIVE_DATE]  
Contact: [SUPPORT_EMAIL]  

This draft should be reviewed by counsel and operations before publication. Refund rules must match Stripe configuration, organizer contracts, event listing copy, tax handling, service-fee handling, and support tooling.

## 1. Core Rule

Unless Tixmo states otherwise in a signed agreement, event organizers set and approve event refund rules. Tixmo provides the platform tools and support workflow for processing eligible refunds after the refund decision is made.

Each event listing should clearly state its refund window, cancellation policy, transfer policy, age or venue restrictions, and any non-refundable fees before checkout.

## 2. When Refunds May Be Considered

Refunds may be considered when:

- The organizer cancels the event.
- The organizer materially changes the event date, location, or advertised core experience.
- A duplicate charge or duplicate order is confirmed.
- A payment succeeded but the order was not fulfilled and cannot be repaired.
- Applicable law requires a refund.
- The organizer approves a discretionary refund under its event policy.

## 3. When Refunds May Be Denied

Refunds may be denied when:

- The event policy states that tickets are final sale.
- The refund request arrives after the published refund window.
- The ticket has already been used, scanned, transferred, refunded, cancelled, or charged back.
- The attendee is denied entry for venue rules, age restrictions, safety rules, misconduct, invalid identification, or organizer/venue policy.
- The request relates to travel, lodging, third-party expenses, or other costs outside the ticket purchase.

## 4. Fees, Taxes, and Partial Refunds

Before publication, Tixmo must decide and document:

- Whether platform service fees are refundable.
- Whether payment-processing fees are refundable.
- How taxes and required fees are handled.
- Whether partial refunds are supported in the dashboard/API.
- How chargebacks affect tickets, inventory, and organizer payouts.

Launch placeholder: refunds may be full or partial depending on the event policy, payment processor rules, and applicable law. Some fees may be non-refundable unless required by law.

## 5. How To Request A Refund

Attendees should contact [SUPPORT_EMAIL] or the organizer support contact listed for the event and include:

- Order number.
- Purchaser email.
- Event name.
- Reason for the request.
- Any relevant screenshots or payment references.

Do not send full card numbers, passwords, raw ticket QR payloads, scanner keys, or public review/share tokens through support messages.

## 6. Processing Steps

1. Support locates the order by order number, customer email, event ID, or PaymentIntent ID.
2. Support confirms the order status, payment status, ticket status, and event policy.
3. The organizer or authorized support owner approves or denies the request.
4. Financial refund action is handled in Stripe or the configured payment processor first unless policy says otherwise.
5. Tixmo updates the platform order/ticket state through supported routes, such as `POST /api/v1/orders/:id/refund`.
6. Support verifies the order state, ticket invalidation, inventory effect, and customer communication.

Operational support details live in `docs/BETA_SUPPORT_ADMIN_PLAYBOOK.md`.

## 7. Event Cancellation

If an organizer cancels an event, the organizer is responsible for telling attendees what happens next, including refund timing, transfer options, rescheduled dates, and any exceptions required by law.

Tixmo should provide support tooling and transaction records needed to process approved cancellation refunds, subject to payment processor and payout constraints.

## 8. Chargebacks

If a purchaser disputes a charge with a bank or card network, Tixmo and the organizer may rely on order records, ticket records, event policy, payment records, email records, and scan logs to respond. A chargeback may result in ticket cancellation or account restrictions.

## Publication Checklist

- [ ] Final owner of refund approval is named.
- [ ] Fee refundability is decided.
- [ ] Tax handling is decided.
- [ ] Partial refund support is confirmed.
- [ ] Event listing template includes refund-policy copy.
- [ ] Stripe refund/chargeback workflow is tested in staging.
- [ ] Support team has approved the operational process.

