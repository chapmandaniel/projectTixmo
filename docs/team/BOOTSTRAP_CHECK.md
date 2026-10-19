# Tixmo bootstrap source check

Inspected 2026-10-19 for kanban #26 by `tixmo-lead`.
Baseline: `2f3a05540b6db6f6bd8c026156e74afcc7b1bf9e` (`main`).
Branch: `tixmo/task-26-bootstrap-check`.
Worktree: `/home/daniel/projects/projectTixmo/worktrees/task-26`.
Scope: documentation only; no behavior, configuration, dependencies or services changed.

## Evidence boundaries

This is a source inspection, not a launch-readiness pass. Node `v24.21.0` and
npm `11.19.0` were observed with `node --version` and `npm --version` (exit 0).
Manifest command availability below means the scripts exist, not that their
dependencies are installed or execution succeeds. No test suite, build,
browser/UI session, database operation, payment or service startup was run.
Historical June results in `docs/LOCAL_MARKET_READINESS_GATES.md` are not current evidence.
CI source uses Node 20; compatibility with the observed local Node version is unverified.

Shared-main setup instructions (`AGENTS.md` and `docs/team/`) were untracked
when read and were not copied wholesale or committed here. This artifact is
self-contained against the recorded source baseline; the manager owns setup.

## Verified repository/component map

All paths below are relative to the repository root and were inspected in source.

| Component | Entry points and responsibility | Evidence |
| --- | --- | --- |
| Dashboard | React 18/Vite; dashboard routes, lazy-loaded feature views and public checkout/review/share pages | `tdash/package.json`; `tdash/src/index.jsx`; `tdash/src/App.jsx` (route declarations, public routes at lines 265-267) |
| Public checkout | Policy-link gating, Stripe publishable key, currency, account/order/payment UI | `tdash/src/pages/CheckoutPage.jsx` (lines 301-358); `tdash/src/lib/runtimeConfig.js`; `tdash/src/test/CheckoutPage.test.jsx` |
| API startup | Express/TypeScript; connects database and Redis before listening; starts expiry/reminder jobs | `tixmoapi2/src/index.ts`; `tixmoapi2/src/app.ts`; `tixmoapi2/package.json` |
| Versioned API | Auth/users/orgs, venues/events, ticket types/tiers, orders/tickets, payments, scanners, approvals/review/assets and additional routes | `tixmoapi2/src/api/index.ts` mounts `/${config.apiVersion}`; `src/app.ts` in that package mounts application routes and raw Stripe webhook parsing |
| Data | Prisma/Postgres models include Organization, Event, TicketType, Order, PaymentWebhookEvent, Ticket, Scanner, approval and asset/share records | `tixmoapi2/prisma/schema.prisma` (`postgresql` provider; named model declarations) |
| Local services | Postgres 14 and Redis 7; persistent volumes, fixed container names and host ports 5432/6379 | `tixmoapi2/docker-compose.yml`; object storage is not provisioned by this compose file |
| Payment lifecycle | Stripe event dispatch, persisted event-ID deduplication, retrying order confirmation | `tixmoapi2/src/api/payments/service.ts` (event handling at 108+, event claiming at 130+, confirmation retry at 244+); `tixmoapi2/tests/integration/payments.test.ts`; `payments_retry.test.ts` in the same directory |
| Scanner | Registration roles, scanner authentication, sync and offline validation surfaces | `tixmoapi2/src/api/scanners/routes.ts`; `tixmoapi2/src/middleware/scannerAuth.ts`; `tixmoapi2/tests/integration/scanners-offline.test.ts`; `tdash/src/test/ScannersView.test.jsx` |
| Local/CI gate | Sequential API build/API verification, dashboard tests/design guard/build, then three helper syntax checks | `scripts/verify-market-local.mjs`; `.github/workflows/market-readiness-local.yml`; `docs/LOCAL_MARKET_READINESS_GATES.md` |
| Release scope/evidence | Core operator V1, payment/scanner/public-share smoke and explicit go/no-go evidence; deferred modules are not launch claims | `docs/PRODUCTION_LAUNCH_CHECKLIST.md`; `tdash/src/App.jsx` uses outside-V1 placeholders for QuantMo, Social, ProMo and Marketing Hub |

