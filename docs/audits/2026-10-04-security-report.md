# Security Review: Project Tixmo

## Scope

Security component of full Tixmo current-project audit; full API/frontend runtime, test and operational source review under one business per deployment.

- Scan mode: repository
- Target kind: git_worktree
- Target ID: target_sha256_1f2554f376ba8bd69a17318929f7ca775c38bba112866cdb331091e1249f3e83
- Revision: 2f3a05540b6db6f6bd8c026156e74afcc7b1bf9e
- Snapshot digest: codex-security-snapshot/v1:sha256:2650b6ca53aa1853e9845011a7c96de65839388b576e20f59a2b694628eb87ad
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Artifacts reviewed: .github/workflows/checkout-runtime-config-evidence.yml, .github/workflows/dependency-audit-evidence.yml, .github/workflows/external-smoke-evidence.yml, .github/workflows/market-readiness-local.yml, .github/workflows/public-route-screenshot-evidence.yml, .github/workflows/tdash-design-system.yml, .github/workflows/uptime-status.yml, .gitignore, docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md, docs/PRODUCTION_LAUNCH_CHECKLIST.md, docs/PUBLIC_ROUTE_SCREENSHOT_EVIDENCE.md, scripts/capture-public-route-evidence.mjs, scripts/check-checkout-runtime-config.mjs, scripts/check-status.mjs, scripts/create-manual-evidence-template.mjs, scripts/dependency-audit-evidence.mjs, scripts/dev.mjs, scripts/evidence-status.mjs, scripts/external-smoke-evidence.mjs, scripts/local-checkout-smoke.mjs, scripts/verify-api.mjs, scripts/verify-market-local.mjs, tdash/.dockerignore, tdash/Dockerfile, tdash/docker-compose.yml, tdash/docker-entrypoint.d/40-runtime-config.sh, tdash/nginx.conf, tdash/nginx.site.conf, tdash/package.json, tdash/postcss.config.js, tdash/scripts/design-system-guard.mjs, tdash/src/App.jsx, tdash/src/components/ApprovalCard.jsx, tdash/src/components/AssetUploader.jsx, tdash/src/components/CommentThread.jsx, tdash/src/components/ConfirmationModal.jsx, tdash/src/components/ErrorBoundary.jsx, tdash/src/components/GlobalErrorNotification.jsx, tdash/src/components/InputField.jsx, tdash/src/components/ReviewerSelector.jsx, tdash/src/components/SidebarItem.jsx, tdash/src/components/StatCard.jsx, tdash/src/components/StatusBadge.jsx, tdash/src/components/TicketBuilder.jsx, tdash/src/components/dashboard/DashboardPrimitives.jsx, tdash/src/data/mockData.js, tdash/src/features/AnalyticsView.jsx, tdash/src/features/ApprovalDetailView.jsx, tdash/src/features/ApprovalGalleryCard.jsx, tdash/src/features/ApprovalStudio.jsx, tdash/src/features/ApprovalsDashboard.jsx, tdash/src/features/ApprovalsView.jsx, tdash/src/features/AssetLibraryView.jsx, tdash/src/features/ComingSoonView.jsx, tdash/src/features/CreateApprovalModal.jsx, tdash/src/features/CreateTaskModal.jsx, tdash/src/features/CreativeControls.jsx, tdash/src/features/CreativePreview.jsx, tdash/src/features/DashboardHome.jsx, tdash/src/features/DashboardPlaceholderView.jsx, tdash/src/features/DevDashboard.jsx, tdash/src/features/ECC_Attendees.jsx, tdash/src/features/ECC_Marketing.jsx, tdash/src/features/ECC_Orders.jsx, tdash/src/features/ECC_Overview.jsx, tdash/src/features/ECC_Settings.jsx, tdash/src/features/ECC_Tickets.jsx, tdash/src/features/EventCommandCenter.jsx, tdash/src/features/EventManagementDashboard.jsx, tdash/src/features/EventStudio.jsx, tdash/src/features/EventWizard.jsx, tdash/src/features/EventsView.jsx, tdash/src/features/KanbanCard.jsx, tdash/src/features/LoginView.jsx, tdash/src/features/OrderDetailModal.jsx, tdash/src/features/OrdersView.jsx, tdash/src/features/PersonalTodoView.jsx, tdash/src/features/PromoCodeModal.jsx, tdash/src/features/PromoCodesView.jsx, tdash/src/features/RegisterScannerModal.jsx, tdash/src/features/ScannersView.jsx, tdash/src/features/SettingsView.jsx, tdash/src/features/TaskDetailsModal.jsx, tdash/src/features/TeamMemberWizard.jsx, tdash/src/features/TeamView.jsx, tdash/src/features/TicketTypeModal.jsx, tdash/src/features/TodoView.jsx, tdash/src/features/UserModal.jsx, tdash/src/features/VenueWizard.jsx, tdash/src/features/VenuesView.jsx, tdash/src/features/WaitingRoomView.jsx, tdash/src/features/approvalConstants.js, tdash/src/index.jsx, tdash/src/layouts/DashboardLayout.jsx, tdash/src/lib/analyticsSources.js, tdash/src/lib/api.js, tdash/src/lib/auth.js, tdash/src/lib/dashboardTheme.js, tdash/src/lib/dashboardTruth.js, tdash/src/lib/runtimeConfig.js, tdash/src/lib/session.js, tdash/src/lib/utils.js, tdash/src/pages/CheckoutPage.jsx, tdash/src/pages/ExternalReviewPage.jsx, tdash/src/pages/SharedAssetFolderPage.jsx, tdash/src/test/AnalyticsView.test.jsx, tdash/src/test/AppSession.test.jsx, tdash/src/test/ApprovalCard.test.jsx, tdash/src/test/ApprovalDetailView.test.jsx, tdash/src/test/ApprovalsDashboard.test.jsx, tdash/src/test/AssetLibraryView.test.jsx, tdash/src/test/AssetUploader.test.jsx, tdash/src/test/CheckoutPage.test.jsx, tdash/src/test/DashboardPlaceholderView.test.jsx, tdash/src/test/DashboardTruth.test.jsx, tdash/src/test/EventCommandCenter.test.jsx, tdash/src/test/EventsView.test.jsx, tdash/src/test/ExternalReviewPage.test.jsx, tdash/src/test/LoginView.test.jsx, tdash/src/test/NotificationResilience.test.jsx, tdash/src/test/ScannersView.test.jsx, tdash/src/test/SharedAssetFolderPage.test.jsx, tdash/src/test/Smoke.test.jsx, tdash/src/test/StatCard.test.jsx, tdash/src/test/StatusBadge.test.jsx, tdash/src/test/TeamView.test.jsx, tdash/src/test/TicketBuilder.test.jsx, tdash/src/test/__snapshots__/StatusBadge.test.jsx.snap, tdash/src/test/runtimeConfig.test.jsx, tdash/src/test/session.test.js, tdash/src/test/setup.js, tdash/tailwind.config.js, tdash/vite.config.js, tdash/vitest.config.js, tixmoapi2/.eslintrc.json, tixmoapi2/.github/workflows/ci.yml, tixmoapi2/.gitignore, tixmoapi2/docker-compose.yml, tixmoapi2/jest.config.js, tixmoapi2/nodemon.json, tixmoapi2/package.json, tixmoapi2/prisma/factories/event.factory.ts, tixmoapi2/prisma/factories/order.factory.ts, tixmoapi2/prisma/factories/organization.factory.ts, tixmoapi2/prisma/factories/promo-code.factory.ts, tixmoapi2/prisma/factories/scanner.factory.ts, tixmoapi2/prisma/factories/ticket-type.factory.ts, tixmoapi2/prisma/factories/user.factory.ts, tixmoapi2/prisma/factories/venue.factory.ts, tixmoapi2/prisma/migrations/20251029024657_init/migration.sql, tixmoapi2/prisma/migrations/20251106234538_add_scanner_and_scan_log_models/migration.sql, tixmoapi2/prisma/migrations/20251107004712_add_notification_models/migration.sql, tixmoapi2/prisma/migrations/20251213132041_add_tasks/migration.sql, tixmoapi2/prisma/migrations/20251219023936_add_deleted_at_to_event/migration.sql, tixmoapi2/prisma/migrations/20260101000000_add_title_manual/migration.sql, tixmoapi2/prisma/migrations/20260101000001_add_permissions_manual/migration.sql, tixmoapi2/prisma/migrations/20260102000000_make_category_optional/migration.sql, tixmoapi2/prisma/migrations/20260102000001_make_timezone_optional/migration.sql, tixmoapi2/prisma/migrations/20260105153700_sync_schema_drift/migration.sql, tixmoapi2/prisma/migrations/20260105223709_add_task_mention_notification_type/migration.sql, tixmoapi2/prisma/migrations/20260201203653_add_approval_system/migration.sql, tixmoapi2/prisma/migrations/20260211210000_fix_ticket_types_and_tiers/migration.sql, tixmoapi2/prisma/migrations/20260216143335_add_approval_type/migration.sql, tixmoapi2/prisma/migrations/20260309120000_rebuild_creative_approval_system/migration.sql, tixmoapi2/prisma/migrations/20260403153000_add_approval_comment_visibility/migration.sql, tixmoapi2/prisma/migrations/20260403170000_add_approval_reviewer_association/migration.sql, tixmoapi2/prisma/migrations/20260502120000_add_approval_curation_fields/migration.sql, tixmoapi2/prisma/migrations/20260502133000_add_manager_role/migration.sql, tixmoapi2/prisma/migrations/20260504120000_add_direct_asset_library/migration.sql, tixmoapi2/prisma/migrations/20260504143000_add_asset_library_usage_type/migration.sql, tixmoapi2/prisma/migrations/20260508140000_add_asset_library_folders/migration.sql, tixmoapi2/prisma/migrations/20260508153000_add_asset_library_folder_shares/migration.sql, tixmoapi2/prisma/migrations/20260508173000_add_asset_library_share_folders/migration.sql, tixmoapi2/prisma/migrations/20260518120000_add_folder_share_token_ciphertext/migration.sql, tixmoapi2/prisma/migrations/20260602010000_add_payment_webhook_events/migration.sql, tixmoapi2/prisma/migrations/migration_lock.toml, tixmoapi2/prisma/schema.prisma, tixmoapi2/prisma/seed-approvals.ts, tixmoapi2/prisma/seed-minimal.js, tixmoapi2/prisma/seed-minimal.ts, tixmoapi2/prisma/seed.ts, tixmoapi2/prisma/seeders/01-users.seeder.ts, tixmoapi2/prisma/seeders/02-organizations.seeder.ts, tixmoapi2/prisma/seeders/03-venues.seeder.ts, tixmoapi2/prisma/seeders/04-events.seeder.ts, tixmoapi2/prisma/seeders/05-ticket-types.seeder.ts, tixmoapi2/prisma/seeders/06-promo-codes.seeder.ts, tixmoapi2/prisma/seeders/07-orders.seeder.ts, tixmoapi2/prisma/seeders/08-scanners.seeder.ts, tixmoapi2/prisma/utils/cleanup.ts, tixmoapi2/prisma/utils/seed-logger.ts, tixmoapi2/scripts/create-admin-user.ts, tixmoapi2/scripts/dev-data-populate.ts, tixmoapi2/scripts/dev-data.ts, tixmoapi2/scripts/export-openapi.js, tixmoapi2/scripts/generate-event-simulation.ts, tixmoapi2/scripts/market-demo-data.ts, tixmoapi2/scripts/postCoverageComment.js, tixmoapi2/scripts/setup.sh, tixmoapi2/scripts/verify-s3.ts, tixmoapi2/src/api/analytics/controller.ts, tixmoapi2/src/api/analytics/routes.ts, tixmoapi2/src/api/analytics/service.ts, tixmoapi2/src/api/analytics/validation.ts, tixmoapi2/src/api/approvals/controller.ts, tixmoapi2/src/api/approvals/routes.ts, tixmoapi2/src/api/approvals/service.ts, tixmoapi2/src/api/approvals/validation.ts, tixmoapi2/src/api/assets/controller.ts, tixmoapi2/src/api/assets/routes.ts, tixmoapi2/src/api/assets/service.ts, tixmoapi2/src/api/auth/controller.ts, tixmoapi2/src/api/auth/routes.ts, tixmoapi2/src/api/auth/service.ts, tixmoapi2/src/api/auth/tenantOrganization.ts, tixmoapi2/src/api/auth/validation.ts, tixmoapi2/src/api/docs/routes.ts, tixmoapi2/src/api/events/controller.ts, tixmoapi2/src/api/events/public.routes.ts, tixmoapi2/src/api/events/routes.ts, tixmoapi2/src/api/events/service.ts, tixmoapi2/src/api/events/stats.service.ts, tixmoapi2/src/api/events/validation.ts, tixmoapi2/src/api/index.ts, tixmoapi2/src/api/notifications/controller.ts, tixmoapi2/src/api/notifications/routes.ts, tixmoapi2/src/api/notifications/service.ts, tixmoapi2/src/api/notifications/validation.ts, tixmoapi2/src/api/orders/controller.ts, tixmoapi2/src/api/orders/routes.ts, tixmoapi2/src/api/orders/service.ts, tixmoapi2/src/api/orders/validation.ts, tixmoapi2/src/api/organizations/controller.ts, tixmoapi2/src/api/organizations/routes.ts, tixmoapi2/src/api/organizations/service.ts, tixmoapi2/src/api/organizations/validation.ts, tixmoapi2/src/api/payments/controller.ts, tixmoapi2/src/api/payments/routes.ts, tixmoapi2/src/api/payments/service.ts, tixmoapi2/src/api/payments/validation.ts, tixmoapi2/src/api/promo-codes/controller.ts, tixmoapi2/src/api/promo-codes/routes.ts, tixmoapi2/src/api/promo-codes/service.ts, tixmoapi2/src/api/promo-codes/validation.ts, tixmoapi2/src/api/reports/controller.ts, tixmoapi2/src/api/reports/routes.ts, tixmoapi2/src/api/reports/service.ts, tixmoapi2/src/api/reports/validation.ts, tixmoapi2/src/api/review/routes.ts, tixmoapi2/src/api/scanners/controller.ts, tixmoapi2/src/api/scanners/routes.ts, tixmoapi2/src/api/scanners/service.ts, tixmoapi2/src/api/scanners/validation.ts, tixmoapi2/src/api/tasks/controller.ts, tixmoapi2/src/api/tasks/routes.ts, tixmoapi2/src/api/tasks/service.ts, tixmoapi2/src/api/ticket-tiers/controller.ts, tixmoapi2/src/api/ticket-tiers/routes.ts, tixmoapi2/src/api/ticket-tiers/service.ts, tixmoapi2/src/api/ticket-tiers/validation.ts, tixmoapi2/src/api/ticket-types/controller.ts, tixmoapi2/src/api/ticket-types/routes.ts, tixmoapi2/src/api/ticket-types/service.ts, tixmoapi2/src/api/ticket-types/validation.ts, tixmoapi2/src/api/tickets/controller.ts, tixmoapi2/src/api/tickets/routes.ts, tixmoapi2/src/api/tickets/service.ts, tixmoapi2/src/api/tickets/validation.ts, tixmoapi2/src/api/users/controller.ts, tixmoapi2/src/api/users/routes.ts, tixmoapi2/src/api/users/service.ts, tixmoapi2/src/api/users/validation.ts, tixmoapi2/src/api/venues/controller.ts, tixmoapi2/src/api/venues/routes.ts, tixmoapi2/src/api/venues/service.ts, tixmoapi2/src/api/venues/validation.ts, tixmoapi2/src/api/waitlists/controller.ts, tixmoapi2/src/api/waitlists/routes.ts, tixmoapi2/src/api/waitlists/service.ts, tixmoapi2/src/app.ts, tixmoapi2/src/config/database.ts, tixmoapi2/src/config/email.ts, tixmoapi2/src/config/environment.ts, tixmoapi2/src/config/logger.ts, tixmoapi2/src/config/prisma.ts, tixmoapi2/src/config/redis.ts, tixmoapi2/src/config/s3.ts, tixmoapi2/src/config/sentry.ts, tixmoapi2/src/config/swagger.ts, tixmoapi2/src/index.ts, tixmoapi2/src/jobs/approval-reminder.job.ts, tixmoapi2/src/jobs/order-expiry.job.ts, tixmoapi2/src/middleware/auth.ts, tixmoapi2/src/middleware/authorize.ts, tixmoapi2/src/middleware/authorizeOrg.ts, tixmoapi2/src/middleware/errorHandler.ts, tixmoapi2/src/middleware/notFoundHandler.ts, tixmoapi2/src/middleware/rateLimiter.ts, tixmoapi2/src/middleware/requestLogger.ts, tixmoapi2/src/middleware/scannerAuth.ts, tixmoapi2/src/middleware/validate.ts, tixmoapi2/src/middleware/validateExpress.ts, tixmoapi2/src/middleware/waitingRoom.ts, tixmoapi2/src/services/approval-email.service.ts, tixmoapi2/src/services/redis-lock.service.ts, tixmoapi2/src/services/upload.service.ts, tixmoapi2/src/types/index.ts, tixmoapi2/src/utils/ApiError.ts, tixmoapi2/src/utils/catchAsync.ts, tixmoapi2/src/utils/clientOrigin.ts, tixmoapi2/src/utils/emailTemplates.ts, tixmoapi2/src/utils/jwt.ts, tixmoapi2/src/utils/notificationService.ts, tixmoapi2/src/utils/password.ts, tixmoapi2/src/utils/qrcode.ts, tixmoapi2/src/utils/response.ts, tixmoapi2/src/utils/retry.ts, tixmoapi2/src/utils/tenantScope.ts, tixmoapi2/tests/benchmark/event_cache.benchmark.test.ts, tixmoapi2/tests/benchmark/syncTickets.test.ts, tixmoapi2/tests/benchmark/ticketCreation.test.ts, tixmoapi2/tests/integration/advanced.test.ts, tixmoapi2/tests/integration/apiRateLimit.test.ts, tixmoapi2/tests/integration/app.test.ts, tixmoapi2/tests/integration/approvals.test.ts, tixmoapi2/tests/integration/auth.test.ts, tixmoapi2/tests/integration/authRateLimit.test.ts, tixmoapi2/tests/integration/concurrency.test.ts, tixmoapi2/tests/integration/orders.test.ts, tixmoapi2/tests/integration/organizations.test.ts, tixmoapi2/tests/integration/payments.test.ts, tixmoapi2/tests/integration/payments_retry.test.ts, tixmoapi2/tests/integration/promo-codes.test.ts, tixmoapi2/tests/integration/reports.test.ts, tixmoapi2/tests/integration/scanners-offline.test.ts, tixmoapi2/tests/integration/tickets.test.ts, tixmoapi2/tests/integration/users.test.ts, tixmoapi2/tests/integration/users_create.test.ts, tixmoapi2/tests/integration/venues.test.ts, tixmoapi2/tests/security/organization_update_auth.test.ts, tixmoapi2/tests/security/payment_validation.test.ts, tixmoapi2/tests/security/submit_decision_validation.test.ts, tixmoapi2/tests/security/tenant_scope.test.ts, tixmoapi2/tests/security/verify_cors_logic.js, tixmoapi2/tests/setup.ts, tixmoapi2/tests/smoke/v1-market-smoke.test.ts, tixmoapi2/tests/unit/ApiError.test.ts, tixmoapi2/tests/unit/api/events-public.service.test.ts, tixmoapi2/tests/unit/api/organizations/controller_auth.test.ts, tixmoapi2/tests/unit/approval-email.service.test.ts, tixmoapi2/tests/unit/approval_upload_limit.test.ts, tixmoapi2/tests/unit/approval_upload_validation.test.ts, tixmoapi2/tests/unit/asset-library.service.test.ts, tixmoapi2/tests/unit/asset_upload_validation.test.ts, tixmoapi2/tests/unit/auth.service.test.ts, tixmoapi2/tests/unit/client-origin.test.ts, tixmoapi2/tests/unit/cors.test.ts, tixmoapi2/tests/unit/email.config.test.ts, tixmoapi2/tests/unit/environment.config.test.ts, tixmoapi2/tests/unit/organizations.controller.test.ts, tixmoapi2/tests/unit/password.test.ts, tixmoapi2/tests/unit/qrcode.test.ts, tixmoapi2/tests/unit/redis-lock.test.ts, tixmoapi2/tests/unit/report.service.test.ts, tixmoapi2/tests/unit/response.test.ts, tixmoapi2/tests/unit/security_fixes.test.ts, tixmoapi2/tests/unit/sentry.config.test.ts, tixmoapi2/tests/unit/stats.service.test.ts, tixmoapi2/tests/unit/upload.service.test.ts, tixmoapi2/tests/unit/users.controller.test.ts, tixmoapi2/tests/unit/users.service.test.ts, tixmoapi2/tests/unit/waiting-room.test.ts, tixmoapi2/tests/utils/README.md, tixmoapi2/tests/utils/testUtils.ts, tixmoapi2/tests/verification/boot.test.ts, tixmoapi2/tsconfig.json
- Scan context: do a full audit on Tixmo project, so we can start planning next steps

