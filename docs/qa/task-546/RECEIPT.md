# Independent QA 546: scoped approval

Reviewed exact `0dfb0badcd1cd6afc01c8047abc99622941af3d7` against
`dd15dc14369e54c67bd8f4d6a81e7ae0e7d4fb6c`. Isolated new worktree
`/home/daniel/projects/projectTixmo/worktrees/task-546`, branch
`tixmo/task-546-qa-receipt`, initially clean at reviewed SHA. No implementation edits.
Read role/team instructions, board mine/inbox/545/546/525/526 and claimed only546.
Inspected entire old and repaired SQL test plus cancellation source lines425-463.

## Commands and actual outcomes

From this worktree:

- `python3 docs/qa/task-546/static.py`: exit0. Sole changed path
  `tixmoapi2/tests/integration/order-double-cancel.race.test.ts`, +7/-2.
  Entire diff byte-identical c9c9e7f354a72c49f6885e4df31b8713d34065fe
  versus e7654ccd7b3f207df2d83da43c57323304f3c3cb. Old file equals e765;
  repaired file equals c9; SHA256
  `86153686495d1764c6a67f95b63e1ed39dc4388ce21e4fc600562527d5af0d0b`.
  All17 complete expect assertion chains/arguments byte-identical, including
  nested expect.any. Product files unchanged. Included git diff --check exit0.
- `env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin node docs/qa/task-546/model.js`:
  exit0. Independent dependency-free model reverses transaction entry [1,0].
  Both winner0 and winner1: old caller-index wait remains blocked while new
  transaction-index commit signal progresses; loser release drains all owned
  async operations. For both winners, rejecting original transaction does NOT
  signal commit; bounded wait rejects, cleanup releases loser and drains all
  async operations/wait wrappers. Failed commit deferred intentionally stays
  unresolved/passive, with no pending timer/work.
- Initial checker mistakenly counted expect.any as an additional assertion
  (18 versus17), corrected selection to expect(...) chains and reran above.
  Initial sanitized PATH had no node; used explicit existing Node24 PATH above.
  These were reviewer harness setup failures, not product failures.

## Source findings

cancelOrder awaits public observation before transaction entry, so invocation
order does not establish gate index. Spy assigns index on transaction entry.
Repair signals committed[index] only after original transaction resolves;
rejection cannot forge success. Waiting on the released winner entry therefore
orders loser release correctly regardless of caller order. Existing pending
read barriers, inverse schedules, full-row foreign hold equality, nonnegative
inventory/conservation, full-ticket equality, payment/state, both-fulfilled,
rollback and stale-state assertions remain unchanged. Immediate allSettled
handlers and finally release/drain remain intact. No scoped blocking findings.

## Limitations and handoff

SOURCE/INERT MODEL approval ONLY. No app/Jest/compiler execution, database,
Redis, HTTP, services, network/provider, installs/generation, environment-secret
inspection, persistent configuration/scheduler changes, PR/CI/push/merge/deploy
or spend. No SQL, capacity or runtime PASS. PR73 exact failed assertion was
suppressed; this does not establish the definitive cause of CI73 failure.
Historical hosted74/75 success is not hosted73 evidence. Fresh exact independent
lead approval and PM closure required; task231 retains publication, new hosted
CI and integration. No product/release gates waived.
