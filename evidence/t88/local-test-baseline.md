# T88 local API test baseline

Head under test: `cursor/t88-api-test-baseline-52f6`, based on PR #185 head `d7c771d29d6d4b0b57ee9365a93e4910722638e6` (`cursor/t84-fast-xml-parser-advisory-4f84`).

Node `v24.21.0`, npm `11.19.0`. Disposable Postgres database `tixmo_disposable_t88jest` on `127.0.0.1` and Redis DB `/1`. No Stripe API traffic. `npm ci` in `tixmoapi2` (817 packages). `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, and `TIXMO_BROWSER_PATH` were unset for the recorded runs below. The JWT/session values are the synthetic harness values already set in `.github/workflows/market-readiness-local.yml` (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `PAYMENT_CURRENCY=cad`, `ADMIN_EMAIL`). They are not Stripe secrets. A run that also left those unset failed 289 tests, almost all `secretOrPrivateKey must have a value` or registration 500s, before the Stripe client was reached.

## Before

T87 on this same commit, with no Stripe key and no `TIXMO_BROWSER_PATH`, reported **44 failed / 1632 passed / 0 skipped (1676)**.

Reproduction on this machine:

| Run | Result | What it shows |
| --- | --- | --- |
| `npm test` with JWT also unset | 289 failed / 1387 passed / 0 skipped (1676) | Missing `JWT_SECRET` hides the scanner Chrome check and fails registration. Not the T87 condition. |
| Same command with the workflow's synthetic JWT/session values, receipt files left by the previous run | 49 failed / 1627 passed / 0 skipped (1676) | The 44 T87 tests fail, plus 5 receipt/`tdash` misses (`orders-http-ramp` 3, `payment-native-recovery` 1, `wallet-browser-recovery` 1). |
| Those five files again after `scripts/*receipt*.cjs clear` / `scanner-browser-guard.cjs clear`, and `npm ci` in `tdash` | ramp, native recovery, and wallet pass. Scanner fails `expect(chrome).toMatch(/^\/[a-zA-Z0-9_./-]+$/)` at `scanner-browser.test.ts:410` | Clean-tree scanner failure matches T87. Wallet finds Chrome via `which` and passes once the dashboard dependencies exist. |

The 43 non-scanner failures in the JWT run used the same first error lines as T87. Grouped:

| Count | First error | Cause |
| --- | --- | --- |
| 18 | `Barrier timeout (harness failure)` | `PaymentService` has no Stripe client, so one racer throws and never releases the harness. |
| 10 | `ApiError: Payment service is not configured.` | `STRIPE_SECRET_KEY` unset, so `provider()` throws. |
| 7 | `TypeError: Cannot read properties of null (reading 'paymentIntents')` | `order-refund-current-path.test.ts` already mocks `stripe`, but the client stays null without a key. |
| 4 | `Fresh API build required before recovery integration suite` | `npm test` ran before `npm run build`. |
| 4 | `Fresh API build required before the Showpass seed smoke` | Same missing `dist` build. |
| 1 | `expect(received).toMatch(expected)` on `TIXMO_BROWSER_PATH` | No Chrome path. Confirmed on the clean receipt re-run. |

## Each former failure

Skip text printed by `testOrSkipMissingEnv` when the captured process environment is missing the value. `tests/setup.ts` snapshots `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `TIXMO_BROWSER_PATH` before any test file writes a synthetic key, so a later file cannot accidentally un-skip these.

Stripe reason (both variables): `PaymentService` builds its client from `STRIPE_SECRET_KEY`. Without it `handleWebhook` throws "Payment service is not configured", and the race harness then reports "Barrier timeout (harness failure)". `Stripe.webhooks.generateTestHeaderString` and `constructEvent` use `STRIPE_WEBHOOK_SECRET`. CI sets synthetic `sk_test_market_readiness` and `whsec_market_readiness`, so these tests still run there.

| Test | Root cause | Fix |
| --- | --- | --- |
| `payment-failed-retry.race.test.ts` — FAILED same-ID retry, `first=false` and `first=true` | Barrier timeout from the missing Stripe client | Skip while the captured Stripe key or webhook secret is missing |
| `payment-handler-ownership.test.ts` — phase `success` and `failure` | Barrier timeout | Same skip |
| `payment-distinct-success.race.test.ts` — winner 0/1, reverse reads false/true (4) | Barrier timeout | Same skip |
| `payment-failed-successor.test.ts` — stale A failure false/true | Barrier timeout | Same skip |
| `payment-expired-successor.test.ts` — phases before-handler, success, failure, success-after-terminal, failure-after-terminal (5) | Barrier timeout | Same skip |
| `payment-prelock-missing-intent.test.ts` — phase success and failure | Barrier timeout | Same skip |
| `payment-distinct-failure-prelock.test.ts` — distinct signed failure A | Barrier timeout | Same skip |
| `payment-paused-owner.baseline.test.ts` — phases fresh, before-handler, before-finish | Payment service is not configured | Same skip |
| `payment-old-processing.baseline.test.ts` — ancient owner false/true | Payment service is not configured | Same skip |
| `payment-expired-candidate.test.ts` — ancient owner false/true | Payment service is not configured | Same skip |
| `payment-cutoff-overflow.test.ts` — maxBigInt FAILED and PROCESSING admission | Payment service is not configured | Same skip. The three `inclusive 300s cutoff offset` tests do not sign a webhook and still run |
| `payment-fenced-checkpoint.test.ts` — FAILED retry generation | Payment service is not configured | Same skip |
| `order-refund-current-path.test.ts` — 7 refund-path tests | Mocked Stripe client was null | Existing `jest.mock('stripe')`. If the captured key is missing, set `sk_test_order_refund_current_path` before the service module loads, then restore the previous value. Assertions unchanged |
| `payment-recovery-backlog.test.ts` — 4 real-SQL recovery tests | `dist/api/payments/service.js` missing or older than source | `pretest` runs `npm run build` before `jest`. The child already uses `sk_test_task566_synthetic` |
| `showpass-seed.test.ts` — 4 compiled seed smokes | `dist/scripts/seed-showpass.js` missing or older than source | Same `pretest` build |
| `scanner-browser.test.ts` — two emulated scanners race one paid QR | `TIXMO_BROWSER_PATH` unset, so `expect(chrome).toMatch(...)` fails | Skip while that variable is missing. The assertion is unchanged when CI sets `/usr/bin/google-chrome` |

28 Stripe-gated tests plus the scanner test are the 29 skips. The 8 build-gated tests and 7 refund tests now pass. 28 + 1 + 8 + 7 = 44.

## After, no Stripe and no browser path

Command: `npm test` in `tixmoapi2` (`pretest` build, then `jest --runInBand`), with the harness above and the four Stripe/browser variables unset. Receipt files cleared first. Exit 0. Jest time 562.37 s.

| | Failed | Passed | Skipped | Total |
| --- | --- | --- | --- | --- |
| Before (T87, same commit, same missing Stripe/browser) | 44 | 1632 | 0 | 1676 |
| After this branch | 0 | 1647 | 29 | 1676 |

1647 − 1632 = 15 tests that now run and pass (8 build-gated + 7 refund mock). 29 tests skip instead of failing. Suites: 0 failed, 167 passed, 12 skipped, 179 total.

Each skip line is `[skip] <file> › <test title> — <missing variable>: <why>`. Titles:

- scanner-browser: two independent emulated scanner browsers race one paid QR and reject duplicate and revoked use
- payment-failed-retry.race: FAILED same-ID retry has one claimant (`first=false`, `first=true`)
- payment-handler-ownership: phase success, failure
- payment-distinct-success.race: winner 0/1 × reverse reads false/true
- payment-failed-successor: stale A failure false/true
- payment-expired-successor: five phases listed above
- payment-prelock-missing-intent: phase success, failure
- payment-distinct-failure-prelock: distinct signed failure A
- payment-paused-owner.baseline: fresh, before-handler, before-finish
- payment-old-processing.baseline: ancient owner false/true
- payment-expired-candidate: ancient owner false/true
- payment-cutoff-overflow: maxBigInt FAILED and PROCESSING admission
- payment-fenced-checkpoint: FAILED retry generation

## CI still runs the same tests

Workflow file not modified: `.github/workflows/market-readiness-local.yml`.

Job `local-gates` env:

- `STRIPE_SECRET_KEY: sk_test_market_readiness`
- `STRIPE_WEBHOOK_SECRET: whsec_market_readiness`
- `TIXMO_BROWSER_PATH: /usr/bin/google-chrome` on the "Run market readiness gates" step
- `npm --prefix tixmoapi2 run build` runs before `npm run verify:market`

`scripts/verify-api.mjs` also fills a synthetic `sk_test_verify_api` / `whsec_verify_api` only when those variables are empty, then runs `npm --prefix tixmoapi2 test`. With the workflow values set, the snapshot is non-empty, `testOrSkipMissingEnv` returns Jest's real `test`, and `pretest` only repeats the build. Placeholder keys (`your_`, `_your`, `change-this`, `placeholder`) still count as missing, matching `normalizeOptionalCredential`. The workflow values do not.

Local check with those workflow values (Chrome path on this machine: `/usr/local/bin/google-chrome`, which matches the test's path assertion): `payment-paused-owner`, `payment-cutoff-overflow`, `payment-failed-retry.race`, `payment-fenced-checkpoint`, and `scanner-browser` all executed and passed. No `[skip]` lines. `order-refund-current-path` did not replace the supplied key.

`verify-api.mjs` discards the Jest child's stdout (`stdio: 'ignore'`), so the GitHub log has no numeric Jest total. The suite size on `d7c771d` is 1676 tests and 0 skips when the workflow env is present (T87 counted 1676 with 0 skips; this branch still totals 1676). A green `local-gates` run therefore still executes those 1676 tests rather than the 29 local skips.

### Before CI (PR #185, `d7c771d`)

- [Tixmo Market Readiness Local Gates](https://github.com/chapmandaniel/projectTixmo/actions/runs/42962543304) — success, 12m37s. Jobs `local-gates` and `configured-image-restore`. API verification logged only `[verify:api] API verification passed.`
- [Tdash Design System](https://github.com/chapmandaniel/projectTixmo/actions/runs/42962543119) — success. Job `guard-and-build`.
- [HTTP soak](https://github.com/chapmandaniel/projectTixmo/actions/runs/42962543056) — skipped, as on a normal pull request.

Jest totals are not printed. Executed test count implied by the passing verifier and the unchanged 1676-test suite: **1676 ran, 0 skipped**.

### After CI (this branch)

Filled in after the draft PR's checks finish. Expected: the same three workflow results, and the same 1676 tests executed because the workflow env still satisfies the skip helper.
