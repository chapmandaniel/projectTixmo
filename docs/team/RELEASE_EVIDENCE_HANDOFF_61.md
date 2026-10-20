> **Historical archive, not current acceptance.** Original 2026-10-19 deliverable `f75036662a7b097d20f0d2b920ca590ea5765c5f`; tested/reference product `c35a6f84512b274b2ae9563fda57169770f08c18`. Imported by task236; no gate rerun. Present-tense wording below belongs to the original capture. See [provenance and limits](evidence/HISTORICAL_DELIVERABLES_236.md).

# Task 61: release-evidence execution handoff

Status: **preparation only; NO-GO; independent review required**. Prepared
2026-10-19 using [the existing ticket template](../MARKET_LAUNCH_EVIDENCE_TICKET_TEMPLATE.md)
and [external packet](../EXTERNAL_LAUNCH_EVIDENCE.md); no new tooling.

## Release identity and observed local check

- Reviewed product candidate: `c35a6f84512b274b2ae9563fda57169770f08c18`.
- Branch: `tixmo/task-61-release-evidence`; base is exactly that candidate.
- Worktree: `/home/daniel/projects/projectTixmo/worktrees/task-61`.
- Release coordinator/rollback owner: `tixmo-release`; acceptance reviewer:
  `tixmo-qa`; integration reviewer: `tixmo-lead`; dispatch/support coordinator:
  `tixmo-pm`; launch/publication/target-change authority: Daniel Chapman.
  These are accountable role identities, not claims of human approval or attendance.
- Inspected `scripts/evidence-status.mjs`, then ran
  `node scripts/evidence-status.mjs --json --strict` at the exact candidate:
  **exit 1**, `openEvidenceGaps: 9`, `readyForGoNoGo: false`.
- Its three other local `pass` labels read existing JSON, including June evidence;
  they are **not fresh executions or current candidate passes**. No local suite,
  dependency audit, CI, target health, deployment, or restore is certified here.

## Authority and missing input intake

Authorized and performed: read existing scripts/templates/runbooks, inspect Git,
create isolated branch, run local artifact inventory, prepare this checklist,
commit it and request independent review. No environment/secret files read.

Before dispatching execution, PM must record the following in the approved launch
ticket, using the existing template. All are **unavailable/unverified here**:

- [ ] Named target environment, API/dashboard origins, deployed API/dashboard SHA
      and deployment IDs proving the candidate is actually served; event/org/test
      account IDs, checkout slug and resettable test dataset ownership.
- [ ] Runtime inputs: approved policy URLs; target API base URL; Stripe publishable
      key availability and test/live mode; expected currency matching API
      `PAYMENT_CURRENCY`; secure workflow credential/token references only.
      Never paste credentials or raw scanner/review/share tokens into this file.
- [ ] Daniel's explicit scope/window for target calls and test-data mutations,
      deployment/publication/runtime changes, monitoring or scheduler changes,
      backup creation and restore test. No such approval is implied by task 61.
- [ ] Named human device operator, gate lead, counsel, payment/support/security
      approvers, backup second operator and launch on-call contact with availability.
      PM obtains these names; role ownership below does not substitute for them.
- [ ] Recovery service/database identity, isolation/data-handling approval, backup
      access/reference, retention and restore window; no production overwrite.

Do not provision, spend, publish, deploy, migrate, send external messages, modify
monitoring/config/schedulers/Gateway or run restores under this preparation task.
PM should split bounded execution assignments only after target inputs and authority
exist. Read scripts again before execution; never blindly run examples with inherited
environment values. Existing task 57/local-runtime and other product decisions are
not resolved by this document. A later integrated candidate needs a new exact SHA
and refreshed/reconciled evidence, not this candidate's approval by association.

## Nine-gap checklist (all remain open)

Output names below use `<env>` = explicitly approved `staging` or `production`,
`<date>` = actual capture date, and must match the checker's staging/production
patterns. Link every output/run in the approved launch ticket with actual target,
capture time, candidate SHA, owner and acceptance result. Sensitive supporting
material belongs only in an approved secure evidence location.

### 1. Local checkout config is non-launch

Owner: **tixmo-release**; checker-contract review: **tixmo-lead**.

- [ ] Preserve `docs/checkout-config-evidence/local-runtime-config-2026-06-09.json`
      as historical, explicitly local non-launch evidence. Never promote it to a
      target pass; obtain fresh target config evidence under gap 3.
