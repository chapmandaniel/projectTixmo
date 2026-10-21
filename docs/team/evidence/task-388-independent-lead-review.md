# Task 388 independent lead review

Verdict: **APPROVE - source preparation only**.
Reviewed exact `b0d749d6962f75d6daee2836a4605e505daf4556` against
`929355653b2b37ae50633e704eb2a2628e5e4967`: complete five-file diff,
full HTTP test/runner/guard/preflight helper, Redis acquisition implementation,
and task379 README repair receipt; read385/379/382/383 board findings.
Reviewer tixmo-lead, 2026-10-21. Isolated branch
`tixmo/task-388-independent-review`, worktree `worktrees/task-388`.

No blocking source findings. Previous382/383 findings addressed:

- Guard recognizes the already-normalized Node connect vector rather than
  re-normalizing it; actual options must have exact127.0.0.1/allowed port and
  no path property. Original argument vector/callback forwarded unchanged.
  UDP rejected. This is Node-only defense, NOT subprocess containment.
- Redis/app/listen acquisition is under try/finally coverage; listen errors
  reject. Redis disconnect attempted even when connect fails before assignment.
  Monitor rejection handler attaches immediately, records original error and
  stops pump/arrivals; failure is surfaced after active requests drain.
- Partial/cleanup artifact, cancellations, leases, server close, Redis and
  Prisma each have contained attempts. Rejected cleanup does not skip later
  attempts, and original setup/measurement failure wins over cleanup errors.
  Outer runner deadlines remain essential for non-settling operations; source
  review does not prove service/client shutdown under timeouts.
- Preflight checks ancestors type/UID/nonwritability/no symlinks, strict owned
  0700 runtime/task/run nodes, realpath and disk-fs allowlist before service
  start; test repeats it before Redis. Existing parents are not chmodded.
  Logs use unique private run child with umask077, not fixed source paths.
  Filesystem allowlist is a preflight, not hardware/crash durability or
  protection against concurrent same-UID replacement.
- Independent source comparison confirms measurement assertions byte-identical:
  exact100GET200/100POST201/200total, max30active, unique pending orders and
  HELD ticket barcodes, stock0/100/0, latency thresholds. Cancellation restores
  100/0/0 and lease-zero checks retained, alongside actual HTTP/JWT/realRedis,
  scheduled30pairs/sec, metrics and monitor sources.

Actual checks, all exit0:
- `bash -n docs/team/evidence/task-379/runtime.sh`
- `node --check docs/team/evidence/task-379/network-guard.cjs`
- `node --check docs/team/evidence/task-379/runtime-path.cjs`
- `git diff --check 929355653b2b37ae50633e704eb2a2628e5e4967 b0d749d6962f75d6daee2836a4605e505daf4556`
- Python text-only exact measurement-assertion equality, setup/monitor/cleanup
  source presence and path-preflight-before-service ordering.

NO helper/guard/harness behavior, compiler/Jest, DB/services/network,
install/download, env/secrets, config/Gateway/scheduler/provider/spend,
push/merge/deploy. Hooks NOTRUN (command-local flags). Runtime behavior,
TypeScript compatibility and full246 acceptance remain UNVERIFIED/OPEN.
Independent QA and PM implementation closure still required; no runtime grant
inferred. Fresh soleDB grant and runtime safeguards required before execution.
