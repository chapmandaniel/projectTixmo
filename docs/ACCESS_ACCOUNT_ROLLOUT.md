# Tixmo access/account rollout

This runbook accompanies the October 4, 2026 access remediation. Source verification passes locally; no production action has been performed. Use the existing release/backup/rollback process, with a named operator and recorded release SHA.

## Before deployment

1. Review the entire release candidate, including existing uncommitted work. This remediation branch also contains pre-existing project changes. Do not publish an unreviewed combined working tree.
2. Verify the actual Railway source root/start override for the API. Source `tixmoapi2/railway.toml` now starts migrations then the API; replace any deployment override that still includes automatic seeding. Updated legacy seed entry points are safe no-ops, including if an old override still invokes them.
3. Rehearse migration/rollback and account recovery on staging with representative retained data. The new migration is additive, but it deliberately disables historical seeded ADMIN identities and historical anonymized accounts.
4. Identify the business owner and any legacy/unscoped administrators using a privileged read-only inventory. Do not grant platform identity just because organizationId is null. Confirm legitimate membership before restoring access.
5. Take and verify a restorable backup. Preserve applied migration history and record the release SHA. Arrange access recovery before running the migration: old JWTs without sessionVersion are rejected, and historical seed identities are disabled.
6. Prepare operator credentials privately. Do not put passwords in CLI arguments, chat, commits or logs.

## Operator provisioning/recovery

Commands run from `tixmoapi2` and require an explicit private `DATABASE_URL`. Authorization, target URL and operation inputs are captured from the explicit process environment before Prisma is constructed; Prisma dotenv loading cannot supply these required inputs. Supply values through a private operator environment, then clear password variables after execution.

| Operation | Required private environment | Command |
| --- | --- | --- |
| Bootstrap a new owner/business | BOOTSTRAP_OWNER_EMAIL, BOOTSTRAP_OWNER_PASSWORD, BOOTSTRAP_OWNER_FIRST_NAME, BOOTSTRAP_OWNER_LAST_NAME, BOOTSTRAP_ORGANIZATION_NAME, BOOTSTRAP_ORGANIZATION_SLUG; BOOTSTRAP_ALLOW_PRODUCTION=true for NODE_ENV=production | `npm run db:bootstrap` |
| Rotate a reviewed existing account | ALLOW_OPERATOR_CREDENTIAL_ROTATION=true, ROTATE_ACCOUNT_ID, ROTATE_ACCOUNT_PASSWORD | `npm run db:rotate-credentials` |

Bootstrap refuses an existing email or another active owner and never overwrites passwords. Rotation requires a strong password of at least 12 characters, refuses deleted accounts, requires reviewed scope for an unscoped ADMIN, and refuses pending invitations (use Resend invitation). It preserves role/membership/platform identity, changes the hash, clears disabled status and increments sessionVersion. No script prints credentials.

For a single-business deployment, restore a legitimate ADMIN's business membership rather than inferring platform authority. There is no public API for setting the operator-managed platform-admin flag.

## Deployment and live acceptance

1. Deploy the reviewed API/dashboard release together and apply `20261004234000_account_revocation_and_invitations` once through normal migration deploy.
2. Explicitly rotate the affected legacy credentials or provision the intended owner using the guarded operation. Test new login privately and confirm the former credential and pre-upgrade access/refresh tokens fail.
3. Inspect and restrict historical application logs that may contain the old seeded credential. Record the review without copying secret values.
4. Rotate each active external reviewer capability that may have been exposed. An authorized operator can use the existing reviewer Resend action / `POST /api/v1/approvals/:approvalId/reviewers/:reviewerId/resend`. Its previous token immediately stops resolving; expired approvals remain expired. Confirm email delivery separately because this endpoint sends asynchronously.
5. Create a lower-role staff invitation and verify actual email delivery, password selection, sign-in, expiry/replay failure and Resend recovery. If creating an invite reports invitationDelivered=false, the account remains pending; use Resend invitation.
6. On a shared browser, sign out and sign in as a customer or different staff member; confirm old private approval/comment/reviewer data is absent and denied requests clear private state.
7. Remove/demote a test staff account. Confirm its old access and refresh tokens fail; a fresh CUSTOMER session has no business membership. Ordinary authorized same-business staff workflows must still work.
8. Record target URL, release SHA, migration result, operator, timestamp and acceptance results. Do not mark production remediation complete from local tests alone.

## Rollback

Use the verified release rollback process. Rolling back application code can re-enable legacy unsafe signup/seed paths or bypass disabled/session-version checks even if the new database columns remain. Do not run old automatic seed commands. A rollback is not security closure; keep exposure contained and document which protections are active.

## Next package

Payment/session idempotency, fulfillment recovery, real Stripe refund reconciliation and resumable customer checkout are next. Currency, full/partial refund eligibility, cancellation and used/transferred-ticket rules require business decisions before finalizing money movement. Admission/inventory and the remaining launch findings remain open.