- [ ] Lead reviews the strict-checker acceptance conflict before final go/no-go:
      `nonLaunchEvidence: true` adds a warning unconditionally; blockers include
      any warnings. Even eight fresh target passes leave **at least this one gap**.
      No artifact-only action can produce zero gaps with this script as written.
      Request a separately scoped, independently reviewed checker-contract decision
      preserving local/target distinction. Do not delete evidence, weaken checks,
      or claim zero gaps here. Target config does not automatically clear this row.

### 2. Target external smoke missing

Owner: **tixmo-qa**; test-data/runtime input owner: **tixmo-backend**.

- [ ] After approved API/dashboard URLs, seeded test organization/account, event,
      scanner and review/share secure references exist, inspect then run existing
      `npm run smoke:external` (or `external-smoke-evidence.yml`). Set
      `TIXMO_SMOKE_EVIDENCE_PATH=docs/external-smoke-runs/<env>-<date>.json`.
- [ ] Follow [external packet](../EXTERNAL_LAUNCH_EVIDENCE.md) and full V1 smoke
      in [launch checklist](../PRODUCTION_LAUNCH_CHECKLIST.md) Section 7. Capture
      health/login/events/ticket availability/report/scanner/review/share results
      and full checkout/webhook/order proof in approved test mode. Demo smoke alone
      does not prove the full payment lifecycle; auth may update last-used times.

### 3. Target checkout runtime config missing

Owner: **tixmo-frontend**; acceptance: **tixmo-qa**.

- [ ] Obtain approved target runtime values from intake and policy approval (gap 8).
      Runtime publication/config edits need Daniel's separate approval first.
- [ ] Use [checkout config runbook](../CHECKOUT_RUNTIME_CONFIG_EVIDENCE.md), then
      `npm run evidence:checkout-config` with explicit dashboard, expected API and
      currency, required policy/Stripe checks enabled and
      `TIXMO_CHECKOUT_CONFIG_EVIDENCE_PATH=docs/checkout-config-evidence/<env>-<date>.json`.
- [ ] Verify served approved Privacy/Terms/Refund URLs, publishable key, API target
      and currency match; checkout blocks when required inputs are absent. No
      `TIXMO_REQUIRE_POLICY_URLS=false` or Stripe non-launch bypass acceptance.

### 4. Target public-route screenshots missing

Owner: **tixmo-frontend**; independent acceptance: **tixmo-qa**.

- [ ] With approved dashboard, checkout slug, secure review/share references and
      published policy URLs, follow [screenshot runbook](../PUBLIC_ROUTE_SCREENSHOT_EVIDENCE.md).
      Run `npm run evidence:public-routes` with explicit target,
      `TIXMO_PUBLIC_EVIDENCE_REQUIRE_POLICIES=true`, and output directory
      `TIXMO_PUBLIC_EVIDENCE_PATH=docs/public-route-screenshots/<env>-<date>`.
- [ ] Attach `public-route-evidence.json` and desktop/mobile logged-out checkout,
      review/share screenshots; verify visible approved policies before payment.
      Redact raw token-bearing URLs before sharing proof.

### 5. Real-device scanner/offline evidence missing

Owner: **tixmo-qa**; Daniel/PM supplies named human operator and gate lead.

- [ ] Reserve actual staff-equivalent device/OS/browser/app, network/offline window,
      charged device and approved test event/tickets/scanner; operator participates
      physically. Browser automation is not a substitute.
- [ ] Complete [scanner guide](../SCANNER_SETUP_AND_FIELD_TEST.md): auth/sync,
      valid/duplicate/wrong-event/cancelled/invalid scans, log identity/timestamps,
      offline last-sync behavior, upload/reconciliation, revocation and replacement.
      Record offline duplicate-risk acceptance by gate lead and door-open decision.
- [ ] Attach redacted device details, scanner/event IDs, sync/upload times and results
      in `docs/scanner-field-test-evidence/<env>-<date>.json` (template gate `scanner`).

### 6. Backup/migration rollback evidence missing

Owner: **tixmo-release**; schema support: **tixmo-backend**;
second technical operator: **tixmo-lead**; authorization: **Daniel Chapman**.

- [ ] Obtain explicit backup/restore test approval, named second operator, isolated
      non-production recovery DB/API and approved secure backup handling first.
      Do not execute production migration or restore as a checklist shortcut.
- [ ] Complete [backup runbook](../DB_BACKUP_AND_MIGRATION_ROLLBACK.md): provider
      environment/service IDs, current and last-known-good deployment/SHA,
      scheduled backup timestamp/retention, pre-migration manual backup ID,
      applicable migration command/SHA/result, restored DB identity and app smoke
      (login/events/orders/tickets/reports/scanner/review/share). Record rollback
      owner and second approval. Never run destructive API verification on restored
      customer data or an unapproved DB; local disposable tests are distinct.
