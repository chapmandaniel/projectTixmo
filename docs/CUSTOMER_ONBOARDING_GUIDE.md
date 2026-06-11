# Tixmo Customer Onboarding Guide

Audience: beta organizers and operators  
Goal: get one organization from account setup to a verified event launch without exposing post-V1 features.

## Before You Start

Have these ready:

- Organization name and primary owner email.
- Venue name, address, capacity, and timezone.
- Event name, date, description, image, and launch status.
- Ticket types, prices, inventory, and sales window.
- Refund and cancellation terms for the event.
- Staff list with roles.
- Stripe/payment setup confirmation.
- Scanner device or phone for entry testing.
- Brand or event assets for approval/share workflows.

## 1. Create The Organization

1. Sign in to the Tixmo dashboard.
2. Confirm the account is attached to the correct organization.
3. Add trusted staff only.
4. Assign roles conservatively:
   - Owner/Admin: senior operators.
   - Manager/Promoter: event operators.
   - Scanner: entry staff using scanner credentials.
5. Remove or downgrade access that is not needed for launch.

Reference: `docs/ROLE_ACTION_PERMISSION_MATRIX.md`.

## 2. Add Venue And Event Details

1. Create or select the venue.
2. Create the event in Event Manager.
3. Add event name, description, venue, timezone, dates, and capacity.
4. Add event images and core metadata.
5. Keep event copy accurate and avoid announcing unsupported features.
6. Save the event before creating tickets.

## 3. Configure Tickets

1. Create at least one ticket type.
2. Add pricing, capacity, and inventory.
3. Add ticket tiers only when tiered availability is intentional.
4. Verify ticket type names are customer-readable.
5. Confirm sales window and status before going on sale.

Before launch, place a test order with all planned ticket types.

## 4. Confirm Checkout And Payments

1. Confirm payment currency.
2. Confirm the Stripe account and webhook endpoint are configured.
3. Place a test order.
4. Complete the test payment.
5. Confirm the order is marked paid once.
6. Confirm ticket inventory moves from available to held to sold.
7. Confirm the attendee can be found in Orders and Attendees.

Use `docs/PRODUCTION_LAUNCH_CHECKLIST.md` Section 7 for the full smoke path.

## 5. Prepare Scanners

1. Register each scanner with a location-specific name.
2. Copy each scanner key once and store it only on the assigned scanner device.
3. Authenticate each scanner.
4. Sync tickets before doors.
5. Test valid, duplicate, invalid, cancelled, and wrong-event tickets.
6. Confirm scan logs appear in the dashboard.
7. Revoke and replace any lost or exposed scanner.

Reference: `docs/SCANNER_SETUP_AND_FIELD_TEST.md`.

## 6. Set Up Approvals

1. Upload the asset that needs review.
2. Create an approval request.
3. Invite the correct external reviewer.
4. Open the review link in a logged-out/private browser.
5. Submit a comment or decision.
6. Confirm the approval status updates in the dashboard.

Treat review links as credentials. Revoke or replace exposed links.

## 7. Share Assets

1. Upload brand or event assets.
2. Organize them into folders.
3. Create a shared folder link for the intended recipient.
4. Open the link in a logged-out/private browser.
5. Confirm nested folders and downloads work.
6. Revoke the share and confirm the link no longer works when access ends.

## 8. Launch Readiness Check

Do not open sales or doors until:

- Dashboard build and API verification gates are green for the release.
- Production environment variables and runtime config are correct.
- Payment webhook is live.
- Event refund/cancellation terms are published.
- At least one full test checkout succeeds.
- Scanner real-device field test passes.
- External reviewer and shared asset links work on the production-like domain.
- Support owner knows the repair playbook.
- Backup and rollback evidence exists for the release.

## Support Contacts

Support: [SUPPORT_EMAIL]  
Privacy: [PRIVACY_CONTACT_EMAIL]  
Legal: [LEGAL_CONTACT_EMAIL]

