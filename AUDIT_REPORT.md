# Project Tixmo Audit Report

Date: March 9, 2026

## Scope

This audit covered both applications in the repository:

- `tdash`: React/Vite dashboard frontend
- `tixmoapi2`: Express/TypeScript/Prisma backend API

The review included:

- Repository structure and architecture inspection
- Static review of representative runtime paths
- Automated verification using existing test/build/lint/typecheck commands
- Targeted reliability and security grep-based review

## Executive Summary

The project has substantial implementation depth, but it is not in a release-ready state. The main issues are execution-path breakage in the frontend API client usage, a broken Stripe webhook path in the backend, and a backend test suite that currently fails at a high rate despite the documentation claiming a clean state.

The strongest part of the repository is breadth: there is a real backend domain model, a non-trivial frontend, test coverage across many API areas, and production-oriented components such as Redis, Prisma, Sentry, rate limiting, and upload/email integrations.

The weakest part is operational consistency. Several layers disagree with each other:

- frontend API wrapper behavior vs. frontend callers
- auth payload shape vs. org authorization middleware expectations
- payment webhook route design vs. global body parser order
- README quality claims vs. actual verification results
- test intent vs. current implementation and fixtures

## Overall Evaluation

| Area | Rating | Notes |
|---|---|---|
| Architecture | B- | Clear separation between frontend and backend, but inconsistent contracts between layers |
| Code Quality | C | Many workable modules, but visible drift, duplicated logic, and inconsistent conventions |
| Reliability | D+ | Multiple confirmed runtime defects and failing tests |
| Security Posture | C | Good baseline controls exist, but some auth/session patterns remain weak |
| Test Quality | C- | Large test surface exists, but many tests are failing or stale |
| Delivery Readiness | D | Not ready for confident release without remediation |

## What I Verified

### Backend

Commands run:

```bash
cd /Users/danielchapman/Desktop/Project\ Tixmo/tixmoapi2
npm test -- --runInBand
npm run typecheck
npm run lint
```

Observed results:

- `npm run typecheck`: completed successfully
- `npm test -- --runInBand`: failed
  - 15 failed suites
  - 28 passed suites
  - 139 failed tests
  - 137 passed tests
- `npm run lint`: failed with 5,515 problems, mostly formatting/test-file issues, plus real rule violations

### Frontend

Commands run:

```bash
cd /Users/danielchapman/Desktop/Project\ Tixmo/tdash
npm test -- --run
npm run build
```

Observed results:

- `npm test -- --run`: failed
  - 4 failed files
  - 6 passed files
  - 12 failed tests
  - 45 passed tests
- `npm run build`: succeeded
  - output bundle includes a 1.3 MB minified JS chunk
  - Vite warned about oversized chunks

## Prioritized Findings

### 1. Frontend auth and data fetching paths are broken by an inconsistent API wrapper

Severity: Critical

Evidence:

