# Tixmo next step plan

Use this plan after the [October 4 project audit](</Users/danielchapman/Desktop/Project Tixmo/docs/audits/2026-10-04-full-project-audit.md>). The proposed milestone is a dependable beta for one business: configure an event, sell and recover a ticket order, admit the ticket once, and complete external creative review. Build on the existing application; defer QuantMo, Social, ProMo and broad marketing expansion until this path is proven.

This is an ordered implementation proposal. No production changes, policy approvals, payments or deployment have been made. Effort estimates should follow task sizing against the current 102-file working-tree change set, rather than treating the June production commit as the implemented baseline.

## First work package

Start with **Access control and production bootstrap**. It has a clear scope, substantial risk reduction and a testable completion point.

| Task | Completion evidence |
| --- | --- |
| Remove production `db:seed` from startup; replace repeatable fixed bootstrap with a one-time guarded operation | Reviewed startup configuration; restart cannot reset credentials or print secrets |
| Prepare credential rotation/session invalidation and access-log review for the seeded administrator | Named operator executes approved production changes; evidence records completion without secret values |
| Keep public registration CUSTOMER within the configured business | Host/header matrix cannot grant staff or create an OWNER |
| Add owner-authorized expiring staff invitations with role limits | Unauthorized, reused and expired invitations fail |
| Enforce disabled/deleted account and session version centrally | Pre-deletion/demotion tokens, refresh and login cannot preserve authority |
| Separate global admin identity from null organization membership | Removing an ADMIN cannot grant global authority |
| Remove peer reviewer capabilities from external responses and rotate exposed links | Public response redaction tests; one reviewer cannot act as another |
| Scope and clear browser caches on logout/account change | A later user cannot see prior staff approval content, even when their API request is denied |

Use the existing role/action matrix as the intent baseline and update it with tested behavior. Same-business staff visibility remains valid; customer and offboarding authority are enforced consistently.

## Subsequent work packages

| Sequence | Work package | Deliverable | Required acceptance |
| --- | --- | --- | --- |
| 2 | Payment and customer recovery | One durable payment session per order; recoverable fulfillment; processor-backed refunds; resumable checkout/ticket access | Repeat payment attempts cannot duplicate charges. Webhook replay and worker failure converge to paid tickets or an explicit recoverable exception. Refund reaches Stripe and reconciles local state exactly once. Refresh/redirect restores authoritative order status |
| 3 | Admission and inventory | Credential rotation; scanner event checks; atomic redemption; exact-once stock transitions; sellability/tier enforcement | Saved pre-transfer QR fails. Wrong-event scanner fails. Forced simultaneous scans yield one entry. Concurrent cancellation/refund/expiry never inflates stock. Early/closed sales and exhausted tier allocations are rejected |
| 4 | Event lifecycle and truthful operations | Correct timezone editing/display; single publish/cancel implementation; complete event save; actual metrics and working settings | Unchanged saves preserve timestamps across Newfoundland/venue zones and DST. Failed ticket/tier save leaves no incomplete published event. All cancellation entry points run identical side effects. Operational pages show measured data or explicit unavailable states |
| 5 | Reproducible release and pilot | Supported patched Node LTS; clean gates; staging; backups/restore; real monitoring; approved policies/configuration; real-device field evidence | Fresh full suites pass without diagnostic clock patches. No test tool can target production implicitly. Release SHA matches tested deployment. Restore and rollback demonstrated. Alerts delivered. Buyer, reviewer/share and scanner journeys pass on target environment |

Waiting-room leak, upload cleanup, unsafe runtime-config evaluation, dependency remediation and missing frontend security headers belong in package 5 or earlier when touching the affected code. Treat storage exhaustion and availability defects as launch acceptance items, not cosmetic cleanup.

## Payment decisions before implementation

Agree on currency, fees/tax responsibility, cancellation eligibility, partial/full refund behavior and handling of used/transferred tickets. Define whether promo usage counts a reservation or a completed purchase, and how cancellation restores limited allowances. Approved policy URLs and consistent backend/frontend Stripe mode/currency must exist before running the paid-flow acceptance test.

Implement money movement as durable processor state with reconciliation, not as a UI status update. Preserve transaction and payment attempt identifiers. Test delayed success after cart expiry, duplicate requests, mismatched/superseded intents, timeout after processor success, duplicate webhooks, worker restart and refund retry.

## Scanner decisions before the pilot

Identify the actual scanner application and devices; the inspected repository does not establish an offline camera client. Choose the supported offline window, cache replacement/delta contract, revocation tombstones, credential versioning and conflict resolution. An unkeyed checksum is not record authentication.

Prove the workflow on real devices under venue conditions: invalid QR, unknown ticket, duplicate gates, wrong event, transfer, refund/cancellation, loss of network, reconnect and conflicting offline admissions. Record the event, scanner version, release SHA, devices, time and operator.

## Release gate repair

Make the gate describe actual acceptance:

- Fix expired fixtures with a controlled test clock or relative test data; investigate the intermittent smoke socket failure.
- Upgrade vulnerable dependencies with reachability and regression checks; avoid a blind bulk `audit fix --force`.
- Standardize local, CI and production on a supported patched Node LTS.
- Require explicit disposable database URLs for tests/schema reset; protect root backup files and redact connection URLs.
- Remove the unconditional local-warning blocker from strict launch acceptance while retaining it as information.
- Configure uptime targets and scheduling; missing required targets must fail instead of silently skipping.
- Add dependency-aware readiness and delivered alerts; prove Postmark/S3 behavior and backup restore.
- Protect main with the actual root workflow checks after they are reliable; nested component workflows do not execute as root workflows.
- Validate the deployed API/dashboard SHA and runtime configuration after each release.

## Pilot completion criteria

Run a single limited event pilot after packages 1–5 pass. Record target-environment evidence for customer checkout/recovery/refund, external reviewer/shared assets, scanner/offline field test, backup/restore/rollback, approved policy links and monitoring. Preserve evidence with the release SHA and named owner.

Keep the pilot outcome factual: who tested which flow, which release ran, what failed, and how the failure was recovered. Expand features only after these core flows are accepted.

The immediate recommended implementation task is package 1. Payment/admission fixes follow as separate reviewable changes so their invariants and deployment consequences can be assessed independently.

