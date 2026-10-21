# Task392 independent QA: accept honest FAILURE evidence only

Reviewed author evidence commit `a085aa70eae8ae44f59d853e23b055c29dee32f8`
on exact runtime source `b0d749d6962f75d6daee2836a4605e505daf4556`.
Isolated branch `tixmo/task-392-qa`, worktree
`/home/daniel/projects/projectTixmo/worktrees/task-392`. No source modification.

## Independent checks, 2026-10-21

- Complete diff file scope: all 13 changed files are task390 documentation/logs;
  no runtime source changes. Read README, runner/acceptance/summary/cleanup/postcheck
  and source hash receipts; parsed both complete raw measurement and partial JSON.
- Byte-compared committed acceptance, migrate, initdb, Postgres, Redis logs,
  measurement.json, partial.json and cleanup.json against actual retained files in
  `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/run.XAQwvK`:
  all eight identical. Retained run directory mode is 0700.
- Both measurement and partial contain 200 results, all status0; measurement has
  exactly100 read and100 order errors `Task379 network guard rejected non-owned TCP target`.
  GET200 and POST201 counts are both zero. Arrived/completed100/100, maxActive1.
  Acceptance log shows failure at read-count assertion line110, one failed Jest test;
  migration log ends with all migrations successfully applied. Compilation/execution
  is established by Jest reaching the assertion, not a separate full API build.
  Summary records runner exit1 at12:42:34–12:42:54UTC; QA did not witness execution
  or independently recover shell exit from outside this retained receipt.
- `sha256sum -c docs/team/evidence/task-390/source-sha256.txt`: all four source
  files match. `bash -n runtime.sh` and `node --check` for both helper files exit0.
- Task390 node_modules symlink points at installed task354 dependencies. Both
  package-lock hashes match the documented f530d767...139da. Source/generated
  schema hashes match the documented 03544f7a...ec7bb and a8601e89...c3b01;
  whitespace-normalized schemas are identical. This establishes schema/lock
  provenance, not independent proof of historical package install integrity or
  absence of every shared dependency write. No generation/install by QA.
- Current `/proc/3222581` and `/proc/3222594` absent. Current
  `ss -H -ltnp 'sport = :38212 or sport = :57257'` exits0 with no rows.
  Retained run has no `pg/postmaster.pid` (recursive postmaster search also empty).
  cleanup.json contains empty cleanupErrors; source finally block includes server
  close and Redis/Prisma disconnect. Exact transient Jest PID and ephemeral HTTP
  port were not recorded: **complete process cleanup is not independently proven**.
  Interpret author's broad “No task runtime process remained” only within the
  observed service-PID/port scope, not as a complete historical process census.
- Scanned every committed artifact for private-key headers, AWS access-key IDs,
  live Stripe keys, GitHub tokens and password-bearing Postgres URLs: zero matches.
  Inspected source uses synthetic fixtures. No real secret value identified;
  pattern scanning cannot establish universal absence of every possible secret.

## Concrete original-backend repair handoff (hypothesis, not proven root cause)

`runtime.sh:150–151` supplies only PG/Redis allowed ports and preloads network guard
via NODE_OPTIONS. `network-guard.cjs:9–11` reads its realm's process.env on every
connect, requiring exact127.0.0.1 host and an explicitly allowed port.
`orders-http-pressure.local.test.ts:46–52` listens on an ephemeral127.0.0.1 HTTP
port, then appends that port to the test's process.env. Installed
`jest-util/build/index.js:170–218,244,716` constructs a proxy backed by a copied env
and replaces the test global process with a copied process object. Thus updating
Jest's env may not update the native process.env read by the preloaded guard.
This source-backed boundary mismatch is a strong candidate, but current artifacts
omit rejected normalized options, native/test allowed lists and actual HTTP port;
no instrumented or synthetic proof was run, and other rejected-option differences
are not excluded.

Return repair to original backend (#393): prove the native-vs-Jest registration
boundary with bounded non-network diagnostics; make exact owned listener registration
visible to the guard without general loopback allowance, guard removal, swallowed
rejections, or weakened assertions. Record transient HTTP/Jest identities and exact
cleanup observations. Fresh exact-SHA lead+QA review and a new sole-owner runtime
grant are prerequisites to a bounded rerun.

## Verdict and limits

**ACCEPT as honest failed-run evidence, NOT runtime qualification or capacity PASS.**
No100 HELD orders, unique pending orders/tickets or100 cancellations were proven.
Restoration100/0/0 with zero created orders is not cancellation-load acceptance.
Guard-rejection timings/maxActive1 are not valid HTTP service measurements.
PG18.6/Redis8.0.5 remain nonparity, not245 parity or production evidence.
Task390 and full246 remain OPEN. QA392 is documentation/evidence review only.
No services, DB connections/rerun, downloads, install, generation, source repair,
config edits, provider/cloud calls, push, merge, deploy or spend by this reviewer.
