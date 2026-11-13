# T100: deterministic API + tdash test suites

Branch `fix/t100-deterministic-tests` off `main` (`aee54592`).
No `jest.retryTimes`, `test.skip`/`xit`, timeout-as-fix, deleted tests, or weakened
product assertions. Skipped-test count stayed **0 → 0** (CI env present; Jest/Vitest
do not print a skipped line when the count is zero).

## Flakes

### 1. `tixmoapi2/tests/integration/wallet-browser-recovery.test.ts`
**Test:** `qualifyWallet` / wallet-browser-recovery (full Jest only; passes alone). Found in T90.

**How it failed:** Chrome choreography died in the full `--runInBand` suite (JWT 401 / browser deadline) while `npx jest --runTestsByPath tests/integration/wallet-browser-recovery.test.ts` passed.

**Root cause (compounded):**
1. `tickets.test.ts` used `@sinonjs/fake-timers` `FakeTimers.install()` which leaked a faked `Date`/`timer` into later files. Wallet JWT expiry is 10s in test config; a faked clock plus suite load made the access token expire mid-Chrome flow.
2. `process.env = { ... }` in unit files replaced the env object instead of mutating it, so later files could see a different `process.env` identity than the captured snapshot.
3. Redis rate-limit keys from earlier files (15-minute window) could starve the next file’s limiter budget.
4. The continuity script waited out the 10s access token without minting a fresh one after the long Chrome stretch.

**Fix:**
- `tixmoapi2/tests/setup.ts`: `jest.useRealTimers()` in `beforeAll`/`afterAll`; Redis `FLUSHDB` per file (skip outage test).
- `tixmoapi2/tests/integration/tickets.test.ts`: Jest fake **Date only** (`doNotFake` I/O timers); nested `afterAll` restores real timers and **does not** call `cleanupTestData()`.
- `tixmoapi2/tests/helpers/restore-process-env.ts` + cors/environment/s3 unit tests: copy-restore env keys.
- `tixmoapi2/tests/integration/wallet-browser-recovery.test.ts`: `jest.useRealTimers()` at start of `qualifyWallet`.
- `scripts/browser/wallet-continuity.mjs`: `POST /auth/refresh` after mark 7 so the 10s JWT is fresh before the expiry wait; refresh again after recovered-password login before Show ticket. Chrome close ignores ESRCH races and drains in-flight CDP commands with `allSettled` (CI failed at stage 16, category `other`, run `43453050490`).

**Proof:** Present in all three consecutive full `npm --prefix tixmoapi2 test -- --runInBand` runs (1711/1711) and in reverse+`--randomize` (seed `1787340611`, 1711/1711).

### 2. `tixmoapi2/tests/integration/tickets.test.ts`
**Tests:** `GET /api/v1/tickets/:id` (401); `should fail to check in already used ticket`; `includes holder name and email for owner, admin, and manager only`.

**How it failed (reverse+randomize seed `-1208007653` / later seeds):**
- `Expected 200, received 401` on GET `:id` after nested time-sensitive `afterAll` ran `cleanupTestData()` and deleted `tickets-test@example.com` while shuffled sibling GET tests still needed the user.
- Shared `checkInBarcode` between “valid check-in” and “already used”.
- `STAFF_PII_VIEW` count `Expected 0, Received 1` when a later staff-list test had already written an audit row.

**Root cause:** Nested `afterAll` global cleanup; shared barcode; absolute audit count instead of a delta.

**Fix:** Parent `afterAll` cleans; nested `afterAll` only `useRealTimers()`. Dedicated `alreadyUsedBarcode`. PII assertions compare counts before/after the promoter `includeHolder` / customer order GET.

**Proof:** Three randomized runs of this file (seeds `1755940174`, `-1717236385`, `999712672`) and full reverse+randomize 1711/1711.

### 3. `tixmoapi2/tests/integration/notification-preferences.test.ts`
**Test:** `creates and returns default preferences for a new user on first view`.

**How it failed:** `expect(before).toBeNull()` failed because `it.each` field tests / persist tests had already GET-created `userA` prefs.

