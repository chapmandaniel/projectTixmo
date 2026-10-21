# QA456 — REQUEST_CHANGES, cumulative source/offline scope

Candidate `d6ad958ce3bda5659ad7c347a014dd78146b9640` cumulative versus
`d2e0dbdfea93e4f6e4a21fdf4e4c0201611acce7`. NEW isolated worktree task-456,
branch `tixmo/task-456-independent-qa`. Read role/repository/team instructions,
456/432/455/457 board notes and actual immutable lead reports 9e38b894 and
dc9d15c3. Claimed456 only. No author source edits; evidence files only.

## Blocking shell artifact-directory initialization ordering

`docs/team/evidence/task-427/runtime.sh` moves source identity publication before
initdb but still uses `process.env.TASK379_ARTIFACT_DIR + "/api-identity.json"`.
The variable is exported only much later, AFTER initdb, PostgreSQL, Redis,
createdb and target validation. The mandatory env-i scrub does not retain this
variable. Thus a normal fresh invocation cannot publish identity and exits
before provisioning with ENOENT `undefined/api-identity.json`. This is not a
native-admission concern: the new shell source wiring itself is nonfunctional.

Independent `probes.mjs` extracts the actual publication inline Node code and
runs it via Node in an empty temporary directory, supplying ONLY
TASK432_SOURCE_IDENTITY and TASK432_API_RECEIPTS in the child environment.
Only the snapshot import is replaced by a deterministic fixture because this
check isolates publication and does not provision or require a clean runtime
candidate. Actual fs.openSync/write/fsync code is unmodified. Observed status1
and ENOENT undefined/api-identity.json; asserted the late shell export ordering.
The temporary directory was removed after remaining empty. No inherited
TASK379_ARTIFACT_DIR masked this failure. No runtime.sh granted invocation.

Original author should bind publication to the already validated owned run
path before this block (or initialize the artifact variable before use), keep
exclusive/fsynced publication and source recheck before provisioning, and add
a fresh scrubbed-env offline regression. Fresh exact-SHA cumulative QA required.
No reviewer repair, no automatic acceptance based on static ordering alone.

## Actual checks

- `node docs/team/evidence/task-456/probes.mjs` exit0: **29 counted independent
  checks PASS plus 1 reproduced blocker**, retained results.txt. ALL TEN stages:
  paused authority, caller command/in-place args/environment mutation AND
  imported table command/args/environment mutation, parent env mutation;
  private canonical command/args/environment remain pinned; raw NUL/Unicode
  stdout/stderr preserved and shell:false/utf8 checked. Imported fixture values
  restored. Build-only NODE_ENV production isolated. All10 failfast positions;
  pre/postauthority source drift and authority rejection zero-child denials;
  concurrent run/close denial, one-shot concurrent cleanup, postclose denial;
  error despite status0, signal despite status0, spawn throw all fail closed.
- Exact Git source comparison to d2e0dbdf confirms root default runner,
  twelve-stage table, nested four-stage verifyApi and 427 run-gate unchanged.
  Shell source capture precedes prepare; exclusive fsync publication precedes
  initdb statically, but the concrete publication defect above blocks operation.
- `node docs/team/evidence/task-432/offline-local-session.mjs` exit0;
  author-results.txt. Existing suite misses the new publication environment bug.
- `node --check scripts/market-local-session.mjs`, `node --check
  docs/team/evidence/task-456/probes.mjs`, `bash -n
  docs/team/evidence/task-427/runtime.sh`, `git diff --check`: exit0.
- `env -i PATH=/usr/bin:/bin bash docs/team/evidence/task-427/runtime.sh` exit2,
  missing-grant.txt: denied before runtime activity.

Each check executed once, no failed test-harness runs. Executor spawn recording
stubs only, not application execution; Git reads and isolated inline Node
publication fixture are the only child actions of the independent probe.

455 command TOCTOU is repaired within the helper. No new helper blocker found.
Prior injected Buffer alias observation remains outside default utf8-string
path; not a newly accepted binary adapter contract. Preconstruction malicious
module-table mutation is not authenticated by this helper.

## Boundaries

REQUEST_CHANGES for this cumulative shell checkpoint, not an approval of
compose.openLocal, native/OS admission, lifecycle wiring, registry443/DNS,
installed/generated/native/runtime provenance or full432 acceptance.432 remains
INCOMPLETE; original424 failure is not waived. No runtime grant, app/Jest,
services, DB/Redis/HTTP/network/install/generation/config/scheduler/cloud/spend/
push/merge/deploy. No448 helper consumed; foreign processes untouched.
Report-only commit uses invocation-local Git identity and hooksPath=/dev/null
because inspected inherited tixmoapi2/.husky/pre-commit sources a missing
_/husky.sh; no config write or lint-staged claim.