## Actual package commands

Complete script inventories read from each current `package.json` follow.
Run root commands from repository root. For package commands, use
`npm --prefix tdash run <name>` or `npm --prefix tixmoapi2 run <name>`.
For a one-shot dashboard suite use `npm --prefix tdash test -- --run`;
plain dashboard `test` invokes Vitest without the explicit non-watch flag.

### Root: `package.json`

| Script | Exact manifest expansion |
| --- | --- |
| `dev` | `node ./scripts/dev.mjs` |
| `dev:web` | `npm --prefix tdash run dev` |
| `dev:api` | `npm --prefix tixmoapi2 run dev` |
| `dev:services` | `docker compose -f tixmoapi2/docker-compose.yml up -d &#124;&#124; docker-compose -f tixmoapi2/docker-compose.yml up -d` |
| `dev:services:down` | `docker compose -f tixmoapi2/docker-compose.yml down &#124;&#124; docker-compose -f tixmoapi2/docker-compose.yml down` |
| `verify:api` | `node ./scripts/verify-api.mjs` |
| `verify:market` | `node ./scripts/verify-market-local.mjs` |
| `status:check` | `node ./scripts/check-status.mjs` |
| `smoke:external` | `node ./scripts/external-smoke-evidence.mjs` |
| `smoke:checkout:local` | `node ./scripts/local-checkout-smoke.mjs` |
| `evidence:public-routes` | `node ./scripts/capture-public-route-evidence.mjs` |
| `evidence:checkout-config` | `node ./scripts/check-checkout-runtime-config.mjs` |
| `evidence:dependency-audit` | `node ./scripts/dependency-audit-evidence.mjs` |
| `evidence:manual-template` | `node ./scripts/create-manual-evidence-template.mjs` |
| `evidence:status` | `node ./scripts/evidence-status.mjs` |
| `evidence:status:strict` | `node ./scripts/evidence-status.mjs --strict` |
| `demo:market` | `npm --prefix tixmoapi2 run demo:market` |
| `demo:market:verify` | `npm --prefix tixmoapi2 run demo:market:verify` |
| `demo:market:reset` | `npm --prefix tixmoapi2 run demo:market:reset` |

### Dashboard: `tdash/package.json`

| Script | Exact manifest expansion |
| --- | --- |
| `dev` | `vite` |
| `build` | `vite build` |
| `preview` | `vite preview` |
| `test` | `vitest` |
| `design:guard` | `node ./scripts/design-system-guard.mjs` |
| `design:guard:update` | `node ./scripts/design-system-guard.mjs --update` |

### API: `tixmoapi2/package.json`

| Script | Exact manifest expansion |
| --- | --- |
| `dev` | `prisma generate && TS_NODE_TRANSPILE_ONLY=true nodemon` |
| `build` | `prisma generate && tsc && tsc-alias` |
| `start` | `node dist/index.js` |
| `test` | `jest --runInBand` |
| `test:watch` | `jest --watch` |
| `test:coverage` | `jest --coverage` |
| `lint` | `eslint . --ext .ts` |
| `lint:fix` | `eslint . --ext .ts --fix` |
| `format` | `prettier --write "src/**/*.ts"` |
| `format:check` | `prettier --check "src/**/*.ts"` |
| `typecheck` | `tsc --noEmit` |
| `migrate` | `prisma migrate deploy` |
| `migrate:dev` | `prisma migrate dev` |
| `migrate:create` | `prisma migrate dev --create-only` |
| `db:seed` | `node prisma/seed-minimal.js` |
| `db:reset` | `TS_NODE_TRANSPILE_ONLY=true ts-node -r tsconfig-paths/register scripts/dev-data.ts reset` |
| `db:populate` | `TS_NODE_TRANSPILE_ONLY=true ts-node -r tsconfig-paths/register scripts/dev-data.ts populate` |
| `demo:market` | `TS_NODE_TRANSPILE_ONLY=true ts-node -r tsconfig-paths/register scripts/market-demo-data.ts seed --reset` |
| `demo:market:reseed` | `TS_NODE_TRANSPILE_ONLY=true ts-node -r tsconfig-paths/register scripts/market-demo-data.ts seed --reset` |
| `demo:market:reset` | `TS_NODE_TRANSPILE_ONLY=true ts-node -r tsconfig-paths/register scripts/market-demo-data.ts reset` |
| `demo:market:verify` | `TS_NODE_TRANSPILE_ONLY=true ts-node -r tsconfig-paths/register scripts/market-demo-data.ts verify` |
| `db:studio` | `prisma studio` |
| `prepare` | `node -e "if (process.env.CI) process.exit(0); process.exit(1)" &#124;&#124; (cd .. && husky install tixmoapi2/.husky)` |
| `docs:openapi` | `node -r ts-node/register -r tsconfig-paths/register scripts/export-openapi.js` |