Limitations and exclusions:
- No authenticated production journey or exploitation.
- Actual offline scanner client, provider control-plane permissions, restore and proxy sanitization acceptance remain unavailable.
- Full source review does not establish all package advisory exploitability or production acceptance.
- Excluded .git/\*\*: Git internals are not application implementation; branch/revision metadata was independently verified.
- Excluded \*\*/node_modules/\*\*; \*\*/dist/\*\*; \*\*/coverage/\*\*: Generated/vendor copies excluded from line-by-line source review; npm audited locked dependency graph and fresh application builds/tests ran. No implementation-owning generated application code was identified.
- Excluded \*\*/.env; \*\*/.env.\*; \*\*/logs/\*\*: Credential values and existing logs omitted; relevant destination and configured/not-configured state inspected without recording secrets.
- Excluded Static image/font/style assets and historical docs/evidence archives: Non-executable design media and historical prose/artifact files were supporting context rather than individually certified security source. Active scripts, schema, API/frontend implementation and relevant launch/rollback runbooks were reviewed.
- Excluded External live systems and actual scanner client: Repository cannot establish provider IAM/proxy/access policies or actual device cache semantics; production writes and exploit execution were outside this audit.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 16 |
| Severity mix | high: 5, medium: 11 |
| Confidence mix | high: 16 |
| Coverage | partial |
| Validation mode | Source tracing, counterevidence review and harmless exact-parser runtime-config reproduction. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Tixmo combines a React/Vite browser dashboard, public checkout/review/share pages, and an Express/TypeScript API backed by Prisma/PostgreSQL and Redis. API startup connects PostgreSQL and Redis before importing Express, listening on PORT (default 3000), and starting order-expiry and approval-reminder jobs (tixmoapi2/src/index.ts:10-32). Versioned routes include staff operations, customer orders/tickets/payments, scanner operations, approval review, asset sharing, and reports (tixmoapi2/src/api/index.ts:41-66). User-provided deployment context: one business per deployment; broad authorized staff visibility within that business is not a cross-tenant boundary. Local root npm dev launches the two packages and Docker database services (package.json:7-11; scripts/dev.mjs:162-176). Frontend production uses a multi-stage Docker build and Nginx static SPA serving; API production starts dist/index.js, but production infrastructure configuration is not present in inspected source (tdash/Dockerfile:13-27; tixmoapi2/package.json:7-9).

### Assets

- Protected assets include user identities/password hashes/roles and business records in PostgreSQL (tixmoapi2/prisma/schema.prisma:57-94), customer order/ticket ownership and payment state (tixmoapi2/src/api/orders/service.ts:274-278; tixmoapi2/src/api/payments/service.ts:201-249), browser access/refresh tokens in origin-local localStorage keys access_token and refresh_token (tdash/src/lib/session.js:1-4,21-48,89-103), JWT signing keys and refresh revocation timestamps (tixmoapi2/src/utils/jwt.ts:15-46; tixmoapi2/src/api/auth/service.ts:32-33,252-266), scanner API keys stored in PostgreSQL (tixmoapi2/src/api/scanners/service.ts:64-65,98-108,134-161), reviewer bearer tokens and asset-share capabilities (tixmoapi2/src/api/approvals/service.ts:161-168,434-447; tixmoapi2/src/api/assets/service.ts:60-83,729-738), private uploaded media and S3 credentials (tixmoapi2/src/config/s3.ts:4-15; tixmoapi2/src/services/upload.service.ts:74-87), Redis rate-limit/availability/revocation state (tixmoapi2/src/middleware/rateLimiter.ts:19-32,66-98; tixmoapi2/src/middleware/waitingRoom.ts:6-19), and credentials/data sent to Stripe, email providers, logs, and Sentry (tixmoapi2/src/api/payments/service.ts:21-65; tixmoapi2/src/config/email.ts:43-59,135-197; tixmoapi2/src/config/logger.ts:36-46; tixmoapi2/src/config/sentry.ts:17-63).

### Trust Boundaries

- Browser/public client -\> API: Axios sends Authorization bearer tokens and refresh-token request bodies to a runtime-configured API URL; runtime config overrides build-time VITE_API_URL (tdash/src/lib/runtimeConfig.js:13-16; tdash/src/lib/api.js:11-41,56-62). Express owns bearer verification, route role gates, 10 MB parsers, Helmet, CORS, and rate-limit middleware; trusted browser origins include configured CORS_ORIGIN/CLIENT_URL plus HTTPS tixmo.co subdomains, while Origin-less clients are allowed (tixmoapi2/src/app.ts:23-63,132; tixmoapi2/src/middleware/auth.ts:28-54; tixmoapi2/src/middleware/authorize.ts:7-21; tixmoapi2/src/utils/clientOrigin.ts:18-45). Public enrollment -\> staff identity: register consumes X-Forwarded-Host before Host, derives an organization seed before Railway environment fallbacks, and assigns OWNER to its first member or TEAM_MEMBER thereafter; proxy/header restrictions are external assumptions (tixmoapi2/src/api/auth/routes.ts:90; tixmoapi2/src/api/auth/controller.ts:20-26; tixmoapi2/src/api/auth/tenantOrganization.ts:90-108; tixmoapi2/src/api/auth/service.ts:36-84,99-117). Customer -\> payment: authenticated creation retrieves the caller-owned order and derives the amount from database totalAmount; Stripe webhook signature verification is separate from browser authentication (tixmoapi2/src/api/payments/routes.ts:49-67; tixmoapi2/src/api/payments/service.ts:32-65,88-101). Scanner device -\> admission/attendee data: separate bearer API keys authenticate an ACTIVE scanner; route-specific scanner flows must preserve event assignment and paid-ticket invariants (tixmoapi2/src/middleware/scannerAuth.ts:19-48; tixmoapi2/src/api/scanners/service.ts:134-161,394-436). Reviewer -\> approval: public token routes permit reading, decisions, comments, and adding reviewers; service lookup/expiry binds the token to its approval reviewer (tixmoapi2/src/api/review/routes.ts:9-35; tixmoapi2/src/api/approvals/service.ts:1495-1510,1831-1845). Asset-share recipient -\> selected folders: a distinct random bearer token is hashed for lookup, encrypted for operator retrieval, and checked for revocation/expiry (tixmoapi2/src/api/assets/routes.ts:7; tixmoapi2/src/api/assets/service.ts:60-83,729-753,813-845). API -\> filesystem/S3: authenticated multipart staging writes to os.tmpdir(), then S3 uses assets/{organizationId}/{UUID}{extension} or approvals/{approvalId}/revision-{n}/{UUID}{extension}; serialized URLs delegate GET access for 24 hours independently of later API checks (tixmoapi2/src/api/assets/controller.ts:61-80; tixmoapi2/src/api/approvals/controller.ts:20-45; tixmoapi2/src/api/assets/service.ts:914-925; tixmoapi2/src/api/approvals/service.ts:452-464; tixmoapi2/src/services/upload.service.ts:59-87,112-131). API -\> email/logging/telemetry: reviewer links go to reviewer email addresses through Postmark/SMTP; originalUrl is logged, and Sentry receives error/request context with only limited explicit password-field scrubbing (tixmoapi2/src/services/approval-email.service.ts:40-88; tixmoapi2/src/middleware/requestLogger.ts:4-17; tixmoapi2/src/config/sentry.ts:17-63). Operator/release tooling -\> database: migration, seed, reset, and demo commands use privileged database authority outside HTTP authentication (tixmoapi2/package.json:18-27; tixmoapi2/prisma/utils/cleanup.ts:4-46).

### Attacker Capabilities

- Unauthenticated clients can reach public event, registration/login/refresh, review-token, asset-share-token, and webhook routes; they control request headers/body/URL within parser and rate limits (tixmoapi2/src/api/index.ts:42-63; tixmoapi2/src/api/auth/routes.ts:90,157,215; tixmoapi2/src/api/review/routes.ts:14-35; tixmoapi2/src/api/assets/routes.ts:7; tixmoapi2/src/api/payments/routes.ts:67). Customers possess their own credentials/orders; authenticated staff possess their assigned role and business authority, not unrestricted destructive/admin rights. Scanner-key holders possess scanner capability rather than user-session authority (tixmoapi2/src/middleware/authorize.ts:7-21; tixmoapi2/src/middleware/scannerAuth.ts:19-48). Reviewer/share-link holders possess intentionally delegated capabilities; ordinary forwarding within that capability is not automatically a privilege escalation. Meaningful failures could add unearned staff/admin privileges, access to another customer's data, admission authority outside assigned events, unauthorized approval/media access, or payment/inventory mutation. No assumption that attackers already control Railway/GitHub/operator accounts, process environment, signing keys, S3 credentials, private databases, or production proxies.

### Security Objectives

- Preserve the user-provided single-business deployment model while enforcing customer ownership, staff role/destructive-action controls, scanner event capabilities, and reviewer/share scope. Bind money and inventory changes to database-derived amounts and authenticated Stripe events; require paid orders before admission (tixmoapi2/src/api/payments/service.ts:40-65,95-101,224-249; tixmoapi2/src/api/scanners/service.ts:394-403). Keep JWT/scanner/reviewer/share credentials private across browser storage, request destinations, email, telemetry, and logs. Retain refresh revocation state in Redis and reject refresh when its state cannot be validated (tixmoapi2/src/api/auth/service.ts:208-269). Enforce configured API limits and upload limits: normal production defaults are 600 GET and 240 writes per 900000 ms, authentication 20/minute per IP, multipart 10 files at 25 MB/file, and waiting-room threshold 5000 concurrent requests (tixmoapi2/src/config/environment.ts:21-23,109-120; tixmoapi2/src/middleware/rateLimiter.ts:66-98; tixmoapi2/src/api/assets/controller.ts:69-72; tixmoapi2/src/middleware/waitingRoom.ts:6-22). Keep production migrations/seeds/resets tied to an intentional database target and recoverable backups rather than assuming developer labels enforce isolation.

### Assumptions

