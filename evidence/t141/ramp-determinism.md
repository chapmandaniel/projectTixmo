# T141: `orders-http-ramp.test.ts` test #3 determinism

Branch `cursor/t141-ramp-determinism-43a5` off `main`
`a702a4a025244d4cfcc087298a720a943f177eab`.

Test-only change. No `jest.retryTimes`, skip, timeout-as-fix, or loosened
p95/SLO bounds. `publicReadP95Ms <= 500` and `reservationP95Ms <= 2000` stay
exact.

## Failure

Merge-train `local-gates` on `c69749588dd2be857f1eac182352fa819ce31a2e`
([run 43994560679](https://github.com/chapmandaniel/projectTixmo/actions/runs/43994560679),
job [133743282660](https://github.com/chapmandaniel/projectTixmo/actions/runs/43994560679/job/133743282660)):

```
Failed tests: 1; suites: orders-http-ramp.test.ts; assertions: orders-http-ramp.test.ts#3@623,123,678.
```

`formatTestFailures` maps stack frames in the failing case. Test #3 is the
`it.each([100, 250, 500])` 500-actor stage. Line 623 is
`expect(metrics.publicReadP95Ms).toBeLessThanOrEqual(500)`; 123/678 are
`bounded(bodyWork, 90000)` wrapping that expect.

The post-fail `http-ramp-receipt.cjs report` step still printed the receipt.
Correctness held (all 6000 requests succeeded, inventory exact). Latency did not.

| Stage | publicReadP95Ms | reservationP95Ms | recoveryReadP95Ms | maxHttpInFlight | scheduleLatenessMaxMs | maxPgConnections |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 8.7 | 21.2 | 7.4 | 13 | 43 | 12 |
| 250 | 15.5 | 29.0 | 13.1 | 26 | 39 | 12 |
| **500** | **625.2** (limit 500) | 752.4 | 648.2 | **235** | **1315** | 12 |

Same cliff showed up earlier as `reservationP95Ms > 2000` on T101's
`8480537f` local-gates run. Both are 500-actor congestion collapse, not a
product inventory/auth race.

## Root cause

Two harness effects stacked. Neither is a product checkout race.

### 1. Public browsing was the authenticated, uncached path

The 500ms SLO is for **anonymous event browsing** during staggered checkout.
The driver sent `Authorization: Bearer <buyer JWT>` on every public GET.

- `optionalAuthenticate` then `resolveAccountSession` → `prisma.user.findUnique`
  on every cadence hit.
- `authenticatedPublicRead()` is true when an `Authorization` header is
  present, so `GET /events/public/:slug` skips the in-process public-event
  cache (`private, no-store`) and runs `getPublicEventBySlug` (event + org +
  venue + ticket types + tiers) every time.
- Suite-wide `PUBLIC_EVENT_CACHE_TTL_SECONDS` defaults to **0 in test**, so
  even anonymous reads would miss the cache.

At 500 actors that is 5,000 session lookups + 5,000 heavy event queries on the
same Prisma pool as 500 checkout transactions, in one Jest process, on a
2-vCPU GitHub runner. In-flight HTTP jumps 26 → 235 and p95 walks past 500ms.
100/250 stay under the bound because they never fill the pool.

Product cache policy is already documented: order holds do not invalidate the
public-event cache; anonymous reads may be a few seconds stale; `POST /orders`
rechecks inventory. Logged-in public GETs are intentionally uncached; this
ramp's "public browsing" schedule is the anonymous storefront path.

### 2. (Not shipped) leaked Prisma pools in `--runInBand`

A local full-suite run with failed browser tests showed 86 Postgres backends
and 250-actor public p95 511ms. CI's 500-actor receipt on this branch showed
only 4 connections. An experimental `pg_terminate_backend` janitor was
dropped after CI `local-gates` still failed with `Failed tests: 0; suites:
unavailable` — ramp receipts were already green (`publicReadP95Ms` 11ms), so
killing other files' idle Prisma clients likely aborted Jest before it wrote
`--outputFile`. The JWT/cache change is the CI-relevant fix.

## Fix

In `orders-http-ramp.test.ts` only:

1. Send `Authorization` on reservation and recovery, not on public GETs.
2. After `jest.resetModules()`, `jest.replaceProperty(config,
   'publicEventCacheTtlSeconds', 4)` so anonymous cadence reads use the
   production 4s TTL and single-flight fill.

Unchanged: actor counts, 20s windows, 500ms/2000ms/0.5% 5xx bounds, no
retries, no skips. `scripts/http-ramp-receipt.test.cjs` locks the harness
contract.

## Proof

Disposable local Postgres `tixmo_disposable_t141` and Redis `/1`.
`TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`. Node 24.21.0.

### 30-loop of the test file (JWT/cache harness; committed shape)

```bash
npx jest --runInBand --runTestsByPath tests/integration/orders-http-ramp.test.ts
```

repeated 30 times.

- **Passes: 30 / 30** (0 failures)
- Stage-500 `publicReadP95Ms`: min 2.40ms, max 5.05ms (limit 500)
- Stage-500 `reservationP95Ms`: max 24.6ms (limit 2000)
- Stage-500 `maxHttpInFlight`: 10–35 (CI failure was 235)

### Full `tixmoapi2` suite once

```bash
npm --prefix tixmoapi2 test -- --runInBand --forceExit
```

`--forceExit` only after Jest printed the summary (this VM leaves Chrome/Prisma
handles open; CI does not use `--forceExit`).

- **188/188 suites, 1778/1778 tests passed, 0 failed, 0 skipped**
- Duration 642.345s

A first full-suite attempt without `tdash/node_modules` failed scanner-browser
and wallet-browser-recovery at stage 1 (missing Vite). After installing tdash,
those tests passed.

### CI receipts on `eed17f20` (same JWT/cache change; extra janitor later dropped)

`local-gates` job [133808150370](https://github.com/chapmandaniel/projectTixmo/actions/runs/44014223633/job/133808150370)
wrote a green ramp receipt then failed Jest with no JSON (`Failed tests: 0;
suites: unavailable`). Ramp stage 500: `publicReadP95Ms` 11.0ms,
`reservationP95Ms` 53.4ms, `maxHttpInFlight` 32, `testAssertionsPassed` true.
Pressure, recovery, payment, and scanner receipts also passed. The janitor was
removed so later Prisma clients are not killed mid-suite.

## Not done

No product code, threshold, retry, or skip changes. No staging/prod/Stripe
traffic. Receipt `limitsQualified` stays false.
