# Task 356: scoped refund observation mock repair

Test-code SHA: `ccdab1394863c0457cdc78f2563ffe56e049af21`.
Base: `cdb41d4d3aa4ccc323a2a1cc6b04a490feafe6a6`.
Branch: `tixmo/task-356-tenant-observation`.
This evidence-only successor does not change product or test code. No test rerun
was made for evidence persistence; the JSON files are the original run outputs.

## Scope and result

Only `tixmoapi2/tests/orders-tenant.unit.test.ts` changed: the two parameterized
refund delegation cases now assert both the full original fixture as second
argument and its reference identity with `toBe(orders[0])`. No fixture fields
were added; tenant/role/foreign-organization and no-transaction assertions remain.
The real service passes the scoped observed order intact; this test does not
establish payment eligibility policy or exercise a real payment provider.

- Original-code baseline: 1 failed suite; 28 passed, 2 failed, 30 total tests;
  Jest exit 1, 4.221 seconds. Both failures are the missing second argument.
- Exact tested repair SHA above: 1 passed suite; 30 passed, 0 failed, 30 total;
  Jest exit 0, 4.036 seconds. No snapshots.
- `git diff HEAD^ HEAD --check`: exit 0; clean worktree after commit/symlink removal.

## Original execution recipe

The attached `jest.json` and `deny-network.cjs` are exact copies of the temporary
configuration and preimport guard used. Both JSON test results are exact copies.
Absolute paths in Jest config/results are original local execution metadata,
not production endpoints. Raw console logs were not copied.

From the isolated worktree, an existing matching offline dependency directory
was linked read-only in practice (no install, generation, cache, or dependency
mutation) at `tixmoapi2/node_modules`:

```sh
ln -s /home/daniel/projects/projectTixmo/worktrees/task-354/tixmoapi2/node_modules tixmoapi2/node_modules
testdir=/tmp/tixmo356-unit-kn5fnas_
env -i PATH="$PATH" HOME=/tmp NODE_ENV=test node \
  --require "$testdir/deny-network.cjs" \
  tixmoapi2/node_modules/jest/bin/jest.js \
  --config "$testdir/jest.json" --runInBand --json \
  --outputFile "$testdir/baseline.json" > "$testdir/baseline.log" 2>&1
```

The baseline command ran before the three-line test delta. The identical command
then ran with `fixed.json`/`fixed.log` output paths after the delta. No product
files changed between runs. The symlink was subsequently removed with `unlink`.
The commit used command-scoped Lead identity and `core.hooksPath=/dev/null`;
no hook pass is claimed and no Git config was edited. Initial commit attempt
failed for missing identity before that command-scoped retry.

## Isolation and limitations

Default `tests/setup.ts` was inspected and excluded because it bootstraps the
integration DB. Explicit empty setup arrays, a single test match, and `cache:false`
were used. The test mocks environment, Prisma, payments, notifications, promo and
tier services before imports. No app runtime, DB, Redis, build, full API gate,
provider request, .env/secrets, install, generation, cloud or deployment occurred.

The guard throws on Node net socket connect/server listen, TLS connect, datagram
creation and global fetch. It is an in-process accidental-network defense, not an
OS sandbox or subprocess network firewall. No subprocess was requested by the
inspected unit suite. It has no separate attempt counter: unexpected uncaught
attempts fail the run, but caught attempts would not be independently counted.
Therefore do not infer a measured zero-attempt network audit from this unit run.

Independent exact-SHA review remains required; author has not self-approved.
Task 356 is review, not done. Full API gate remains unrerun; task 325's four
historical refund-suite failures are outside this repair.
