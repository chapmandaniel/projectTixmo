# Task192 paused-owner fixture repair

Branch `tixmo/task-192-paused-owner-fixture`; isolated `worktrees/task-192`.
Exact base `e245579998b81309e3b6ebb1efc9633111b0b421` (source7574eea), accepted diagnosis185 independently reviewed by QA188 `b66a4079a77e3d76cf842308710df0987200bdb1`. No task184/186 changes included.

## Assertion parity and scope

Only implementation file: `tixmoapi2/tests/integration/payment-paused-owner.baseline.test.ts`. Existing Jest/deferred/race and local BigInt replacer patterns suffice; no dependency required.

- Real admission is still awaited and returned unchanged; exact `{eventId,generation:1n}` replaces obsolete boolean assertion. No ownership/count fabrication.
- Barrier races real A completion/rejection so admission assertion failures propagate promptly. Immediate allSettled drain and nested-finally release/drain/spy restoration remain; cleanup tail byte-identical, 5000ms bound and 15000ms test deadline unchanged.
- All three signed schedules remain. Paused gen1 PROCESSING has null terminal timestamp and valid processing timestamp. Before-handler/fresh retains PENDING/PROCESSING, inventory6/4/0, email0; before-finish is already PAID/SUCCEEDED, inventory6/2/2, email1.
- Fresh B full snapshot equals beforeB, gen1; released A completes once. Expired B must produce gen2 PROCESSED PAID/SUCCEEDED, inventory6/2/2, email1, valid refreshed processing and terminal timestamps. Before-finish full business snapshot is unchanged (only event excluded). Before-handler must fulfill once.
- Full afterB versus released-stale-A equality is unconditional in expired phases. Original final order/tickets/unrelated buyer/inventory/ticket4/event1/email1 assertions preserved, with explicit generation. Native BigInts retained in assertions; local diagnostic replacer only.
- Historical environment conditional baseline equality and optional RED are replaced with unconditional phase-specific enabled recovery oracles, not skipped. Assertion call sites increase14 to40; count alone is not semantic proof.
- Separate actual B-PROCESSING stale success/failure/zero-row suite `payment-expired-successor.test.ts` is untouched, as are product, schema, dependencies, configs, manifests, locks and historical reports.

## Actual checks and limitations

All executed in task192 isolated checkout, static/mock-only:

1. `git diff --check`: exit0.
2. Inline Node `node:assert/strict` mock: original rejected A error identity propagates immediately through same Promise.race construction; allSettled drains; local BigInt JSON is exact decimal string while original generation remains1n. Exit0. No product imports or DB.
3. Inline Python source assertions: finally cleanup tail byte-identical to base; 5000/15000 deadlines unchanged; obsolete mode switch absent; implementation diff fixture-only; assertion sites14 ->40. Exit0.
4. `git diff e245579 -- tixmoapi2/src tixmoapi2/prisma tixmoapi2/package.json tixmoapi2/package-lock.json package.json package-lock.json tixmoapi2/tests/integration/payment-expired-successor.test.ts`: empty, exit0.

No TypeScript compiler found on PATH or at inspected main/task192 dependency paths. No build/typecheck/Jest/integration/full-market run, DB, services, dependency installation or runtime grant. Initial worktree command ran in wrong repository and failed invalid reference without mutation; corrected explicitly to project main. Existing shared-main untracked files preserved. No SQL-green inference, no product readiness claim. Independent exact-SHA lead and QA review, then separately authorized fresh guarded disposable SQL verification, are required before PM closure; task192 stays REVIEW and175/177 remain nonpassing/unmerged/undeployed.
