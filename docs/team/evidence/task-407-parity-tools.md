# Task407: bounded host parity-tool inventory and restore prerequisite

2026-10-21, 13:52–13:56 UTC; tixmo-release; parent245. Source/base
`aa422d361d13fe4715aec56e2886185200cde8e5`; isolated branch
`tixmo/task-407-parity-tools`, worktree `worktrees/task-407`.
Documentation-only; no database ownership or runtime grant. This extends371's
known extracted-cache inventory to bounded standard host locations; it is NOT
an exhaustive host search and does not repeat391 as new execution evidence.

## Actual new inventory

All probes were read-only filesystem/package/client version metadata. No daemon
connection, privilege escalation, config/secret access, download or service start.

- `command -v` via `bash -c 'command -v "$1"' probe NAME`: postgres, pg_dump,
  pg_restore, redis-server, podman, nerdctl, skopeo each exit1; docker and ctr
  exit0 at `/usr/bin/docker` and `/usr/bin/ctr`.
- `/usr/bin/docker --version` exit0: Docker29.8.2 build7fc2dff.
  `/usr/bin/ctr --version` exit0: containerd2.3.6.
- Python `os.listdir`, `glob.glob`, `os.stat`, `os.access` inspected only these
  standard locations, with no recursive traversal:
  `/usr/lib/postgresql`, `/usr/local/pgsql`, `/opt/postgresql`, `/opt/pgsql`,
  `/opt/redis`, `/usr/local/redis`, `/opt/redis-stack`,
  `/usr/local/lib/postgresql`, `/home/daniel/.local/opt`, and user
  `.local/share/mise/installs/{postgres,redis}` / `.asdf/installs/{postgres,redis}`:
  all FileNotFoundError. `/usr/bin` and `/usr/local/bin` had no PG/Redis name;
  `/snap/bin` contained only hwctl; `/opt` contained only containerd.
- `/home/daniel/.local/bin` (15 entries), `/home/daniel/.cache` (12 entries),
  `/var/cache/apt/archives` (4 entries) had no names containing postgres, pgsql,
  or redis. Cache top-level names were aws-agent-setup, checkpoint-nodejs,
  claude, claude-cli-nodejs, motd.legal-displayed, ms-playwright, openclaw, pip,
  pip-tools, prisma, prisma-nodejs, uv. Contents of unrelated caches not read.
- `dpkg-query -W -f='${binary:Package} ${db:Status-Status} ${Version}\n'
  'postgresql*' 'redis*' 'docker*' 'podman*' 'containerd*'` exit1 because redis
  and podman patterns have no matches. No installed PostgreSQL/Redis package.
  postgresql-17-pllua, postgresql-15-pllua and postgresql-pgmp are explicitly
  **not-installed**, not evidence of a server. Installed Docker CE/CLI/rootless
  extras29.8.2, containerd.io2.3.6, buildx0.37.1 and compose5.6.0.
- Rootless `/run/user/1000/docker.sock`,
  `/home/daniel/.local/share/docker`,
  `/home/daniel/.local/share/containers/storage`, and rootful
  `/var/lib/containers/storage` are absent. `/var/run/docker.sock` and
  `/run/containerd/containerd.sock` exist, root-owned0660, but `os.access`
  reports neither read nor write access. `/var/lib/docker/image` and
  `/opt/containerd` return PermissionError on listing. No docker/ctr image
  query was attempted against these inaccessible sockets, no Docker config
  was read, and no daemon was started. **Rootful cached images UNKNOWN**, not
  absent. No remote contexts, sudo, permission changes or group changes.
- Narrow corroboration only: known task57 extracted-cache
  `root/usr/lib/postgresql` still lists only18. Version18.6/Redis8.0.5 remain
  historical371/391 observations, not newly executed version probes here.

**Result:** PostgreSQL17 and Redis8.2.10 not located in inspected standard host
paths. This does not prove whole-host absence, particularly inaccessible image
storage. No version substitution is authorized as parity acceptance.

## Concrete zero-spend next tooling action

First have an already-authorized host/container operator perform a bounded,
local-only **read-only image metadata** inventory on the existing daemon, e.g.
`docker --host unix:///var/run/docker.sock image ls --no-trunc`, returning only
PG17/Redis8.2.10 image tags/digests and daemon architecture. This task does NOT
authorize that operator action or permission changes. If found, pin immutable
digests and verify actual binaries/architecture in a separately authorized
disposable runtime slice; tags alone are not binary-version proof. Do not
automatically pull missing images. Existing Docker is adequate; no custom
container framework or paid platform is needed.

