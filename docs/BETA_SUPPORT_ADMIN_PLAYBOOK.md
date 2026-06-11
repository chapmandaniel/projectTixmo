# Tixmo Beta Support And Admin Playbook

Use this playbook for beta customer support, admin repair, and launch-week incident handling. Prefer first-class dashboard or API actions. Use direct database changes only when no supported route exists, the production database has a current backup, and a second operator has approved the change.

## Operating Rules

- Keep a ticket for every support action with the actor, timestamp, customer, organization, event, affected record IDs, action taken, before/after state, and rollback note.
- Never paste secrets into support tickets: JWTs, scanner API keys, Stripe secrets, webhook secrets, asset share tokens, approval review tokens, or raw QR payloads.
- Verify money movement in Stripe before changing Tixmo order state. The platform record and Stripe PaymentIntent must agree on amount, currency, customer, and event/order context.
- Treat scanner and public review/share tokens as credentials. Revoke and replace if they are exposed.
- Record manual database repairs as incidents, not routine support steps.

## First Checks

1. Confirm service health with `/health` and `/api/v1/health`.
2. Capture release/version context, environment, organization ID, event ID, user ID, order number, Stripe PaymentIntent ID, scanner ID, ticket ID, or share/review token reference.
3. Check logs around the affected timestamp before changing state.
4. Reproduce in staging when the issue is workflow-wide rather than customer-specific.
5. If the issue blocks checkout, entry, payout, or customer access, assign an incident owner before starting repair.

## Supported Admin Surfaces

| Area | Supported route or system | Use for |
| --- | --- | --- |
| Users | `GET/POST/PUT/DELETE /api/v1/users` | User lookup, team account creation, profile repair, soft delete |
| Organizations | `GET/POST/PUT/DELETE /api/v1/organizations` | Org lookup, org status repair, Stripe account reference checks |
| Org members | `POST /api/v1/organizations/:id/members`, `DELETE /api/v1/organizations/:id/members/:userId` | Add/remove users from organizations |
| Orders | `GET /api/v1/orders`, `GET /api/v1/orders/:id`, `POST /api/v1/orders/:id/confirm`, `POST /api/v1/orders/:id/cancel`, `POST /api/v1/orders/:id/refund` | Order lookup and controlled order-state repair |
| Payments | Stripe Dashboard, `POST /api/v1/payments/webhook` | PaymentIntent verification and webhook replay |
| Scanners | `GET/POST/PUT/DELETE /api/v1/scanners`, `GET /api/v1/scanners/logs` | Scanner registration, update, revoke, and scan investigation |
| Assets | `GET /api/v1/assets/folders/:folderId/shares`, `POST /api/v1/assets/folders/:folderId/shares`, `DELETE /api/v1/assets/folders/:folderId/shares/:shareId` | Share creation and revocation |
| Approvals | `/api/v1/approvals`, `/api/v1/review/:token` | Approval routing, reviewer resend/remove, public reviewer actions |

## Failed Payment

1. Find the order by order number, customer email, event ID, or Stripe PaymentIntent ID.
2. Confirm the order is still pending or processing. Relevant fields are `orders.status`, `orders.payment_status`, and `orders.payment_intent_id`.
3. Confirm the PaymentIntent status in Stripe. Do not mark the order paid for a failed, canceled, or mismatched PaymentIntent.
4. If the PaymentIntent failed, tell the customer to retry checkout. If the order hold expired or inventory changed, create a new order instead of reviving the old one.
5. If the PaymentIntent succeeded but the app still shows failed, follow the paid-order-not-confirmed runbook.

## Paid Order Not Confirmed

1. Confirm the Stripe PaymentIntent succeeded and matches the Tixmo order amount, currency, customer, and event.
2. Check `payment_webhook_events` for the Stripe event ID, `payment_intent_id`, `order_id`, `status`, and `error_message`.
3. Replay the Stripe webhook when the event is missing or failed.
4. If Stripe is correct and the webhook cannot be replayed, an owner/admin/manager/promoter may use `POST /api/v1/orders/:id/confirm` after documenting the PaymentIntent evidence.
5. Verify the order is `PAID`, `payment_status` is `SUCCEEDED`, tickets exist, inventory counts are correct, and the customer received confirmation.

## Duplicate Webhook Or Duplicate Confirmation

1. Find the Stripe event in `payment_webhook_events`; webhook event IDs are stored as unique IDs.
2. Confirm the order has only one final paid state and ticket set.
3. If the customer received duplicate notifications but the order state is correct, document the duplicate message and avoid touching order state.
4. If duplicate tickets or inventory changes exist, stop and escalate as an incident before repair.

