# Task391 retained populated upgrade: bounded LOCAL NONPARITY PASS

2026-10-21; tixmo-release; exact reviewed source
`28b403252555ba9917e482cfbcd5d287c57afa47` (lead386 a6f8d074, QA387 d0c0a7ff).
Isolated `tixmo/task-391-upgrade-runtime`, worktrees/task-391. Evidence-only changes.
PM sole disposable runtime grant on391 was checked against actual process metadata:
no prior task379/390/Jest live, prior recorded PIDs3222581/3222594 absent and ports
38212/57257 not listening. Historical unrecorded transient HTTP cleanup is NOT proven.
Unrelated Oct6 PG7071/7502 and Redis7194/7620 were neither connected nor touched.
Read role/repo/team instructions,371/373/377/384 contracts and390 cleanup notes.
Reused existing reviewed migration harness and installed stack, no custom product
framework or source repair. Runner adapted inspected task278 service ownership and
cleanup; network guard copied byte-for-byte from reviewed task379, not modified.

## Actual execution and consumer verdict

Outer invocation (from task391 worktree):

```
TASK391_SCRUBBED=0 timeout --signal=TERM --kill-after=12s 170s bash /home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-391/runtime.sh > /home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-391/outer.log 2>&1
```

Runner immediately reexecutes env-i with HOME and fixed Node24 PATH only; all
DB/provider credentials inherited from parent were discarded, no .env loaded.
Synthetic user tixmo391, explicit fresh loopback tixmo_test_391 database; test reset
guard unchanged. Private runtime `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-391/run.aVUlMz`
and retained parent0700, ext4 disk backing inspected with findmnt, not /tmp.
TMPDIR points inside this run. NODE_OPTIONS preloads inspected Node guard permitting
only exact owned IPv4 PG/Redis ports, forbidding other TCP/Unix/UDP. This guards Node
network calls, NOT a subprocess/kernel sandbox: native Prisma subprocesses receive
only the explicit synthetic local DB target. No provider credentials/calls. Test mail
uses jsonTransport, observed in output. Missing JWT/session variable warning retained;
no auth/session HTTP acceptance claimed. No real credential read or stored.

Actual inner commands are retained in runtime.sh: initdb/trust synthetic cluster;
pg_ctl start; Redis foreground; PID/executable/PGdata/Redis parent and exclusive
loopback listener ownership checks BEFORE any DB connection; createdb fresh;
`timeout --signal=TERM --kill-after=5s 60s node scripts/build.cjs` in tixmoapi2;
`timeout --signal=TERM --kill-after=5s 75s node scripts/verify-payment-upgrade.cjs`.
Build exit0, harness exit0, outer cleanup exit0, outer process exit0; separate durable
*-exit.txt and terminal logs are committed. Harness start/end timestamps retained;
these tiny fixture timings are NOT RTO/RPO. No full API/Jest rerun.

Harness applied first26 migrations and inert synthetic prior-schema fixture, then
all five remaining migrations. Before ledger26, after31, exact source checksums
verified; all8 tickets' inventory state/tier, all5 type totals/available/status, all6
tier limits/sold/held passed, including unchanged reconciliation counters. Legacy
identity/money/history preserved; account disable/session revocation fields, transfer
credential rotation and used-ticket preservation, generation bigint0, historical
currency/receipt/payment amount assertions passed. Checkout runtime rejects exhausted
known tier and ambiguous/unmatched/inconsistent reconciliation cases. These are the
actual harness assertions, not new HTTP/security regression or failure injection.

`result.json` has passed:null, verificationPassed:true, phase:complete and explicitly
unconfirmed finalization. It is PRE-finalization and NEVER standalone success.
Here success additionally requires AND has separately captured actual harness exit0,
post-seal terminal `Populated upgrade passed: ...`, outer exit0, correct artifact
hashes/modes and owned runtime cleanup. No invented fault injection or crash/WORM proof.

## Provenance, retention and cleanup

Installed PostgreSQL18.6, Redis8.0.5, Node24.21.0 are recorded in outer.log.
Required PG17/Redis8.2.10 unavailable: this is NONPARITY only, not full245 acceptance.
Existing task354 node_modules reused by local untracked symlink; no install/download,
Prisma generate, dependency replacement or persistent config change. package-lock
byte-identical to installed donor; generated Prisma schema whitespace-normalized
identical to task source. Source/schema/lock/generated schema/client JS SHA256 in
provenance.json; harness includes source/fixture SHA and migration source hashes.
API compiled from THIS source with existing build.cjs, bypassing npm build's generate
step deliberately to avoid shared generated-client mutation. Build exit0 retained.

Retained runtime files0400 and finalized child0500 were checked; parent0700. Before,
after, provenance, migration sources and pre-finalization result copied byte-exactly
into retained/ here for review; Git does not preserve runtime read-only modes. All
result artifact hashes match; SHA256SUMS covers raw captured artifacts. Originals
remain privately on disk with DB data/logs. Not whole DB dumps or WORM storage.

Owned PG3234779:34722 and Redis3234792:57178 stopped using inspected identity-bound
cleanup. Postcheck independently observed both /proc PIDs absent, owned ports closed,
postmaster.pid and owned PG sockets absent, no task391 process rows. Cleanup exit0
and output retained. No services intentionally left live. Unrelated services preserved.

Full245 remains OPEN/NO-GO: PG17/Redis8.2.10 parity, dump/separate-new-DB restore,
old-code compatibility, write-preserving rollback, operational timing and broader
API auth/QR/session acceptance NOT RUN. No cloud/target/provider/install/config/
scheduler/spend/push/merge/deploy. Evidence submitted REVIEW, independent QA next cycle.
Commit uses command-local synthetic identity/hooksPath=/dev/null; hooks NOT RUN;
explicit diff check run separately. No persistent Git config changed.

Initial committed diff check found an extra terminal blank line in generated postcheck.txt; trimmed it, refreshed hashes, and reran exact committed diff check. Raw harness/outer output unchanged. PM independently confirmed both owned PIDs absent and ports closed (supplemental check, not independent QA acceptance).
