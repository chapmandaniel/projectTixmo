# Recovered unpublished reviewer tests

Recovered on 2026-10-25 from local review worktrees at Daniel's request. These files are byte-identical to their original untracked working copies. Original worktrees are unchanged.

These are historical reviewer experiments, not current passing qualification. Several use historical transaction/payment mocks and integration fixtures. Reconcile them with current contracts, use an explicitly disposable local database for integration tests, and obtain independent review before merging. No test suite or provider/database operation was run during recovery.

| File | Original worktree | Original HEAD |
| --- | --- | --- |
| tixmoapi2/tests/integration/task113-rollback.review.test.ts | review-113 | 98e89576a7c2ee66bcea72ec535607319376e499 |
| tixmoapi2/tests/review144-transaction.unit.test.ts | review-144 | c004dd75005ee0656c31d929799ade47805f6349 |
| tixmoapi2/tests/review145-direct.integration.test.ts | review-145 | c004dd75005ee0656c31d929799ade47805f6349 |
| tixmoapi2/tests/integration/review146-checkpoint.test.ts | review-146 | 0ac140c348883a99261ac9cdfd0bf7d7fda59ee1 |
| tixmoapi2/tests/integration/review147-checkpoint.test.ts | review-147 | 0ac140c348883a99261ac9cdfd0bf7d7fda59ee1 |
| tdash/src/test/ScannerPage.qa.test.jsx | review-571 | c7ea2e7f0b7652e03fbae50006ebb44bf27d1649 |
| tixmoapi2/tests/qa90-adverse.unit.test.ts | review-90 | b6e6fff664076bddc4f824bd10f26498787f068f |
