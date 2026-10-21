# Task327 independent QA: task321 public-event tests

Verdict: **PASS for the bounded public-test-only repair**, independently reviewed and freshly executed by `tixmo-qa` on 2026-10-21. No acceptance-blocking findings. Submit review, not done; PM owns closure/integration.

## Exact source and isolation

- Reviewed implementation: `f28a4cc986c917135764d7a73ee4d0f4b424339d`, author branch `tixmo/task-321-public-tests`.
- Complete implementation diff base: `4ec8594850eb547dafc145a14bb1b85cdeaa235c`.
- QA branch: `tixmo/task-327-independent-qa`; worktree `/home/daniel/projects/projectTixmo/worktrees/task-327`, created directly from exact implementation.
- Complete diff inspection (`git diff --stat`, `--name-only`, `--numstat`, and full two-test source diff): exactly two test files plus seven task321 evidence files. No product, schema, package/lock, default Jest config, or other tests changed. All seven evidence files inspected; JSON/log historical claims are not substituted for this run.
- Fresh dependency tree copied using `cp -a /home/daniel/projects/projectTixmo/worktrees/task-321/tixmoapi2/node_modules /home/daniel/projects/projectTixmo/worktrees/task-327/tixmoapi2/node_modules`; no install/generate or shared dependency writes. Generated index inode703157/nlink1 versus source687855/nlink1. Lock SHA256 `f530d7671524de570d43a6cf7e105cc8161f4c1be6b71a7ffc89025ee8a139da`; schema SHA256 `03544f7a5fbe613b111fcf83b0249a38cc21d15ff8427b95ff340989871ec7bb`, matching author evidence.

## Independent contract assessment

- Fixture repair matches the queried Prisma relation shape (`ticketTypes`, nested `_count.tiers`, active `tiers`). The prior reference-identity assertion was incompatible with the deliberate DTO reconstruction; exact deep DTO equality replaces it, with stronger behavior assertions rather than removing coverage.
- Unit test verifies two successive reads using distinct mocked database payloads: ticket-fresh/20 then ticket-recreated/3. Both exact Prisma queries, two reads, both returned payloads and zero Redis get/set are asserted.
- Exact query checks preserve nondeleted public statuses, ACTIVE ticket types, active-only tiers with deterministic sortOrder/id ordering, and complete configured-tier count selection.
- DTO expectations omit raw `_count`, with explicit absence checks. The configured-but-no-active-rows case uses count2 and tiers[], requiring hasConfiguredTiers=true without count or inactive-row exposure. Zero-count case requires false.
- Benchmark retains both delayed reads/timing observations and adds exact result equality, two Prisma reads and zero cache get/set assertions. Timing logs alone are not treated as a correctness oracle or performance SLA.
- Read the unchanged `src/api/events/service.ts` method: it performs fresh findFirst, strips `_count`, maps count presence to a boolean and has no cache use. No product/assertion weakening, skips or disabled tests were introduced.

## Fresh execution and exact commands

Inspected `docs/team/evidence/task-321/run.sh`, its network guard and Jest override, ordinary Jest config and integration setup before execution. Both selected suites mock Prisma/Redis. The override removes shared setup that otherwise invokes database bootstrap; it does not weaken default integration verification. Runner clears inherited environment via env-i, supplies no database/provider credentials, preloads denial hooks for net/TLS/HTTP/HTTPS/fetch, and rejects caught network attempts through the log-file check.

Executed from QA worktree root:

```bash
bash docs/team/evidence/task-321/run.sh
```

Exit **0**, fresh Jest startTime `1792570626569` (2026-10-21T08:17:06.569Z). **2 suites passed / 3 tests passed / 0 failed / 0 pending / 0 todo**; zero snapshots. Jest duration4.926s. Benchmark observations50.91ms/50.09ms are synthetic delay observations only. No `docs/team/evidence/task-321/blocked-network.jsonl` created (`test ! -e ...` exit0).

Fresh output preserved verbatim as task327 `jest-result.json` and `jest.log`. Runner writes task321 output paths; after copying those fresh outputs here, restored only those two generated files to exact implementation with:

```bash
cp docs/team/evidence/task-321/jest-result.json docs/team/evidence/task-327/jest-result.json
cp docs/team/evidence/task-321/jest.log docs/team/evidence/task-327/jest.log
git restore --source=f28a4cc986c917135764d7a73ee4d0f4b424339d -- docs/team/evidence/task-321/jest-result.json docs/team/evidence/task-321/jest.log
```

`git diff --check 4ec85948 f28a4cc` exit0. Final evidence whitespace/source-preservation checks recorded at handoff. Private ignored dependency/cache files remain local for reproducibility; no service or process remains from this completed Jest run.

## Limits

Mocked unit/query-contract evidence, not a real Prisma/database filtering proof, full API/build gate, end-to-end checkout, live environment, provider test or performance claim. Environment warnings for absent DB/auth variables and local email jsonTransport are expected under scrubbed test configuration. No DB/service starts or mutations, network/provider calls, spend, deployment or merge. Backend322 retained sole DB ownership. Other task318 findings are not resolved by this review.