### Execution precautions verified in helper source

`npm run verify:market` is not read-only: its second step runs `verify:api`.
`scripts/verify-api.mjs` loads API `.env` defaults and preserves existing
DATABASE_URL/REDIS_URL values; it starts Compose (and may start Colima), waits
for fixed service containers, then executes
`prisma db push --accept-data-loss --skip-generate` before Jest.
A reachable database is not proof it is disposable. Release/QA must explicitly
verify a disposable local target and coordinate fixed ports/container names
before execution. Do not inherit an unknown target. No such execution occurred here.
Reset/demo/migration/format-fix/guard-update commands above are inventory only,
not recommendations to execute. Do not change guard baselines to force a pass.

## Three source-backed V1 follow-up candidates

These are bounded proposals for PM refinement, not claims of discovered defects
or new assignments. Existing board tasks should be checked for overlap first.

1. **P1: Establish a safe, current local verification baseline (release + QA).**
   Evidence: `scripts/verify-api.mjs` preserves inherited connection values and
   applies schema with data-loss permission; Compose uses fixed shared resources;
   `.github/workflows/market-readiness-local.yml` selects Node 20, whereas the
   inspected host reports Node 24. Acceptance: record the selected Node/dependency
   baseline, demonstrate the target is disposable without exposing credentials,
   coordinate the sole DB-test owner, and capture `npm run verify:market` output,
   exit code and exact SHA (or a precise prerequisite failure). No current pass is known.

2. **P1: Produce checkout/payment lifecycle evidence (backend + frontend + QA).**
   Evidence: launch checklist sections 7-8 require policy links, test checkout,
   webhook exactly-once behavior and inventory transitions. Checkout policy
   gating exists in `tdash/src/pages/CheckoutPage.jsx:357`; current tests include
   missing-policy blocking (`tdash/src/test/CheckoutPage.test.jsx`) and duplicate
   webhook IDs (`tixmoapi2/tests/integration/payments.test.ts:185`). Acceptance:
   rerun relevant suites in the coordinated disposable environment, then prepare
   a no-live-charge test-mode rehearsal covering mixed ticket types, paid and
   failed orders, duplicate webhooks and inventory state. Capture exact SHA and
   evidence; any external environment/payment action remains separately authorized.

3. **P1: Close the scanner field-evidence gap (QA + product/gate owner).**
   Evidence: `tixmoapi2/tests/integration/scanners-offline.test.ts` covers sync
   and offline upload, while `docs/SCANNER_SETUP_AND_FIELD_TEST.md` requires
   real-device checks and documents simultaneous offline duplicate-admission risk.
   Acceptance: rerun existing scanner tests against disposable services, identify
   the actual staff device/app and gate owner, and execute or explicitly block a
   production-like field checklist for duplicate/wrong-event/cancelled tickets,
   offline reconnect, revoked-device rejection and replacement handoff. Record
   device/environment/SHA and results without copying scanner keys. API tests alone
   cannot close the real-device checklist.

## Checks for this artifact

- Manifest JSON parsed successfully to generate the exact script inventory.
- Source/manifests/runbooks inspected; no historical results promoted to a pass.
- `git diff --check` must pass before submission; exact result and commit SHA
  are recorded in the kanban #26 review handoff.
- Only `docs/team/BOOTSTRAP_CHECK.md` is owned by this change. Independent QA must
  inspect the submitted exact commit before PM closure. No merge/deployment performed.
