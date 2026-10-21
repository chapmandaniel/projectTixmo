# QA452 exact repaired checkpoint — REQUEST_CHANGES

Candidate `f28753c035489effa018b41abd346c0ce8a6f84d` versus
`f8f54a476ed171fdc8b9c307aa1316c8113cdc52`. New isolated branch
`tixmo/task-452-independent-qa`, worktree `worktrees/task-452`.
Read actual452/448 notes, exact repair delta and updated RUNNER-CHECKPOINT;
reused independent451 evidence `be94cf2fc9548b497068318939fb1685aa7c1e85`.
No implementation changes.

## Verdict and remaining finding

Previous close-handler overwrite is repaired **in memory**: real ENOENT Error
message/code/syscall/path survive close and simultaneous injected evidence-write
failure. Numeric port aliases/equal values now correctly fail before native guard.

**Remaining required repair: original diagnostic is not serializable.** Actual
`JSON.parse(JSON.stringify(report))` inside writeEvidence loses Error.message
(and stack, non-enumerable Error properties). Serialized error contains only
errno/code/syscall/path/spawnargs. Thus original message cannot survive normal
JSON evidence storage despite surviving in memory. Retain an explicit plain
serializable diagnostic containing original message, code, syscall, path (and
stack if intended), alongside primary close code/signal and separate evidence
error. Test round-trip serialized output plus evidence failure, not only Error
property access. Original author448 should repair; no runtime integration implied.

## Actual results

`node docs/team/evidence/task-452/probes.cjs`: exit0, **22 counted independent
checks PASS**, plus separate in-memory repair assertion PASS and one deterministic
serialized-message defect reproduction. Two executions passed: initial run had
19 counted checks; final added three pre-native-guard alias/equal denials and
retained final results.txt. Real owned cooperative TERM and stubborn SIGKILL
children timed out and were directly reaped,/proc absent before teardown;
consumed authority reuse and foreign live PID denied without signalling it.
Original exit37/stderr preserved with injected ENOSPC. Real ENOENT followed by
close preserves memory diagnostic plus evidence failure, JSON message absent.
Preload/malformed/range/duplicate/alias port denials pass; fixture successful
preflight installs native guard, which synchronously denies nonowned TCP/UDP
without making socket calls. All owned direct children reaped.

`node docs/team/evidence/task-426/runner-probes.cjs`: exit0, author real two-process
cooperative timeout/order/foreignPID/originalexit+stderr/evidence failure and
repaired ENOENT/ports cases PASS (author-results.txt). Three node --check commands
(preflight, process-cleanup, reviewer probe), git diff --check: exit0.

Preflight success and port branch use narrowly substituted provenance/path,
restored in finally; this is fixture testing, NOT genuine admission. Native
guard installed only within short-lived probe process. No app/Jest, services,
DB/Redis/HTTP, network, installation, config, spend, push, merge or deployment.

Full escaped-tree/setsid containment/adoption/reaping, scrubbed shell/env-i and
preJest integration, bounded teardown and shell exit mapping, immutable
source/dependency TOCTOU and426 observer/service identities remain unfinished.
No448/426 closure, runtime approval or exhaustive provenance claim. Report-only
commit uses invocation-only identity/hooksPath due previously-inspected missing
Husky helper; no persistent config change/lint-staged claim.
