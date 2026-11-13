# T101 — buyer wallet self-service coverage (gap #4)

Head under test: `ec07bfcaf36c398e23e0a9864f20cb4c75905566` (T101 tests plus evidence). Tests themselves landed at `d2fea085e522916ff1fdd4684d2377d3cfa84ebf`.

Local Node `v24.21.0`, npm `11.19.0`. Disposable Postgres `tixmo_disposable_t101` on `127.0.0.1:5432` and Redis `/1`. Synthetic JWT/session and Stripe keys matching `.github/workflows/market-readiness-local.yml`. `TIXMO_BROWSER_PATH=/usr/bin/google-chrome`. No Stripe network traffic, no checkout or refund work.

## New tests

### `tixmoapi2/tests/integration/buyer-wallet-self-service.test.ts`

| Name | Asserts |
| --- | --- |
| lists only the authenticated buyer orders and paginates past page 1 | `GET /api/v1/orders/mine?page=1&limit=1` returns one of the buyer’s three orders, `pagination.total=3` / `pages=3`; page 2 is a different buyer order; page 3 completes the set; the other buyer’s order id never appears |
| never includes another buyer’s orders, even on an unfiltered first page | buyer `limit=100` returns exactly those three order ids; the other buyer’s list is only their own order |
| refuses an unauthenticated wallet order list | `GET /orders/mine` without a token is 401 and has no `data` |
| lets the owner view ticket detail and QR | owner `GET /tickets/:id` is 200 with id/userId/barcode; owner `GET /tickets/:id/qr` is 200 with a `data:image` QR |
| does not let another buyer view ticket detail or QR | other buyer gets 404 on detail and 403 on QR, both without `data` |
| moves ownership, invalidates the sender QR, and issues a new credential | `POST /tickets/:id/transfer` is 200, `userId` becomes the recipient, response has no barcode; stored barcode changes and `qrCodeUrl` is null; sender QR is 403; recipient QR is 200 and different; ticket leaves sender `/tickets/mine` and appears on the recipient’s |
| refuses an unknown recipient and leaves the sender ticket usable | 404; `userId`/barcode/status unchanged; sender QR still 200 |
| refuses a self-transfer and leaves the sender ticket usable | 400 mentioning yourself; ownership and barcode unchanged; sender QR still 200 |
| refuses a used ticket and leaves it owned by the sender | 400; still `USED` and owned by the sender; sender QR still 200 |
| refuses a refunded ticket and leaves ownership with the sender | 400; `userId` and barcode unchanged, `transferredFrom` still null; owner `GET /tickets/:id` still 200 |

`tickets.test.ts` already covered transfer success (ownership fields), unknown recipient, self-transfer, cancelled, unpaid, unauthenticated, and invalid email. It did not assert QR rotation or used/refunded refusals leaving the sender in control. Those paths are the new HTTP tests above.

### `tdash/src/test/WalletPage.test.jsx`

| Name | Asserts |
| --- | --- |
| opens the transfer dialog on a VALID paid ticket, requires a recipient, and posts one transfer | Transfer opens `role=dialog` “Transfer ticket”; email input is `required` and `type=email`; one `POST /tickets/ticket-owned/transfer` with the typed email; notice “Ticket transferred.”; previous QR and dialog are gone |
| normalises the transfer recipient email (trim/lowercase) before POST | **skipped** — see Bugs |
| shows the API 4xx message on a refused transfer and keeps the ticket usable | 400 message is shown as `role=alert`; Show ticket and Transfer remain; no “Ticket transferred.”; exactly one POST |
| cancels a PENDING reservation with one POST and a notice | one `POST /orders/order-pending/cancel`; “Reservation cancelled.” |
| hides transfer and cancel for a PAID order without a ticket and for PROCESSING refunds | PAID + empty tickets: Resend receipt only, no Transfer / Cancel reservation / Show ticket. PROCESSING refund: “Refund processing”, no Transfer / Cancel / Show ticket |
| loads the next wallet page past page 1 | Page 1 of 2 shows `ORD-PAGE-1`; Next loads `page=2` for both `/orders/mine` and `/tickets/mine`; Page 2 of 2 shows `ORD-PAGE-2` and not page 1 |

Existing WalletPage tests (11) were left unchanged: records, no self-service refund, privacy, receipt resend, QR cleared on expiry, ownership denied, reopen, HST, unpaid labels, expired session.

## Coverage before / after

HTTP `GET /orders/mine` had no integration test (unit mock of the route table only). Ticket owner vs non-owner detail/QR was not asserted as a pair over HTTP. WalletPage transfer dialog (~127–134), Cancel reservation (~118), and pagination past page 1 were untested.

| Surface | Before | After |
| --- | --- | --- |
| `GET /orders/mine` HTTP | 0 tests | 3 tests (own orders, pagination, foreign excluded, 401) |
| Owner vs non-owner ticket detail/QR HTTP | not covered as a pair | 2 tests |
| Buyer transfer HTTP QR + used/refunded | success/unknown/self in `tickets.test.ts` without QR/used/refunded usability | +5 tests in this file |
| WalletPage transfer / cancel / pagination | 0 tests | 5 passing + 1 skipped |
| `WalletPage.jsx` lines 118, 121–125, 127–134 | never exercised | cancel, Next, dialog + POST |

