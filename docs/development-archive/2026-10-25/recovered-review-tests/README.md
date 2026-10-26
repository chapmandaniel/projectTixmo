# Reconciled historical reviewer tests

Source: PR115 head `54b9c41fc87ad44823e3266dafdae77998f9659d`, compared with main baseline `822dcf02a80958b65986bd5eb3f4635760ec9275`. The seven original tests and their original recovery provenance document are preserved byte-for-byte under their source paths with `.txt` suffixes. They are inert historical material, excluded from Jest/Vitest discovery. `manifest.json` maps every source path/blob to its snapshot path, byte size and SHA-256. The preserved provenance document records the original worktree HEADs; no original working copies were read or changed during reconciliation.

These experiments are not current passing qualification. Their historical contracts are not restored to production:

| Original source | Reconciliation |
| --- | --- |
| `tdash/src/test/ScannerPage.qa.test.jsx` | Current `ScannerPage.test.jsx` already tests clearing prior admission when any of three input fields changes without another request. No duplicate active test added. |
| `tixmoapi2/tests/qa90-adverse.unit.test.ts` | Current `orders-aggregate-limit.unit.test.ts` covers aggregate caps, single aggregated holds, server/tier pricing and rollback. Added interleaved over-cap duplicates and two distinct types reaching their exact aggregate caps. Historical two-hold expectations contradict current aggregation. |
| `tixmoapi2/tests/review144-transaction.unit.test.ts` | Current confirmation locks/rereads the supplied client, returns an Order, and accepts no caller-supplied snapshot. Tenant tests already cover scoped inventory/promo transitions. New direct caller-owned integration cases verify scoped/missing order errors and rollback/commit with the supplied transaction; they would expose an independently committed nested transaction. Historical CAS and rich-response assertions are obsolete. |
| `tixmoapi2/tests/review145-direct.integration.test.ts` | Ported caller abort and successful commit to `order-confirm-rollback.test.ts`, including full order/ticket/type/tier/promo snapshots and a different buyer's hold. Current repeated confirmation is idempotent, rather than an error. |
| `tixmoapi2/tests/integration/task113-rollback.review.test.ts` | Ported rollback intent using explicit HELD tickets, tier and promo reservations. A tier failure follows type writes; a promo failure follows type/tier/ticket writes. Full snapshots must remain unchanged after each failure. Historical counters-only fixtures no longer represent current reservation contracts. |
| `tixmoapi2/tests/integration/review146-checkpoint.test.ts` | Current `payment-fenced-checkpoint.test.ts` covers FAILED retry, fulfillment, stale terminal/fence immunity, overflow and missing IDs with current payment attempts/currency/reservations. Intent mismatch now records unexpected-payment refund handling rather than historical rejection/alert expectations. |
| `tixmoapi2/tests/integration/review147-checkpoint.test.ts` | Current distinct-success race tests cover distinct webhook concurrency. Do not activate the historical unbounded invocation gate or obsolete payment fixtures. |

## Verification of this reconciliation

- Setup-free Jest with TypeScript diagnostics enabled: `tests/orders-aggregate-limit.unit.test.ts`, 1 suite, 10 tests passed. Existing local dependencies were reused without installing. No database/provider transport or default DB bootstrap ran.
- TypeScript checked the new integration fixture and its imported source with the repository compiler options, `noEmit: true` and `rootDir: '.'` to include tests: zero diagnostics. Production tsconfig itself excludes tests.
- All eight archived source blobs match the source commit, byte sizes and SHA-256 manifest. `git diff --check` passes.
- New integration tests have NOT executed locally. Docker's socket is unavailable to this session; no approved local database runtime was provisioned. They require the existing hosted disposable PostgreSQL CI gate before acceptance. Static compilation is not a database rollback result.

No production code, dependencies, service configuration, database or provider state changed. This is a bounded test port plus historical source preservation, not release qualification.
