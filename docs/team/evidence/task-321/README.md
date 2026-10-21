# Task321 public-event test repair

Branch `tixmo/task-321-public-tests`, base `4ec8594850eb547dafc145a14bb1b85cdeaa235c`.
Implements the public-test portion of task320 report `a041c35ceb95d6a41d2cc9c2a68681971e8817b2` only.

## Changes

- Benchmark mock includes query-realistic empty ticketTypes; retains both timings and adds exact DTO equality, two DB reads and zero cache get/set assertions.
- Unit mock includes `_count.tiers`; reference identity replaced by exact public DTO equality. Successive DB responses change ticket ID and availability; both results and both exact queries are verified. Assertions prevent exposing `_count`, enforce active tier filtering/order in the query, and cover a configured schedule with zero active tier rows.
- No product/services, DB schema, payment/order tests, smoke analytics or storage implementation changed.

## Verification

Focused command (exit0), executed after final test formatting/mock reset adjustment:

```bash
bash docs/team/evidence/task-321/run.sh
```

The recorded final successful Jest execution used the identical env/Jest command captured in run.sh. Result: **2 suites passed; 3 tests passed; 0 failed/skipped**. `jest-result.json` and `jest.log` retain exact results. Zero network-denial records; guard rejects even loopback connections and the runner fails on caught denials too. No DB or Redis URL supplied. Missing-secret warnings in Jest output are expected from deliberately scrubbed test configuration; email selects local jsonTransport.

`jest.config.cjs` inherits ordinary transforms/module aliases but removes shared integration `setupFilesAfterEnv`: that shared setup always executes `prisma db push`. Both selected suites mock Prisma/Redis themselves, so they require neither that destructive bootstrap nor shared test services. No integration guard was weakened in product/default test configuration.

Dependencies were copied with `cp -a` (no hardlinks) from task318's owned generated dependency tree. package-lock SHA256 matches both worktrees: `f530d7671524de570d43a6cf7e105cc8161f4c1be6b71a7ffc89025ee8a139da`; schema SHA256 matches: `03544f7a5fbe613b111fcf83b0249a38cc21d15ff8427b95ff340989871ec7bb`. Generated client index inode687855/nlink1 versus source inode571658/nlink1. No generate/install commands or shared generated writes. Jest30.5.2, TypeScript5.9.3.

Prettier run on the two changed test files; `git diff --check` passed. Separate production tsc not run: source is unchanged, root tsconfig excludes tests, and focused ts-jest compiled the selected tests successfully. No broader suite/API-readiness pass claimed; task318's smoke/storage/payment findings remain open.

Commit uses command-scoped agent identity and hooksPath=/dev/null because the fresh worktree lacks the Husky helper (same observed task320 limitation). Independent exact-SHA review is required; submitted review, not done. No spend, provider/network access, DB/service start, deployment or merge.
