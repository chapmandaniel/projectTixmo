# Independent QA 403 - scoped ACCEPT

Reviewed exact source `971275ba7c87b7d6d3d8831d6334922dcf618a05`, prior
`5a64d9739f148d966534ba802ddd162fc17e053d`.
Isolated branch `tixmo/review-403-native-http`, worktree
`/home/daniel/projects/projectTixmo/worktrees/review-403`.
Report-only changes: this directory. Shared main and product source unchanged.

## Verdict and actual evidence

ACCEPT this narrow source/STUB-only repair; no blocking finding. Independently
inspected the exact diff: only guard predicate gains null exemption, all other
host/port/path checks and native listener registration/revocation unchanged.
Installed Node v24.21.0 `_http_agent` explicitly sets `this.options.path = null`
to avoid pipe confusion; installed Superagent delegates `module_.request(options)`
at task-354/tixmoapi2/node_modules/superagent/lib/node/index.js:763.

Actual reruns, with subprocess environment only PATH=/usr/bin:/bin, retained
in checks.log (not copied author/lead output):

- Same native HTTP fixture compiled with exact prior guard: expected exit 1,
  observed `{host:"127.0.0.1",port:33333,path:null}`, transport calls zero.
  before.cjs retrieves prior source using read-only git show, never edits it.
- Exact reviewed native fixture: exit 0, 3 native GET/POST transports, 11
  denied targets plus UDP, close revocation. Actual Node HTTP normalization;
  transport stub installed before guard, so no native socket can connect.
- Original guard regression: exit 0, 2 stub transports, copied Jest env denial.
- Cleanup regression: exit 0, 46 stubbed receipt cases. Read cleanup source;
  invocation/root, PID/PPID/executable/startStat, cross-receipt identity and exact
  IPv4 listener checks unchanged. No signals or actual ss execution in fixture.
- Separately authored adversarial.cjs: exit 0, 27 denials and 1 null-vector
  admission. Covers fake/non-listening server, invalid native address family,
  wildcard, invalid/range/noninteger port, duplicate registration; exact owned
  IPv4 port versus hostname/IPv6/external/other loopback/unowned port; Unix and
  malformed present paths; explicit idempotent revoke, close revoke and UDP6.
  Public address override cannot substitute for captured native address method.
- Guard/new native fixture node syntax, runtime bash syntax, diff check: exit 0.

## Limits and handoff

Server address/listening metadata is deliberately stubbed: native registration
provenance logic is tested, but no real kernel listener ownership is proven here.
No sockets, listener bind, network/DNS, database, services, install, generated
product artifacts, config/environment-file change, provider/spend, push, merge
or deploy. No HTTP responses/status, 100GET+100POST success, full246 or runtime390
claim. Native path-null defect is reproduced, not asserted the exclusive cause
of every prior runtime failure. No inherited secret/environment values loaded.

PM may consider QA403 satisfied for the exact reviewed SHA alongside independent
lead402; only PM closes401. Runtime390 remains gated on a fresh explicit sole-DB
runtime grant and its actual evidence. This report does not grant that run.

Report commit uses command-scoped author and core.hooksPath=/dev/null because
repository husky helper is missing in this isolated tree; no Git config changed.
All relevant focused checks above were explicitly run.
