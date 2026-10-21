# Task432 native admission feasibility: enforced denial

Checkpoint 2026-10-21T19:03Z. New isolated branch
`tixmo/task-432-native-feasibility`, worktree
`/home/daniel/projects/projectTixmo/worktrees/task-432-native-feasibility`,
exact base `fc1c24dac2ce2fd5b0eb9a8d3df5f15b9f7486e3`.
Documentation only; this checkpoint SHA is supplied by Git/board after commit.
Task432 REVIEW/INCOMPLETE; no provider or functional code introduced.

## Existing solution and actual source review

Read provider-blocker.md, retained-shell.sh, held-timeout.md, actual
market-local-phase.mjs, task427 owned-lifecycle.sh, task379 runtime-path.cjs
and network-guard.cjs. Read actual independent lead478 report at
b2d71a49ea84c6f85bb3dcbcf21fb6548672a437 and QA465 report identity/stat at
287445b3e094e9b2c1785acb27f00124fccf6a81. QA479 independently reviews the
base this cycle; no overlap or claim of its outcome. Existing Node guard
explicitly scopes itself to Node sockets, not native descendant enforcement.
Owned disk validation, retained lifecycle and close/read deadline do not
substitute for pre-provision native admission or installed/generated provenance.
Maintained installed Linux tools are the adequate first feasibility option:
/usr/bin/unshare, /usr/bin/nsenter, /usr/bin/setpriv, /usr/bin/timeout.
No additional library, custom containment wrapper or install is justified.

## Read-only host metadata

Commands: `id -u`; `id -g` =>1000/1000.
`rg '^(Cap(Inh|Prm|Eff|Bnd|Amb)|NoNewPrivs|Seccomp|Seccomp_filters):' /proc/self/status`
=> CapInh=0000000800000000, CapPrm=0000000000000000,
CapEff=0000000000000000, CapBnd=000001ffffffffff,
CapAmb=0000000000000000, NoNewPrivs=0, Seccomp=0, Seccomp_filters=0.
`cat /proc/sys/user/max_user_namespaces /proc/sys/kernel/unprivileged_userns_clone /proc/sys/kernel/apparmor_restrict_unprivileged_userns`
=>50179,1,1 (exit0). These are observations, NOT proof of a particular denial
cause; no LSM/audit logs read and no causal attribution established.
`readlink /proc/self/ns/user /proc/self/ns/net`
=>user:[4026531837], net:[4026531833] (exit0).
`unshare --version`; `setpriv --version` =>util-linux2.41.3, both exit0.
`timeout --version` =>uutils coreutils0.10.0, exit0.
No settings/capabilities/configuration changed; no credentials or environment dump.

## Actual empty-child probes

Python3 subprocess.run(capture_output=True,text=True,timeout=5) owned/reaped each
command sequentially; each additionally has TERM3s and KILL-after1s timeout.
Payload is only /usr/bin/true: no services, sockets, DNS or network traffic.
All stdout empty; exact stderr and exit statuses:

1. `timeout --signal=TERM --kill-after=1s 3s unshare --user --map-root-user -- /usr/bin/true`
   =>1, 4.63ms: `unshare: write failed /proc/self/uid_map: Operation not permitted`
2. `timeout --signal=TERM --kill-after=1s 3s unshare --net -- /usr/bin/true`
   =>1, 4.18ms: `unshare: unshare failed: Operation not permitted`
3. `timeout --signal=TERM --kill-after=1s 3s unshare --user --map-root-user --net -- /usr/bin/true`
   =>1, 4.79ms: `unshare: write failed /proc/self/uid_map: Operation not permitted`
4. `timeout --signal=TERM --kill-after=1s 3s setpriv --no-new-privs unshare --user --map-root-user --net -- /usr/bin/true`
   =>1, 5.40ms: `unshare: write failed /proc/self/uid_map: Operation not permitted`

Wrapper exits0 because every subprocess result was collected; NONE of the four
namespace payload probes passed. No retries, elevation, alternate identity,
permission bypass, namespace joining or host namespace changes attempted.
Presence of unshare/nsenter is not enforced availability. This proves these
specific unprivileged paths are unavailable here, not universal impossibility
of native containment or a diagnosis of the exact host policy responsible.

## Concrete smallest unblock and stop

An operator-provided, separately authorized execution sandbox with demonstrated
user-mapping and private-network namespace availability (or equivalent reviewed
native process/network containment) is needed before implementing this route.
First acceptance is the SAME bounded empty-child mapped-user+network probe exit0
in that execution context, plus reviewed containment design/negative evidence;
exit0 alone would not establish correct loopback routing or deny all escape paths.
Do not disable host restrictions or grant this agent host privileges. No host
change is requested/applied by this checkpoint. Stop speculative provider code
here. Provenance, native child-tree lifetime, audit registry443/existingDNS
isolation and owned-runtime integration also remain separate open requirements.
A namespace would not alone provide the audit phase registry/DNS allowlist.

Default absent-provider denial, terminal refusal, exact12/nested4 and unfiltered
audits are byte-unchanged. Only this evidence and retained-shell.md stale timeout
wording changed. No app/Jest/DBRedisHTTP/services/audit/network/install/generation/
lock/config/scheduler/cloud/provider/production/spend/push/merge/deploy/runtime
grant. No scratch disk files. Original424 FAIL retained; no fullmarketPASS.
Documentation checkpoint needs independent review; any later functional primitive
requires fresh exact-SHA lead+QA approval, not self-approval.

## Command/result limitations

Initial source search was mistakenly in shared main: provider-blocker.md missing,
rg exit2; no writes there. Required branch was then created at exact base and
actual files read. Misnamed task379/native-guard.cjs read failed1; corrected to
network-guard.cjs. QA465 report is not present on this author branch; Git object
stat was read, not its report body. No QA465 approval inferred. Root .husky absent
(ls2); inspected existing core.hooksPath=tixmoapi2/.husky, no config write.
No repeated offline callback suites or broad runtime gates run this cycle.
