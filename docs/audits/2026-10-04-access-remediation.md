# Tixmo access remediation — October 4, 2026

Outcome: **fixed and verified locally for the selected access package; production rollout pending**. Branch: `codex/tixmo-access-remediation-2026-10-04`. This is work package 1 from the October 4 next-step plan, not closure of the full project audit.

The audited working tree, including its existing uncommitted work, was the implementation baseline. No commit, push, merge, deployment, production login, database update, payment or reviewer action was performed. Original sealed security results are unchanged.

## Boundaries closed in source

| Original finding | Change and proof |
| --- | --- |
| csf_36cc4d95fffda29085375842 — public signup grants staff/owner | Signup always creates an unscoped CUSTOMER. Before/after execution reproduced OWNER/TEAM_MEMBER creation in the original service and CUSTOMER in the patched service. Host, forwarded-host and Railway deployment variants are covered; signup/login still succeed. |
| csf_bd701b7117c5a005e522560e — deleted accounts remain renewable | Shared current-account resolution rejects disabled, anonymized and missing accounts. Deletion randomizes the password hash, clears role/membership/permissions/2FA and increments session version. Former access, refresh and password login fail. Historical anonymized users are disabled by migration. |
| csf_41bbc494bd49a4fc3a547760 — removed ADMIN becomes global | Global ADMIN identity now requires an explicit database flag. Membership removal demotes to CUSTOMER, clears permissions and revokes sessions. Null membership alone cannot grant global identity; deleting the business does not turn a scoped ADMIN into platform staff. Existing unscoped administrators require operator review. |
| csf_f3359431e053b0953bf6936d — stale role claims remain authoritative | Mandatory and optional JWT authentication resolve the current database account and session version. Forged/stale role copies cannot elevate authority. Role, membership and permission changes and logout revoke both token types. Legacy tokens without a version are rejected. |
| csf_3e1e2468bcec05833b01c9b6 — external reviewers receive peer bearer links | All external approval serializers omit reviewUrl/token capabilities. Fetch, reviewer addition and comment deletion responses are tested. A reviewer can still decide as themselves; legitimate internal operators retain review URLs. The existing resend endpoint is tested to invalidate an old link and issue a working replacement. Exposed production links have not been rotated. |
| csf_aaeb6034fc2205e15c4cf000 — startup reapplies/logs fixed admin credential | Automatic JS/TS seed entry points are harmless no-ops and the legacy admin script refuses. API Railway source config runs migrations then start. Historical seeded ADMIN identities are disabled by the new migration; removing future seeding alone was insufficient. Guarded owner bootstrap and explicit account credential rotation replace reset-on-start behavior. |
| csf_d7f66a2351af6a3ffcc86006 — approval cache crosses sessions | Private caches clear on logout/session replacement and are keyed by user, business, role and session generation. Private pages remount across sessions. Authorization denial clears visible cached approval data. Pending responses/refresh cannot overwrite a later account. Explicit logout credentials remain bound to the former account even if a new login wins before dispatch. |

The narrow shared enforcement point is database-backed account/session resolution, reused by both JWT middleware modes and refresh. Route-level business policies remain intact. Tixmo remains one business per deployment; legitimate same-business staff visibility was not classified as a vulnerability.

## Staff enrollment and recovery

Passwordless team creation creates a disabled account with a random unusable password hash. A 32-byte random invitation is emailed, stored only as SHA-256, bound to the account's session version and issuer, and expires after 48 hours. Redemption checks the issuer's current role/business authority and atomically claims/activates once. Replay, expiry, malformed/random links, concurrent redemption, changed roles and offboarded issuers are tested.

The public `/invite#token` page chooses a password, consumes the fragment from the address bar, supports reopening a replacement link, and signs in only after successful redemption. Passwords are not emailed. Owners/admins/managers/promoters retain the existing hierarchy-limited invitation workflow.

`POST /api/v1/users/:id/invitation` recovers pending/expired invitations, rechecks issuer and target scope, and invalidates prior links. Delivery failure is reported and can be retried. Team roster responses expose only pending/delivery state, not capability values; the dashboard provides Resend invitation and delivery notices.

An explicit staff-to-CUSTOMER demotion removes business membership and custom permissions so fresh customer login cannot retain private approval access.

## Files changed

- API: `src/utils/accountSession.ts`, `src/utils/jwt.ts`, `src/utils/tenantScope.ts`, `src/middleware/auth.ts`; auth routes/controller/validation/service; users routes/controller/validation/service; organization membership service; approval serialization.
- Database/operations: Prisma user status/version/platform identity, StaffInvitation model, `20261004234000_account_revocation_and_invitations` migration, harmless legacy seeds, `bootstrap-owner.js`, `rotate-account-credentials.js`, retired fixed admin script, package scripts and `railway.toml`.
- Dashboard: session/API/auth utilities, App/ErrorBoundary, ApprovalsDashboard/ApprovalDetailView, AcceptInvitationView, TeamView and TeamMemberWizard.
- Tests: new account-security/bootstrap integration suites, session-race/invitation UI tests, approval redaction/rotation and cache regression assertions, current-authority fixtures. Two already-expired asset/event date fixtures now use relative future dates.
- Documentation: role/action permission matrix and access rollout runbook.