## Test counts

Local full suites, same disposable DB/Redis and CI-matching secrets. Receipt files from a prior run were cleared before the after API run (`scripts/*-receipt.cjs clear`, `scanner-browser-guard.cjs clear`), matching CI. `wallet-browser-recovery` did **not** flake.

| Suite | Before | After |
| --- | --- | --- |
| API Jest | 182 suites, **1711 passed** / 0 failed / 0 skipped (1711) | 183 suites, **1721 passed** / 0 failed / 0 skipped (1721) |
| tdash Vitest | 66 files, **500 passed** / 0 skipped (500) | 66 files, **505 passed** / 1 skipped (506) |

API +10 tests (new file). tdash +5 passing +1 skipped (WalletPage 11 → 17).

An intermediate API run without clearing receipts failed 7 tests in `orders-http-pressure`, `orders-http-ramp`, `payment-http-visibility`, `payment-native-recovery`, and `scanner-browser` (`expect(receiptPath exists).toBe(false)`). That is leftover evidence from the baseline run, not a product bug. After clear, the full suite is 1721/1721.

## CI run ids

Draft PR #203. `http-soak` skipped (opt-in workflow). T101 tests did not change between these heads.

### `d2fea085e522916ff1fdd4684d2377d3cfa84ebf` (T101 tests)

| Check | Workflow run | Job | Status |
| --- | --- | --- | --- |
| local-gates | [43433377628](https://github.com/chapmandaniel/projectTixmo/actions/runs/43433377628) | [131912199115](https://github.com/chapmandaniel/projectTixmo/actions/runs/43433377628/job/131912199115) | pass, 13m3s |
| configured-image-restore | [43433377628](https://github.com/chapmandaniel/projectTixmo/actions/runs/43433377628) | [131912199529](https://github.com/chapmandaniel/projectTixmo/actions/runs/43433377628/job/131912199529) | pass, 3m16s |
| guard-and-build | [43433377745](https://github.com/chapmandaniel/projectTixmo/actions/runs/43433377745) | [131912199435](https://github.com/chapmandaniel/projectTixmo/actions/runs/43433377745/job/131912199435) | pass, 1m17s |

### `8480537f306521eb2215b8c4203b2921f9cb2519` (evidence-only follow-up)

| Check | Workflow run | Job | Status |
| --- | --- | --- | --- |
| local-gates | [43436903707](https://github.com/chapmandaniel/projectTixmo/actions/runs/43436903707) | [131924256883](https://github.com/chapmandaniel/projectTixmo/actions/runs/43436903707/job/131924256883) | fail, 15m11s — `orders-http-ramp.test.ts` case 3, `reservationP95Ms` at line 629 (`<= 2000`). Not a T101 test. Same tree as `d2fea085` except this markdown file. Not weakened. |
| configured-image-restore | [43436903707](https://github.com/chapmandaniel/projectTixmo/actions/runs/43436903707) | [131924256444](https://github.com/chapmandaniel/projectTixmo/actions/runs/43436903707/job/131924256444) | pass, 3m20s |
| guard-and-build | [43436903692](https://github.com/chapmandaniel/projectTixmo/actions/runs/43436903692) | [131924256717](https://github.com/chapmandaniel/projectTixmo/actions/runs/43436903692/job/131924256717) | pass, 1m15s |

`wallet-browser-recovery` did not fail on either head.

### `ec07bfcaf36c398e23e0a9864f20cb4c75905566` (evidence retrigger after ramp flake)

| Check | Workflow run | Job | Status |
| --- | --- | --- | --- |
| local-gates | [43440852074](https://github.com/chapmandaniel/projectTixmo/actions/runs/43440852074) | [131937754836](https://github.com/chapmandaniel/projectTixmo/actions/runs/43440852074/job/131937754836) | pass, 14m34s |
| configured-image-restore | [43440852074](https://github.com/chapmandaniel/projectTixmo/actions/runs/43440852074) | [131937755114](https://github.com/chapmandaniel/projectTixmo/actions/runs/43440852074/job/131937755114) | pass, 2m38s |
| guard-and-build | [43440852042](https://github.com/chapmandaniel/projectTixmo/actions/runs/43440852042) | [131937754293](https://github.com/chapmandaniel/projectTixmo/actions/runs/43440852042/job/131937754293) | pass, 1m19s |

## Bugs found

| Severity | Location | Repro | Skipped test |
| --- | --- | --- | --- |
| Medium | `tdash/src/pages/WalletPage.jsx:129` (and `tixmoapi2/src/api/tickets/validation.ts:14`) | Open Transfer, type `  Recipient@Example.com  `, confirm. The POST body is the raw string. Auth stores emails through `normalizeEmail` (`tixmoapi2/src/api/auth/service.ts:29`), and `transferTicketSchema` has no trim/lowercase preprocess, so a real account is looked up as missing. | `WalletPage.test.jsx` › `normalises the transfer recipient email (trim/lowercase) before POST` |

Tests only; app code was not changed. Draft PR, not merged.
