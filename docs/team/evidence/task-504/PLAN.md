# Task 504: current-main / local-onsale integration inventory

## Exact scope and result

Base main: `ebfbce7dc697effa8e359006c7e71bfe61ff2c6a`. Local source checkpoint: `5526991b45eb8cf93eeda23205f8341b5637ae90`.
Common ancestor: `0d193a6e8f8180d509f5cfdbb793203904047237`.
Branch: `tixmo/task-504-main-reconciliation`; isolated worktree: `/home/daniel/projects/projectTixmo/worktrees/task-504`.

Source-only audit, not a product composition, test pass, independent approval, or launch acceptance. No application import, runtime, services, installs, network, provider, config, scheduler, publication or deployment action.

Existing Git facilities are sufficient: `git diff`, `git log`, and non-checkout-mutating `git merge-tree --write-tree`. No framework or new runner is needed.

## Findings

Three-way preview exits 1 with **35 conflicted files**; exact stage blobs and conflict messages are preserved in `merge-tree.txt`. There are 324 paths changed on both sides since the ancestor, 66 main-only changed paths and 243 local-only changed paths. Overlap does not imply conflict or lost fixes.

Main has customer event storefront, festival navigation and later typography/admission refinements absent from local. Keep main as integration base. Never replace main with the local tree or apply a local-to-main whole-tree diff. Main also has durable payment-attempt admission and modernized race assertions: conflict-free application is not semantic acceptance.

## Product commit inventory (chronological local-only, non-merge)

The following commits touch application source/Prisma. Each full SHA and file set is in inventory.json. This is a mechanical source classification, not a claim that every commit has exact-SHA independent approval. Obtain original board review receipts before composing. Tests carried within these commits stay with their behavior.

- `0b4e30dccbc77d1213ca4f14ff34982f17c1d42c` — fix(orders): intersect event and ticket sale windows
- `825e38d2a4a43f11bc2f8a10e24b9a8f032aadd7` — fix(studio): preserve ticket windows and total inventory on edit
- `3ddfbf871329dc37f99c6597ead7f564a7868ecf` — fix(checkout): update advisory eligibility across sale boundaries
- `eee5fa0dc5d097b65fbd5c48881b9dd97f3e1d58` — fix(checkout): preserve public tier schedule and ordering contract
- `78f07ae565031353c3999634f9abd9c75b528164` — fix(wallet): recover expired sessions without repurchasing
- `3b510ae07694e014b5a9a8fadc5fd7d628f4cf8a` — fix(auth): preserve wallet recovery through App session expiry
- `c69168cf83698e30889ea6607f9f589fe25e2946` — fix(receipt): link trusted authenticated ticket wallet
- `acc801da083ccc257fb640cd04c6a80157ee52ca` — Enforce manual reconciliation for late-paid exceptions
- `56080a0f57f27e12290efabbfe9d2664e5c672ea` — Rotate failed refund recovery with durable bounded cooldown
- `4ec8594850eb547dafc145a14bb1b85cdeaa235c` — Rotate webhook retrieval failures with fenced durable cooldown
- `fa7fe109959f415b8f83e1ff3e01b68db61416ad` — fix: preserve public cancellation stale-payment precondition under lock
- `bc3384cf316c9efa86fc9510d6a905cd032fd52a` — fix(refunds): preserve observed request payment state before effects
- `5db04d61406b6e46e3993cf5b459115456e944e2` — fix: prepare UTC-normalized paid-sales bounds and SQL regressions
- `b46fd6490bcb4def2023ee883290c568c74fd134` — fix: isolate waiting room admission to validated checkout writes
- `4dde80623f21272f011fed3ff05c9ebb86bfb071` — fix: retain checkout state during marked busy feedback
- `434bb2fda62ab0d9645896e2020e8a96202ee612` — feat: prepare source-only atomic event sales pause control
- `913b90d67d88b3b29876ed37de3e56701c8b149d` — feat: prepare scoped organizer sales pause and checkout UI
- `6ab827bff6fdf67283b93f16612106f2217d4dc0` — fix: synchronize sales control and safely recover rejected requests

The remaining **31 local-only non-merge commits** touch only tests/docs/tooling: fully enumerated in inventory.json, including sales-pause SQL source preparation and HTTP100 transport guards. They are not all disposable: keep relevant regression assertions, but do not bulk-import historical harness/evidence branches or block product integration on unneeded harness repairs. The inventory covers the named checkpoint, not every branch in the repository. Task499 successor remains separately owned and excluded.

## Proposed exact file ownership and serial integration sequence

Assignments below are a handoff plan, not new claims or delegation. Parent231 owns orchestration and publication; existing499 remains exclusively backend-owned. Board startup showed doing231/moosey and504/tixmo-lead;499 is review with parent-confirmed active source continuation, so it was not reclaimed.

