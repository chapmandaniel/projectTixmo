# Tixmo Scanner Setup And Field-Test Guide

Use this for beta event staff setup, scanner handoff, and real-device gate testing. Treat scanner API keys like passwords: copy them once, store them only in the scanner app/device, and revoke the scanner if a key is exposed.

## Roles

- Event owner/admin/manager/promoter: registers scanners, assigns devices, monitors scan logs, and revokes lost devices.
- Scanner operator: uses the scanner app/device at entry and reports denied scans to the gate lead.
- Gate lead: owns go/no-go for entry operations and confirms the field-test checklist before doors.

## Setup Before The Event

1. Confirm the event is published or on sale.
2. Confirm paid test orders have valid tickets for the target event.
3. Open Dashboard -> Event Manager -> Scanners.
4. Select `Register New Scanner`.
5. Name the scanner for its physical location, for example `Main Entrance 1` or `VIP Door 2`.
6. Enter a device ID when available, such as a hardware serial or phone asset tag.
7. Generate the scanner key.
8. Copy the key immediately. It is shown once.
9. Load the key into the scanner app/device.
10. Authenticate the scanner before handing it to staff.
11. Sync tickets before doors open.

Supported scanner API surfaces:

- `POST /api/v1/scanners/auth` authenticates a scanner with its API key.
- `GET /api/v1/scanners/sync?eventId=<eventId>` downloads valid and used tickets for offline validation.
- `POST /api/v1/scanners/scan` validates one online scan.
- `POST /api/v1/scanners/validate` uploads offline scan batches.
- `GET /api/v1/scanners/logs` lets admins review scan history.
- `DELETE /api/v1/scanners/:id` revokes a scanner.

## Staff Handoff Script

Tell each scanner operator:

1. Keep the device charged and unlocked only for assigned staff.
2. Use the assigned scanner name and gate only.
3. Green/valid means admit the guest.
4. Already used means send the guest to the gate lead.
5. Wrong event, cancelled, invalid QR, or not found means do not admit without gate lead approval.
6. If the device loses connection, continue only if the scanner app shows a recent offline sync.
7. If the device is lost, stop using it and report it immediately.

Do not give operators raw scanner API keys in chat, email, or printed run sheets.

## Real-Device Field Test

Run this against staging or a production-like environment with the same browser/app/device type staff will use.

- [ ] Device is charged and has network access.
- [ ] Scanner is registered with a location-specific name.
- [ ] Scanner key authenticates successfully.
- [ ] Ticket sync succeeds for the target event.
- [ ] A valid ticket scans successfully.
- [ ] The same ticket scanned a second time is denied as already used.
- [ ] A ticket from another event is denied.
- [ ] A cancelled ticket is denied.
- [ ] An invalid QR payload is denied.
- [ ] Scan logs show scanner name, ticket ID, event ID, result, and timestamp.
- [ ] Offline mode uses the last synced ticket set.
- [ ] Offline scan batch uploads after connectivity returns.
- [ ] Revoking the scanner blocks new auth/sync/scan attempts.
- [ ] Replacement scanner can be registered and used.

## Offline Procedure

1. Sync tickets while the device has a reliable connection.
2. Confirm the scanner app shows the sync timestamp.
3. If connection drops, keep scanning only if the sync timestamp is acceptable for the gate lead.
4. When connection returns, upload offline scans.
5. Review scan logs for failed uploads, duplicate admissions, or delayed conflicts.

Offline limitations to remember:

- Offline validation can only know about the tickets from the last sync.
- Two offline scanners may both accept the same ticket until uploads reconcile.
- Gate leads should keep high-risk entry lanes online when possible.

## Lost Or Compromised Device

1. Open Dashboard -> Event Manager -> Scanners.
2. Find the scanner by name, device ID, or last active time.
3. Revoke it with the dashboard action or `DELETE /api/v1/scanners/:id`.
4. Register a replacement scanner and load the new key.
5. Review scan logs after the loss timestamp.
6. Record the incident in the support/admin ticket.

## Door-Open Go / No-Go

Go only when:

- At least one scanner per planned gate has authenticated and synced.
- A valid scan, duplicate scan, and invalid scan have all been tested.
- The gate lead knows the escalation path for denied guests.
- The dashboard scan log is visible to an admin.
- Replacement scanner registration has been tested or the support owner is available to do it.
