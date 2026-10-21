# Individual-event sale-window contract (W01 / #238)

Status: proposed source-backed contract and bounded implementation; independent
non-author contract review and QA required. Base: `317754edc7b43eb8e27b60c5374679330326c575`
(combined candidate #235, not independently accepted).

## Authoritative eligibility

`tixmoapi2/prisma/schema.prisma` defines nullable event and ticket-type
`salesStart`/`salesEnd` DateTime instants. `src/api/orders/service.ts:createOrder`
is the authoritative direct-request reservation path. It acquires the event row
lock, reads current event state, and samples the API server clock once. Browser
time, countdown state and extra client JSON cannot authorize an order.

For every requested ticket type, the effective sale interval is the intersection
of the event and ticket intervals: opening is the latest non-null start; closing
is the earliest non-null end **and event startDatetime**. Null endpoints add no
restriction. All windows are half-open **[opening, closing)**: T−1ms before
opening rejects, T opens, T+1ms stays open; closing T−1ms permits, T and T+1ms
reject. Empty or inverted intersections cannot sell. Comparisons use instants,
not local wall-clock strings; synthetic November 9 10:00 America/St_Johns is
2026-11-09T13:30:00Z (NST, not today's offset).

Only PUBLISHED/ON_SALE events with null deletedAt qualify; DRAFT, SOLD_OUT,
CANCELLED, COMPLETED, DELETED and soft-deleted published events reject with
400 `Event is not available for purchase`. Ticket types must remain ACTIVE and
inside their window; violation returns 400 `Ticket type is not on sale`.
Existing event start cutoff is preserved. Existing tier [startsAt, endsAt),
inventory readiness/availability, per-type aggregate caps and tenant rules remain
additional constraints, never substitutes for these windows. This does not add a
new event CLOSED enum or per-person cumulative limit.

The admission clock sample is after the event lock, not HTTP arrival time;
an early request waiting until opening can qualify, and one waiting past closing
cannot. Existing single-sample behavior across the reservation transaction is
preserved; this slice does not promise a commit-time clock cutoff. Existing valid
holds/payment confirmation are not revalidated against sale windows by this fix.

## UI handoff / remaining acceptance

W02 must display the same intersection and lifecycle restrictions, update open
pages across boundaries, preserve UTC instants on editor round trips, and treat
API rejection as final even when browser time is skewed. This slice verifies
direct service calls cannot bypass the server clock, **not** browser countdown,
HTTP middleware, timezone editor or physical browser behavior. A wider ticket
window must never extend event eligibility; a narrower ticket window restricts it.

## Reproduction and verification

`tests/orders-sale-windows.unit.test.ts` calls the real OrderService transaction
callback with mocked persistence/config/notifications. No DB, Redis, provider,
dotenv or normal test bootstrap is loaded. `jest.sale-windows.config.cjs` also
runs unchanged aggregate-cap (#70) and tenant-fence (#65) unit regressions.
From tixmoapi2, with existing installed dependencies and Node24.21.0:

```sh
env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin NODE_ENV=test TZ=America/St_Johns node node_modules/jest/bin/jest.js --config jest.sale-windows.config.cjs --runInBand
```

Before the two event-window guard conditions, dedicated regression exits1:
5 failed /19 passed /24 total (early event opening, closing T/T+1ms, wider ticket
override and client-clock bypass). Removing only those added conditions
reproduces the original failure. After fix, see task #238 board for current
exact-SHA results. Mocked unit tests do not establish DB isolation/race behavior,
full candidate acceptance or launch readiness. No integration, push, deployment
or provider action is included. Next slice: independent contract+QA exact-SHA
review, then authorized disposable-DB/API and W02 browser boundary acceptance.