1. **Backend, next bounded integration task:** new branch from exact main above. First compose event/ticket sale-window intersection `0b4e30dc`, then payment lifecycle `acc801da`, `56080a0f`, `4ec85948`, stale cancellation `fa7fe109` and refund observation `bc3384cf`, plus UTC reporting `5db04d61`, in that dependency order. Own `tixmoapi2/src/api/orders/{controller,service}.ts`, `tixmoapi2/src/api/payments/service.ts` and their directly related tests. Inspect original review receipts, retain main durable-attempt binding (281d61d0) and existing generation/tenant fences; resolve only these product boundaries first. Do not touch499 or replace unrelated main API/security code. One commit per understood behavior group; stop on unresolved financial semantics and return a precise finding.
2. **Frontend, after backend contract freeze:** own `tdash/src/App.jsx`, `pages/CheckoutPage.jsx`, `features/EventStudio.jsx` and directly relevant lib/test paths. Port `825e38d2`, `3ddfbf87`, `eee5fa0d`, `78f07ae5`, `3b510ae0`, `c69168cf` preserving main EventOnSalePage/FestivalPage routes, store/checkout query contract, typography and purchase navigation. No whole-file ours/theirs resolution. Main-only storefront files should remain byte-identical unless an explicit regression requires a separately reviewed change.
3. **Backend then frontend, serial shared contract:** checkout admission `b46fd649` then retained busy UI `4dde8062`; dedicated sales-pause API `434bb2fd` then UI `913b90d6` and synchronization repair `6ab827bf`. Own waitingRoom/app/order/payment/event routes and scoped tests on backend; App/Checkout/ECC and salesPause helpers on frontend. Preserve validated-checkout-only admission, webhook/scanner/auth exemptions, manual late-paid behavior and safe authenticated recovery. Sales-pause prepared SQL sources `2a3de901`, `9fb2cdf4`, `5526991b` are unexecuted acceptance preparation, not qualified product behavior.
4. **Release tooling separately, if needed:** `scripts/verify-api.mjs` and `tdash/Dockerfile` conflicts belong to release/parent, not backend/frontend. Preserve main hosted-verifier output handling, deployment/seed safeguards and workflow. Do not introduce task-local runtime guards into ordinary CI solely because they exist on local branches.
5. **Independent lead + QA:** review exact composed SHA against both inputs, inventory each selected/omitted local behavior and retained assertion. Parent231 alone pushes/opens PR/merges after required reviews. Never treat earlier local approval or hosted main results as acceptance for this composition.

## Exact conflict inventory

- `scripts/verify-api.mjs`
- `tdash/Dockerfile`
- `tdash/src/App.jsx`
- `tdash/src/pages/CheckoutPage.jsx`
- `tixmoapi2/src/api/orders/controller.ts`
- `tixmoapi2/src/api/orders/service.ts`
- `tixmoapi2/src/api/payments/service.ts`
- `tixmoapi2/tests/integration/order-confirm-cancel.race.test.ts`
- `tixmoapi2/tests/integration/order-confirm-expiry.race.test.ts`
- `tixmoapi2/tests/integration/order-double-cancel.race.test.ts`
- `tixmoapi2/tests/integration/order-double-confirm.race.test.ts`
- `tixmoapi2/tests/integration/order-double-refund.race.test.ts`
- `tixmoapi2/tests/integration/payment-admission-aba.test.ts`
- `tixmoapi2/tests/integration/payment-competing-claims.test.ts`
- `tixmoapi2/tests/integration/payment-cutoff-overflow.test.ts`
- `tixmoapi2/tests/integration/payment-distinct-failure-prelock.test.ts`
- `tixmoapi2/tests/integration/payment-distinct-success.race.test.ts`
- `tixmoapi2/tests/integration/payment-expired-candidate.test.ts`
- `tixmoapi2/tests/integration/payment-expired-successor.test.ts`
- `tixmoapi2/tests/integration/payment-failed-retry.race.test.ts`
- `tixmoapi2/tests/integration/payment-failed-successor.test.ts`
- `tixmoapi2/tests/integration/payment-fenced-checkpoint.test.ts`
- `tixmoapi2/tests/integration/payment-handler-ownership.test.ts`
- `tixmoapi2/tests/integration/payment-old-processing.baseline.test.ts`
- `tixmoapi2/tests/integration/payment-paused-owner.baseline.test.ts`
- `tixmoapi2/tests/integration/payment-prelock-missing-intent.test.ts`
- `tixmoapi2/tests/integration/payment-sequential-generation.test.ts`
- `tixmoapi2/tests/integration/payments_retry.test.ts`
- `tixmoapi2/tests/orders-aggregate-limit.unit.test.ts`
- `tixmoapi2/tests/orders-recovery.unit.test.ts`
- `tixmoapi2/tests/orders-tenant.unit.test.ts`
- `tixmoapi2/tests/setup.ts`
- `tixmoapi2/tests/unit/payments.prepare.test.ts`
- `tixmoapi2/tests/unit/payments.webhook-recovery.test.ts`
- `tixmoapi2/tests/unit/payments.webhook-signature.test.ts`

## Checks performed and missing acceptance

- Actual: git status/worktree inventory before isolation; merge-base; both side commit logs and source-path diffs; full non-mutating merge-tree preview (exit1 expected, 35 conflicts); generated exact path/commit inventory. No merge/cherry-pick applied and no product file changed.
- Main existing `.github/workflows/market-readiness-local.yml` provides job-scoped Postgres14/Redis7, Node24.21, npm ci and verify:market on PRs (parent-inspected). Reuse it for ordinary integrated baseline validation rather than importing a new custom runner. PG17/Redis8.2 parity is a separate unproven gate.
- Main PR67 reportedly records prior application87bbad0 hosted full-market run39527401260 and233 frontend tests (parent-provided historical evidence, not rerun here). It does not qualify any new composition.
- Missing: exact-source original review receipt validation, conflict resolutions, financial/tenant/route semantic review, targeted frontend tests/design guard/build, API build and safe disposable DB regression gates, full existing CI on final exact SHA, storefront browser acceptance, real last-ten HTTP and remaining246/load requirements, provider/target/manual and launch gates. No source-only audit satisfies these.
