# Lead455 independent source/offline review — REQUEST_CHANGES

Candidate `54d55c0b75ced9b87871607d00fbd767a4a63962` versus
`d2e0dbdfea93e4f6e4a21fdf4e4c0201611acce7`, NEW isolated task-455 worktree
and branch `tixmo/task-455-lead-review`. Four-file successor reviewed. Role,
repository/team instructions previously read this session;455 and actual432
notes inspected; claim455 only. Author files unchanged, own evidence only.

## Blocking canonical command TOCTOU

In `scripts/market-local-session.mjs`, `run(step)` validates caller-provided
step against canonical steps before `await assertOwnedRuntime()`, but later
executes properties of the SAME mutable object after the await. A caller can
change step.command, step.args or environment while authority is pending, and
source rechecks do not detect this in-memory mutation. Independent probe starts
with a genuine structuredClone of canonical steps[2], pauses authority, changes
command/args to unreviewed values, releases authority and observes those exact
unreviewed values sent to spawn. Thus the exact-ten execution contract is not
maintained even though initial validation and source checks pass.

Original author should capture an internal canonical command/args/environment
snapshot before first await (not execute the caller object), use the internal
snapshot throughout execution, and regress adversarial mutation while the
callback is pending. Fresh exact successor QA+lead review required. No reviewer
repair applied. Imported mutable steps table is also not a security boundary;
this finding requires only a caller-owned cloned step, not mutation of globals.

## Actual checks

`node docs/team/evidence/task-455/probes.mjs`: exit0, **18 counted independent
checks PASS plus1 reproduced canonical-execution defect and1 alias observation**,
retained results.txt. Exact10 order and NUL+Unicode stdout/stderr, build-only
production override, all10 failfast positions, source denial before/after
awaited authority and authority rejection with zero children PASS. Concurrent
run and close during active authority denied; simultaneous closes clean once;
run after close denied. Static shell capture precedes runtime prepare; source
recheck and exclusive publication/fsync precede initdb. Exact source comparison
confirms default root runner and twelve-step table unchanged.

Mutable raw receipt observation: injected spawn adapter returns Buffers; returned
receipt aliases its mutable stdout Buffer, so adapter mutation changes the
receipt. NOT a standalone default-path blocker: actual spawnSync is explicitly
utf8 and returns immutable strings. If arbitrary adapter buffers are supported,
copy/normalize them on receipt; otherwise document/reject unsupported types.
Default-path rawNUL and Unicode retention passed.

`node docs/team/evidence/task-432/offline-local-session.mjs`: exit0,
author-results.txt. `node --check` on local-session and independent probes,
`bash -n docs/team/evidence/task-427/runtime.sh`, `git diff --check`: exit0.
One execution each; no initial probe failures. Independent spawn is a recording
stub only, not application or shell command execution. Git diff subprocess only
reads source. Shell ordering is static evidence, not actual provisioning.

## Scope limitations

No compose.openLocal/full432 acceptance, runtime grant, native admission or
network enforcement approved. Executor intentionally exposes no admission
contract and is not wired to full shell ten-stage lifecycle. Enforced lifecycle
and owned/native preimport admission, registry443/DNS boundary, installed/
generated/native/runtime provenance remain open; source snapshots alone are
not native containment. No use of blocked448 helper, no services or runtime
fixtures, no app/Jest/DB/Redis/HTTP/network/install/generation/config/scheduler/
cloud/provider/spend/push/merge/deploy. Default12/unfiltered audits unchanged;
original424 failure not waived. Report-only commit uses invocation-local
identity/hooksPath for previously inspected missing Husky helper; no persistent
config change or lint-staged claim.