**Root cause:** Shared `userA`/`userB` across first-view, second-user, and mutation tests.

**Fix:** First-view and second-user register dedicated users. Non-boolean reject seeds prefs with GET first.

**Proof:** Same randomized file runs + full suite 1711/1711.

### 4. `tixmoapi2/tests/integration/approvals.test.ts`
**Tests:** later cases using `findFirstOrThrow({ title: 'Main stage LED artwork' })`, e.g. add/resend/remove reviewer, comments, revision.

**How it failed:** `No record was found for a query` / `managerReviewer` undefined when create ran after dependents.

**Root cause:** Implicit sequence: one shared approval mutated by later `it()`s.

**Fix:** `createApprovalFixture()` with unique titles/emails; each test owns its row.

**Proof:** Randomized file runs + full reverse+randomize 1711/1711.

### 5. `tixmoapi2/tests/integration/advanced.test.ts`
**Tests:** Waitlist join/duplicate/status/leave/null; promo create vs validate `TESTPROMO2025`.

**How it failed:** Duplicate join `Expected 409, received 201` (join had not run); validate failed if create had not run.

**Root cause:** Ordered waitlist state machine; shared promo code.

**Fix:** `beforeEach` deletes the user’s waitlist row; each test joins as needed. Unique promo codes per test.

**Proof:** Randomized file runs + full reverse+randomize 1711/1711.

### 6. `tixmoapi2/tests/integration/asset-share-rekey.test.ts`
**Tests:** `explicit NULL policy…`; `concurrent real SQL rekeys…`

**How it failed:** Concurrent `fulfilled length 0` (both rekeys `verification failed`) when hash-only rows from the NULL-policy test were still present. `resetOwned()` only rewrote the original four share ciphertexts.

**Root cause:** Leftover hash-only/diagnostic rows in the org scope.

**Fix:** `resetOwned()` deletes extra hash-only/diagnostic shares first; first owned test also calls `resetOwned()`.

**Proof:** Randomized file runs + full reverse+randomize 1711/1711.

### 7. `tixmoapi2/tests/integration/users.test.ts`
**Tests:** `should allow admin to list users` / pagination `total >= 3`.

**How it failed:** `Expected >= 3, Received 2` when `should allow admin to delete user` ran first and soft-deleted `otherUser` (list excludes `deleted_` emails).

**Root cause:** List tests assumed the delete test had not run.

**Fix:** Delete test registers its own user.

**Proof:** Focused `--randomize` (seed `-1270502385`, 131/131 across 9 files) + full reverse+randomize.

### 8. `tixmoapi2/tests/integration/scanners-offline.test.ts`
**Test:** `should download valid tickets`.

**How it failed:** `Expected length 1, Received 0` when `should process offline scans` had already marked the only paid ticket `USED`.

**Root cause:** One paid ticket shared by download + scan.

**Fix:** Dedicated `scanTicket` for offline scan; download asserts the original paid barcode is VALID (unpaid is not).

**Proof:** Same focused randomize + full reverse+randomize.

### 9. `tixmoapi2/tests/integration/promo-codes.test.ts`
**Tests:** create `SUMMER20` (201) vs duplicate (409); GET by `promoCodeId`.

**How it failed:** Duplicate-first → create 409; GET-first → `promoCodeId` undefined → 404.

**Root cause:** Shared code and id assigned only by the create test.

**Fix:** Duplicate and GET create their own codes/ids.

**Proof:** Focused randomize + full reverse+randomize.

### 10. `tixmoapi2/tests/integration/payments.test.ts`
**Tests:** create-intent `pi_mock_123456`; webhook succeeded/duplicate 500.

**How it failed:** Stripe mock first call is `pi_mock_123456`, later calls `pi_${orderId}`. Webhooks assumed the beforeAll order already had that PI and was still PENDING.

**Root cause:** First-call mock magic + shared order.

**Fix:** Assert the PI returned by the API. Webhook tests create their own order+intent. Duplicate spy cleared after the first delivery.

**Proof:** Focused randomize + full reverse+randomize.