- [`tdash/src/lib/api.js`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/lib/api.js#L56) returns `response.data`
- [`tdash/src/lib/auth.js`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/lib/auth.js#L5) reads `response.data.data`
- [`tdash/src/features/TodoView.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/features/TodoView.jsx#L86) also reads `response.data.data.users`
- [`tdash/src/layouts/DashboardLayout.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/layouts/DashboardLayout.jsx#L64) mixes `notifRes.data`, `data.data`, and plain response assumptions in the same function
- [`tdash/src/features/RegisterScannerModal.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/features/RegisterScannerModal.jsx#L40) reads `response.data.data`

Impact:

- Login and registration are likely to throw at runtime
- Multiple screens can silently fail to hydrate data
- Response handling is inconsistent across the entire dashboard

Why this matters:

The API helper has no stable contract. Callers are split between expecting raw Axios responses and already-unwrapped payloads. This creates broad user-facing breakage and makes further frontend work unsafe until the contract is normalized.

### 2. Frontend task updates call a method that does not exist

Severity: Critical

Evidence:

- [`tdash/src/lib/api.js`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/lib/api.js#L56) exports `get`, `post`, `put`, `delete`, and `upload`, but no `patch`
- [`tdash/src/features/TodoView.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/features/TodoView.jsx#L127) calls `api.patch(...)`
- [`tdash/src/features/TodoView.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/features/TodoView.jsx#L194) calls `api.patch(...)`

Impact:

- Task drag/drop status changes will throw immediately
- Task edit flows will also fail

### 3. Stripe webhook verification is effectively broken by middleware ordering

Severity: High

Evidence:

- [`tixmoapi2/src/app.ts`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/src/app.ts#L61) registers `express.json()` globally before routes
- [`tixmoapi2/src/api/payments/routes.ts`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/src/api/payments/routes.ts#L71) tries to use `express.raw()` for `/webhook`
- [`tixmoapi2/src/api/payments/controller.ts`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/src/api/payments/controller.ts#L19) comments acknowledge raw body is required
- [`tixmoapi2/src/api/payments/service.ts`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/src/api/payments/service.ts#L77) calls `stripe.webhooks.constructEvent(payload, signature, ...)`

Impact:

- Stripe signature verification can fail in production
- Successful payments may not be confirmed by webhook processing
- Payment flow reliability is lower than the code suggests

### 4. Organization authorization middleware cannot work with the auth payload it receives

Severity: High

Evidence:

- [`tixmoapi2/src/middleware/auth.ts`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/src/middleware/auth.ts#L30) places only `userId`, `role`, and `email` on `req.user`
- [`tixmoapi2/src/middleware/authorizeOrg.ts`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/src/middleware/authorizeOrg.ts#L32) expects `req.user.organizationId`

Impact:

- Any non-customer path using `authorizeOrg` will reject valid users unless another layer manually augments `req.user`
- This is a contract bug between middleware layers

Note:

`rg` only found the middleware definition and not any current runtime usage, which reduces current blast radius, but this is still a latent authorization defect waiting to activate.

### 5. Backend test isolation is broken, so test results cannot be trusted

Severity: High

Evidence:

- [`tixmoapi2/tests/utils/testUtils.ts`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/tests/utils/testUtils.ts#L191) cleanup swallows foreign-key deletion failures and continues
- Jest run produced unique-constraint and foreign-key failures across multiple suites
- Example failures included duplicate emails, duplicate slugs, and undeleted FK-linked rows

Impact:

- The suite does not provide reliable regression protection
- A passing subset of tests does not mean the system is stable
- CI confidence is overstated

### 6. Backend rate-limiting behavior does not match its own tests or comments

Severity: Medium

Evidence:

- [`tixmoapi2/src/middleware/rateLimiter.ts`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/src/middleware/rateLimiter.ts#L8) says auth should be limited to 5 requests/minute
- [`tixmoapi2/src/middleware/rateLimiter.ts`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/src/middleware/rateLimiter.ts#L13) actually sets 100 in development and 20 otherwise
- [`tixmoapi2/tests/integration/authRateLimit.test.ts`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/tests/integration/authRateLimit.test.ts#L14) expects lockout after 5 requests

Impact:

- Rate limiting is weaker than tests and comments imply
- The behavior is unclear to maintainers
- Security expectations and implementation are currently out of sync

### 7. README status is materially inaccurate

Severity: Medium

Evidence:

- [`tixmoapi2/README.md`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/README.md#L12) claims `143/143 passing`
- [`tixmoapi2/README.md`](/Users/danielchapman/Desktop/Project%20Tixmo/tixmoapi2/README.md#L23) claims `0 technical debt`
- current local verification found 15 failing backend suites and 5,515 lint issues

Impact:

- Misleads maintainers and reviewers
- Makes release/readiness decisions unreliable
- Reduces trust in project documentation

### 8. Frontend tests are stale relative to the current routing and icon usage

Severity: Medium

Evidence:

- [`tdash/src/test/Smoke.test.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/test/Smoke.test.jsx#L37) renders `DashboardLayout` without a router even though layout uses `Link`
- [`tdash/src/test/Smoke.test.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/test/Smoke.test.jsx#L51) renders `App` without a router even though it uses `Routes`
- [`tdash/src/test/ApprovalDetailView.test.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/test/ApprovalDetailView.test.jsx#L16) mocks `lucide-react` but omits `ChevronLeft`
- actual component uses [`tdash/src/features/ApprovalDetailView.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/features/ApprovalDetailView.jsx#L162)

Impact:

- Test failures are partly caused by stale harnesses rather than application logic
- The suite is not maintaining pace with UI evolution

### 9. Error recovery clears all browser local storage

Severity: Medium

Evidence:

- [`tdash/src/components/ErrorBoundary.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/components/ErrorBoundary.jsx#L45) calls `localStorage.clear()`

Impact:

- Wipes unrelated application/browser state, not just Tixmo session data
- Can create surprising user data loss

### 10. Scanner registration reads from the wrong localStorage key

Severity: Medium

Evidence:

- [`tdash/src/lib/auth.js`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/lib/auth.js#L10) stores user data under `user`
- [`tdash/src/features/RegisterScannerModal.jsx`](/Users/danielchapman/Desktop/Project%20Tixmo/tdash/src/features/RegisterScannerModal.jsx#L23) reads `tixmo_user`

Impact:

- Scanner registration can fail even for authenticated users
- Another example of session/state contract drift

## Additional Observations

### Strengths

- The backend has meaningful domain coverage: auth, organizations, events, tickets, orders, approvals, scanners, payments, analytics, reports
- TypeScript is in place and backend typecheck currently passes
- The repository contains a substantial test surface, even though it is currently unhealthy
- Security baseline tooling is present: Helmet, CORS restrictions, JWT auth, rate limiting, Redis-backed controls, Sentry hooks
- Frontend production build succeeds, so the dashboard is not structurally broken at bundle time

### Weaknesses

- Contract drift is the dominant maintenance problem
- Test hygiene is poor enough to reduce confidence in all status claims
- Logging and error handling are inconsistent across the codebase
- Frontend state/auth conventions are not centralized enough
- Some production-oriented subsystems are only partially wired despite appearing complete

### Performance and Packaging

- Frontend production build emits a large minified JS chunk around 1.3 MB
- Vite warns about chunk size, which will affect initial load time and cache efficiency
- This is not the highest-priority issue compared with the runtime defects above, but it should be addressed before scale-up

## Recommended Remediation Order

### Immediate

1. Normalize the frontend API client contract
2. Fix auth/login/register callers and all `response.data.data` misuse
3. Add missing `api.patch` support or remove patch usage
4. Fix Stripe webhook raw-body handling at the app boundary
5. Repair backend test cleanup so the suite is deterministic

### Short Term

1. Reconcile auth payload shape with org authorization requirements
2. Align rate-limiter configuration, comments, and tests
3. Fix stale frontend tests to use router-aware harnesses and current icon mocks
4. Replace `localStorage.clear()` with scoped key removal
5. Standardize localStorage keys used for session state

### Medium Term

1. Introduce typed API response contracts in the frontend
2. Add integration tests for login, scanner registration, task patching, and Stripe webhook verification
3. Reduce bundle size through route-based code splitting
4. Update README and status docs so they reflect current verified state

## Suggested Quality Gate Before Release

Do not treat the project as release-ready until the following are true:

- backend tests pass cleanly in a deterministic run
- frontend tests pass cleanly in CI mode
- payment webhook verification is proven with an automated test
- login, task updates, and scanner registration are manually smoke-tested
- README status and coverage claims are regenerated from actual results

## Bottom Line

This is a serious codebase with real product ambition and a meaningful amount of completed work. It is not a toy project. But right now it is in a drifted state where documentation, tests, and runtime contracts no longer agree.

The fastest path to improvement is not feature work. It is contract repair: unify API response handling, fix payment webhook parsing, restore deterministic tests, and make the documented health claims honest again. Once those are addressed, the existing breadth of the system becomes a real asset instead of a source of uncertainty.
