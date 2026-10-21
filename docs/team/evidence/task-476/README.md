# QA476 independent scoped APPROVE: direct-child evidence

Exact843f0245eed7567350185190f85a6aefe60ecbef versus
4a265fb957cfc760d4c985c55a0190ee4517671b. NEW isolated task-476 worktree,
branch tixmo/task-476-qa-review, based on exact candidate. Claimed476; read448,
476, exact diff/checkpoint and actual cleanup/status/runner/shell fixtures.
Candidate changes only runner-probes.cjs and RUNNER-CHECKPOINT.md; no helper,
qualification, runtime refusal or application assertions changed.

SOURCE/OFFLINE scoped APPROVE of stubborn DIRECT-child evidence ONLY.
Independent own check.cjs launches two real owned detached direct children,
not author fixtures: one successful evidence callback and one injected evidence
failure. Both install a TERM-ignoring handler before private PID-bound READY,
record actual TERM delivery, and require SIGKILL after55ms timeout/200ms grace.
Both synthetic callbacks independently assert observed close, SIGKILL signal,
direct /proc PID absence, original process-group absence and matching TERM
receipt. Exact callback order teardown then evidence is asserted, bounded<2s.
Copied full live record and copied live child/identity are independently denied
before callbacks or TERM receipt. One-shot reuse denied after real completion.
Both primary null/SIGKILL results survive JSON and map137; successful evidence
and ENOSPC secondary failure distinguished. Outer run harness asserts both
unique inherited primary stderr sentinels occur exactly once despite failure.
All own children reaped; fixture finalizer signals only its own child if needed.

## Commands and actual results

`TMPDIR=/home/daniel/.openclaw/workspace/tixmo-pm/runtime/qa476-disk node docs/team/evidence/task-476/run.cjs`

Six exact commands in results.json all exit0: independent two-child probe,
author runner-probes, existing shell-probes, own and author Node syntax,
git diff --check. stdout/stderr separately retained, including expected injected
secondary error. Author runner suite is regression evidence, not substituted
for independent own proof. Repeated complete run passed; no observed failures.
First complete run used default os.tmpdir (/tmp); final TWO complete runs used
explicit TMPDIR above. Final logs/environment.json correspond to explicit path.
Parent path0700; own per-case directories0700 and ready files0600 asserted.
Read-only findmnt identifies backing root ext4 /dev/nvme0n1p2; filesystem.txt
records observation. Per-case temporary directories removed after reaping.
Existing shell probe uses its own fixed task426 private fixture path, not TMPDIR.

## Limits

Direct-child/group proof only, not arbitrary escaped-tree containment, descendant
adoption/subreaping, immutable generated/native dependencies, TOCTOU prevention,
observer/service identities, or admitted shell/pre-Jest integration. Async waits
are not cancellation and do not prevent late callback effects. No app/Jest,
DB/Redis/HTTP/services/network/audits/install/generation/config/scheduler/cloud/
spend/push/merge/deploy/runtime grant. No author implementation edits.448/426
remain OPEN; no full-runner acceptance, runtime qualification or closure.
