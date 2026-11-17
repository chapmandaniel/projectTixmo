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

### 2. Leaked Prisma pools in `--runInBand`

Prisma's default `connection_limit` is `num_cpus * 2 + 1`. Earlier files in
the same Jest process that do not `$disconnect()` leave idle backends.
`pg_stat_activity` during a local full-suite 250-actor stage showed **86**
connections (CI's isolated 500-actor receipt showed 12). Checkouts then wait
on the remaining slots and public-read p95 can kiss 500ms even after (1).

## Fix

In `orders-http-ramp.test.ts` only:

1. Send `Authorization` on reservation and recovery, not on public GETs.
2. After `jest.resetModules()`, `jest.replaceProperty(config,
   'publicEventCacheTtlSeconds', 4)` so anonymous cadence reads use the
   production 4s TTL and single-flight fill.
3. Before each stage, terminate other `client backend` rows on the disposable
   database (`pg_terminate_backend`) so leaked pools from earlier files cannot
   starve this stage.

Unchanged: actor counts, 20s windows, 500ms/2000ms/0.5% 5xx bounds, no
retries, no skips. `scripts/http-ramp-receipt.test.cjs` locks the harness
contract.

## Proof

Disposable local Postgres `tixmo_disposable_t141` and Redis `/1`.
`TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`. Node 24.21.0.

### 30-loop of the test file (committed harness)

```bash
npx jest --runInBand --runTestsByPath tests/integration/orders-http-ramp.test.ts
```

repeated 30 times after the janitor landed.

- **Passes: 30 / 30** (0 failures)
- Stage-500 `publicReadP95Ms`: min 2.59ms, max 5.44ms (limit 500)
- Stage-500 `reservationP95Ms`: min 14.55ms, max 32.34ms (limit 2000)
- Stage-500 `maxHttpInFlight`: 11–31 (CI failure was 235)
- Stage-500 `maxPgConnections`: 3–6 (CI failure was 12; dirty full-suite
  before janitor was 86)

An earlier 30/30 on the JWT/cache change alone (before the janitor) had
stage-500 public p95 2.40–5.05ms. That loop is not the committed proof; the
counts above are.

### Full `tixmoapi2` suite once

```bash
npm --prefix tixmoapi2 test -- --runInBand --forceExit
```

`--forceExit` only after Jest printed the summary (this VM leaves Chrome/Prisma
handles open; CI does not use `--forceExit`).

- **188/188 suites, 1778/1778 tests passed, 0 failed, 0 skipped**
- Duration 642.345s

A first full-suite attempt before tdash `node_modules` and before the janitor
failed scanner-browser (stage 1, missing Vite), wallet-browser-recovery
(same), and ramp test #2 at `publicReadP95Ms` 511ms with 86 Postgres
backends. Those are the conditions the janitor and local dashboard install
address. The passing run above is after both.

## Not done

No product code, threshold, retry, or skip changes. No staging/prod/Stripe
traffic. Receipt `limitsQualified` stays false.
