# Independent QA292: scoped PostgreSQL recovery PASS

Exact reviewed author evidence commit `adc81d94f8ec5d9b50ac025cabdf4fb535611da0`, exact tested harness `08f96af42cb88d094450293f48881c792ac0e2d5`, unchanged product `4ec8594850eb547dafc145a14bb1b85cdeaa235c`. Separate branch tixmo/review-292-pg. Inspected runtime, guards, setup, imports, provider mock, notification throwing proxy, real selection/claim/CAS/fence/process code before run. Full134-file author source hash manifest verified before/after (hash-check.log), relevant source diff from tested harness empty. API lockfile matches existing task271 dependency cache. No product/test assertions changed.

Fresh commands exit0:

```sh
bash -n docs/team/evidence/task-292-pg/runtime.sh
bash docs/team/evidence/task-292-pg/runtime.sh > docs/team/evidence/task-292-pg/runtime.log 2>&1
sha256sum -c docs/team/evidence/task-291-webhook-pg/source-sha256.txt
```

Independent soleDB owner, after author PID2677268/2677301 and35172/51228 absence verified; browser run completed/cleaned first. env-i explicit fixture-only credentials; new0700 disk runtime `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-292-pg/run.ibTvNz`, PG18 exactPID2684003 loopback30696 and RedisPID2684016 loopback57652/DB1. Original runner adapted only task-owned runtime/artifact/fixture naming.31 real migrations; Jest3/3 PASS in6.022s. Durable actual SQL snapshots in acceptance.log.

Actual assertions: first50 oldest poison rows retried/rotated with owned reason60s cooldown without changing gen7/status/lease; reconstructed service instance progresses healthy51 to PROCESSED/gen1; duplicate cannot finish twice. SQL-age just1 poison61s retries only that1. Concurrent actualSQL claims admit1/gen1; SQL-age lease301s permits gen2 takeover, stale completion and effect callback fenced. Provider retrieval race's stale SQL CAS preserves competitor's completed newer state. Real Prisma/query/transaction/process path, no DB mocking. Unsupported synthetic event deliberately invokes no financial handler; provider constructor/retrieval stub only, notifications forbidden. Redis readiness real but application Redis mocked by global setup.

First attempt output path typo in reviewer-only adapter stopped before migration/test; failure retained runtime-path-adaptation-failure.log, ownedPID2683482/2683495 and29711/46693 cleaned before one corrected rerun. Final runner exit0 and independently verified both own runs PID/listener/postmaster/socket cleanup, modes0700; independent-cleanup.txt. Dependency symlink removed. Author artifacts untouched.

PASS SQL fairness/cooldown eligibility/generation/claim/stale-CAS/fence slice only. NOT financial exactly-once, signed ingress, actual provider, real notification, HTTP/backend ownership, process crash/restart (only service reconstruction), real elapsed60s cooldown, outage/staging acceptance. No production/provider/email/secret/network targets/spend/config/push/merge/deploy. Full W04/W05/Stripe/inbox/staging/device launch NO-GO remains.
