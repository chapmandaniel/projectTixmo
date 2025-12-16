# Failure Analysis
**Goal:** Isolate root causes of test failures.

## Context & Approach
We will analyze the output of `npm test -- --detectOpenHandles` to identify why tests are failing and leaking.

## Evidence
- [x] Error Logs: "No token provided" in `auth.test.ts`.
- [x] Open Handle Report: Suspect `PrismaClient` (global in `testUtils`) or Sentry.
- [x] Hanging: Tests hung when run in parallel. `README` suggests `--runInBand`.
- [x] Missing Tests: `users.test.ts` is missing despite documentation claims.

## Root Causes
1.  **Global Prisma Instance**: `testUtils.ts` exports a global instance. `auth.test.ts` disconnects it in `afterAll`. Subsequent tests using it will fail/hang. [FIXED]
2.  **Auth Token Dependency**: If `register` fails in `beforeAll`, `validAccessToken` is undefined, causing "No token provided" in subsequent tests. [FIXED]
3.  **Missing Coverage**: User management tests are completely absent.
4.  **Cleanup Failure**: `cleanupTestData` missed `scanners` table, causing FK violations and subsequent setup failures. [FIXED]