- No SECURITY.md was found in the repository, its component inventories, or ancestor chain through filesystem root. No authoritative threat model or knowledge base was supplied. This is offline architecture mapping, not completed vulnerability coverage or live deployment verification. Current local .env destination inspection, with credentials omitted, shows PostgreSQL localhost:5432/tixmoapi, Redis localhost:6379 database 0, 7d/30d JWT lifetimes, LOG_TO_FILE=true, and S3 endpoint https://t3.storageapi.dev with bucket mediabucket-0zpraphus3gb0; inherited process environment can override dotenv values (tixmoapi2/.env:7,10,12,16,18,36,40,67; tixmoapi2/src/config/environment.ts:3,51-63; tixmoapi2/src/config/s3.ts:4-15). Local database destinations therefore do not imply isolated external upload storage. Production environment values, reverse-proxy header sanitization/TLS, Docker volume host locations, database/Redis network controls, S3 bucket/IAM policies, backup restoration, and email/Stripe configuration remain unverified. README claims 15min access/7d refresh, whereas executable defaults and local .env use 7d/30d (tixmoapi2/README.md:379; tixmoapi2/src/config/environment.ts:60-63; tixmoapi2/.env:16,18). Vite serves 5173, while CLIENT_URL defaults to 3001 and the local .env has no CLIENT_URL; notification URLs require an override or trusted request-derived origin (tdash/vite.config.js:10-18; tixmoapi2/src/config/environment.ts:49; tixmoapi2/src/services/approval-email.service.ts:40-56). Production runtime-config.js defaults API to /api/v1, but bundled Nginx contains only SPA static routing: a configured absolute API URL or external reverse proxy is required (tdash/docker-entrypoint.d/40-runtime-config.sh:4,20-29; tdash/nginx.site.conf:4-8). Startup validates only DATABASE_URL/JWT_SECRET/JWT_REFRESH_SECRET/SESSION_SECRET; missing Stripe disables payments, absent email credentials select jsonTransport, and unavailable S3 fails uploads at use, despite the launch checklist's broader required configuration list (tixmoapi2/src/config/environment.ts:142-154; tixmoapi2/src/api/payments/service.ts:21-37; tixmoapi2/src/config/email.ts:135-182; tixmoapi2/src/services/upload.service.ts:29-56; docs/PRODUCTION_LAUNCH_CHECKLIST.md:39-81). Auth rate-limit comment claims 5/minute, but production implementation allows 20 (tixmoapi2/src/middleware/rateLimiter.ts:61-74). Custom TEAM_MEMBER permissions are documented as stored metadata, not broadly enforced route authority; scanner credentials are separate (docs/ROLE_ACTION_PERMISSION_MATRIX.md:62-78). AI/Twilio/Elasticsearch settings exist without inspected runtime consumers; they are not established external execution surfaces.
- The preceding architecture model is preserved as an offline mapping. Parent read-only verification on 2026-10-04 confirms the live June 16 source revision, the production migrate+seed+start command, active API/dashboard/Postgres/Redis services, absolute frontend API URL, missing frontend Stripe/policy configuration, and absent configured backend Stripe/Sentry variables. Proxy sanitization, IAM, backup restore and authenticated user journeys remain unverified.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Removing an admin preserves and broadens administrative authority](#finding-1) | high | high | inline below |
| [External review responses expose other reviewers' bearer links](#finding-2) | high | high | inline below |
| [Deleted users retain credentials, roles and renewable access](#finding-3) | high | high | inline below |
| [Public registration can grant staff and owner authority without invitation](#finding-4) | high | high | inline below |
| [Production startup reapplies and logs a fixed administrator credential](#finding-5) | high | high | inline below |
| [Rejected multipart uploads leave staged files on API disk](#finding-6) | medium | high | inline below |
| [Role demotion leaves prior access-token authority usable](#finding-7) | medium | high | inline below |
| [Checkout bypasses ticket status and sales-window restrictions](#finding-8) | medium | high | inline below |
| [Concurrent entry scans can redeem one ticket more than once](#finding-9) | medium | high | inline below |
| [Ticket transfers and QR regeneration preserve previous admission credentials](#finding-10) | medium | high | inline below |
| [Quantity-limited discounted tiers never exhaust through checkout](#finding-11) | medium | high | inline below |
| [Approval cache survives logout and exposes the previous session to the next user](#finding-12) | medium | high | inline below |
| [Aborted requests permanently consume waiting-room capacity](#finding-13) | medium | high | inline below |
| [Event-assigned scanner keys can scan tickets for other events](#finding-14) | medium | high | inline below |
| [Concurrent cancellation requests can release the same inventory repeatedly](#finding-15) | medium | high | inline below |
| [Runtime configuration inspection exposes the operator's Node process to downloaded JavaScript](#finding-16) | medium | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Removing an admin preserves and broadens administrative authority

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | authorization |
| CWE | CWE-269 |
| Affected lines | tixmoapi2/src/api/organizations/service.ts:266-271 |

#### Summary

Removing a member clears organizationId but preserves ADMIN. The shared authorization helper defines an ADMIN without an organization as a global administrator. The removed account therefore remains privileged and bypasses controls meant to reject detached staff.

#### Root Cause

A nullable organization doubles as the marker for highest privilege, and removal does not reset role or disable access.

**Root control** — `tixmoapi2/src/api/organizations/service.ts:266-271`

A nullable organization doubles as the marker for highest privilege, and removal does not reset role or disable access.

```typescript
    // Remove user from organization
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
      },
```

**Related control** — `tixmoapi2/src/utils/tenantScope.ts:13-14`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const isGlobalAdmin = (actor: ActorScope) =>
  actor.role === UserRole.ADMIN && !actor.organizationId;
```

**Related control** — `tixmoapi2/src/utils/tenantScope.ts:77-84`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const assertOrganizationAccess = (actor: ActorScope, organizationId: string) => {
  if (isGlobalAdmin(actor)) {
    return;
  }

  if (!actor.organizationId || organizationId !== actor.organizationId) {
    throw ApiError.forbidden("You do not have access to this organization's resources");
  }
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/api/organizations/service.ts:266-271`

A nullable organization doubles as the marker for highest privilege, and removal does not reset role or disable access.

```typescript
    // Remove user from organization
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
      },
```

**Related control** — `tixmoapi2/src/utils/tenantScope.ts:13-14`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const isGlobalAdmin = (actor: ActorScope) =>
  actor.role === UserRole.ADMIN && !actor.organizationId;
```

**Related control** — `tixmoapi2/src/utils/tenantScope.ts:77-84`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const assertOrganizationAccess = (actor: ActorScope, organizationId: string) => {
  if (isGlobalAdmin(actor)) {
    return;
  }

  if (!actor.organizationId || organizationId !== actor.organizationId) {
    throw ApiError.forbidden("You do not have access to this organization's resources");
  }
```

Assertions:
- Removing a member clears organizationId but preserves ADMIN. The shared authorization helper defines an ADMIN without an organization as a global administrator. The removed account therefore remains privileged and bypasses controls meant to reject detached staff.

Counterevidence and remaining uncertainty:
- Member removal verifies current membership and is role-controlled; fresh actor lookup preserves the mistaken role rather than rejecting it.

Limitations:
- No malicious production requests or state changes were made.
- Dynamic end-to-end offboarding exploit was not executed.

#### Dataflow

Owner removes ADMIN membership -\> organizationId null -\> refreshed/current actor classified global ADMIN -\> authorization bypass.

- **Source:** A removed administrative account possessing valid credentials or a refresh token.

- **Sink:** tixmoapi2/src/api/organizations/service.ts

- **Outcome:** Removing a member clears organizationId but preserves ADMIN. The shared authorization helper defines an ADMIN without an organization as a global administrator. The removed account therefore remains privileged and bypasses controls meant to reject detached staff.

**Root control** — `tixmoapi2/src/api/organizations/service.ts:266-271`

A nullable organization doubles as the marker for highest privilege, and removal does not reset role or disable access.

```typescript
    // Remove user from organization
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
      },
```

**Related control** — `tixmoapi2/src/utils/tenantScope.ts:13-14`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const isGlobalAdmin = (actor: ActorScope) =>
  actor.role === UserRole.ADMIN && !actor.organizationId;
```

**Related control** — `tixmoapi2/src/utils/tenantScope.ts:77-84`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const assertOrganizationAccess = (actor: ActorScope, organizationId: string) => {
  if (isGlobalAdmin(actor)) {
    return;
  }

  if (!actor.organizationId || organizationId !== actor.organizationId) {
    throw ApiError.forbidden("You do not have access to this organization's resources");
  }
```

#### Reachability

Owner removes ADMIN membership -\\\> organizationId null -\\\> refreshed/current actor classified global ADMIN -\\\> authorization bypass.

Preconditions:
- A removed administrative account possessing valid credentials or a refresh token.

Existing controls:
- Member removal verifies current membership and is role-controlled; fresh actor lookup preserves the mistaken role rather than rejecting it.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**High** — A routine offboarding action promotes a business admin to global authority instead of revoking membership. This is an authority lifecycle flaw even with one business per deployment.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** A routine offboarding action promotes a business admin to global authority instead of revoking membership. This is an authority lifecycle flaw even with one business per deployment.

#### Remediation

Model global authority explicitly and independently of null membership. Removal must disable/reset business authority and revoke sessions atomically.

Tests:
- Removing an ADMIN cannot make isGlobalAdmin true.
- Offboarded members lose staff actions on existing and newly refreshed tokens.

<a id="finding-2"></a>

### [2] External review responses expose other reviewers' bearer links

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | authorization |
| CWE | CWE-200 |
| Affected lines | tixmoapi2/src/api/approvals/service.ts:345-356 |

#### Summary

A valid external reviewer link returns the shared approval serializer, whose reviewers array includes every reviewUrl. These URLs carry tokens used to submit decisions as those reviewers, enabling peer impersonation and falsified approval records.

#### Root Cause

The public response shares the staff serializer and does not remove peer bearer capabilities.

**Root control** — `tixmoapi2/src/api/approvals/service.ts:345-356`

The public response shares the staff serializer and does not remove peer bearer capabilities.

```typescript
      reviewers: approval.reviewers.map((reviewer) => {
        const latestDecision = latestRevision.decisions.find(
          (decision) => decision.reviewerId === reviewer.id
        );
        return {
          id: reviewer.id,
          email: reviewer.email,
          name: reviewer.name,
          association: reviewer.association,
          reviewerType: reviewer.reviewerType,
          tokenExpiresAt: reviewer.tokenExpiresAt,
          reviewUrl: buildReviewUrl(reviewer.token),
```

**Related control** — `tixmoapi2/src/api/approvals/service.ts:1520-1533`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    return {
      reviewer: {
        id: reviewer.id,
        email: reviewer.email,
        name: reviewer.name,
        association: reviewer.association,
        reviewerType: reviewer.reviewerType,
        tokenExpiresAt: reviewer.tokenExpiresAt,
      },
      approval: await this.serializeApproval(reviewer.approvalRequest, {
        reviewerId: reviewer.id,
        email: reviewer.email,
        canViewInternalComments: false,
      }),
```

**Related control** — `tixmoapi2/src/api/approvals/service.ts:1750-1767`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const decision = await prisma.approvalReviewDecision.upsert({
      where: {
        approvalRevisionId_reviewerId: {
          approvalRevisionId: revision.id,
          reviewerId: reviewer.id,
        },
      },
      create: {
        approvalRequestId: approval.id,
        approvalRevisionId: revision.id,
        reviewerId: reviewer.id,
        decision: input.decision,
        note: input.note,
      },
      update: {
        decision: input.decision,
        note: input.note,
      },
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/api/approvals/service.ts:345-356`

The public response shares the staff serializer and does not remove peer bearer capabilities.

```typescript
      reviewers: approval.reviewers.map((reviewer) => {
        const latestDecision = latestRevision.decisions.find(
          (decision) => decision.reviewerId === reviewer.id
        );
        return {
          id: reviewer.id,
          email: reviewer.email,
          name: reviewer.name,
          association: reviewer.association,
          reviewerType: reviewer.reviewerType,
          tokenExpiresAt: reviewer.tokenExpiresAt,
          reviewUrl: buildReviewUrl(reviewer.token),
```

**Related control** — `tixmoapi2/src/api/approvals/service.ts:1520-1533`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    return {
      reviewer: {
        id: reviewer.id,
        email: reviewer.email,
        name: reviewer.name,
        association: reviewer.association,
        reviewerType: reviewer.reviewerType,
        tokenExpiresAt: reviewer.tokenExpiresAt,
      },
      approval: await this.serializeApproval(reviewer.approvalRequest, {
        reviewerId: reviewer.id,
        email: reviewer.email,
        canViewInternalComments: false,
      }),
```

**Related control** — `tixmoapi2/src/api/approvals/service.ts:1750-1767`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const decision = await prisma.approvalReviewDecision.upsert({
      where: {
        approvalRevisionId_reviewerId: {
          approvalRevisionId: revision.id,
          reviewerId: reviewer.id,
        },
      },
      create: {
        approvalRequestId: approval.id,
        approvalRevisionId: revision.id,
        reviewerId: reviewer.id,
        decision: input.decision,
        note: input.note,
      },
      update: {
        decision: input.decision,
        note: input.note,
      },
```

Assertions:
- A valid external reviewer link returns the shared approval serializer, whose reviewers array includes every reviewUrl. These URLs carry tokens used to submit decisions as those reviewers, enabling peer impersonation and falsified approval records.

Counterevidence and remaining uncertainty:
- Internal comments are filtered and invalid/expired tokens are rejected. Those controls do not prevent peer-token disclosure.

Limitations:
- No malicious production requests or state changes were made.

#### Dataflow

GET review/{own token} -\> approval.reviewers\[\*\].reviewUrl -\> peer token -\> reviewer decision mutation attributed to peer.

- **Source:** An external reviewer holding one unexpired review token.

- **Sink:** tixmoapi2/src/api/approvals/service.ts

- **Outcome:** A valid external reviewer link returns the shared approval serializer, whose reviewers array includes every reviewUrl. These URLs carry tokens used to submit decisions as those reviewers, enabling peer impersonation and falsified approval records.

**Root control** — `tixmoapi2/src/api/approvals/service.ts:345-356`

The public response shares the staff serializer and does not remove peer bearer capabilities.

```typescript
      reviewers: approval.reviewers.map((reviewer) => {
        const latestDecision = latestRevision.decisions.find(
          (decision) => decision.reviewerId === reviewer.id
        );
        return {
          id: reviewer.id,
          email: reviewer.email,
          name: reviewer.name,
          association: reviewer.association,
          reviewerType: reviewer.reviewerType,
          tokenExpiresAt: reviewer.tokenExpiresAt,
          reviewUrl: buildReviewUrl(reviewer.token),
```

**Related control** — `tixmoapi2/src/api/approvals/service.ts:1520-1533`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    return {
      reviewer: {
        id: reviewer.id,
        email: reviewer.email,
        name: reviewer.name,
        association: reviewer.association,
        reviewerType: reviewer.reviewerType,
        tokenExpiresAt: reviewer.tokenExpiresAt,
      },
      approval: await this.serializeApproval(reviewer.approvalRequest, {
        reviewerId: reviewer.id,
        email: reviewer.email,
        canViewInternalComments: false,
      }),
```

**Related control** — `tixmoapi2/src/api/approvals/service.ts:1750-1767`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const decision = await prisma.approvalReviewDecision.upsert({
      where: {
        approvalRevisionId_reviewerId: {
          approvalRevisionId: revision.id,
          reviewerId: reviewer.id,
        },
      },
      create: {
        approvalRequestId: approval.id,
        approvalRevisionId: revision.id,
        reviewerId: reviewer.id,
        decision: input.decision,
        note: input.note,
      },
      update: {
        decision: input.decision,
        note: input.note,
      },
```

#### Reachability

GET review/{own token} -\\\> approval.reviewers\\\[\\\*\\\].reviewUrl -\\\> peer token -\\\> reviewer decision mutation attributed to peer.

Preconditions:
- An external reviewer holding one unexpired review token.

Existing controls:
- Internal comments are filtered and invalid/expired tokens are rejected. Those controls do not prevent peer-token disclosure.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**High** — A legitimately invited external reviewer can act as other reviewers on the same approval, undermining approval authority.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** A legitimately invited external reviewer can act as other reviewers on the same approval, undermining approval authority.

#### Remediation

Use separate public serializers; return current-reviewer capability only, and redact all peer tokens/review URLs. Rotate affected links and inspect decision history.

Tests:
- External response contains no peer bearer capability.
- A reviewer cannot submit a decision for another reviewer.

<a id="finding-3"></a>

### [3] Deleted users retain credentials, roles and renewable access

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | authentication |
| CWE | CWE-613 |
| Affected lines | tixmoapi2/src/api/users/service.ts:222-232 |

#### Summary

Deleting a user only anonymizes identifying fields. The row retains passwordHash, role and organization; refresh authentication checks row existence and issues new tokens. Deleted staff can retain existing access, refresh it, and authenticate with the deterministic replacement email.

#### Root Cause

Deletion is implemented as PII anonymization without disabling authentication or revoking sessions.

**Root control** — `tixmoapi2/src/api/users/service.ts:222-232`

Deletion is implemented as PII anonymization without disabling authentication or revoking sessions.

```typescript
    // Soft delete by anonymizing email
    await prisma.user.update({
      where: { id },
      data: {
        email: `deleted_${id}@deleted.com`,
        firstName: 'Deleted',
        lastName: 'User',
        phone: null,
        updatedAt: new Date(),
      },
    });
```

**Related control** — `tixmoapi2/src/api/auth/service.ts:220-243`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Generate new tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      emailVerified: user.emailVerified,
    });
```

**Related control** — `tixmoapi2/src/api/auth/service.ts:171-191`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Verify password
    const isPasswordValid = await comparePassword(data.password, user.passwordHash);

    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      emailVerified: user.emailVerified,
    });
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/api/users/service.ts:222-232`

Deletion is implemented as PII anonymization without disabling authentication or revoking sessions.

```typescript
    // Soft delete by anonymizing email
    await prisma.user.update({
      where: { id },
      data: {
        email: `deleted_${id}@deleted.com`,
        firstName: 'Deleted',
        lastName: 'User',
        phone: null,
        updatedAt: new Date(),
      },
    });
```

**Related control** — `tixmoapi2/src/api/auth/service.ts:220-243`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Generate new tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      emailVerified: user.emailVerified,
    });
```

**Related control** — `tixmoapi2/src/api/auth/service.ts:171-191`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Verify password
    const isPasswordValid = await comparePassword(data.password, user.passwordHash);

    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      emailVerified: user.emailVerified,
    });
```

Assertions:
- Deleting a user only anonymizes identifying fields. The row retains passwordHash, role and organization; refresh authentication checks row existence and issues new tokens. Deleted staff can retain existing access, refresh it, and authenticate with the deterministic replacement email.

Counterevidence and remaining uncertainty:
- The deletion controller enforces actor scope and role hierarchy; refresh revocation exists for logout but deletion never invokes it.

Limitations:
- No malicious production requests or state changes were made.
- Dynamic end-to-end offboarding exploit was not executed.

#### Dataflow

Authorized account deletion -\> unchanged credential/authority row -\> existing refresh token or replacement-email login -\> fresh access.

- **Source:** A former staff member with a previously issued token/password and known own user ID.

- **Sink:** tixmoapi2/src/api/users/service.ts

- **Outcome:** Deleting a user only anonymizes identifying fields. The row retains passwordHash, role and organization; refresh authentication checks row existence and issues new tokens. Deleted staff can retain existing access, refresh it, and authenticate with the deterministic replacement email.

**Root control** — `tixmoapi2/src/api/users/service.ts:222-232`

Deletion is implemented as PII anonymization without disabling authentication or revoking sessions.

```typescript
    // Soft delete by anonymizing email
    await prisma.user.update({
      where: { id },
      data: {
        email: `deleted_${id}@deleted.com`,
        firstName: 'Deleted',
        lastName: 'User',
        phone: null,
        updatedAt: new Date(),
      },
    });
```

**Related control** — `tixmoapi2/src/api/auth/service.ts:220-243`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Generate new tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      emailVerified: user.emailVerified,
    });
```

**Related control** — `tixmoapi2/src/api/auth/service.ts:171-191`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Verify password
    const isPasswordValid = await comparePassword(data.password, user.passwordHash);

    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      emailVerified: user.emailVerified,
    });
```

#### Reachability

Authorized account deletion -\\\> unchanged credential/authority row -\\\> existing refresh token or replacement-email login -\\\> fresh access.

Preconditions:
- A former staff member with a previously issued token/password and known own user ID.

Existing controls:
- The deletion controller enforces actor scope and role hierarchy; refresh revocation exists for logout but deletion never invokes it.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**High** — Offboarded privileged accounts can continue business access indefinitely through retained credentials and refresh.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** Offboarded privileged accounts can continue business access indefinitely through retained credentials and refresh.

#### Remediation

Add explicit disabled/deleted state enforced by login, refresh and every access check; revoke sessions/access versions on deletion, and remove authority while preserving necessary records.

Tests:
- Deleted users cannot login, refresh or use pre-deletion access tokens.
- Historical business records remain intact without active credentials.

<a id="finding-4"></a>

### [4] Public registration can grant staff and owner authority without invitation

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | authorization |
| CWE | CWE-269 |
| Affected lines | tixmoapi2/src/api/auth/service.ts:101-117 |

#### Summary

Unauthenticated registration resolves an organization from the request host, prioritizing X-Forwarded-Host, then grants OWNER to its first account or TEAM_MEMBER thereafter. A caller able to supply an accepted tenant host can cross the customer-to-staff boundary without an invitation; ordinary same-business staff visibility is not itself a finding.

#### Root Cause

Host naming and member count substitute for an authorized staff invitation.

**Root control** — `tixmoapi2/src/api/auth/service.ts:101-117`

Host naming and member count substitute for an authorized staff invitation.

```typescript
    const tenantOrganization = await this.resolveTenantOrganization(context);
    const role = tenantOrganization
      ? tenantOrganization.memberCount === 0
        ? UserRole.OWNER
        : UserRole.TEAM_MEMBER
      : UserRole.CUSTOMER;

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role,
        organizationId: tenantOrganization?.organizationId ?? null,
```

**Related control** — `tixmoapi2/src/api/auth/controller.ts:20-26`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const register = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as RegisterData;
  const result = await authService.register(payload, {
    requestHost:
      (typeof req.headers['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host']) ||
      req.get('host'),
  });
```

**Related control** — `tixmoapi2/src/api/auth/tenantOrganization.ts:90-108`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const resolveTenantOrganizationSeed = (input?: {
  requestHost?: string | null;
  serviceDashUrl?: string | null;
  projectName?: string | null;
}): TenantOrganizationSeed | null => {
  const label =
    extractTenantLabelFromHost(input?.requestHost) ||
    extractTenantLabelFromHost(input?.serviceDashUrl) ||
    extractTenantLabelFromProjectName(input?.projectName);

  if (!label) {
    return null;
  }

  return {
    label,
    name: formatTenantName(label),
    slug: label.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  };
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/api/auth/service.ts:101-117`

Host naming and member count substitute for an authorized staff invitation.

```typescript
    const tenantOrganization = await this.resolveTenantOrganization(context);
    const role = tenantOrganization
      ? tenantOrganization.memberCount === 0
        ? UserRole.OWNER
        : UserRole.TEAM_MEMBER
      : UserRole.CUSTOMER;

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role,
        organizationId: tenantOrganization?.organizationId ?? null,
```

**Related control** — `tixmoapi2/src/api/auth/controller.ts:20-26`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const register = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as RegisterData;
  const result = await authService.register(payload, {
    requestHost:
      (typeof req.headers['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host']) ||
      req.get('host'),
  });
```

**Related control** — `tixmoapi2/src/api/auth/tenantOrganization.ts:90-108`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const resolveTenantOrganizationSeed = (input?: {
  requestHost?: string | null;
  serviceDashUrl?: string | null;
  projectName?: string | null;
}): TenantOrganizationSeed | null => {
  const label =
    extractTenantLabelFromHost(input?.requestHost) ||
    extractTenantLabelFromHost(input?.serviceDashUrl) ||
    extractTenantLabelFromProjectName(input?.projectName);

  if (!label) {
    return null;
  }

  return {
    label,
    name: formatTenantName(label),
    slug: label.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  };
```

Assertions:
- Unauthenticated registration resolves an organization from the request host, prioritizing X-Forwarded-Host, then grants OWNER to its first account or TEAM_MEMBER thereafter. A caller able to supply an accepted tenant host can cross the customer-to-staff boundary without an invitation; ordinary same-business staff visibility is not itself a finding.

Counterevidence and remaining uncertainty:
- Role input is constrained by validation. demo/API Railway host and reserved project naming can resolve CUSTOMER; this does not secure accepted custom or forwarded hosts. Live enrollment was not executed.

Limitations:
- No malicious production requests or state changes were made.

#### Dataflow

Public registration -\> host-derived organization selection/create -\> automatic staff role -\> token issuance -\> staff endpoints.

- **Source:** Unauthenticated person able to supply a request host accepted by tenant resolution.

- **Sink:** tixmoapi2/src/api/auth/service.ts

- **Outcome:** Unauthenticated registration resolves an organization from the request host, prioritizing X-Forwarded-Host, then grants OWNER to its first account or TEAM_MEMBER thereafter. A caller able to supply an accepted tenant host can cross the customer-to-staff boundary without an invitation; ordinary same-business staff visibility is not itself a finding.

**Root control** — `tixmoapi2/src/api/auth/service.ts:101-117`

Host naming and member count substitute for an authorized staff invitation.

```typescript
    const tenantOrganization = await this.resolveTenantOrganization(context);
    const role = tenantOrganization
      ? tenantOrganization.memberCount === 0
        ? UserRole.OWNER
        : UserRole.TEAM_MEMBER
      : UserRole.CUSTOMER;

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role,
        organizationId: tenantOrganization?.organizationId ?? null,
```

**Related control** — `tixmoapi2/src/api/auth/controller.ts:20-26`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const register = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as RegisterData;
  const result = await authService.register(payload, {
    requestHost:
      (typeof req.headers['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host']) ||
      req.get('host'),
  });
```

**Related control** — `tixmoapi2/src/api/auth/tenantOrganization.ts:90-108`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
export const resolveTenantOrganizationSeed = (input?: {
  requestHost?: string | null;
  serviceDashUrl?: string | null;
  projectName?: string | null;
}): TenantOrganizationSeed | null => {
  const label =
    extractTenantLabelFromHost(input?.requestHost) ||
    extractTenantLabelFromHost(input?.serviceDashUrl) ||
    extractTenantLabelFromProjectName(input?.projectName);

  if (!label) {
    return null;
  }

  return {
    label,
    name: formatTenantName(label),
    slug: label.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  };
```

#### Reachability

Public registration -\\\> host-derived organization selection/create -\\\> automatic staff role -\\\> token issuance -\\\> staff endpoints.

Preconditions:
- Unauthenticated person able to supply a request host accepted by tenant resolution.

Existing controls:
- Role input is constrained by validation. demo/API Railway host and reserved project naming can resolve CUSTOMER; this does not secure accepted custom or forwarded hosts. Live enrollment was not executed.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**High** — Unauthorized staff enrollment or privileged owner creation exposes business operations. High impact is conditional on an accepted tenant host; live proxy header sanitization was not tested.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** Unauthorized staff enrollment or privileged owner creation exposes business operations. High impact is conditional on an accepted tenant host; live proxy header sanitization was not tested.

#### Remediation

Keep public enrollment CUSTOMER within a server-configured business; use owner-authorized, expiring invitations for staff. Trust only known deployment identity and sanitized proxy headers.

Tests:
- Public buyer signup stays CUSTOMER for all Host/X-Forwarded-Host combinations.
- No public request can create an OWNER or organization; invitation role limits are enforced.

<a id="finding-5"></a>

### [5] Production startup reapplies and logs a fixed administrator credential

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | authentication |
| CWE | CWE-798 |
| Affected lines | tixmoapi2/prisma/seed-minimal.js:27-42 |

#### Summary

The minimal seed hashes a tracked fixed administrator password, upserts an ADMIN with organizationId null, resets its password on repeat runs, and prints the credential. Read-only Railway metadata confirms production startup invokes migrations, db:seed and npm start on every boot. This is an active deployment bootstrap risk, without testing the credential against production.

#### Root Cause

Repeatable development seed is included in the production start command.

**Root control** — `tixmoapi2/prisma/seed-minimal.js:27-42`

Repeatable development seed is included in the production start command.

```typescript
    const admin = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash,
            role: 'ADMIN',
            organizationId: org.id,
        },
        create: {
            email,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            passwordHash,
            phone: '555-0123',
            emailVerified: true,
            organizationId: org.id,
```

**Related control** — `tixmoapi2/prisma/seed-minimal.js:45-48`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript

    console.log(`✓ Admin user created/updated: ${admin.email}`);
    console.log(`✓ Password: ${password}`);
}
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/prisma/seed-minimal.js:27-42`

Repeatable development seed is included in the production start command.

```typescript
    const admin = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash,
            role: 'ADMIN',
            organizationId: org.id,
        },
        create: {
            email,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            passwordHash,
            phone: '555-0123',
            emailVerified: true,
            organizationId: org.id,
```

**Related control** — `tixmoapi2/prisma/seed-minimal.js:45-48`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript

    console.log(`✓ Admin user created/updated: ${admin.email}`);
    console.log(`✓ Password: ${password}`);
}
```

Assertions:
- The minimal seed hashes a tracked fixed administrator password, upserts an ADMIN with organizationId null, resets its password on repeat runs, and prints the credential. Read-only Railway metadata confirms production startup invokes migrations, db:seed and npm start on every boot. This is an active deployment bootstrap risk, without testing the credential against production.

Counterevidence and remaining uncertainty:
- Password is stored hashed in the database and HTTP login is rate limited; neither makes a publicly defined credential secret.

Limitations:
- No malicious production requests or state changes were made.

#### Dataflow

Production startup -\> db:seed -\> fixed credential ADMIN upsert/reset -\> plaintext credential logging -\> potential privileged login.

- **Source:** A person with source or seed-output access who can reach the deployed API login.

- **Sink:** tixmoapi2/prisma/seed-minimal.js

- **Outcome:** The minimal seed hashes a tracked fixed administrator password, upserts an ADMIN with organizationId null, resets its password on repeat runs, and prints the credential. Read-only Railway metadata confirms production startup invokes migrations, db:seed and npm start on every boot. This is an active deployment bootstrap risk, without testing the credential against production.

**Root control** — `tixmoapi2/prisma/seed-minimal.js:27-42`

Repeatable development seed is included in the production start command.

```typescript
    const admin = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash,
            role: 'ADMIN',
            organizationId: org.id,
        },
        create: {
            email,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            passwordHash,
            phone: '555-0123',
            emailVerified: true,
            organizationId: org.id,
```

**Related control** — `tixmoapi2/prisma/seed-minimal.js:45-48`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript

    console.log(`✓ Admin user created/updated: ${admin.email}`);
    console.log(`✓ Password: ${password}`);
}
```

#### Reachability

Production startup -\\\> db:seed -\\\> fixed credential ADMIN upsert/reset -\\\> plaintext credential logging -\\\> potential privileged login.

Preconditions:
- A person with source or seed-output access who can reach the deployed API login.

Existing controls:
- Password is stored hashed in the database and HTTP login is rate limited; neither makes a publicly defined credential secret.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**High** — Source/log readers can learn a privileged fixed credential, and service restarts restore it. The deployed start command was confirmed; successful production login was deliberately not attempted.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** Source/log readers can learn a privileged fixed credential, and service restarts restore it. The deployed start command was confirmed; successful production login was deliberately not attempted.

#### Remediation

Remove seeding from production startup. Use a guarded one-time bootstrap with a generated secret; rotate affected admin credentials, invalidate sessions and review access/log exposure.

Tests:
- Production boot executes migrations and service only.
- One-time bootstrap cannot overwrite existing credentials or log secrets.

<a id="finding-6"></a>

### [6] Rejected multipart uploads leave staged files on API disk

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | resources |
| CWE | CWE-459 |
| Affected lines | tixmoapi2/src/api/assets/controller.ts:170-180 |

#### Summary

Multipart handlers stage files in the OS temp directory before business authorization and body/content validation. Failure paths before uploadService's cleanup do not unlink these files. An authenticated low-privilege caller can repeatedly stage up to ten 25 MiB files per request and cause durable temporary-disk growth.

#### Root Cause

Cleanup is attached to successful upload service execution instead of every request terminal path.

**Root control** — `tixmoapi2/src/api/assets/controller.ts:170-180`

Cleanup is attached to successful upload service execution instead of every request terminal path.

```typescript
      const files = (req.files as Express.Multer.File[]) || [];
      await validateUploadedFiles(files);
      const result = await assetLibraryService.upload(userId, files, {
        usageType: req.body?.usageType || req.body?.collectionType,
        eventId: req.body?.eventId,
        category: req.body?.category,
        folderId: req.body?.folderId,
      });
      return res.status(StatusCodes.CREATED).json(result);
    } catch (error) {
      return next(error);
```

**Related control** — `tixmoapi2/src/api/assets/controller.ts:61-83`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedAssetUploadType(file)) {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
      return;
    }

    cb(null, true);
  },
});

export const assetLibraryUploadMiddleware = upload.array('files', 10);
```

**Related control** — `tixmoapi2/src/api/assets/service.ts:914-923`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async upload(userId: string, files: Express.Multer.File[], context: AssetUploadContext) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    if (files.length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one file is required');
    }

    const uploadContext = await this.normalizeUploadContext(user, context);
    const uploadedAssets = await uploadService.uploadMultiple(
```

**Related control** — `tixmoapi2/src/api/approvals/controller.ts:144-169`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
      const body = parseSchema(createApprovalBodySchema, req.body);
      const files = (req.files as Express.Multer.File[]) || [];
      await validateUploadedFiles(files);
      const organizationId = await approvalService.getUserOrganizationId(userId);

      if (!organizationId) {
        return res
          .status(StatusCodes.FORBIDDEN)
          .json({ message: 'User does not belong to an organization' });
      }

      const approval = await approvalService.create({
        organizationId,
        createdById: userId,
        eventId: body.eventId,
        title: body.title,
        description: body.description,
        deadline: new Date(body.deadline),
        reviewers: body.reviewers,
        files,
        dashboardOrigin: getDashboardOrigin(req),
      });

      return res.status(StatusCodes.CREATED).json(approval);
    } catch (error) {
      return next(error);
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/api/assets/controller.ts:170-180`

Cleanup is attached to successful upload service execution instead of every request terminal path.

```typescript
      const files = (req.files as Express.Multer.File[]) || [];
      await validateUploadedFiles(files);
      const result = await assetLibraryService.upload(userId, files, {
        usageType: req.body?.usageType || req.body?.collectionType,
        eventId: req.body?.eventId,
        category: req.body?.category,
        folderId: req.body?.folderId,
      });
      return res.status(StatusCodes.CREATED).json(result);
    } catch (error) {
      return next(error);
```

**Related control** — `tixmoapi2/src/api/assets/controller.ts:61-83`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedAssetUploadType(file)) {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
      return;
    }

    cb(null, true);
  },
});

export const assetLibraryUploadMiddleware = upload.array('files', 10);
```

**Related control** — `tixmoapi2/src/api/assets/service.ts:914-923`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async upload(userId: string, files: Express.Multer.File[], context: AssetUploadContext) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    if (files.length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one file is required');
    }

    const uploadContext = await this.normalizeUploadContext(user, context);
    const uploadedAssets = await uploadService.uploadMultiple(
```

**Related control** — `tixmoapi2/src/api/approvals/controller.ts:144-169`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
      const body = parseSchema(createApprovalBodySchema, req.body);
      const files = (req.files as Express.Multer.File[]) || [];
      await validateUploadedFiles(files);
      const organizationId = await approvalService.getUserOrganizationId(userId);

      if (!organizationId) {
        return res
          .status(StatusCodes.FORBIDDEN)
          .json({ message: 'User does not belong to an organization' });
      }

      const approval = await approvalService.create({
        organizationId,
        createdById: userId,
        eventId: body.eventId,
        title: body.title,
        description: body.description,
        deadline: new Date(body.deadline),
        reviewers: body.reviewers,
        files,
        dashboardOrigin: getDashboardOrigin(req),
      });

      return res.status(StatusCodes.CREATED).json(approval);
    } catch (error) {
      return next(error);
```

Assertions:
- Multipart handlers stage files in the OS temp directory before business authorization and body/content validation. Failure paths before uploadService's cleanup do not unlink these files. An authenticated low-privilege caller can repeatedly stage up to ten 25 MiB files per request and cause durable temporary-disk growth.

Counterevidence and remaining uncertainty:
- File count/size/type limits and rate limiting reduce individual request size/rate; cleanup exists once uploadService is reached.

Limitations:
- No malicious production requests or state changes were made.

#### Dataflow

Authenticated multipart request -\> disk staging -\> validation/authorization rejection -\> no cleanup -\> repeated disk accumulation.

- **Source:** An authenticated account allowed through upload route middleware but rejected by later role/context or content checks.

- **Sink:** tixmoapi2/src/api/assets/controller.ts

- **Outcome:** Multipart handlers stage files in the OS temp directory before business authorization and body/content validation. Failure paths before uploadService's cleanup do not unlink these files. An authenticated low-privilege caller can repeatedly stage up to ten 25 MiB files per request and cause durable temporary-disk growth.

**Root control** — `tixmoapi2/src/api/assets/controller.ts:170-180`

Cleanup is attached to successful upload service execution instead of every request terminal path.

```typescript
      const files = (req.files as Express.Multer.File[]) || [];
      await validateUploadedFiles(files);
      const result = await assetLibraryService.upload(userId, files, {
        usageType: req.body?.usageType || req.body?.collectionType,
        eventId: req.body?.eventId,
        category: req.body?.category,
        folderId: req.body?.folderId,
      });
      return res.status(StatusCodes.CREATED).json(result);
    } catch (error) {
      return next(error);
```

**Related control** — `tixmoapi2/src/api/assets/controller.ts:61-83`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedAssetUploadType(file)) {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
      return;
    }

    cb(null, true);
  },
});

export const assetLibraryUploadMiddleware = upload.array('files', 10);
```

**Related control** — `tixmoapi2/src/api/assets/service.ts:914-923`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async upload(userId: string, files: Express.Multer.File[], context: AssetUploadContext) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    if (files.length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one file is required');
    }

    const uploadContext = await this.normalizeUploadContext(user, context);
    const uploadedAssets = await uploadService.uploadMultiple(
```

**Related control** — `tixmoapi2/src/api/approvals/controller.ts:144-169`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
      const body = parseSchema(createApprovalBodySchema, req.body);
      const files = (req.files as Express.Multer.File[]) || [];
      await validateUploadedFiles(files);
      const organizationId = await approvalService.getUserOrganizationId(userId);

      if (!organizationId) {
        return res
          .status(StatusCodes.FORBIDDEN)
          .json({ message: 'User does not belong to an organization' });
      }

      const approval = await approvalService.create({
        organizationId,
        createdById: userId,
        eventId: body.eventId,
        title: body.title,
        description: body.description,
        deadline: new Date(body.deadline),
        reviewers: body.reviewers,
        files,
        dashboardOrigin: getDashboardOrigin(req),
      });

      return res.status(StatusCodes.CREATED).json(approval);
    } catch (error) {
      return next(error);
```

#### Reachability

Authenticated multipart request -\\\> disk staging -\\\> validation/authorization rejection -\\\> no cleanup -\\\> repeated disk accumulation.

Preconditions:
- An authenticated account allowed through upload route middleware but rejected by later role/context or content checks.

Existing controls:
- File count/size/type limits and rate limiting reduce individual request size/rate; cleanup exists once uploadService is reached.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**Medium** — Authenticated upload abuse can exhaust API storage and interrupt service; exact production tmp mount quota was not inspected.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** Authenticated upload abuse can exhaust API storage and interrupt service; exact production tmp mount quota was not inspected.

#### Remediation

Authorize before multipart parsing where possible and guarantee request-scoped finally cleanup on validation, auth, upload, cancellation and error paths; enforce disk quota and sweeper.

Tests:
- Rejected body, magic bytes, role and folder context leave no staged files.
- Aborted and partially successful uploads also clean all files.

<a id="finding-7"></a>

### [7] Role demotion leaves prior access-token authority usable

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | authorization |
| CWE | CWE-863 |
| Affected lines | tixmoapi2/src/middleware/auth.ts:43-50 |

#### Summary

Role changes update the user row but do not invalidate access tokens. authenticate copies role from the JWT, and authorize trusts that claim for routes without a subsequent current-actor lookup, including privileged order actions. Demoted users can retain their former authority for the token lifetime (default seven days).

#### Root Cause

Access authorization lacks current account/session version enforcement across routes.

**Root control** — `tixmoapi2/src/middleware/auth.ts:43-50`

Access authorization lacks current account/session version enforcement across routes.

```typescript
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
      emailVerified: payload.emailVerified,
      organizationId: payload.organizationId,
    };
```

**Related control** — `tixmoapi2/src/api/users/service.ts:181-186`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    return await prisma.user.update({
      where: { id },
      data: {
        ...data,
        permissions: data.permissions as Prisma.InputJsonValue | undefined,
        updatedAt: new Date(),
```

**Related control** — `tixmoapi2/src/middleware/authorize.ts:9-20`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role as UserRole)) {
        throw ApiError.forbidden('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/middleware/auth.ts:43-50`

Access authorization lacks current account/session version enforcement across routes.

```typescript
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
      emailVerified: payload.emailVerified,
      organizationId: payload.organizationId,
    };
```

**Related control** — `tixmoapi2/src/api/users/service.ts:181-186`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    return await prisma.user.update({
      where: { id },
      data: {
        ...data,
        permissions: data.permissions as Prisma.InputJsonValue | undefined,
        updatedAt: new Date(),
```

**Related control** — `tixmoapi2/src/middleware/authorize.ts:9-20`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role as UserRole)) {
        throw ApiError.forbidden('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
```

Assertions:
- Role changes update the user row but do not invalidate access tokens. authenticate copies role from the JWT, and authorize trusts that claim for routes without a subsequent current-actor lookup, including privileged order actions. Demoted users can retain their former authority for the token lifetime (default seven days).

Counterevidence and remaining uncertainty:
- Several services reload current actor role, and refresh uses the current user row. Exposure is confined to routes trusting access-token role.

Limitations:
- No malicious production requests or state changes were made.
- Dynamic end-to-end offboarding exploit was not executed.

#### Dataflow

Old JWT -\> signature accepted -\> old role copied to request -\> role-only privileged route.

- **Source:** A staff member demoted after receiving a privileged access token.

- **Sink:** tixmoapi2/src/middleware/auth.ts

- **Outcome:** Role changes update the user row but do not invalidate access tokens. authenticate copies role from the JWT, and authorize trusts that claim for routes without a subsequent current-actor lookup, including privileged order actions. Demoted users can retain their former authority for the token lifetime (default seven days).

**Root control** — `tixmoapi2/src/middleware/auth.ts:43-50`

Access authorization lacks current account/session version enforcement across routes.

```typescript
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
      emailVerified: payload.emailVerified,
      organizationId: payload.organizationId,
    };
```

**Related control** — `tixmoapi2/src/api/users/service.ts:181-186`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    return await prisma.user.update({
      where: { id },
      data: {
        ...data,
        permissions: data.permissions as Prisma.InputJsonValue | undefined,
        updatedAt: new Date(),
```

**Related control** — `tixmoapi2/src/middleware/authorize.ts:9-20`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role as UserRole)) {
        throw ApiError.forbidden('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
```

#### Reachability

Old JWT -\\\> signature accepted -\\\> old role copied to request -\\\> role-only privileged route.

Preconditions:
- A staff member demoted after receiving a privileged access token.

Existing controls:
- Several services reload current actor role, and refresh uses the current user row. Exposure is confined to routes trusting access-token role.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**Medium** — Role revocation is delayed on claim-only routes; an already privileged user is required.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** Role revocation is delayed on claim-only routes; an already privileged user is required.

#### Remediation

Use centralized current-account/session-version checks and invalidate sessions on role changes. Shorten access lifetime as defense in depth.

Tests:
- Previously issued privileged JWT is rejected for privileged routes immediately after demotion.
- Current-role lookup and version checks apply consistently.

<a id="finding-8"></a>

### [8] Checkout bypasses ticket status and sales-window restrictions

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | inventory |
| CWE | CWE-841 |
| Affected lines | tixmoapi2/src/api/orders/service.ts:89-112 |

#### Summary

Customers can buy before release or after closure. Previously known HIDDEN or administratively SOLD_OUT types also remain directly purchasable when their inventory is positive. Public event payload supplies active ticket IDs and sales dates → customer submits an ID before salesStart or after salesEnd → createOrder checks event state, remaining quantity, and per-item limit but skips ticket status and sales dates → holds inventory and creates tickets → normal payment completes the purchase.

#### Root Cause

Reservation enforces availability but omits authoritative status and sales-window eligibility.

**Root control** — `tixmoapi2/src/api/orders/service.ts:89-112`

Reservation enforces availability but omits authoritative status and sales-window eligibility.

```typescript
    // Validate event status — accept PUBLISHED and ON_SALE
    if (!['PUBLISHED', 'ON_SALE'].includes(event.status)) {
      throw ApiError.badRequest('Event is not available for purchase');
    }

    // Validate event hasn't started
    if (event.startDatetime && new Date() >= event.startDatetime) {
      throw ApiError.badRequest('Event has already started');
    }

    // Validate availability and per-order limits
    for (const item of data.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      if (ticketType.quantityAvailable < item.quantity) {
        throw ApiError.badRequest(
          `Only ${ticketType.quantityAvailable} tickets available for ${ticketType.name}`
        );
      }
      if (item.quantity > ticketType.maxPerOrder) {
        throw ApiError.badRequest(
          `Maximum ${ticketType.maxPerOrder} tickets per order for ${ticketType.name}`
        );
      }
    }
```

**Related control** — `tixmoapi2/src/api/ticket-types/service.ts:212-231`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Check ticket type status (reject HIDDEN and SOLD_OUT)
    if (ticketType.status === 'HIDDEN' || ticketType.status === 'SOLD_OUT') {
      return false;
    }

    // Check if event hasn't started yet
    // Ensure both event and startDatetime are present and not null
    if (ticketType.event && ticketType.event.startDatetime) {
      if (new Date() >= ticketType.event.startDatetime) {
        return false;
      }
    }

    // Check sales window
    const now = new Date();
    if (ticketType.salesStart && now < ticketType.salesStart) {
      return false;
    }
    if (ticketType.salesEnd && now > ticketType.salesEnd) {
      return false;
```

**Related control** — `tixmoapi2/src/api/events/service.ts:747-756`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
          ticketTypes: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              name: true,
              price: true,
              quantityAvailable: true,
              salesStart: true,
              salesEnd: true,
            },
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/api/orders/service.ts:89-112`

Reservation enforces availability but omits authoritative status and sales-window eligibility.

```typescript
    // Validate event status — accept PUBLISHED and ON_SALE
    if (!['PUBLISHED', 'ON_SALE'].includes(event.status)) {
      throw ApiError.badRequest('Event is not available for purchase');
    }

    // Validate event hasn't started
    if (event.startDatetime && new Date() >= event.startDatetime) {
      throw ApiError.badRequest('Event has already started');
    }

    // Validate availability and per-order limits
    for (const item of data.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      if (ticketType.quantityAvailable < item.quantity) {
        throw ApiError.badRequest(
          `Only ${ticketType.quantityAvailable} tickets available for ${ticketType.name}`
        );
      }
      if (item.quantity > ticketType.maxPerOrder) {
        throw ApiError.badRequest(
          `Maximum ${ticketType.maxPerOrder} tickets per order for ${ticketType.name}`
        );
      }
    }
```

**Related control** — `tixmoapi2/src/api/ticket-types/service.ts:212-231`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Check ticket type status (reject HIDDEN and SOLD_OUT)
    if (ticketType.status === 'HIDDEN' || ticketType.status === 'SOLD_OUT') {
      return false;
    }

    // Check if event hasn't started yet
    // Ensure both event and startDatetime are present and not null
    if (ticketType.event && ticketType.event.startDatetime) {
      if (new Date() >= ticketType.event.startDatetime) {
        return false;
      }
    }

    // Check sales window
    const now = new Date();
    if (ticketType.salesStart && now < ticketType.salesStart) {
      return false;
    }
    if (ticketType.salesEnd && now > ticketType.salesEnd) {
      return false;
```

**Related control** — `tixmoapi2/src/api/events/service.ts:747-756`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
          ticketTypes: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              name: true,
              price: true,
              quantityAvailable: true,
              salesStart: true,
              salesEnd: true,
            },
```

Assertions:
- Customers can buy before release or after closure. Previously known HIDDEN or administratively SOLD_OUT types also remain directly purchasable when their inventory is positive. Public event payload supplies active ticket IDs and sales dates → customer submits an ID before salesStart or after salesEnd → createOrder checks event state, remaining quantity, and per-item limit but skips ticket status and sales dates → holds inventory and creates tickets → normal payment completes the purchase.

Counterevidence and remaining uncertainty:
- Draft/cancelled events, events that have started, and insufficient inventory are rejected. Public responses exclude currently hidden types, so the hidden-type variation requires a previously obtained ID.

Limitations:
- No malicious production requests or state changes were made.

#### Dataflow

Public event payload supplies active ticket IDs and sales dates → customer submits an ID before salesStart or after salesEnd → createOrder checks event state, remaining quantity, and per-item limit but skips ticket status and sales dates → holds inventory and creates tickets → normal payment completes the purchase.

- **Source:** An authenticated customer submitting a known ticket type ID directly to POST /orders.

- **Sink:** tixmoapi2/src/api/orders/service.ts

- **Outcome:** Customers can buy before release or after closure. Previously known HIDDEN or administratively SOLD_OUT types also remain directly purchasable when their inventory is positive. Public event payload supplies active ticket IDs and sales dates → customer submits an ID before salesStart or after salesEnd → createOrder checks event state, remaining quantity, and per-item limit but skips ticket status and sales dates → holds inventory and creates tickets → normal payment completes the purchase.

**Root control** — `tixmoapi2/src/api/orders/service.ts:89-112`

Reservation enforces availability but omits authoritative status and sales-window eligibility.

```typescript
    // Validate event status — accept PUBLISHED and ON_SALE
    if (!['PUBLISHED', 'ON_SALE'].includes(event.status)) {
      throw ApiError.badRequest('Event is not available for purchase');
    }

    // Validate event hasn't started
    if (event.startDatetime && new Date() >= event.startDatetime) {
      throw ApiError.badRequest('Event has already started');
    }

    // Validate availability and per-order limits
    for (const item of data.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      if (ticketType.quantityAvailable < item.quantity) {
        throw ApiError.badRequest(
          `Only ${ticketType.quantityAvailable} tickets available for ${ticketType.name}`
        );
      }
      if (item.quantity > ticketType.maxPerOrder) {
        throw ApiError.badRequest(
          `Maximum ${ticketType.maxPerOrder} tickets per order for ${ticketType.name}`
        );
      }
    }
```

**Related control** — `tixmoapi2/src/api/ticket-types/service.ts:212-231`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Check ticket type status (reject HIDDEN and SOLD_OUT)
    if (ticketType.status === 'HIDDEN' || ticketType.status === 'SOLD_OUT') {
      return false;
    }

    // Check if event hasn't started yet
    // Ensure both event and startDatetime are present and not null
    if (ticketType.event && ticketType.event.startDatetime) {
      if (new Date() >= ticketType.event.startDatetime) {
        return false;
      }
    }

    // Check sales window
    const now = new Date();
    if (ticketType.salesStart && now < ticketType.salesStart) {
      return false;
    }
    if (ticketType.salesEnd && now > ticketType.salesEnd) {
      return false;
```

**Related control** — `tixmoapi2/src/api/events/service.ts:747-756`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
          ticketTypes: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              name: true,
              price: true,
              quantityAvailable: true,
              salesStart: true,
              salesEnd: true,
            },
```

#### Reachability

Public event payload supplies active ticket IDs and sales dates → customer submits an ID before salesStart or after salesEnd → createOrder checks event state, remaining quantity, and per-item limit but skips ticket status and sales dates → holds inventory and creates tickets → normal payment completes the purchase.

Preconditions:
- An authenticated customer submitting a known ticket type ID directly to POST /orders.

Existing controls:
- Draft/cancelled events, events that have started, and insufficient inventory are rejected. Public responses exclude currently hidden types, so the hidden-type variation requires a previously obtained ID.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**Medium** — Customers can buy before release or after closure. Previously known HIDDEN or administratively SOLD_OUT types also remain directly purchasable when their inventory is positive. Requires An authenticated customer submitting a known ticket type ID directly to POST /orders.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** Customers can buy before release or after closure. Previously known HIDDEN or administratively SOLD_OUT types also remain directly purchasable when their inventory is positive. Requires An authenticated customer submitting a known ticket type ID directly to POST /orders.

#### Remediation

Enforce the shared sellability policy in authoritative checkout and include relevant state in the inventory reservation transaction.

Tests:
- Purchases must respect the ticket type's sellable state and sales window. under repeated, concurrent and unauthorized requests.

<a id="finding-9"></a>

### [9] Concurrent entry scans can redeem one ticket more than once

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | admission |
| CWE | CWE-367 |
| Affected lines | tixmoapi2/src/api/scanners/service.ts:350-369 |

#### Summary

One purchased ticket can admit multiple attendees when requests overlap. The same issue affects scanner and staff check-in endpoints. Two gate requests read VALID → both pass validation → each performs an unconditional update to USED → both return successful admission.

#### Root Cause

Eligibility checks and successful admission logs are separated from an unconditional state update.

**Root control** — `tixmoapi2/src/api/scanners/service.ts:350-369`

Eligibility checks and successful admission logs are separated from an unconditional state update.

```typescript
    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: true,
        ticketType: true,
        order: {
          select: {
            status: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
```

**Related control** — `tixmoapi2/src/api/tickets/service.ts:433-451`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async checkInTicket(barcode: string, checkedInBy?: string): Promise<Ticket> {
    // Validate first
    const validation = await this.validateTicket(barcode);

    if (!validation.valid) {
      throw ApiError.badRequest(validation.reason || 'Ticket is not valid');
    }

    // Mark as used
    const updatedTicket = await prisma.ticket.update({
      where: { barcode },
      data: {
        status: 'USED',
        checkedInAt: new Date(),
        checkedInBy: checkedInBy || 'system',
      },
    });

    return updatedTicket;
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/api/scanners/service.ts:350-369`

Eligibility checks and successful admission logs are separated from an unconditional state update.

```typescript
    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: true,
        ticketType: true,
        order: {
          select: {
            status: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
```

**Related control** — `tixmoapi2/src/api/tickets/service.ts:433-451`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async checkInTicket(barcode: string, checkedInBy?: string): Promise<Ticket> {
    // Validate first
    const validation = await this.validateTicket(barcode);

    if (!validation.valid) {
      throw ApiError.badRequest(validation.reason || 'Ticket is not valid');
    }

    // Mark as used
    const updatedTicket = await prisma.ticket.update({
      where: { barcode },
      data: {
        status: 'USED',
        checkedInAt: new Date(),
        checkedInBy: checkedInBy || 'system',
      },
    });

    return updatedTicket;
```

Assertions:
- One purchased ticket can admit multiple attendees when requests overlap. The same issue affects scanner and staff check-in endpoints. Two gate requests read VALID → both pass validation → each performs an unconditional update to USED → both return successful admission.

Counterevidence and remaining uncertainty:
- Sequential repeated ENTRY scans reject USED tickets. Scanner authentication and staff role restrictions control the calling gate. Redis lock code has ownership-safe release, but no runtime source calls acquireLock.

Limitations:
- No malicious production requests or state changes were made.
- Race is source-backed; existing tests do not force overlapping scan/cancellation transactions.

#### Dataflow

Two gate requests read VALID → both pass validation → each performs an unconditional update to USED → both return successful admission.

- **Source:** Attendees presenting copies of one valid paid QR simultaneously at different gates.

- **Sink:** tixmoapi2/src/api/scanners/service.ts

- **Outcome:** One purchased ticket can admit multiple attendees when requests overlap. The same issue affects scanner and staff check-in endpoints. Two gate requests read VALID → both pass validation → each performs an unconditional update to USED → both return successful admission.

**Root control** — `tixmoapi2/src/api/scanners/service.ts:350-369`

Eligibility checks and successful admission logs are separated from an unconditional state update.

```typescript
    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: true,
        ticketType: true,
        order: {
          select: {
            status: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
```

**Related control** — `tixmoapi2/src/api/tickets/service.ts:433-451`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async checkInTicket(barcode: string, checkedInBy?: string): Promise<Ticket> {
    // Validate first
    const validation = await this.validateTicket(barcode);

    if (!validation.valid) {
      throw ApiError.badRequest(validation.reason || 'Ticket is not valid');
    }

    // Mark as used
    const updatedTicket = await prisma.ticket.update({
      where: { barcode },
      data: {
        status: 'USED',
        checkedInAt: new Date(),
        checkedInBy: checkedInBy || 'system',
      },
    });

    return updatedTicket;
```

#### Reachability

Two gate requests read VALID → both pass validation → each performs an unconditional update to USED → both return successful admission.

Preconditions:
- Attendees presenting copies of one valid paid QR simultaneously at different gates.

Existing controls:
- Sequential repeated ENTRY scans reject USED tickets. Scanner authentication and staff role restrictions control the calling gate. Redis lock code has ownership-safe release, but no runtime source calls acquireLock.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**Medium** — One purchased ticket can admit multiple attendees when requests overlap. The same issue affects scanner and staff check-in endpoints. Requires Attendees presenting copies of one valid paid QR simultaneously at different gates.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** One purchased ticket can admit multiple attendees when requests overlap. The same issue affects scanner and staff check-in endpoints. Requires Attendees presenting copies of one valid paid QR simultaneously at different gates.

#### Remediation

Atomically change VALID to USED using a guarded update and accept only one affected row. Include order/payment eligibility and successful log creation in the same transactional admission operation. Add a simultaneous two-gate test.

Tests:
- At most one entry request may successfully consume a ticket. under repeated, concurrent and unauthorized requests.

<a id="finding-10"></a>

### [10] Ticket transfers and QR regeneration preserve previous admission credentials

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | admission |
| CWE | CWE-613 |
| Affected lines | tixmoapi2/src/api/tickets/service.ts:231-239 |

#### Summary

A former owner can consume the recipient's ticket or resell its saved QR code. The advertised compromise recovery endpoint does not revoke compromised copies. Customer saves QR → POST /tickets/:id/transfer changes owner → previous QR remains valid → gate redeems it before the recipient. POST /tickets/:id/regenerate-qr also reproduces the original payload.

#### Root Cause

Old admission credentials survive ownership changes and QR regeneration.

**Root control** — `tixmoapi2/src/api/tickets/service.ts:231-239`

Old admission credentials survive ownership changes and QR regeneration.

```typescript
    // Transfer the ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        userId: recipient.id,
        transferredFrom: currentUserId,
        transferredAt: new Date(),
        status: 'VALID', // Reset to VALID so the recipient can actually use the ticket
      },
```

**Related control** — `tixmoapi2/src/api/tickets/service.ts:539-553`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Generate new QR code
    const qrData = generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);
    const qrCodeDataUrl = await generateQRCode(qrData, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
    });

    // Update ticket
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        qrCodeUrl: qrCodeDataUrl,
        updatedAt: new Date(),
      },
```

**Related control** — `tixmoapi2/src/api/scanners/service.ts:348-352`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const { ticketId, eventId } = qrParsed;

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
```

**Related control** — `tixmoapi2/src/api/orders/service.ts:274-295`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async getOrderById(id: string, userId?: string): Promise<Order | null> {
    if (userId) {
      // when userId provided, findFirst with both id and userId
      return await prisma.order.findFirst({
        where: { id, userId },
        include: {
          tickets: {
            include: {
              ticketType: {
                select: { name: true },
              },
            },
          },
          event: {
            select: {
              name: true,
              startDatetime: true,
              venue: { select: { name: true, address: true } },
            },
          },
          user: { select: { email: true, firstName: true, lastName: true } },
        },
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/api/tickets/service.ts:231-239`

Old admission credentials survive ownership changes and QR regeneration.

```typescript
    // Transfer the ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        userId: recipient.id,
        transferredFrom: currentUserId,
        transferredAt: new Date(),
        status: 'VALID', // Reset to VALID so the recipient can actually use the ticket
      },
```

**Related control** — `tixmoapi2/src/api/tickets/service.ts:539-553`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Generate new QR code
    const qrData = generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);
    const qrCodeDataUrl = await generateQRCode(qrData, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
    });

    // Update ticket
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        qrCodeUrl: qrCodeDataUrl,
        updatedAt: new Date(),
      },
```

**Related control** — `tixmoapi2/src/api/scanners/service.ts:348-352`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const { ticketId, eventId } = qrParsed;

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
```

**Related control** — `tixmoapi2/src/api/orders/service.ts:274-295`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async getOrderById(id: string, userId?: string): Promise<Order | null> {
    if (userId) {
      // when userId provided, findFirst with both id and userId
      return await prisma.order.findFirst({
        where: { id, userId },
        include: {
          tickets: {
            include: {
              ticketType: {
                select: { name: true },
              },
            },
          },
          event: {
            select: {
              name: true,
              startDatetime: true,
              venue: { select: { name: true, address: true } },
            },
          },
          user: { select: { email: true, firstName: true, lastName: true } },
        },
```

Assertions:
- A former owner can consume the recipient's ticket or resell its saved QR code. The advertised compromise recovery endpoint does not revoke compromised copies. Customer saves QR → POST /tickets/:id/transfer changes owner → previous QR remains valid → gate redeems it before the recipient. POST /tickets/:id/regenerate-qr also reproduces the original payload.

Counterevidence and remaining uncertainty:
- Transfer and QR endpoints check current ownership; unpaid orders and cancelled/used tickets are rejected by the relevant admission paths. These checks do not invalidate saved credentials.

Limitations:
- No malicious production requests or state changes were made.

#### Dataflow

Customer saves QR → POST /tickets/:id/transfer changes owner → previous QR remains valid → gate redeems it before the recipient. POST /tickets/:id/regenerate-qr also reproduces the original payload.

- **Source:** A customer who saves a paid ticket's QR code before transferring it, or someone holding a compromised QR code.

- **Sink:** tixmoapi2/src/api/tickets/service.ts

- **Outcome:** A former owner can consume the recipient's ticket or resell its saved QR code. The advertised compromise recovery endpoint does not revoke compromised copies. Customer saves QR → POST /tickets/:id/transfer changes owner → previous QR remains valid → gate redeems it before the recipient. POST /tickets/:id/regenerate-qr also reproduces the original payload.

**Root control** — `tixmoapi2/src/api/tickets/service.ts:231-239`

Old admission credentials survive ownership changes and QR regeneration.

```typescript
    // Transfer the ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        userId: recipient.id,
        transferredFrom: currentUserId,
        transferredAt: new Date(),
        status: 'VALID', // Reset to VALID so the recipient can actually use the ticket
      },
```

**Related control** — `tixmoapi2/src/api/tickets/service.ts:539-553`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    // Generate new QR code
    const qrData = generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);
    const qrCodeDataUrl = await generateQRCode(qrData, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
    });

    // Update ticket
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        qrCodeUrl: qrCodeDataUrl,
        updatedAt: new Date(),
      },
```

**Related control** — `tixmoapi2/src/api/scanners/service.ts:348-352`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const { ticketId, eventId } = qrParsed;

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
```

**Related control** — `tixmoapi2/src/api/orders/service.ts:274-295`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async getOrderById(id: string, userId?: string): Promise<Order | null> {
    if (userId) {
      // when userId provided, findFirst with both id and userId
      return await prisma.order.findFirst({
        where: { id, userId },
        include: {
          tickets: {
            include: {
              ticketType: {
                select: { name: true },
              },
            },
          },
          event: {
            select: {
              name: true,
              startDatetime: true,
              venue: { select: { name: true, address: true } },
            },
          },
          user: { select: { email: true, firstName: true, lastName: true } },
        },
```

#### Reachability

Customer saves QR → POST /tickets/:id/transfer changes owner → previous QR remains valid → gate redeems it before the recipient. POST /tickets/:id/regenerate-qr also reproduces the original payload.

Preconditions:
- A customer who saves a paid ticket's QR code before transferring it, or someone holding a compromised QR code.

Existing controls:
- Transfer and QR endpoints check current ownership; unpaid orders and cancelled/used tickets are rejected by the relevant admission paths. These checks do not invalidate saved credentials.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**Medium** — A former owner can consume the recipient's ticket or resell its saved QR code. The advertised compromise recovery endpoint does not revoke compromised copies. Requires A customer who saves a paid ticket's QR code before transferring it, or someone holding a compromised QR code.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** A former owner can consume the recipient's ticket or resell its saved QR code. The advertised compromise recovery endpoint does not revoke compromised copies. Requires A customer who saves a paid ticket's QR code before transferring it, or someone holding a compromised QR code.

#### Remediation

Rotate an unpredictable admission token atomically on transfer/regeneration, clear the cached QR, require its match at every scanner path, and redact current admission tokens for tickets no longer owned by the order viewer. Propagate revocations to offline clients.

Tests:
- Transfer and compromise recovery must revoke prior holders' admission capabilities. under repeated, concurrent and unauthorized requests.

<a id="finding-11"></a>

### [11] Quantity-limited discounted tiers never exhaust through checkout

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | inventory |
| CWE | CWE-841 |
| Affected lines | tixmoapi2/src/api/ticket-tiers/service.ts:133-155 |

#### Summary

A configured limited early-bird discount can apply to the entire ticket inventory, causing unauthorized price reductions beyond the intended allocation. getActiveTier selects a tier while quantitySold \< quantityLimit → createOrder applies its price → confirmation increments only ticketType.quantitySold → tier.quantitySold remains unchanged → further orders continue receiving the limited price.

#### Root Cause

Only tier price is recorded; the limited tier's allocation is never reserved or consumed.

**Root control** — `tixmoapi2/src/api/ticket-tiers/service.ts:133-155`

Only tier price is recorded; the limited tier's allocation is never reserved or consumed.

```typescript
  async getActiveTier(ticketTypeId: string): Promise<TicketTier | null> {
    const now = new Date();

    const tiers = await prisma.ticketTier.findMany({
      where: {
        ticketTypeId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    for (const tier of tiers) {
      // Check date window
      if (tier.startsAt && now < tier.startsAt) continue;
      if (tier.endsAt && now >= tier.endsAt) continue;

      // Check quantity limit
      if (tier.quantityLimit !== null && tier.quantitySold >= tier.quantityLimit) continue;

      return tier; // First qualifying tier wins
    }

    return null; // No active tier — use base price
```

**Related control** — `tixmoapi2/src/api/orders/service.ts:117-128`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    for (const item of data.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      let unitPrice = ticketType.price;

      // Check for active tier
      const activeTier = await ticketTierService.getActiveTier(item.ticketTypeId);
      if (activeTier) {
        unitPrice = activeTier.price;
        tierPriceMap.set(item.ticketTypeId, activeTier.price);
      }

      totalAmount = totalAmount.add(unitPrice.mul(item.quantity));
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/api/ticket-tiers/service.ts:133-155`

Only tier price is recorded; the limited tier's allocation is never reserved or consumed.

```typescript
  async getActiveTier(ticketTypeId: string): Promise<TicketTier | null> {
    const now = new Date();

    const tiers = await prisma.ticketTier.findMany({
      where: {
        ticketTypeId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    for (const tier of tiers) {
      // Check date window
      if (tier.startsAt && now < tier.startsAt) continue;
      if (tier.endsAt && now >= tier.endsAt) continue;

      // Check quantity limit
      if (tier.quantityLimit !== null && tier.quantitySold >= tier.quantityLimit) continue;

      return tier; // First qualifying tier wins
    }

    return null; // No active tier — use base price
```

**Related control** — `tixmoapi2/src/api/orders/service.ts:117-128`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    for (const item of data.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      let unitPrice = ticketType.price;

      // Check for active tier
      const activeTier = await ticketTierService.getActiveTier(item.ticketTypeId);
      if (activeTier) {
        unitPrice = activeTier.price;
        tierPriceMap.set(item.ticketTypeId, activeTier.price);
      }

      totalAmount = totalAmount.add(unitPrice.mul(item.quantity));
```

Assertions:
- A configured limited early-bird discount can apply to the entire ticket inventory, causing unauthorized price reductions beyond the intended allocation. getActiveTier selects a tier while quantitySold \< quantityLimit → createOrder applies its price → confirmation increments only ticketType.quantitySold → tier.quantitySold remains unchanged → further orders continue receiving the limited price.

Counterevidence and remaining uncertainty:
- Tier activation dates and isActive are checked, and total ticket type stock is guarded. Runtime-source search found no increment of ticketTier.quantitySold. Exposure requires a configured quantity-limited discounted tier.

Limitations:
- No malicious production requests or state changes were made.

#### Dataflow

getActiveTier selects a tier while quantitySold \< quantityLimit → createOrder applies its price → confirmation increments only ticketType.quantitySold → tier.quantitySold remains unchanged → further orders continue receiving the limited price.

- **Source:** Customers purchasing while a cheaper quantity-limited tier is configured.

- **Sink:** tixmoapi2/src/api/ticket-tiers/service.ts

- **Outcome:** A configured limited early-bird discount can apply to the entire ticket inventory, causing unauthorized price reductions beyond the intended allocation. getActiveTier selects a tier while quantitySold \< quantityLimit → createOrder applies its price → confirmation increments only ticketType.quantitySold → tier.quantitySold remains unchanged → further orders continue receiving the limited price.

**Root control** — `tixmoapi2/src/api/ticket-tiers/service.ts:133-155`

Only tier price is recorded; the limited tier's allocation is never reserved or consumed.

```typescript
  async getActiveTier(ticketTypeId: string): Promise<TicketTier | null> {
    const now = new Date();

    const tiers = await prisma.ticketTier.findMany({
      where: {
        ticketTypeId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    for (const tier of tiers) {
      // Check date window
      if (tier.startsAt && now < tier.startsAt) continue;
      if (tier.endsAt && now >= tier.endsAt) continue;

      // Check quantity limit
      if (tier.quantityLimit !== null && tier.quantitySold >= tier.quantityLimit) continue;

      return tier; // First qualifying tier wins
    }

    return null; // No active tier — use base price
```

**Related control** — `tixmoapi2/src/api/orders/service.ts:117-128`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    for (const item of data.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      let unitPrice = ticketType.price;

      // Check for active tier
      const activeTier = await ticketTierService.getActiveTier(item.ticketTypeId);
      if (activeTier) {
        unitPrice = activeTier.price;
        tierPriceMap.set(item.ticketTypeId, activeTier.price);
      }

      totalAmount = totalAmount.add(unitPrice.mul(item.quantity));
```

#### Reachability

getActiveTier selects a tier while quantitySold \\\< quantityLimit → createOrder applies its price → confirmation increments only ticketType.quantitySold → tier.quantitySold remains unchanged → further orders continue receiving the limited price.

Preconditions:
- Customers purchasing while a cheaper quantity-limited tier is configured.

Existing controls:
- Tier activation dates and isActive are checked, and total ticket type stock is guarded. Runtime-source search found no increment of ticketTier.quantitySold. Exposure requires a configured quantity-limited discounted tier.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**Medium** — A configured limited early-bird discount can apply to the entire ticket inventory, causing unauthorized price reductions beyond the intended allocation. Requires Customers purchasing while a cheaper quantity-limited tier is configured.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** A configured limited early-bird discount can apply to the entire ticket inventory, causing unauthorized price reductions beyond the intended allocation. Requires Customers purchasing while a cheaper quantity-limited tier is configured.

#### Remediation

Persist the selected tier on the reservation/ticket, atomically reserve tier allocation during checkout, and maintain held/sold/released tier counters through every transition.

Tests:
- A limited-price tier must stop supplying its price when its allocation is consumed. under repeated, concurrent and unauthorized requests.

<a id="finding-12"></a>

### [12] Approval cache survives logout and exposes the previous session to the next user

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Complete frontend dashboard/detail/session/router reads and parent source trace establish disclosure despite current API authorization denial. |
| Category | privacy |
| CWE | CWE-525 |
| Affected lines | tdash/src/features/ApprovalsDashboard.jsx:72-78 |

#### Summary

An authenticated staff GET /approvals returns INTERNAL comments, full revisions/assets and reviewer reviewUrl credentials. ApprovalsDashboard serializes the complete response in a global sessionStorage key without identity/expiry. clearStoredSession removes only localStorage auth/activity entries. The next logged-in user can enter /approvals; cached records are rendered immediately and retained when current API access fails. Clicking a card passes its cached record as initialApproval. ApprovalDetailView keeps initialApproval on failed refresh and treats any truthy user.role, including CUSTOMER, as staff for internal-comment visibility. Disclosure of the preceding staff session's internal comments, reviewer identities, revision assets and still-valid bearer review credentials on shared-browser reuse. The credentials can be replayed against public review endpoints.

#### Root Cause

Sensitive staff responses are persisted globally across authentication transitions and trusted on authorization failure.

**Global sensitive cache write** — `tdash/src/features/ApprovalsDashboard.jsx:66-78`

Cache stores complete approval data without a user/session partition or expiry.

```javascript
const writeApprovalsDashboardCache = ({ approvals, events }) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.sessionStorage.setItem(
            APPROVALS_DASHBOARD_CACHE_KEY,
            JSON.stringify({
                approvals,
                events,
            })
        );
```

**Supporting lifecycle control** — `tdash/src/features/ApprovalsDashboard.jsx:505-517`

Cached staff data survives the later identity/authorization boundary.

```javascript
            let nextApprovals = approvalsRef.current;
            let nextEvents = eventsRef.current;
            let nextError = '';

            if (approvalsResponse.status === 'fulfilled') {
                nextApprovals = approvalsResponse.value.approvals || [];
                setApprovals(nextApprovals);
            } else {
                nextError =
                    approvalsResponse.reason?.response?.data?.message ||
                    approvalsResponse.reason?.message ||
                    'Failed to load approvals.';
            }
```

**Supporting lifecycle control** — `tdash/src/features/ApprovalDetailView.jsx:345-375`

Cached staff data survives the later identity/authorization boundary.

```javascript
    const isTeamMember = useMemo(() => {
        if (user?.role || user?.organizationId) {
            return true;
        }

        const currentEmail = normalizeEmail(user?.email);
        if (!currentEmail) {
            return false;
        }

        return reviewers.some((reviewer) => (
            normalizeEmail(reviewer.email) === currentEmail &&
            reviewer.reviewerType === 'INTERNAL'
        ));
    }, [reviewers, user?.email, user?.organizationId, user?.role]);
    const sortedComments = useMemo(
        () =>
            [...comments].sort((left, right) => {
                const leftTime = new Date(left.createdAt || 0).getTime();
                const rightTime = new Date(right.createdAt || 0).getTime();
                return rightTime - leftTime;
            }),
        [comments]
    );
    const internalComments = useMemo(
        () => sortedComments.filter((item) => item.visibility === 'INTERNAL'),
        [sortedComments]
    );
    const visibleComments = useMemo(
        () => sortedComments.filter((item) => isTeamMember || item.visibility !== 'INTERNAL'),
        [isTeamMember, sortedComments]
```

**Supporting lifecycle control** — `tdash/src/lib/session.js:115-124`

Cached staff data survives the later identity/authorization boundary.

```javascript
};

export const clearStoredSession = () => {
    removeStoredValue(ACCESS_TOKEN_KEY);
    removeStoredValue(REFRESH_TOKEN_KEY);
    removeStoredValue(USER_STORAGE_KEY);
    clearSessionActivity();
};

export const emitAuthExpired = (reason = AUTH_EXPIRED_REASONS.expired) => {
```

**Supporting lifecycle control** — `tdash/src/features/ApprovalDetailView.jsx:293-298`

Cached staff data survives the later identity/authorization boundary.

```javascript
        } catch (requestError) {
            if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
                return null;
            }
            setError(requestError.response?.data?.message || requestError.message || 'Failed to load approval.');
        } finally {
```

#### Validation

Cache write, retained logout storage, rehydration, denial behavior and internal-comment rendering traced. No production login or shared-browser exploitation executed.

Validation method: Static complete-file and parent source tracing

**Global sensitive cache write** — `tdash/src/features/ApprovalsDashboard.jsx:66-78`

Cache stores complete approval data without a user/session partition or expiry.

```javascript
const writeApprovalsDashboardCache = ({ approvals, events }) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.sessionStorage.setItem(
            APPROVALS_DASHBOARD_CACHE_KEY,
            JSON.stringify({
                approvals,
                events,
            })
        );
```

**Supporting lifecycle control** — `tdash/src/features/ApprovalsDashboard.jsx:505-517`

Cached staff data survives the later identity/authorization boundary.

```javascript
            let nextApprovals = approvalsRef.current;
            let nextEvents = eventsRef.current;
            let nextError = '';

            if (approvalsResponse.status === 'fulfilled') {
                nextApprovals = approvalsResponse.value.approvals || [];
                setApprovals(nextApprovals);
            } else {
                nextError =
                    approvalsResponse.reason?.response?.data?.message ||
                    approvalsResponse.reason?.message ||
                    'Failed to load approvals.';
            }
```

**Supporting lifecycle control** — `tdash/src/features/ApprovalDetailView.jsx:345-375`

Cached staff data survives the later identity/authorization boundary.

```javascript
    const isTeamMember = useMemo(() => {
        if (user?.role || user?.organizationId) {
            return true;
        }

        const currentEmail = normalizeEmail(user?.email);
        if (!currentEmail) {
            return false;
        }

        return reviewers.some((reviewer) => (
            normalizeEmail(reviewer.email) === currentEmail &&
            reviewer.reviewerType === 'INTERNAL'
        ));
    }, [reviewers, user?.email, user?.organizationId, user?.role]);
    const sortedComments = useMemo(
        () =>
            [...comments].sort((left, right) => {
                const leftTime = new Date(left.createdAt || 0).getTime();
                const rightTime = new Date(right.createdAt || 0).getTime();
                return rightTime - leftTime;
            }),
        [comments]
    );
    const internalComments = useMemo(
        () => sortedComments.filter((item) => item.visibility === 'INTERNAL'),
        [sortedComments]
    );
    const visibleComments = useMemo(
        () => sortedComments.filter((item) => isTeamMember || item.visibility !== 'INTERNAL'),
        [isTeamMember, sortedComments]
```

**Supporting lifecycle control** — `tdash/src/lib/session.js:115-124`

Cached staff data survives the later identity/authorization boundary.

```javascript
};

export const clearStoredSession = () => {
    removeStoredValue(ACCESS_TOKEN_KEY);
    removeStoredValue(REFRESH_TOKEN_KEY);
    removeStoredValue(USER_STORAGE_KEY);
    clearSessionActivity();
};

export const emitAuthExpired = (reason = AUTH_EXPIRED_REASONS.expired) => {
```

**Supporting lifecycle control** — `tdash/src/features/ApprovalDetailView.jsx:293-298`

Cached staff data survives the later identity/authorization boundary.

```javascript
        } catch (requestError) {
            if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
                return null;
            }
            setError(requestError.response?.data?.message || requestError.message || 'Failed to load approval.');
        } finally {
```

Assertions:
- Signed-out staff approval data and bearer reviewer links must not remain available to the subsequent unauthorised session.

Counterevidence and remaining uncertainty:
- The cache is scoped to the browser tab and normally disappears when its page session ends; this is a local/shared-browser issue, not a remote cross-tenant disclosure. Successful authorized refresh replaces the cache, but rejection retains it. Server organization checks do not authorize cached content. Legitimate same-business staff visibility remains expected.

Limitations:
- Shared-browser/tab prerequisite; no remote disclosure or multi-tenant claim.
- End-to-end exploit not executed.

#### Dataflow

An authenticated staff GET /approvals returns INTERNAL comments, full revisions/assets and reviewer reviewUrl credentials. ApprovalsDashboard serializes the complete response in a global sessionStorage key without identity/expiry. clearStoredSession removes only localStorage auth/activity entries. The next logged-in user can enter /approvals; cached records are rendered immediately and retained when current API access fails. Clicking a card passes its cached record as initialApproval. ApprovalDetailView keeps initialApproval on failed refresh and treats any truthy user.role, including CUSTOMER, as staff for internal-comment visibility.

- **Source:** Previous authenticated staff API response

- **Sink:** Subsequent user's cached approval detail

- **Outcome:** Disclosure of the preceding staff session's internal comments, reviewer identities, revision assets and still-valid bearer review credentials on shared-browser reuse. The credentials can be replayed against public review endpoints.

**Global sensitive cache write** — `tdash/src/features/ApprovalsDashboard.jsx:66-78`

Cache stores complete approval data without a user/session partition or expiry.

```javascript
const writeApprovalsDashboardCache = ({ approvals, events }) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.sessionStorage.setItem(
            APPROVALS_DASHBOARD_CACHE_KEY,
            JSON.stringify({
                approvals,
                events,
            })
        );
```

**Supporting lifecycle control** — `tdash/src/features/ApprovalsDashboard.jsx:505-517`

Cached staff data survives the later identity/authorization boundary.

```javascript
            let nextApprovals = approvalsRef.current;
            let nextEvents = eventsRef.current;
            let nextError = '';

            if (approvalsResponse.status === 'fulfilled') {
                nextApprovals = approvalsResponse.value.approvals || [];
                setApprovals(nextApprovals);
            } else {
                nextError =
                    approvalsResponse.reason?.response?.data?.message ||
                    approvalsResponse.reason?.message ||
                    'Failed to load approvals.';
            }
```

**Supporting lifecycle control** — `tdash/src/features/ApprovalDetailView.jsx:345-375`

Cached staff data survives the later identity/authorization boundary.

```javascript
    const isTeamMember = useMemo(() => {
        if (user?.role || user?.organizationId) {
            return true;
        }

        const currentEmail = normalizeEmail(user?.email);
        if (!currentEmail) {
            return false;
        }

        return reviewers.some((reviewer) => (
            normalizeEmail(reviewer.email) === currentEmail &&
            reviewer.reviewerType === 'INTERNAL'
        ));
    }, [reviewers, user?.email, user?.organizationId, user?.role]);
    const sortedComments = useMemo(
        () =>
            [...comments].sort((left, right) => {
                const leftTime = new Date(left.createdAt || 0).getTime();
                const rightTime = new Date(right.createdAt || 0).getTime();
                return rightTime - leftTime;
            }),
        [comments]
    );
    const internalComments = useMemo(
        () => sortedComments.filter((item) => item.visibility === 'INTERNAL'),
        [sortedComments]
    );
    const visibleComments = useMemo(
        () => sortedComments.filter((item) => isTeamMember || item.visibility !== 'INTERNAL'),
        [isTeamMember, sortedComments]
```

**Supporting lifecycle control** — `tdash/src/lib/session.js:115-124`

Cached staff data survives the later identity/authorization boundary.

```javascript
};

export const clearStoredSession = () => {
    removeStoredValue(ACCESS_TOKEN_KEY);
    removeStoredValue(REFRESH_TOKEN_KEY);
    removeStoredValue(USER_STORAGE_KEY);
    clearSessionActivity();
};

export const emitAuthExpired = (reason = AUTH_EXPIRED_REASONS.expired) => {
```

**Supporting lifecycle control** — `tdash/src/features/ApprovalDetailView.jsx:293-298`

Cached staff data survives the later identity/authorization boundary.

```javascript
        } catch (requestError) {
            if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
                return null;
            }
            setError(requestError.response?.data?.message || requestError.message || 'Failed to load approval.');
        } finally {
```

#### Reachability

An authenticated staff GET /approvals returns INTERNAL comments, full revisions/assets and reviewer reviewUrl credentials. ApprovalsDashboard serializes the complete response in a global sessionStorage key without identity/expiry. clearStoredSession removes only localStorage auth/activity entries. The next logged-in user can enter /approvals; cached records are rendered immediately and retained when current API access fails. Clicking a card passes its cached record as initialApproval. ApprovalDetailView keeps initialApproval on failed refresh and treats any truthy user.role, including CUSTOMER, as staff for internal-comment visibility.

Preconditions:
- Another person reusing the same browser tab after a staff member logs out, including a customer who subsequently signs in.

Existing controls:
- The cache is scoped to the browser tab and normally disappears when its page session ends; this is a local/shared-browser issue, not a remote cross-tenant disclosure. Successful authorized refresh replaces the cache, but rejection retains it. Server organization checks do not authorize cached content. Legitimate same-business staff visibility remains expected.

Limitations:
- Requires prior staff cache and same-tab subsequent user.

#### Severity

**Medium** — Disclosure of the preceding staff session's internal comments, reviewer identities, revision assets and still-valid bearer review credentials on shared-browser reuse. The credentials can be replayed against public review endpoints. Requires subsequent use of the same browser tab, limiting reachability.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** Disclosure of the preceding staff session's internal comments, reviewer identities, revision assets and still-valid bearer review credentials on shared-browser reuse. The credentials can be replayed against public review endpoints.

#### Remediation

Clear sensitive sessionStorage on every logout/expiry/account transition; partition caches by authenticated user and organization/session generation, enforce expiry, discard content on authorization errors, avoid caching bearer credentials, and derive isTeamMember from explicit staff roles.

Tests:
- Staff logout then customer login in same tab yields no staff cache or internal content even when API returns 403.
- All expiry, logout and account-switch paths clear or isolate sensitive caches and no bearer tokens are cached.

<a id="finding-13"></a>

### [13] Aborted requests permanently consume waiting-room capacity

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | availability |
| CWE | CWE-772 |
| Affected lines | tixmoapi2/src/middleware/waitingRoom.ts:34-51 |

#### Summary

The waiting room increments a persistent Redis counter and decrements only on response finish. Its close listener does nothing, and no lease/TTL is set. Aborted slow requests or process termination can leave reservations behind until ordinary requests are rejected at the 5,000 limit while health checks continue passing.

#### Root Cause

Reservations have no idempotent abort release or crash-expiring lease.

**Root control** — `tixmoapi2/src/middleware/waitingRoom.ts:34-51`

Reservations have no idempotent abort release or crash-expiring lease.

```typescript
    // Capture response finish to decrement count
    res.on('finish', () => {
      client.decr(ACTIVE_USERS_KEY).catch((err) => {
        logger.error('Failed to decrement active user count', err);
      });
    });

    // Also handle close in case connection is terminated prematurely
    res.on('close', () => {
      // NOTE: 'finish' and 'close' might both emit, but DECR operates on an atomic counter.
      // Ideally we want to decrement exactly once per increment.
      // Express 'finish' event is reliable for completed responses.
      // 'close' handles aborted connections.
      // We rely on 'finish' primarily. To handle 'close' without double-decrementing is tricky without unique request IDs.
      // For a simple waiting room, 'finish' is usually sufficient.
      // If we implement unique request tracking, we could be more precise.
      // For now, we trust 'finish'.
    });
```

**Related control** — `tixmoapi2/src/middleware/waitingRoom.ts:15-31`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  try {
    const client = getRedisClient();

    // Increment active user count
    const activeUsers = await client.incr(ACTIVE_USERS_KEY);

    // If load is too high, reject
    if (activeUsers > MAX_CONCURRENT_USERS) {
      // Decrement immediately since we are rejecting
      await client.decr(ACTIVE_USERS_KEY);

      logger.warn('Waiting Room Active: Rejected request due to high load', { activeUsers });

      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        message: 'High traffic volume. Please try again in a moment.',
        retryAfter: 5, // Suggest retry in 5 seconds
      });
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/middleware/waitingRoom.ts:34-51`

Reservations have no idempotent abort release or crash-expiring lease.

```typescript
    // Capture response finish to decrement count
    res.on('finish', () => {
      client.decr(ACTIVE_USERS_KEY).catch((err) => {
        logger.error('Failed to decrement active user count', err);
      });
    });

    // Also handle close in case connection is terminated prematurely
    res.on('close', () => {
      // NOTE: 'finish' and 'close' might both emit, but DECR operates on an atomic counter.
      // Ideally we want to decrement exactly once per increment.
      // Express 'finish' event is reliable for completed responses.
      // 'close' handles aborted connections.
      // We rely on 'finish' primarily. To handle 'close' without double-decrementing is tricky without unique request IDs.
      // For a simple waiting room, 'finish' is usually sufficient.
      // If we implement unique request tracking, we could be more precise.
      // For now, we trust 'finish'.
    });
```

**Related control** — `tixmoapi2/src/middleware/waitingRoom.ts:15-31`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  try {
    const client = getRedisClient();

    // Increment active user count
    const activeUsers = await client.incr(ACTIVE_USERS_KEY);

    // If load is too high, reject
    if (activeUsers > MAX_CONCURRENT_USERS) {
      // Decrement immediately since we are rejecting
      await client.decr(ACTIVE_USERS_KEY);

      logger.warn('Waiting Room Active: Rejected request due to high load', { activeUsers });

      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        message: 'High traffic volume. Please try again in a moment.',
        retryAfter: 5, // Suggest retry in 5 seconds
      });
```

Assertions:
- The waiting room increments a persistent Redis counter and decrements only on response finish. Its close listener does nothing, and no lease/TTL is set. Aborted slow requests or process termination can leave reservations behind until ordinary requests are rejected at the 5,000 limit while health checks continue passing.

Counterevidence and remaining uncertainty:
- Overflow rejection immediately decrements; completed requests release; Redis outage fails open. None recovers leaked reservations during healthy Redis service.

Limitations:
- No malicious production requests or state changes were made.

#### Dataflow

Request INCR -\> early connection close without finish -\> persistent leaked count -\> repeated aborts -\> 503 for normal traffic.

- **Source:** Unauthenticated callers that terminate admitted requests before the response finishes.

- **Sink:** tixmoapi2/src/middleware/waitingRoom.ts

- **Outcome:** The waiting room increments a persistent Redis counter and decrements only on response finish. Its close listener does nothing, and no lease/TTL is set. Aborted slow requests or process termination can leave reservations behind until ordinary requests are rejected at the 5,000 limit while health checks continue passing.

**Root control** — `tixmoapi2/src/middleware/waitingRoom.ts:34-51`

Reservations have no idempotent abort release or crash-expiring lease.

```typescript
    // Capture response finish to decrement count
    res.on('finish', () => {
      client.decr(ACTIVE_USERS_KEY).catch((err) => {
        logger.error('Failed to decrement active user count', err);
      });
    });

    // Also handle close in case connection is terminated prematurely
    res.on('close', () => {
      // NOTE: 'finish' and 'close' might both emit, but DECR operates on an atomic counter.
      // Ideally we want to decrement exactly once per increment.
      // Express 'finish' event is reliable for completed responses.
      // 'close' handles aborted connections.
      // We rely on 'finish' primarily. To handle 'close' without double-decrementing is tricky without unique request IDs.
      // For a simple waiting room, 'finish' is usually sufficient.
      // If we implement unique request tracking, we could be more precise.
      // For now, we trust 'finish'.
    });
```

**Related control** — `tixmoapi2/src/middleware/waitingRoom.ts:15-31`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  try {
    const client = getRedisClient();

    // Increment active user count
    const activeUsers = await client.incr(ACTIVE_USERS_KEY);

    // If load is too high, reject
    if (activeUsers > MAX_CONCURRENT_USERS) {
      // Decrement immediately since we are rejecting
      await client.decr(ACTIVE_USERS_KEY);

      logger.warn('Waiting Room Active: Rejected request due to high load', { activeUsers });

      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        message: 'High traffic volume. Please try again in a moment.',
        retryAfter: 5, // Suggest retry in 5 seconds
      });
```

#### Reachability

Request INCR -\\\> early connection close without finish -\\\> persistent leaked count -\\\> repeated aborts -\\\> 503 for normal traffic.

Preconditions:
- Unauthenticated callers that terminate admitted requests before the response finishes.

Existing controls:
- Overflow rejection immediately decrements; completed requests release; Redis outage fails open. None recovers leaked reservations during healthy Redis service.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**Medium** — An unauthenticated client able to abort in-flight requests can accumulate stale capacity and deny normal API use.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** An unauthenticated client able to abort in-flight requests can accumulate stale capacity and deny normal API use.

#### Remediation

Release exactly once on both finish and close and use expiring per-request leases or another crash-safe concurrency mechanism; expose saturation/recovery metrics.

Tests:
- finish plus close releases once, early close releases once.
- Worker crash leases expire and normal service recovers without manual Redis edits.

<a id="finding-14"></a>

### [14] Event-assigned scanner keys can scan tickets for other events

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | admission |
| CWE | CWE-863 |
| Affected lines | tixmoapi2/src/middleware/scannerAuth.ts:39-48 |

#### Summary

An event-limited scanner can consume another event's tickets and retrieve its attendee/ticket details. This remains an event capability violation within one business. POST /scanners/scan or /scanners/validate authenticates event A's scanner → controller passes only scannerId and supplied QR → scanTicket reads event B's ticket without loading or checking scanner scope → writes a successful log and consumes event B's ticket.

#### Root Cause

Scanner authentication identity is discarded at the shared admission operation.

**Root control** — `tixmoapi2/src/middleware/scannerAuth.ts:39-48`

Scanner authentication identity is discarded at the shared admission operation.

```typescript
    const scanner = await scannerService.authenticateScanner(apiKey);

    // Attach scanner info to request
    req.scanner = {
      id: scanner.id,
      name: scanner.name,
      organizationId: scanner.organizationId,
      eventId: scanner.eventId,
    };
    req.scannerId = scanner.id;
```

**Related control** — `tixmoapi2/src/api/scanners/controller.ts:169-174`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const result = await scannerService.scanTicket({
      scannerId: req.scanner!.id,
      qrData: req.body.qrData,
      scanType: req.body.scanType,
      metadata: req.body.metadata,
    });
```

**Related control** — `tixmoapi2/src/api/scanners/service.ts:318-363`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async scanTicket(data: ScanTicketData): Promise<{
    success: boolean;
    ticket?: unknown;
    scanLog: ScanLog;
    reason?: string;
  }> {
    // Parse QR code data
    const qrParsed = parseTicketQRData(data.qrData);

    if (!qrParsed) {
      // Log failed scan
      const failedLog = await prisma.scanLog.create({
        data: {
          scannerId: data.scannerId,
          ticketId: '00000000-0000-0000-0000-000000000000', // Invalid ticket
          eventId: '00000000-0000-0000-0000-000000000000', // Invalid event
          scanType: data.scanType,
          success: false,
          failureReason: 'Invalid QR code format',
          metadata: data.metadata as Prisma.InputJsonValue,
        },
      });

      return {
        success: false,
        reason: 'Invalid QR code format',
        scanLog: failedLog,
      };
    }

    const { ticketId, eventId } = qrParsed;

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: true,
        ticketType: true,
        order: {
          select: {
            status: true,
          },
        },
        user: {
          select: {
            firstName: true,
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/middleware/scannerAuth.ts:39-48`

Scanner authentication identity is discarded at the shared admission operation.

```typescript
    const scanner = await scannerService.authenticateScanner(apiKey);

    // Attach scanner info to request
    req.scanner = {
      id: scanner.id,
      name: scanner.name,
      organizationId: scanner.organizationId,
      eventId: scanner.eventId,
    };
    req.scannerId = scanner.id;
```

**Related control** — `tixmoapi2/src/api/scanners/controller.ts:169-174`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const result = await scannerService.scanTicket({
      scannerId: req.scanner!.id,
      qrData: req.body.qrData,
      scanType: req.body.scanType,
      metadata: req.body.metadata,
    });
```

**Related control** — `tixmoapi2/src/api/scanners/service.ts:318-363`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async scanTicket(data: ScanTicketData): Promise<{
    success: boolean;
    ticket?: unknown;
    scanLog: ScanLog;
    reason?: string;
  }> {
    // Parse QR code data
    const qrParsed = parseTicketQRData(data.qrData);

    if (!qrParsed) {
      // Log failed scan
      const failedLog = await prisma.scanLog.create({
        data: {
          scannerId: data.scannerId,
          ticketId: '00000000-0000-0000-0000-000000000000', // Invalid ticket
          eventId: '00000000-0000-0000-0000-000000000000', // Invalid event
          scanType: data.scanType,
          success: false,
          failureReason: 'Invalid QR code format',
          metadata: data.metadata as Prisma.InputJsonValue,
        },
      });

      return {
        success: false,
        reason: 'Invalid QR code format',
        scanLog: failedLog,
      };
    }

    const { ticketId, eventId } = qrParsed;

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: true,
        ticketType: true,
        order: {
          select: {
            status: true,
          },
        },
        user: {
          select: {
            firstName: true,
```

Assertions:
- An event-limited scanner can consume another event's tickets and retrieve its attendee/ticket details. This remains an event capability violation within one business. POST /scanners/scan or /scanners/validate authenticates event A's scanner → controller passes only scannerId and supplied QR → scanTicket reads event B's ticket without loading or checking scanner scope → writes a successful log and consumes event B's ticket.

Counterevidence and remaining uncertainty:
- Inactive/revoked keys are rejected. Registration validates event organization. Offline ticket download checks assigned event at lines 615-618; online scans and uploaded offline scans lack the equivalent check.

Limitations:
- No malicious production requests or state changes were made.

#### Dataflow

POST /scanners/scan or /scanners/validate authenticates event A's scanner → controller passes only scannerId and supplied QR → scanTicket reads event B's ticket without loading or checking scanner scope → writes a successful log and consumes event B's ticket.

- **Source:** A person possessing an active scanner API key assigned to event A and a QR code from event B.

- **Sink:** tixmoapi2/src/middleware/scannerAuth.ts

- **Outcome:** An event-limited scanner can consume another event's tickets and retrieve its attendee/ticket details. This remains an event capability violation within one business. POST /scanners/scan or /scanners/validate authenticates event A's scanner → controller passes only scannerId and supplied QR → scanTicket reads event B's ticket without loading or checking scanner scope → writes a successful log and consumes event B's ticket.

**Root control** — `tixmoapi2/src/middleware/scannerAuth.ts:39-48`

Scanner authentication identity is discarded at the shared admission operation.

```typescript
    const scanner = await scannerService.authenticateScanner(apiKey);

    // Attach scanner info to request
    req.scanner = {
      id: scanner.id,
      name: scanner.name,
      organizationId: scanner.organizationId,
      eventId: scanner.eventId,
    };
    req.scannerId = scanner.id;
```

**Related control** — `tixmoapi2/src/api/scanners/controller.ts:169-174`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const result = await scannerService.scanTicket({
      scannerId: req.scanner!.id,
      qrData: req.body.qrData,
      scanType: req.body.scanType,
      metadata: req.body.metadata,
    });
```

**Related control** — `tixmoapi2/src/api/scanners/service.ts:318-363`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
  async scanTicket(data: ScanTicketData): Promise<{
    success: boolean;
    ticket?: unknown;
    scanLog: ScanLog;
    reason?: string;
  }> {
    // Parse QR code data
    const qrParsed = parseTicketQRData(data.qrData);

    if (!qrParsed) {
      // Log failed scan
      const failedLog = await prisma.scanLog.create({
        data: {
          scannerId: data.scannerId,
          ticketId: '00000000-0000-0000-0000-000000000000', // Invalid ticket
          eventId: '00000000-0000-0000-0000-000000000000', // Invalid event
          scanType: data.scanType,
          success: false,
          failureReason: 'Invalid QR code format',
          metadata: data.metadata as Prisma.InputJsonValue,
        },
      });

      return {
        success: false,
        reason: 'Invalid QR code format',
        scanLog: failedLog,
      };
    }

    const { ticketId, eventId } = qrParsed;

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: true,
        ticketType: true,
        order: {
          select: {
            status: true,
          },
        },
        user: {
          select: {
            firstName: true,
```

#### Reachability

POST /scanners/scan or /scanners/validate authenticates event A's scanner → controller passes only scannerId and supplied QR → scanTicket reads event B's ticket without loading or checking scanner scope → writes a successful log and consumes event B's ticket.

Preconditions:
- A person possessing an active scanner API key assigned to event A and a QR code from event B.

Existing controls:
- Inactive/revoked keys are rejected. Registration validates event organization. Offline ticket download checks assigned event at lines 615-618; online scans and uploaded offline scans lack the equivalent check.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**Medium** — An event-limited scanner can consume another event's tickets and retrieve its attendee/ticket details. This remains an event capability violation within one business. Requires A person possessing an active scanner API key assigned to event A and a QR code from event B.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** An event-limited scanner can consume another event's tickets and retrieve its attendee/ticket details. This remains an event capability violation within one business. Requires A person possessing an active scanner API key assigned to event A and a QR code from event B.

#### Remediation

Resolve and enforce the scanner's active state, organization, and optional event assignment inside the shared admission service before returning ticket data or changing ticket state.

Tests:
- A scanner's event assignment must constrain its admission authority. under repeated, concurrent and unauthorized requests.

<a id="finding-15"></a>

### [15] Concurrent cancellation requests can release the same inventory repeatedly

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent full-file review and parent inspection confirm the reachable source control failure. Production exploitation was not attempted. |
| Category | inventory |
| CWE | CWE-367 |
| Affected lines | tixmoapi2/src/api/tickets/service.ts:278-319 |

#### Summary

Customers can inflate available stock beyond physical capacity, cause overselling, and corrupt held/sold counters. Pending-order cancellation can consume other orders' aggregate holds. Concurrent requests read a cancellable ticket/order before either transaction → both pass status checks → each transaction updates the same state unconditionally and increments available inventory.

#### Root Cause

Transition eligibility is checked before the transaction rather than claimed once inside it.

**Root control** — `tixmoapi2/src/api/tickets/service.ts:278-319`

Transition eligibility is checked before the transaction rather than claimed once inside it.

```typescript
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        event: true,
        order: true,
      },
    });

    if (!ticket) {
      throw ApiError.notFound('Ticket not found');
    }

    const ticketTyped2 = ticket as unknown as Ticket & {
      event: { startDatetime: Date };
      order: { status: string };
      userId: string;
      status: string;
    };

    // Check ownership
    if (ticketTyped2.userId !== userId) {
      throw ApiError.forbidden('You can only cancel your own tickets');
    }

    // Check if ticket is valid
    if (ticketTyped2.status === 'CANCELLED') {
      throw ApiError.badRequest('Ticket is already cancelled');
    }

    if (ticketTyped2.status === 'USED') {
      throw ApiError.badRequest('Cannot cancel a used ticket');
    }

    // Check if order is paid
    if (ticketTyped2.order.status !== 'PAID') {
      throw ApiError.badRequest('Can only cancel tickets from paid orders');
    }

    // Check if event hasn't started
    if (new Date() >= ticketTyped2.event.startDatetime) {
      throw ApiError.badRequest('Cannot cancel tickets for events that have already started');
    }
```

**Related control** — `tixmoapi2/src/api/orders/service.ts:467-489`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        tickets: true,
      },
    });

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const orderTyped2 = order as unknown as OrderWithTicketsAndUser;
    if (userId && orderTyped2.userId !== userId) {
      throw ApiError.forbidden('You can only cancel your own orders');
    }

    if (orderTyped2.status === 'CANCELLED') {
      throw ApiError.badRequest('Order is already cancelled');
    }

    if (orderTyped2.status === 'PAID') {
      throw ApiError.badRequest('Cannot cancel paid orders. Request a refund instead.');
    }
```

**Related control** — `tixmoapi2/src/api/tickets/routes.ts:216`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
router.post('/:id/cancel', controller.cancelTicket);
```

#### Validation

Source path and missing guard confirmed; general regression tests are not claimed as exploit reproductions.

Validation method: Static source tracing with counterevidence review

**Root control** — `tixmoapi2/src/api/tickets/service.ts:278-319`

Transition eligibility is checked before the transaction rather than claimed once inside it.

```typescript
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        event: true,
        order: true,
      },
    });

    if (!ticket) {
      throw ApiError.notFound('Ticket not found');
    }

    const ticketTyped2 = ticket as unknown as Ticket & {
      event: { startDatetime: Date };
      order: { status: string };
      userId: string;
      status: string;
    };

    // Check ownership
    if (ticketTyped2.userId !== userId) {
      throw ApiError.forbidden('You can only cancel your own tickets');
    }

    // Check if ticket is valid
    if (ticketTyped2.status === 'CANCELLED') {
      throw ApiError.badRequest('Ticket is already cancelled');
    }

    if (ticketTyped2.status === 'USED') {
      throw ApiError.badRequest('Cannot cancel a used ticket');
    }

    // Check if order is paid
    if (ticketTyped2.order.status !== 'PAID') {
      throw ApiError.badRequest('Can only cancel tickets from paid orders');
    }

    // Check if event hasn't started
    if (new Date() >= ticketTyped2.event.startDatetime) {
      throw ApiError.badRequest('Cannot cancel tickets for events that have already started');
    }
```

**Related control** — `tixmoapi2/src/api/orders/service.ts:467-489`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        tickets: true,
      },
    });

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const orderTyped2 = order as unknown as OrderWithTicketsAndUser;
    if (userId && orderTyped2.userId !== userId) {
      throw ApiError.forbidden('You can only cancel your own orders');
    }

    if (orderTyped2.status === 'CANCELLED') {
      throw ApiError.badRequest('Order is already cancelled');
    }

    if (orderTyped2.status === 'PAID') {
      throw ApiError.badRequest('Cannot cancel paid orders. Request a refund instead.');
    }
```

**Related control** — `tixmoapi2/src/api/tickets/routes.ts:216`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
router.post('/:id/cancel', controller.cancelTicket);
```

Assertions:
- Customers can inflate available stock beyond physical capacity, cause overselling, and corrupt held/sold counters. Pending-order cancellation can consume other orders' aggregate holds. Concurrent requests read a cancellable ticket/order before either transaction → both pass status checks → each transaction updates the same state unconditionally and increments available inventory.

Counterevidence and remaining uncertainty:
- Sequential cancellations reject already-cancelled records. Inventory hold creation uses atomic quantityAvailable guards. Transactions make each individual cancellation consistent but do not recheck its transition eligibility.

Limitations:
- No malicious production requests or state changes were made.
- Race is source-backed; existing tests do not force overlapping scan/cancellation transactions.

#### Dataflow

Concurrent requests read a cancellable ticket/order before either transaction → both pass status checks → each transaction updates the same state unconditionally and increments available inventory.

- **Source:** An authenticated customer issuing simultaneous cancellation requests for their own ticket or pending order.

- **Sink:** tixmoapi2/src/api/tickets/service.ts

- **Outcome:** Customers can inflate available stock beyond physical capacity, cause overselling, and corrupt held/sold counters. Pending-order cancellation can consume other orders' aggregate holds. Concurrent requests read a cancellable ticket/order before either transaction → both pass status checks → each transaction updates the same state unconditionally and increments available inventory.

**Root control** — `tixmoapi2/src/api/tickets/service.ts:278-319`

Transition eligibility is checked before the transaction rather than claimed once inside it.

```typescript
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        event: true,
        order: true,
      },
    });

    if (!ticket) {
      throw ApiError.notFound('Ticket not found');
    }

    const ticketTyped2 = ticket as unknown as Ticket & {
      event: { startDatetime: Date };
      order: { status: string };
      userId: string;
      status: string;
    };

    // Check ownership
    if (ticketTyped2.userId !== userId) {
      throw ApiError.forbidden('You can only cancel your own tickets');
    }

    // Check if ticket is valid
    if (ticketTyped2.status === 'CANCELLED') {
      throw ApiError.badRequest('Ticket is already cancelled');
    }

    if (ticketTyped2.status === 'USED') {
      throw ApiError.badRequest('Cannot cancel a used ticket');
    }

    // Check if order is paid
    if (ticketTyped2.order.status !== 'PAID') {
      throw ApiError.badRequest('Can only cancel tickets from paid orders');
    }

    // Check if event hasn't started
    if (new Date() >= ticketTyped2.event.startDatetime) {
      throw ApiError.badRequest('Cannot cancel tickets for events that have already started');
    }
```

**Related control** — `tixmoapi2/src/api/orders/service.ts:467-489`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        tickets: true,
      },
    });

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const orderTyped2 = order as unknown as OrderWithTicketsAndUser;
    if (userId && orderTyped2.userId !== userId) {
      throw ApiError.forbidden('You can only cancel your own orders');
    }

    if (orderTyped2.status === 'CANCELLED') {
      throw ApiError.badRequest('Order is already cancelled');
    }

    if (orderTyped2.status === 'PAID') {
      throw ApiError.badRequest('Cannot cancel paid orders. Request a refund instead.');
    }
```

**Related control** — `tixmoapi2/src/api/tickets/routes.ts:216`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
router.post('/:id/cancel', controller.cancelTicket);
```

#### Reachability

Concurrent requests read a cancellable ticket/order before either transaction → both pass status checks → each transaction updates the same state unconditionally and increments available inventory.

Preconditions:
- An authenticated customer issuing simultaneous cancellation requests for their own ticket or pending order.

Existing controls:
- Sequential cancellations reject already-cancelled records. Inventory hold creation uses atomic quantityAvailable guards. Transactions make each individual cancellation consistent but do not recheck its transition eligibility.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**Medium** — Customers can inflate available stock beyond physical capacity, cause overselling, and corrupt held/sold counters. Pending-order cancellation can consume other orders' aggregate holds. Requires An authenticated customer issuing simultaneous cancellation requests for their own ticket or pending order.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** Customers can inflate available stock beyond physical capacity, cause overselling, and corrupt held/sold counters. Pending-order cancellation can consume other orders' aggregate holds. Requires An authenticated customer issuing simultaneous cancellation requests for their own ticket or pending order.

#### Remediation

Claim each state transition with a conditional update inside its transaction before moving inventory; only the winner may restore stock. Apply the same transition discipline to order confirmation, refund, and expiry.

Tests:
- Each ticket or order may restore inventory exactly once. under repeated, concurrent and unauthorized requests.

<a id="finding-16"></a>

### [16] Runtime configuration inspection exposes the operator's Node process to downloaded JavaScript

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Exact parser reproduced host-process access with a harmless synthetic payload; helper call chain was fully read. |
| Category | tooling |
| CWE | CWE-94 |
| Affected lines | scripts/check-checkout-runtime-config.mjs:127-138 |

#### Summary

The evidence helper executes fetched runtime-config.js inside node:vm with a host-realm window object. A harmless reproduction using the exact parser reached the host Function constructor and returned process.version. A party controlling the selected dashboard response can therefore gain the checker's host process authority when an operator or workflow invokes the check.

#### Root Cause

A VM context containing host objects is treated as an isolation boundary for untrusted remote JavaScript.

**Root control** — `scripts/check-checkout-runtime-config.mjs:127-138`

A VM context containing host objects is treated as an isolation boundary for untrusted remote JavaScript.

```typescript
const parseRuntimeConfig = (source) => {
  const sandbox = {
    window: {},
  };
  sandbox.window.__TIXMO_CONFIG__ = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, {
    timeout: 1000,
    displayErrors: false,
  });

  return sandbox.window.__TIXMO_CONFIG__ || {};
```

**Related control** — `scripts/check-checkout-runtime-config.mjs:180-182`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
try {
  const runtime = await requestText('runtime config fetch', evidence.runtimeConfigUrl);
  const runtimeConfig = parseRuntimeConfig(runtime.text);
```

**Related control** — `.github/workflows/checkout-runtime-config-evidence.yml:30-36`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```yaml
      STAGING_DASHBOARD_URL: ${{ secrets.STAGING_DASHBOARD_URL }}
      STAGING_EXPECTED_API_URL: ${{ secrets.STAGING_EXPECTED_API_URL }}
      STAGING_EXPECTED_PAYMENT_CURRENCY: ${{ secrets.STAGING_EXPECTED_PAYMENT_CURRENCY }}

      PRODUCTION_DASHBOARD_URL: ${{ secrets.PRODUCTION_DASHBOARD_URL }}
      PRODUCTION_EXPECTED_API_URL: ${{ secrets.PRODUCTION_EXPECTED_API_URL }}
      PRODUCTION_EXPECTED_PAYMENT_CURRENCY: ${{ secrets.PRODUCTION_EXPECTED_PAYMENT_CURRENCY }}
```

#### Validation

Exact parser returned host process.version through downloaded-script payload; no credentials, filesystem writes or command execution were attempted.

Validation method: Static source tracing plus harmless offline exact-parser reproduction

**Root control** — `scripts/check-checkout-runtime-config.mjs:127-138`

A VM context containing host objects is treated as an isolation boundary for untrusted remote JavaScript.

```typescript
const parseRuntimeConfig = (source) => {
  const sandbox = {
    window: {},
  };
  sandbox.window.__TIXMO_CONFIG__ = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, {
    timeout: 1000,
    displayErrors: false,
  });

  return sandbox.window.__TIXMO_CONFIG__ || {};
```

**Related control** — `scripts/check-checkout-runtime-config.mjs:180-182`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
try {
  const runtime = await requestText('runtime config fetch', evidence.runtimeConfigUrl);
  const runtimeConfig = parseRuntimeConfig(runtime.text);
```

**Related control** — `.github/workflows/checkout-runtime-config-evidence.yml:30-36`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```yaml
      STAGING_DASHBOARD_URL: ${{ secrets.STAGING_DASHBOARD_URL }}
      STAGING_EXPECTED_API_URL: ${{ secrets.STAGING_EXPECTED_API_URL }}
      STAGING_EXPECTED_PAYMENT_CURRENCY: ${{ secrets.STAGING_EXPECTED_PAYMENT_CURRENCY }}

      PRODUCTION_DASHBOARD_URL: ${{ secrets.PRODUCTION_DASHBOARD_URL }}
      PRODUCTION_EXPECTED_API_URL: ${{ secrets.PRODUCTION_EXPECTED_API_URL }}
      PRODUCTION_EXPECTED_PAYMENT_CURRENCY: ${{ secrets.PRODUCTION_EXPECTED_PAYMENT_CURRENCY }}
```

Assertions:
- The evidence helper executes fetched runtime-config.js inside node:vm with a host-realm window object. A harmless reproduction using the exact parser reached the host Function constructor and returned process.version. A party controlling the selected dashboard response can therefore gain the checker's host process authority when an operator or workflow invokes the check.

Counterevidence and remaining uncertainty:
- Manual workflow dispatch, local default and one-second timeout reduce reachability but do not prevent the demonstrated host-realm escape. Evidenced CI env contains URL/currency references, not established cloud/payment keys.

Limitations:
- No malicious production requests or state changes were made.

#### Dataflow

Selected dashboard URL -\> fetch /runtime-config.js -\> vm parser with outer-realm object -\> host Function constructor -\> process authority.

- **Source:** A party controlling runtime-config.js at an operator-selected dashboard origin.

- **Sink:** scripts/check-checkout-runtime-config.mjs

- **Outcome:** The evidence helper executes fetched runtime-config.js inside node:vm with a host-realm window object. A harmless reproduction using the exact parser reached the host Function constructor and returned process.version. A party controlling the selected dashboard response can therefore gain the checker's host process authority when an operator or workflow invokes the check.

**Root control** — `scripts/check-checkout-runtime-config.mjs:127-138`

A VM context containing host objects is treated as an isolation boundary for untrusted remote JavaScript.

```typescript
const parseRuntimeConfig = (source) => {
  const sandbox = {
    window: {},
  };
  sandbox.window.__TIXMO_CONFIG__ = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, {
    timeout: 1000,
    displayErrors: false,
  });

  return sandbox.window.__TIXMO_CONFIG__ || {};
```

**Related control** — `scripts/check-checkout-runtime-config.mjs:180-182`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```typescript
try {
  const runtime = await requestText('runtime config fetch', evidence.runtimeConfigUrl);
  const runtimeConfig = parseRuntimeConfig(runtime.text);
```

**Related control** — `.github/workflows/checkout-runtime-config-evidence.yml:30-36`

Source completes the entry point, authority/state check, or downstream effect described in this finding.

```yaml
      STAGING_DASHBOARD_URL: ${{ secrets.STAGING_DASHBOARD_URL }}
      STAGING_EXPECTED_API_URL: ${{ secrets.STAGING_EXPECTED_API_URL }}
      STAGING_EXPECTED_PAYMENT_CURRENCY: ${{ secrets.STAGING_EXPECTED_PAYMENT_CURRENCY }}

      PRODUCTION_DASHBOARD_URL: ${{ secrets.PRODUCTION_DASHBOARD_URL }}
      PRODUCTION_EXPECTED_API_URL: ${{ secrets.PRODUCTION_EXPECTED_API_URL }}
      PRODUCTION_EXPECTED_PAYMENT_CURRENCY: ${{ secrets.PRODUCTION_EXPECTED_PAYMENT_CURRENCY }}
```

#### Reachability

Selected dashboard URL -\\\> fetch /runtime-config.js -\\\> vm parser with outer-realm object -\\\> host Function constructor -\\\> process authority.

Preconditions:
- A party controlling runtime-config.js at an operator-selected dashboard origin.

Existing controls:
- Manual workflow dispatch, local default and one-second timeout reduce reachability but do not prevent the demonstrated host-realm escape. Evidenced CI env contains URL/currency references, not established cloud/payment keys.

Limitations:
- No observed exploitation or production impact is claimed.

#### Severity

**Medium** — Process authority is substantial, but exploitation requires control of the configured dashboard's script and a separate operator-triggered check. Medium reflects that prerequisite; no ordinary business-record input reaches this sink, and no actual secret or shell access was tested.

Additional runtime or deployment evidence could raise or lower this severity.

**Impact assessment:** Process authority is substantial, but exploitation requires control of the configured dashboard's script and a separate operator-triggered check. Medium reflects that prerequisite; no ordinary business-record input reaches this sink, and no actual secret or shell access was tested.

#### Remediation

Publish JSON configuration and validate a strict schema without executing downloaded JavaScript. Verify the expected origin and configuration as data.

Tests:
- Malicious configuration is rejected without executing code.
- Configuration checks run without host process access or secret-bearing context.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Staff identity and authority lifecycle | not recorded | Reported | Public enrollment, deletion, membership removal and stale role authority validated. Legitimate same-business staff visibility is expected. Evidence: artifacts/02_discovery/baseline-review.json |
| Reviewer and browser-cache capabilities | not recorded | Reported | Peer bearer capability disclosure and subsequent-user cached disclosure are separate controls; invalid/expired/share revocation controls also read. Evidence: artifacts/02_discovery/baseline-review.json, artifacts/02_discovery/frontend-runtime-review.json, artifacts/02_discovery/frontend-authority-review.json |
| Payments, admission and inventory | not recorded | Reported | Customer-owned database amount, signed webhook and paid-admission gates retained; six admission/inventory findings validated. Monetary refund/retry defects retained as project correctness blockers. Evidence: artifacts/02_discovery/payments-admission-review.json |
| Upload, waiting room and production bootstrap | not recorded | Reported | Temporary storage cleanup, persistent leaked availability capacity and fixed admin bootstrap risk validated; current startup command confirmed read-only. Evidence: artifacts/02_discovery/baseline-review.json, artifacts/02_discovery/ops-data-review.json, artifacts/03_validation/project-verification.json |
| Remaining API routes, events and support runtime | not recorded | No issue found | Full route/control/support reads; lifecycle and integration correctness observations retained without inventing attacker impact. Evidence: artifacts/02_discovery/baseline-api-followup.json, artifacts/02_discovery/remaining-route-review.json, artifacts/02_discovery/runtime-support-review.json |
| Evidence checker runtime configuration | not recorded | Reported | Exact VM parser escaped into host realm with harmless process.version output. Parent Medium severity reflects response-control plus operator-trigger prerequisites. Evidence: artifacts/02_discovery/tooling-review.json |
| Tests and actual local verification | not recorded | No issue found | 87 test/harness/config files fully read; suites executed against disposable local services. Mocking and missing deterministic invariant coverage explicitly recorded. Evidence: artifacts/02_discovery/test-coverage-review.json, artifacts/03_validation/project-verification.json |
| Screenshot artifact bearer recipient scope | not recorded | Needs follow-up | Full bearer URLs retained in manifests, but unintended recipient/access/retention prerequisite unavailable; not a validated finding. Evidence: artifacts/02_discovery/tooling-review.json |
| Provider and deployed-state acceptance | not recorded | Needs follow-up | Read-only live reachability/configuration verified. No authenticated payment/refund/scanner/reviewer or restore/mail/S3/proxy authorization acceptance performed. Evidence: artifacts/03_validation/project-verification.json, artifacts/02_discovery/runtime-support-review.json |
| Validated core runtime and browser identity controls | not recorded | Reported | 16 findings validated; same-browser cache disclosure kept separate from public reviewer impersonation. Evidence: artifacts/02_discovery/baseline-review.json, artifacts/02_discovery/payments-admission-review.json, artifacts/02_discovery/tooling-review.json, artifacts/02_discovery/frontend-runtime-review.json |
| Validated core runtime controls | not recorded | Reported | No additional canonical notes were recorded. Evidence: artifacts/02_discovery/baseline-review.json, artifacts/02_discovery/payments-admission-review.json, artifacts/02_discovery/tooling-review.json |
| Validated identity, admission and tooling controls | not recorded | Reported | 15 source-backed findings validated; runtime config worker high severity calibrated Medium due caller/response-control prerequisites. Evidence: artifacts/02_discovery/baseline-review.json, artifacts/02_discovery/payments-admission-review.json, artifacts/02_discovery/tooling-review.json |
| Authorization, admission and tooling | not recorded | Needs follow-up | Raw independent candidates retained; source validation and attack-path calibration in progress. Evidence: artifacts/02_discovery/baseline-review.json, artifacts/02_discovery/payments-admission-review.json, artifacts/02_discovery/tooling-review.json |

## Open Questions And Follow Up

- Does the deployed reverse proxy overwrite untrusted X-Forwarded-Host, and what is the intended owner-authorized enrollment process?
  - Follow-up prompt: After the registration patch, run host/header enrollment tests in staging and verify production proxy settings without creating privileged public accounts.
- Which actual scanner client/device applies snapshots/deltas, and how are offline revocations/conflicts enforced?
  - Follow-up prompt: Identify and test the real scanner implementation with cancellation, transfer, refund, multiple gates and reconnect scenarios.
- What refund, currency and promo reservation policies does the business approve?
  - Follow-up prompt: Agree on policy and processor states before implementing paid-flow reconciliation and policy publication.
- Can target backups be restored with measured recovery and rollback acceptance?
  - Follow-up prompt: Perform a named-operator restore test to an isolated target with representative retained data and bind evidence to the release SHA.
- Need actual artifact ACL/retention and live non-demo token exposure to an unintended recipient before validating disclosure; exact source packet retained.
  - Follow-up prompt: Review deferred unit screenshot-artifact-capability-recipient and close its stated proof gap. Paths: scripts/capture-public-route-evidence.mjs, .github/workflows/public-route-screenshot-evidence.yml.
- Raw comment/name interpolation in email confirmed; relevant recipient/mail-client rendering impact and unintended action remain unavailable. No browser JavaScript execution claimed.
  - Follow-up prompt: Review deferred unit email-html-rendering-impact and close its stated proof gap. Paths: tixmoapi2/src/utils/emailTemplates.ts, tixmoapi2/src/services/approval-email.service.ts.
- Delta omission is source-backed, but actual scanner cache/client is unavailable. Validate tombstones, credential versions, staleness and conflicts on the real client.
  - Follow-up prompt: Review deferred unit offline-cache-revocation and close its stated proof gap. Paths: tixmoapi2/src/api/scanners/service.ts.
- Proxy header sanitization, S3 IAM/privacy, actual restore, mail delivery and production token/role exploit effects were not exercised. Read-only configuration/reachability is not full acceptance.
  - Follow-up prompt: Review deferred unit external-deployment-controls and close its stated proof gap.
- Remaining coherent full-file reviews continue; finished groups have supplemental packets.
  - Follow-up prompt: Review deferred unit remaining-support-review and close its stated proof gap.
- Coherent full reads of remaining frontend runtime, tests and privileged tooling underway; exact reviewed paths retained in worker artifacts.
  - Follow-up prompt: Review deferred unit remaining-runtime-support and close its stated proof gap.
- Eight raw findings retained in baseline-review.json.
  - Follow-up prompt: Review deferred unit baseline-candidates and close its stated proof gap.
- Six raw findings retained in payments-admission-review.json.
  - Follow-up prompt: Review deferred unit focused-candidates and close its stated proof gap.
- Raw VM escape candidate and harmless reproduction retained in tooling-review.json; impact calibration pending.
  - Follow-up prompt: Review deferred unit runtime-config-vm-candidate and close its stated proof gap.
