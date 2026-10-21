# Task408 independent serial source/document QA

2026-10-21; reviewer tixmo-qa; no author-task claim. Review branches
`tixmo/task-408-independent-qa` at406 and `tixmo/task-408-parity-review` at407;
isolated worktrees task-408 and task-408-parity. Shared main untouched.

## 406: CHANGES REQUESTED (documentation completeness)

Exact `db1b5f30a38fe3b336fdb2bf1e51c389dfcde92d`, parent
`971275ba7c87b7d6d3d8831d6334922dcf618a05`. Diff is only129 added lines in
`task-406-waitingroom-contract.md`. Parent and supplied base match.

Finding F1: the matrix says **all scanner routes** but omits PUT and DELETE
`/api/{version}/scanners/:id`, mounted at
`tixmoapi2/src/api/scanners/routes.ts:387-392,419-423`. The required route tests
parameterize the incomplete list. Add both methods, line references and explicit
no-admission assertions while preserving their auth/role/validation responses.
This is a bounded doc correction, not an invitation to rewrite middleware.

Otherwise source qualification agrees: `waitingRoom.ts:7-24,28,36-95` contains
expiring sorted-set leases, pre-acquire terminal handlers, idempotent removal,
renewal and fail-open, not historical404 permanent counter. `app.ts:55-73,103-147`
and `api/index.ts:32-66` substantiate raw webhook ordering, root exemptions,
versioned-health contention, global mounting and no separate admin router.
Orders routes11/60 and payments49-67 support target POST-only routing after
existing auth/validation. Ticket validation/check-in and auth routes checked.
`api.js:129-146`, `App.jsx:149-160` confirm generic503 event/suppression defect;
marker/body/header/jitter contract is future work, not current behavior.
Config absent/default5000 is explicitly compatibility-only, not capacity proof.
Seven lease test bodies and Redis script read, not executed. API default Jest
setup invokes database bootstrap (tests/setup.ts8-9), correctly gated.

Integration advisory: `App.jsx:281-287` renders public checkout separately from
the wildcard containing WaitingRoomView. Future UI QA must exercise actual
public checkout503 presentation, not only dispatch/listener tests. No claim
that the current view covers all public paths.

## 407: PASS (bounded documentation/tooling prerequisite only)

Exact `937889b51f234359ec7927b841b4033ea0ba8ecd`, parent
`aa422d361d13fe4715aec56e2886185200cde8e5`. Diff is only137 added lines in
`task-407-parity-tools.md`; parent and base match.

Three relative Markdown links resolve in the exact407 checkout. SHA256 of
upgrade harness and fixture match both recorded values. Read harness phases,
ledger/inventory checks and pre-seal result handling against retained391 README.
No dump/restore/new recovery DB/old-code execution or post-backup write replay
exists in current harness. Snapshots are correctly not backups; repaired fixture
and31-migration coverage are not reopened as missing. Historical391 remains
NONPARITY, not a fresh run. Future checkpoint before remaining migrations,
NEW empty recovery DB, no source overwrite, revocation/rotation disposition,
old-code compatibility and write-preserving recovery remain explicitly required.
Fresh sole-DB ownership, scrubbed synthetic loopback targets,0700 disk-backed
runtime, bounded execution and exact-owned cleanup prerequisites retained.

Independently repeated a narrow subset of read-only host probes: command-v found
only Docker/ctr among postgres/pg_dump/pg_restore/redis-server/docker/ctr;
client versions Docker29.8.2/ctr2.3.6. Selected /usr/lib/postgresql,
/usr/local/pgsql,/opt/postgresql,/opt/redis and rootless Docker locations absent.
Rootful Docker/containerd sockets0660 inaccessible; listing /var/lib/docker/image
raises PermissionError. Thus cached images UNKNOWN, not absent. Did not query a
daemon, repeat every author inventory location or inspect unrelated caches.
Acquisition/operator inventory are future scoped steps, not performed authority.

## Checks, limitations and handoff

Serial406 then407 review; git parent inspection, exact diff --stat/--check
both exit0; only their respective evidence Markdown changes. Link validation
4073/3,406 has no Markdown links. Source reads/hash/client-version/filesystem
probes exit0 (expected absent/inaccessible paths reported by handled exceptions).
No build/test/npm hook, runtime/service/DB/Redis connection, network, download,
install, provider/cloud/config/spend/merge/deploy. No runtime, parity, restore,
rollback, load, product or launch pass inferred. No change to original docs or
code. Original406/407 closure remains PM-owned;408 closes only this review.
