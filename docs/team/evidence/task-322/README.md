# Task322 payment fixture and lifecycle test contract repair

Base `4ec8594850eb547dafc145a14bb1b85cdeaa235c`; branch `tixmo/task-322-payment-test-contracts`, isolated task-322 worktree. Task319 `8cced1c` cases1-7,14-21,30-31 and task324 `1eeb38e` read before edits. Seven assigned test suites only plus evidence; no product/service/schema changes or task321 composition.

## Repairs and preserved invariants

- Five synthetic signed-webhook/race suites now supply success status, amount and received amount from exact target totalAmount*100, target currency, metadata identity; event fixture is ON_SALE, not default DRAFT. No inferred financial defaults in production.
- Integrity fulfillment failure injected into the actual fenced transaction confirmation seam, not unused public confirmation; abandoned lease/replay and foreign hold invariants retained.
- Late-paid assertions follow authority73: durable LATE_PAYMENT manual marker, REQUESTED exception, null processor refund ID, no provider refund/fulfillment/financial closure, repeated recovery preserves reservation release. Mock-only integration asserts no reconcileRefund call. Existing automatically refunded expectations replaced solely where they contradicted approved73.
- Ordinary refund cooldown tests prove immediate recovery leaves SOLD stock untouched, explicitly backdate refund updatedAt by60001ms, then run repeated/concurrent recovery and require exactly-once release/finalization. This verifies fresh versus eligible (>60s), not exact59.999/60.000 boundary precision; no actual sleeps or weakened cooldown.
- Wrong processor binding uses complete succeeded intent, persists exact UNEXPECTED_PAYMENT amount/currency and no fulfillment, with inert mocked reconcileRefund instead of old mismatch alert/400. All subsequent generation/fence checks retained.
- New malformed-success negative case omits amount_received while retaining amount; requires409 before transaction, refund creation or confirmation. The pre-existing separate undefined===undefined robustness gap described319 is not repaired or represented as fixed; no source scope expansion.
- Later assertions exposed old target-ticket HELD snapshots. Exact expected target rows now require SOLD lifecycle plus Date updatedAt while preserving every other scalar/identity/owner/barcode field. Foreign buyer rows remain exact unchanged snapshots; target count/counters, generation/lease barriers and stale-finish immunity remain. Fresh/nonfulfilling snapshots still require exact original tickets, not SOLD. No assertions removed to hide a source defect.

## Reproduction / safety

From worktree root: `bash docs/team/evidence/task-322/runtime.sh`.

This invokes only the seven explicit suites (see exact command in script), ordinary candidate Jest config/ts-jest, disposable-local shared schema bootstrap; not verify:api/full gate. Dependencies copied `cp -a ../task-318/tixmoapi2/node_modules tixmoapi2/node_modules`, no hardlinks/generate/install/shared generated writes. Candidate schema and lock unchanged/matching318. No build/production tsc needed for tests-only edit; ts-jest checks selected tests.

Runtime adapted from inspected318 helper: env-i before imports; synthetic keys only, checkpoint disabled; hard pre-import nonloopback denial and blocked-attempt gate; diskbacked task322 root0700; fresh owned PG18+Redis PIDs verified by exe/user/runtime identity and exact listener ownership before access. Never uses production DB/provider; no AWS work/APIs/credentials. No migrations against any non-disposable target. Default test setup db push is only against generated disposable DB.

First attempt:6 failed suites/1 passed;11 failed tests/30 passed and one compile failure (unused alert import after contract update). First new failures were ticket SOLD lifecycle representation plus manual marker capitalization. Second:6 suites passed/1 failed;41 tests passed/1 failed, nested target ticket expectation still HELD. Both artifacts retained under attempt-1/attempt-2, with owned runtime cleanup in logs. Final run results in jest-result.json/jest.log; summary and cleanup artifact document exact final outcome. No prior failure is counted as a pass. Formatting applied only seven touched test files; git diff --check required.

## Limitations / handoff

No full API readiness claim, no smoke/storage/order-refund/cancel repair. Task328 public stale-request source guarantee remains separate. Guard is Node-level not OS isolation; tests use only inert provider boundaries. Independent exact-SHA lead+QA acceptance required; author submits review, not done. Default branch untouched, no spend/cloud/deploy/merge. Commit uses command-scoped agent identity/hook bypass because isolated checkout lacks Husky helper.