## Refund Or Chargeback

1. Verify who approved the refund and why.
2. Handle the financial refund or chargeback workflow in Stripe first unless product policy says otherwise.
3. Use `POST /api/v1/orders/:id/refund` for the platform-side order/ticket/inventory update after the financial action is confirmed.
4. Confirm the order is `REFUNDED` or `PARTIALLY_REFUNDED` as expected and tickets cannot be used.

## Duplicate Scan

1. Search scan history with `GET /api/v1/scanners/logs` by `ticketId`, `eventId`, `scannerId`, and `success`.
2. Compare the first successful scan timestamp, scanner, and gate against the guest's claim.
3. If the first scan was valid, do not reset the ticket. Give the gate team the timestamp and scanner context.
4. If the ticket was incorrectly marked used, require event manager approval before repair. Direct DB repair should restore the ticket to `VALID`, clear check-in metadata if present, and record the incident ticket ID.
5. Re-run scanner validation after repair and keep the scan-log evidence.

## Lost Or Compromised Scanner

1. Find the scanner with `GET /api/v1/scanners` or `GET /api/v1/scanners/:id`.
2. Revoke it with `DELETE /api/v1/scanners/:id` or set status to `REVOKED` with `PUT /api/v1/scanners/:id`.
3. Register a replacement scanner with `POST /api/v1/scanners/register`.
4. Do not send the old API key to anyone. Treat it as compromised.
5. Review `GET /api/v1/scanners/logs` for suspicious scans after the loss timestamp.

## Organization Membership Repair

1. Confirm the user exists with `GET /api/v1/users` or `GET /api/v1/users/:id`.
2. Confirm the organization exists and is active with `GET /api/v1/organizations/:id`.
3. Add missing membership with `POST /api/v1/organizations/:id/members`.
4. Remove incorrect membership with `DELETE /api/v1/organizations/:id/members/:userId`.
5. If the user's role is wrong, update through `PUT /api/v1/users/:id` while respecting role hierarchy.
6. Ask the user to sign out and sign back in if their session has stale claims.

## Asset Share Revocation

1. List active shares with `GET /api/v1/assets/folders/:folderId/shares`.
2. Revoke the affected share with `DELETE /api/v1/assets/folders/:folderId/shares/:shareId`.
3. Confirm the share no longer resolves through `GET /api/v1/assets/shares/:token`.
4. If the token was exposed broadly, notify the organization and create a new share only after the recipient list is confirmed.

## Approval Or Public Review Link Issue

1. Identify the approval, reviewer, and public token reference without pasting the raw token into the ticket.
2. Use approval routes to resend the reviewer invite when the right person lacks access.
3. Remove and re-add the reviewer if a token is compromised or assigned to the wrong person.
4. Confirm the public review route works with `GET /api/v1/review/:token`.
5. For disputed decisions or comments, preserve the public review audit trail before editing data.

## Email Not Received

1. Confirm the email address on the user, order, reviewer, or share recipient.
2. Check provider delivery logs for bounce, suppression, spam complaint, or delayed delivery.
3. Resend only through a supported product route where available, such as approval reviewer resend.
4. If no resend route exists, create a new supported action rather than manually sending secrets or raw tokens.

## Staging Or Production Smoke Failure

1. Use `docs/PRODUCTION_LAUNCH_CHECKLIST.md` Section 7 as the canonical smoke path.
2. Capture the first failing step, exact timestamp, environment, browser/device, user role, organization, event, and network/API response.
3. Classify as service dependency, configuration, data issue, or app defect.
4. Run local `npm run verify:api` only as a local guard. Passing locally is not proof that staging or production is healthy.
5. Do not continue launch tasks until checkout, order confirmation, scanner validation, and support contact paths pass in the target environment.

## Manual Repair Checklist

Use this only when no supported API or dashboard path exists.
For production database backup and restore evidence, use `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md`.

1. Confirm current production backup/snapshot.
2. Write the exact query or migration and expected before/after result.
3. Get second-operator approval.
4. Run against one record first when possible.
5. Verify through the app/API after the change.
6. Attach evidence to the support ticket.

## Records To Capture

| Incident type | Required IDs |
| --- | --- |
| Payment/order | Order ID, order number, user ID, event ID, PaymentIntent ID, Stripe event ID |
| Scanner | Scanner ID, event ID, ticket ID, scan log ID, timestamp |
| User/org | User ID, organization ID, role, membership action |
| Asset share | Folder ID, share ID, recipient label, expiry, revocation timestamp |
| Approval | Approval ID, reviewer ID, token reference, decision/comment IDs |
