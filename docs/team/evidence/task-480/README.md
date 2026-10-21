# QA480: scoped documentation-only APPROVE

Exact candidate `0081e61462ac7e18b1c82d8c1ac0a538d4df3bcb` versus
`fc1c24dac2ce2fd5b0eb9a8d3df5f15b9f7486e3`.
New isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-480`,
branch `tixmo/task-480-independent-qa`, based on candidate. Read task480 acceptance,
complete diff and actual native-feasibility.md/retained-shell.md/current helper.
No author edits; shared main's pre-existing untracked files preserved.

## Actual checks/results

Python3 subprocess inspection asserted `git diff --name-only BASE CANDIDATE`
contains exactly native-feasibility.md and retained-shell.md under task432.
Therefore all functional source, exact12/nested4/default refusal/unfiltered audits
and provider absence remain byte-unchanged; this is source comparison, not a new
execution pass. Direct helper checks confirmed default60, strict canonical1..300
validation, builtin timed read and timeout75. The replacement wording correctly
limits this to held-input read; earlier QA479 is not relabeled current runtime proof.

Exactly ONE independently reproduced namespace probe, argv/status/stdout/stderr
and elapsed recorded in results.json:

`/usr/bin/timeout --signal=TERM --kill-after=1s 3s /usr/bin/unshare --user --map-root-user --net -- /usr/bin/true`

Python subprocess.run(capture_output=True,text=True,timeout=5) reaped its owned
child: exit1, empty stdout, stderr exactly
`unshare: write failed /proc/self/uid_map: Operation not permitted`.
Elapsed4.8849ms. No timeout/retry/elevation/alternate identity/namespace joining,
service, socket, DNS, network traffic or host/config change. Payload only true.
Other three author probes were NOT repeated, respecting the one-probe bound.
Their reported argv use the same bounded empty payload strategy and reported
exit1/EPERM results are internally consistent. Original four raw receipts are
embedded prose, not separately retained machine logs; independent corroboration
covers only the mapped-user+network case and not their historical timings or
all host metadata values. No invented reproduction claim.

Candidate explicitly avoids universal impossibility and causal policy attribution;
observed AppArmor setting is not presented as the cause. It distinguishes wrapper
exit0 from four failed payload probes, does not infer containment from tool
presence or from a future empty-child success, and does not ask to disable host
restrictions/grant privileges. Operator-provided authorized sandbox is a scoped
next prerequisite, not proof all alternatives are impossible. Registry/DNS,
native child lifetime, provenance and owned-runtime wiring remain open.

`git diff --check` exited0 before this report and again before commit. No broad
functional suites warranted/rerun for two documentation changes. Commit uses
invocation-only identity/hooks override, no persistent config mutation or hook pass.

## Decision and limitations

APPROVE documentation accuracy/bounded checkpoint ONLY. No functional primitive,
provider/native containment, readiness/cleanup deadline, provenance, audit allowlist
or runtime admission approved. No app/DB/Redis/HTTP/services/audit/network traffic/
install/generation/config/scheduler/cloud/spend/push/merge/deploy. Original424 FAIL
retained, task432 INCOMPLETE and not closed; no fullmarketPASS/runtime grant.
Only independent review480 completed. Further functional changes require fresh
exact-SHA independent lead+QA review.