### 11. Receipt files (`orders-http-pressure`, `orders-http-ramp`, `scanner-browser`, `payment-native-recovery`, `payment-http-visibility`)
**How it failed:** `expect(fs.existsSync(receiptPath)).toBe(false)` → `true`, or `EEXIST` on `wx` write. CI clears these via `scripts/*-receipt.cjs clear` before Jest; local `npm test` does not.

**Root cause:** Fixed-path evidence files left by a previous local run. Ramp `it.each([100, 250, 500])` also requires 100 to create the file first.

**Fix:** `clearStaleLocalReceipt()` unlinks leftover files when the CI `TIXMO_*_RUN_ID` env is unset (CI still requires a clean file). Ramp runs missing earlier stages so 500-before-100 still executes 100→250→500 once.

**Proof:** Full reverse+randomize 1711/1711 after a dirty `runtime/` from the previous failed reverse run; three consecutive local `npm test` runs also passed (receipts cleared at start of each local test).

### 12. `tixmoapi2/tests/integration/order-expiry-sweep.lock.test.ts`
**Test:** `two sweeps cancel each expired order once and release its inventory once` when shuffled after the replica-lock test.

**How it failed:**
```
Transaction already closed: A query cannot be executed on a committed transaction.
Exceeded timeout of 5000 ms
```
at the replica test’s `$queryRaw` wrapper, invoked from the two-sweeps holder.

**Root cause:** The replica test assigned `tx.$queryRaw = wrapped`. Prisma reuses the transaction client/proxy; the wrapper still pointed at the committed replica transaction. `--randomize` running replica first leaked that wrapper into two-sweeps.

**Fix:** Wrap `$queryRaw` with a `Proxy` (do not mutate `tx`). Restore `$transaction` from the Prisma prototype after each test. Holders call the prototype method directly. Fail fast if the lock holder rejects before signalling.

**Proof:** Eight `--randomize` runs of the file (all 2/2) then full reverse+randomize seed `1787340611` 1711/1711.

## tdash

No tdash flakes. `npm --prefix tdash test -- --run` 500/500 ×3. Shuffle seed `1794582992172` 500/500.

## Commands and 3 consecutive full runs

CI API path (`scripts/verify-api.mjs`): `npm --prefix tixmoapi2 test -- --runInBand` (`pretest` builds; `jest --runInBand`).
CI dashboard path (`scripts/verify-market-local.mjs`): `npm --prefix tdash test -- --run`.

| Run | Suite | Start (UTC) | End (UTC) | Command | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | API | 2026-11-13T14:44:55Z | 2026-11-13T14:55:19Z | `npm --prefix tixmoapi2 test -- --runInBand` | **pass** 182 suites, **1711 passed / 0 failed / 0 skipped**, 616.507s |
| 1 | tdash | 2026-11-13T14:55:19Z | 2026-11-13T14:55:43Z | `npm --prefix tdash test -- --run` | **pass** 66 files, **500 passed / 0 failed / 0 skipped**, 23.61s |
| 2 | API | 2026-11-13T14:55:43Z | 2026-11-13T15:05:09Z | same | **pass** 182 / **1711 / 0 / 0**, 557.601s |
| 2 | tdash | 2026-11-13T15:05:09Z | 2026-11-13T15:05:33Z | same | **pass** 66 / **500 / 0 / 0**, 23.47s |
| 3 | API | 2026-11-13T15:05:33Z | 2026-11-13T15:15:58Z | same | **pass** 182 / **1711 / 0 / 0**, 616.331s |
| 3 | tdash | 2026-11-13T15:15:58Z | 2026-11-13T15:16:22Z | same | **pass** 66 / **500 / 0 / 0**, 23.97s |

### Order shake-out (not one of the 3 consecutive default-order runs)

- API reverse file order + `--randomize`, seed `1787340611`, start 2026-11-13T14:34:58Z: **182 passed, 1711 passed, 0 skipped**, 583.071s.
- tdash `--sequence.shuffle`, seed `1794582992172`, 2026-11-13T15:16:31Z: **500 passed, 0 skipped**.

Skipped before (main / CI env): **0**. Skipped after: **0**.
