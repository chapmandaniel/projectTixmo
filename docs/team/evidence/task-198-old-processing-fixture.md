# Task198 legacy-seed old-processing fixture repair

Branch `tixmo/task-198-old-processing-fixture`, isolated `worktrees/task-198`.
Exact base `8909a2420fb15ff35b2abb86248b4f6bba4af2ae`; diagnosis195 independently approved by QA197 evidence `10478a3116fccd32602575f33d16f649c41745c4`. Existing candidate fixture/snapshot patterns suffice; no library or custom harness added.

## Scoped repair

Only implementation file: `tixmoapi2/tests/integration/payment-old-processing.baseline.test.ts`.

- Seed create statement is byte-identical: generation deliberately omitted, schema default0n. Before/fresh native0n; ancient takeover native1n, not2n.
- Before snapshot rereads complete event, both orders with ordered tickets, inventory, scoped ticket/event counts and email baseline. PROCESSING/PENDING, null error/terminal time, finite original processing time,6/4/0,4tickets/1event/0email asserted.
- Fresh signed delivery preserves complete snapshot, including timestamps, generation, unrelated buyer and tickets, counts, email. No owner invocation or private ownership mocking introduced.
- Ancient contradictory skip assertions replaced with PROCESSED1n/nullerror and refreshed valid processing/terminal timestamps. Complete event equality permits only lifecycle changes; identity/type/order/intent/createdAt remain immutable. Complete target equality permits only PAID/SUCCEEDED and updatedAt; original paymentIntent and tickets remain. Full unrelated order/tickets equal baseline.
- Complete inventory equality permits only held-2/sold+2 and updatedAt, explicitly6/4/0 to6/2/2. Available/total/other fields stable; both snapshots enforce nonnegative conservation. Four tickets, one event, exactly one mocked confirmation email.
- Second identical signed terminal redelivery compares COMPLETE post-first and repeated snapshots including every durable field/timestamp/generation/count and email1. This is observable business/email no-repeat, not an external exactly-once delivery guarantee.
- Local lossless BigInt diagnostics retained and used for repeat; native BigInt assertions. Finally restoration, afterAll disconnect,15000ms deadline unchanged. Separate paused-owner and real-successor suites untouched. No192/184 branch mixing.

## Actual checks

All checks in isolated task198 checkout; no service or database execution:

1. `cmp` API package.json and package-lock.json against existing task177: both exit0. API lock SHA256 `112131b08362bd7683a99a0a11f6a03dc5204e36e29826a3ed5735f860fba9c1` identical. Reused task177 dependencies through temporary local API node_modules symlink (removed before commit); no install/hooks/generation executed.
2. `node tixmoapi2/node_modules/typescript/bin/tsc --noEmit -p tixmoapi2/tsconfig.json`: exit0. This default config excludes tests.
3. Focused TypeScript compiler-API check: read/parse existing API tsconfig; createProgram for repaired fixture plus imported source graph, noEmit, rootDir API directory, explicit existing API node_modules/@types typeRoots and node/jest types: exit0, zero diagnostics. Initial attempt without explicit API typeRoots failed43 missing Jest globals/associated implicit-any diagnostics because invocation was from repository root; corrected checker options only, no repository config changes.
4. Inline Python source assertions: exact seed and finally/deadline parity, generation0n/1n with no2n, fresh and terminal full snapshot equality, no skip/experimental gates, fixture-only tracked source diff: exit0.
5. Inline Node assert smoke: local replacer preserves9007199254740993n as exact decimal string without changing original native bigint: exit0. No product imports/mock ownership or runtime claim.
6. `git diff --check`: exit0. Initial commit attempt failed because author identity was unset; retried with command-local role identity (no persistent config change). Product/src, schema, manifests, locks, configuration and separate fixtures unchanged from exact base; tracked deliverable is this evidence plus one fixture.

## Limitations and handoff

No Jest, SQL/integration/full-market run, DB/service access, dependency install, product build/generation, or fresh recovery reproduction performed. Runtime owner196 was not disturbed. Static/compiler checks are not SQL-green evidence. Require independent lead and QA review of exact committed SHA, then a future separately authorized fresh guarded sole-owner disposable SQL run before implementation closure. Author submits REVIEW, does not self-approve.175/177 remain nonpassing/unmerged/undeployed; no readiness or release claim, no merge/deploy.
