# Task 286 independent QA

2026-10-21. QA branch `tixmo/task-286-independent-qa`, isolated task-286 worktree; evidence base `5947e4737410c6ed732230eb84581dcb87f8ed83`. No product edits.

## Task 283 verdict: scoped PASS

Exact source `68eb4db523c4054001104c27cb2a0725bfc84906`, separately checked out at review-286-283. Read preparation, qualifier, launcher and official Ubuntu manifest before execution. Verified all 13 cached archives against manifest SHA256 and apt SHA512 and dpkg package/version/architecture/dependency metadata. URLs are official Ubuntu HTTPS; author resolved configured apt metadata, QA did not independently refresh repository signatures. Independently extracted all pinned archives into QA runtime and byte-compared every regular file to the read-only reused private task283 extraction. Browser cached1243 SHA256 ded93a9c9a53a1ae040f08124badcca95c938e9d5015ff340c3b5538c41bf39e verified before launching. Dependency closure ldd no missing ELF.

Copied qualifier only changes root/output/profile runtime and cache-library references, preserving original launcher and original assertions. QA owns runtime/task-286-browser; no author evidence overwritten. `python3 docs/team/evidence/task-286/browser-qualify.py` exit0, version153.0.8010.12, actual JavaScript loopback rendered DOM, reserved external .invalid fetch BLOCKED, browser exit0; PID/group, server and profile cleanup PASS. Application-level dead proxy/exact127.0.0.1 bypass/wildcard DNS failure only; NOT kernel isolation. No new unshare attempt. Fontconfig/GPU warnings retained, no raster/sandbox guarantee. Original hardcoded qualifier is not a concurrent-safe reusable general runner; explicit QA copy avoids its output ownership collision.

## Task 284 verdict: scoped PASS

Exact evidence/source candidate `5947e4737410c6ed732230eb84581dcb87f8ed83`; tested harness `4cae9eb99b29714e190aa09ae5a6993cad51425b`; original full manifest hashcheck PASS. Product base `4ec8594850eb547dafc145a14bb1b85cdeaa235c` unchanged. Author PG2653729/Redis2653742 and38929/59768 absent before new runtime. QA soleDB owner.

Read runtime, ownership/cleanup, fail-closed target guard, schema/test setup and test before execution. Adapted runner only task runtime root and artifact output; leaves original synthetic DB/user fixture names unchanged. Fresh0700 ext4 `/home/daniel/projects/projectTixmo/runtime/task-286-race/run.QVCG2N`; env-i explicit loopback owned PG18/Redis, 130PG max connections,105real Prisma pool,5s pool/statement/lock deadlines. No inherited credentials. Existing task271 dependencies temporarily symlinked, then removed. Commands:

```
sha256sum -c docs/team/evidence/task-284-local-race/source-sha256.txt
bash -n docs/team/evidence/task-286/race-runtime.sh
bash docs/team/evidence/task-286/race-runtime.sh > docs/team/evidence/task-286/race/runtime.log 2>&1
```

All exit0;31fresh realPG migrations, Jest1/1PASS6.838s. Exactly100actual OrderService calls:10success90soldout/no other errors, observed69realPG lockwaiters. Stock available0/held10/sold0;10orders10tickets, unique barcodes/order/buyers, successful orders match HELD tickets; orders PENDING no payment intent. Aggregate duplicate-line3>2 cap and invalid promo after-decrement full rollback PASS. Race1193.864ms, latencies min136.875/p50676.562/p951171.635/p991188.845/max1193.350ms. Full individual outcomes retained in summary and acceptance log. Timings are observed fixture contention, NOT capacity SLA/throughput.

Independent cleanup: PG2658680/Redis2658693 stopped,27600/47103 absent; postmaster/socket absent; no HTTP listener started. Browser2658573 absent, profile removed. SoleDB released. Logs trailing-whitespace-normalized only after completion for repository checks.

## Limits

Direct service actual Postgres reservation proof, not HTTP/rate-limit/real Redis behavior (global mocks)/payment/fulfillment/webhook/email/Stripe/staging/device/500–1000 sessions/30orders per second. Synthetic browser only, not actual App route/screenshot acceptance. Full App and full W09 launch NO-GO remain open. No host install/config/sudo/Gateway, provider/env-secret/external targets, spend, push, merge or deploy.