If none are cached, PM must explicitly scope zero-spend network acquisition of
official PG17 server+matching dump/restore tools and exact Redis8.2.10 artifacts,
verified provenance/checksums, into an owned0700 disk-backed workspace runtime.
No system install, service/config/group change or daemon start is implied.
Acquisition, licensing/architecture validation and subsequent service execution
are separate prerequisites; no acquisition was attempted here. This is an
actionable next tooling step, not a request to repeat371 or391.

## Source-backed dump/NEW restore/rollback prerequisite

Reused existing [upgrade harness](../../../scripts/verify-payment-upgrade.cjs),
[retained391 receipt](task-391/README.md), and
[backup/rollback runbook](../../DB_BACKUP_AND_MIGRATION_ROLLBACK.md).
371 is a nonancestor evidence branch: inspect using
`git show 95e62218:docs/team/evidence/task-371-upgrade-preflight.md`, not a broken
relative link. Its missing-fixture/full31 gap is now repaired; do NOT reopen it.

Current source hashes:

```
cbf92d7b41848ea6176ae164736d2d35fb8537e086ef6744c8f86ad1cb2183be  scripts/verify-payment-upgrade.cjs
9ed128fb7bfa86c13250615aeb3bd85bc49fee2f05dabfb9632470187cd43690  tixmoapi2/tests/migrations/payment-inventory-upgrade-fixture.sql
```

The harness stages26-prefix, seeds8tickets/5types/6tiers, captures selected
before rows and ledger, deploys all31, captures after rows and checks invariants.
It contains no pg_dump, pg_restore, separate recovery database creation, old-code
launch or post-backup-write replay. Its snapshots intentionally scrub fields and
are **not database backups**. Historical391 independently accepted build/harness/
outer/cleanup exits0 and31 migrations on PG18.6/Redis8.0.5; not rerun here.
`result.json` is pre-finalization; actual exit and post-seal success remain required.

Next source-only implementation should extend/reuse this harness or a reviewed
wrapper with a checkpoint **after prefix+fixture, before remaining migrations**:

1. Matching PG17 pg_dump creates a custom-format archive of the synthetic prior
   database; retain checksum, tool/server versions, ledger/source hashes,
   before-row expectations and actual start/end/exit receipts. A wrapper cannot
   safely insert this checkpoint by running the current all-in-one harness twice.
2. Upgrade source once; preserve it and subsequent synthetic writes unchanged.
   Create a separately named NEW empty recovery database, verify disposable
   loopback ownership and emptiness, then restore with
   `pg_restore --exit-on-error --single-transaction --no-owner --no-privileges`.
   Never --clean, source overwrite, inverse migration or ledger deletion.
3. Verify archive/restored row, ledger, inventory, history and credential safety;
   compare explicit post-backup order/scan/user-write deltas before any switch.
   Ambiguous stock remains fail-closed. Restored old sessions/sender QR/bootstrap
   access must not revive: reviewed revocation/rotation disposition required.
4. Select exact previous-code SHA and prove old-code/new-schema compatibility
   with API/auth/scanner/inventory checks before calling code rollback safe.
   No prior-code SHA/compatibility proof exists in this receipt. If unsafe,
   remain paused and forward-fix; do not roll back security credentials.
5. Only after independent lead+QA source review and fresh sole-DB grant: owned
   disk-backed0700 runtime under tixmo-pm/runtime (never /tmp), scrubbed env,
   explicit synthetic targets, restrictive network/PID/port checks, bounded
   commands, durable outer exit/terminal output and exact-owned cleanup proof.
   Restore durations on synthetic data are not production RTO/RPO evidence.

## Checks and limits

Source reads and hash commands above exit0. Initial guessed local371 path and
`tixmoapi2/scripts/...` path reads failed (missing files); corrected to git-show
and root `scripts/` paths. No source/runtime failure was concealed or repaired.
Documentation diff/link checks recorded at handoff. No app tests are appropriate
for this documentation-only change; no build, DB execution, tiny restore or
upgrade rerun. No install/download, daemon/service start, credentials, provider,
network, cloud, spend, config/scheduler, push, merge, deploy or messaging action.
Parent245 remains OPEN: parity, dump/NEW restore, old-code compatibility,
write-preserving rollback and operational timing are NOT RUN/NOT qualified.
