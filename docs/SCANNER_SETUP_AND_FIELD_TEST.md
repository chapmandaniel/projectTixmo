# Tixmo Scanner Setup And Field-Test Guide

Use this for beta event staff setup, scanner handoff, and real-device gate testing. Treat scanner API keys like passwords: copy them once, keep them only in the assigned scanner session/device, and revoke the scanner if a key is exposed.

## Roles

- Event owner/admin/manager/promoter: registers scanners, assigns devices, monitors scan logs, and revokes lost devices.
- Scanner operator: uses the scanner app/device at entry and reports denied scans to the gate lead.
- Gate lead: owns go/no-go for entry operations and confirms the field-test checklist before doors.

## Setup Before The Event

1. Confirm the event is published or on sale.
2. Confirm paid test orders have valid tickets for the target event.
3. Open the dashboard scanner management page at `/scanners`.
4. Select `Register New Scanner`.
5. Name the scanner for its physical location, for example `Main Entrance 1` or `VIP Door 2`.
6. Enter a device ID when available, such as a hardware serial or phone asset tag.
7. Generate the scanner key.
8. Copy the key immediately. It is shown once.
9. On the operator device, open `/scan` on the dashboard origin over HTTPS and enter the assigned key in `Scanner API key`. Select `Connect scanner`; dashboard account sign-in is not required for this separate scanner-key session.
10. Confirm the assigned scanner name before handing the device to staff. The key stays in memory only; leaving/reloading the page or selecting `End scanner session` clears it. Do not put it in a URL or browser storage.
11. For online entry, select `Start camera` and allow camera access. Native `BarcodeDetector` QR support is browser dependent. If unsupported, use manual/hardware entry: paste the full `TICKET:<ticketId>:<barcode>:<eventId>` payload, or enter a barcode with its ticket ID and event ID. The camera pauses after each decoded ticket; start it again for the next guest. Moving to manual fields stops the camera.

The `/scan` screen is **online only**: it does not sync tickets, queue scans, or authorize offline entry. Admit only after the current ticket shows `Admitted`; `Not admitted`, network errors, or an uncertain result are not permission to admit. Editing any ticket field clears the previous result. On an uncertain result, consult the gate lead before an explicit retry.

The offline sync and physical two-device rehearsal requirements below remain separate, uncompleted acceptance gates until a suitable offline client is qualified. The online screen does not satisfy those gates.

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
3. On `/scan`, `Admitted` for the current ticket means admit the guest.
4. Already used means send the guest to the gate lead.
5. Wrong event, cancelled, invalid QR, or not found means do not admit without gate lead approval.
6. If `/scan` loses connection, stop online admission and contact the gate lead. Only a separately qualified offline client may continue under its documented sync procedure.
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

This procedure requires a separately qualified offline client; it is not implemented by `/scan`. Keep these gates open until that client and its two-device behavior have been tested.

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