Comparison against the pre-remediation copied working tree identified 47 modified existing files and 10 added implementation/test/configuration files before this report/runbook export, with no removed files. Dependency lockfiles and unrelated existing changes were preserved.

## Ordered verification

All database commands used explicit disposable loopback targets in an environment-free source copy. No normal project `.env` database was used.

1. **Final diff and syntax/import checks — pass.** Operator CLI entry points additionally pass `node --check`; six executed CLI cases reject missing explicit target/authorization and incomplete inputs without exposing credentials. `git diff --check`; API `npm run build` and `npm run typecheck`; dashboard `npm run build`.
2. **Security triggers and alternate inputs — pass.** `npm test -- --runInBand tests/integration/account-security.test.ts tests/integration/bootstrap-owner.test.ts tests/unit/users.service.test.ts tests/unit/users.controller.test.ts`: 4 suites, 29 tests. Before/after signup proof reproduced the old escalation and the new restriction. Populated upgrade proof exercised ordinary scoped/global/anonymized accounts plus a legacy seeded identity; legacy password login fails after upgrade, explicit guarded rotation restores login, and the former password still fails. Forged role claims, missing version, same-second logout, stale access/refresh, expired/replayed/random/malformed invites, concurrent redemption, recovery scope and email failure/retry are covered.
3. **Legitimate controls and owning-package gates — pass.** API full `npm test -- --runInBand`: **55 suites / 355 tests**. Dashboard full `npm test -- --run`: **26 suites / 126 tests**. API lint: zero errors / 286 warnings. `npm run design:guard`: no added violations against the existing 1,055 baseline. Final reviewer rotation assertions: `npm test -- --runInBand tests/integration/approvals.test.ts`, 13 tests pass. Fresh PostgreSQL 17 replay applies all 27 migrations; upgrade applies the new migration after the original 26.
4. **Candidate review — completed once.** Independent read-only review identified the surviving seeded credential and missing expired-invitation recovery. Both were confirmed, corrected and validated. Parent final challenge reproduced and fixed the logout account-switch race.
5. **Local browser controls — pass with stated scope.** Invitation form inspected at 390×844 and 1440×960; complete/incomplete link and password mismatch states checked. Team resend inspected and clicked with local mocked API responses on desktop/mobile. No horizontal overflow at sampled widths. Screenshots were visually inspected.

An early baseline Jest reproduction attempt was blocked by generated-client type mismatch, then replaced with an executed before/after service proof in its own disposable database. The logout regression initially failed with the new account's bearer token, then passed after preserving explicit authorization. These intermediate failures were not counted as final success.

## Limitations and next work

- Production is unchanged. Local closure does not revoke already exposed reviewer links or credentials in old production logs. Follow the access rollout runbook before claiming live remediation.
- Migration rejects pre-upgrade session tokens and disables historical seed identities. Staff must sign in again; arrange an operator recovery path before rollout.
- No platform administrator is inferred/backfilled from null membership. Review legitimate unscoped accounts explicitly.
- Invitation/reviewer mail tests mock delivery. Production Postmark delivery, real-device onboarding, staging rollout/rollback and backup restore remain unverified.
- Redis is mocked by the repository test setup; these tests do not prove multi-process Redis behavior or capacity.
- Local browser Team actions used fixtures. Pre-existing missing favicon and temporary HMR reload errors were observed; a completely clean production browser console is not asserted.
- Lint warnings, grandfathered design violations, vulnerable dependencies and runtime versions were not remediated by this package.
- Audit counterevidence: the original fixed seed did assign a business membership; the sealed scan's characterization of that seed as unscoped is not accurate for this baseline. Its known password reset/logging flaw and the separate offboarding-to-global flaw were confirmed and addressed.
- Remaining work packages: payment/fulfillment/refund/customer recovery; admission/inventory/sales eligibility; event timezone/lifecycle and truthful metrics; upload/waiting-room/tooling/runtime/dependency/release hardening. Currency and refund-policy choices are pending before financial behavior is finalized.

Temporary browser/server and two disposable database containers were closed/removed; the initially stopped Tixmo Colima profile was stopped again.

## Retained evidence

The target-bound Codex Security supplemental collection retains API/dashboard full-suite logs, API build/typecheck/lint, reviewer rotation tests, before/after signup execution, dashboard build/design guard, CLI guard proof and four inspected desktop/mobile screenshots under `artifacts/access-remediation/`. The sealed original scan is not modified. Repo copies of this report and the [rollout runbook](</Users/danielchapman/Desktop/Project Tixmo/docs/ACCESS_ACCOUNT_ROLLOUT.md>) accompany the source.
