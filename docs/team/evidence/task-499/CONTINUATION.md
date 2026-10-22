# Task499 concrete source continuation - incomplete acceptance

Base73aa2b2a649dd64bd3d14b048212a84ec1f2d656, product base5526991b45eb8cf93eeda23205f8341b5637ae90.
Branch tixmo/task-499-source-continuation, new isolated task-499-continuation.
Read independent lead500 exact66cdae86a42a4715ff51fc44faea3c11c1df5045.

Added concrete checkout-specific qualification ownership helper, NOT a runner,
framework or HTTP acceptance claim. Reused mutable pending-set join and actual
promise-middleware continuation from426 exact510824df9e9bb7f5e57984862728b52929f7f849;
did not import its unrelated cleanup/publication dependencies or modify originals.
Adapted493 exact5526991b45eb8cf93eeda23205f8341b5637ae90 permanent uncertainty latch
and before-write inventory. Preallocation registers107 setup IDs (100 buyers,
primary org/event/type and independent foreign org/event/type/buyer). Mounted API
generates order/ticket IDs; uncertain clients require recovery by those owned
scopes, not an assumption that returned IDs are exhaustive.

Raw run() tracks actual operations. critical() is required for acquisition,
setup, snapshots, observers, cancel and close/disconnect. join() repeatedly joins
mutable work, catches work added during drainage, and permanently preserves on
unresolved work. teardown() stops new fixture admission, joins before any step,
and runs each step fail-closed; a failed/uncertain step stops later steps.
Timers detect uncertainty, never claim cancellation. Middleware work can register
during normal drain; after preservation even late settlement cannot reopen it.
Inventory is copied and retained; no cleanup or disconnect exists in helper.

Actual inert checks, after source inspection: node --check both CJS files exit0;
node docs/team/evidence/task-499/ownership-probes.cjs exit0, six PASS lines in
ownership-results.txt. Actual exported helper executes with deferred fakes:
HTTP wrapper already settled but real middleware continuation/raw close remains
unresolved; zero cleanup/disconnect, admission refused, exact IDs retained,
late settlement cannot reopen. Settled client failure/success controls permit
cleanup; settled critical observer rejection conservatively preserves. UUID
preallocation uniqueness/count checked with inert deterministic ID generator.
Whitespace checked before commit. These are ownership/helper proofs, NOT HTTP,
SQL or whole-fixture integration proof. Node builtins and this helper only.

## Remaining exact acceptance (same499)

This bounded slice does NOT include the last-ten HTTP test or installation of
instrumentation. Do not close499, label capacity PASS, or treat helper presence
as coverage of actual HTTP resources. Next source continuation must install426
catchAsync/auth/waiting/validation/limiter and detached Redis spies before app
capture; route all raw fixture/acquisition/setup/snapshot/client/server/observer/
cancel/close operations through the helper with verified lifetimes. Guard before
resources, owned real Redis before dynamic app import, owned IPv4 listener,
provider/notifications denied; no bootstrap/jobs. Server-close callback lifetime
must be tracked, not merely client response completion or close initiation.
Stop request admission and observers before terminal join without suppressing
already-admitted continuation registration; retain instrumentation on failure.

Then add opt-in non-default source using existing Jest/Supertest:100 synthetic
authenticated same-IP barrier buyers vs10 positive-price untiered units. Actual
maxInFlight start-to-settlement measured, not server concurrency inferred from
barrier. Exactly10 HTTP201 PENDING/no paymentIntent and90 HTTP400 exact message
`Not enough tickets available`;409/429/503/transport/other400 fail. Unique10
order IDs/numbers/buyers and ticket IDs/barcodes with correspondence and HELD;
stock0/10/0 then owned cancellation10/0/0; no duplicate holds; independent
foreign snapshots unchanged. Preserve originals. No generic runner or448 work.

No app imports, Jest/collection, typecheck, DB/Redis/HTTP/services/runtime/network,
install/generation/env/secrets/config/spend/push/merge/deploy. Independent exact
lead AND QA are mandatory before implementation closure; this partial helper
needs review, not approval by its author. Full246 remains OPEN. Actual runtime
needs separate reviewed admission and explicit sole disposable-target grant.
