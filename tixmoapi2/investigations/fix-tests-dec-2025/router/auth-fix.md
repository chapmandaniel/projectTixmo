# Auth Fix Strategy
**Goal:** Fix "No token provided" and "Worker force exit" in `auth.test.ts`.

## Plan
1.  **Isolate**: `auth.test.ts` PASSED in isolation (25/25).
2.  **Root Cause Confirmed**: Failures are due to test interference/parallel execution.
3.  **Fix**: Run tests with `--runInBand` to prevent shared resource conflicts (Global Prisma).