- [ ] Attach `docs/backup-rollback-evidence/<env>-<date>.json` (gate `backup`) only
      after actual restore outside production and verification; production switch
      remains a separate second-operator and launch-owner decision.

### 7. External reviewer/shared asset evidence missing

Owner: **tixmo-qa**; UI support: **tixmo-frontend**.

- [ ] Secure approved test reviewer/request/share references and permission for
      decision/comment/revoke mutations; no outbound invitations in task 61.
- [ ] Complete launch checklist Section 7 in logged-out/private browser on target:
      review opens, comment/decision submits, dashboard reflects action, shared
      assets open and revocation/expiry behaves correctly. Capture redacted IDs,
      screenshots and timestamps, never raw bearer tokens.
- [ ] Attach `docs/external-review-share-evidence/<env>-<date>.json`
      (gate `review-share`); read-only route smoke alone is insufficient.

### 8. Policy approval/publication evidence missing

Owner: **tixmo-pm**; product/launch approval: **Daniel Chapman**;
publication implementer after authorization: **tixmo-frontend**.

- [ ] Complete [policy checklist](../POLICY_PUBLICATION_CHECKLIST.md): final legal
      entity/contacts, named counsel signoff, named payment/support/security
      approvals and Daniel's V1 scope approval. Cover Privacy, Terms, Refund,
      Organizer Terms and Data Retention; drafts are not legal approval.
- [ ] Obtain explicit publication authority, publish approved versions/URLs and
      confirm footer/checkout/onboarding/settings/support links and privacy intake.
      Cross-link target config and screenshot proof (gaps 3/4), approver names,
      version IDs and approval timestamps.
- [ ] Attach `docs/policy-approval-evidence/<env>-<date>.json` (gate `policy`).
      No current approval or publication is asserted; an internal-only risk
      acceptance is not silently equivalent to approved public policy evidence.

### 9. Uptime/status evidence missing

Owner: **tixmo-release**; support/on-call routing owner: **tixmo-pm**.

- [ ] Obtain approved target origins, named alert recipient/destination, selected
      existing monitor/workflow and explicit authority for monitor/config/schedule
      changes and staging Sentry test. Inspect existing monitor state before edits.
- [ ] Follow [uptime runbook](../UPTIME_STATUS_MONITORING.md): `/health` returns
      HTTP 200 `status: ok`, `/api/v1/health` HTTP 200 JSON, dashboard HTTP 200-399.
      Capture one passing manual AND one genuinely scheduled run with timestamps,
      run URLs and target/SHA mapping; skipped/unconfigured workflow is not a pass.
- [ ] Confirm failed-run alert delivery to named launch/support recipient and
      staging-only Sentry test event with service/environment/release/alert-route
      tags. Record accepted cadence: existing GitHub template is 15 minutes,
      whereas runbook target recommendation is 1-5 minutes. Daniel must accept
      chosen cadence or authorize an adjustment; no scheduler changes here.
- [ ] Attach `docs/uptime-status-evidence/<env>-<date>.json` (gate `uptime`) with
      monitor configuration reference, manual/scheduled run proof, alert delivery
      proof and staging Sentry event reference. No paid/destructive checkout monitor.

## Artifact creation and independent acceptance

After dispatch, reuse `npm run evidence:manual-template -- --gate <gate>
--environment <env> --owner "<accountable owner>"` for the five manual gates.
Inspect the package script/template implementation first. Templates start pending;
record `environment`, actual `capturedAt`, exact `releaseSha`, `owner`, and
`evidence.summary` plus safe supporting links. Set `result: "pass"` only after
runbook completion and independent acceptance. No pending JSON generated here.

PM/QA must inspect contents: this checker does not establish freshness, deployed
SHA, real approvals or authentic manual completion; it also picks lexically latest
matching paths, so verify the selected artifacts explicitly. Historical June
artifacts never count as current passes. Refresh local/CI gates from the existing
ticket template on the final candidate under separately verified disposable-local
runtime authority; no API/DB/services execution performed by task 61.

- [ ] QA independently reviews this documentation commit and all nine mappings.
- [ ] PM records target/input/approval readiness and dispatches only bounded approved
      execution; blocked inputs stay open, not fabricated or assumed.
- [ ] After real evidence exists and gap 1's checker contract is independently
      resolved, rerun strict inventory, attach exact output/exit/SHA, inspect all
      evidence, and obtain Daniel's explicit go/no-go decision. A zero-gap JSON
      summary alone is not launch authorization.

This artifact changes no application, configuration, target, service or gate status.
No merge, push, deploy, publication or launch approval is included.
