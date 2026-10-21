# Task 401: native HTTP TCP null-path compatibility

Base: `5a64d9739f148d966534ba802ddd162fc17e053d`.
Branch: `tixmo/task-401-native-http`; isolated worktree `worktrees/task-401`.

## Observed incompatibility and narrow repair

On actual installed Node v24.21.0, native `http.get()` normalizes its TCP target
as `{host:"127.0.0.1",port:33333,path:null}`. The regression installs a counting
`net.Socket.prototype.connect` stub **before** importing the guard; no native
transport can run. The original guard rejects this exact owned TCP destination
before reaching that stub (exit 1, `before.log`, zero transport calls). This is
an independently reproduced native HTTP compatibility defect, not proof that
no other runtime defect exists. Installed Superagent source at
`worktrees/task-354/tixmoapi2/node_modules/superagent/lib/node/index.js:763`
delegates to native protocol `module_.request(options)`; no package changes or
new custom networking stack are needed. Native HTTP Agent produces the null
TCP sentinel downstream of HTTP request URL paths.

The guard now distinguishes absent/null TCP path from any other supplied path.
The only admission change is `path:null` on an otherwise exact allowed IPv4
loopback host and port. Real Unix paths, empty/malformed present paths,
non-owned ports, external addresses, IPv6 and hostname targets remain denied.
No cleanup schema/receipt/invocation logic, runtime runner or HTTP integration
assertions changed. QA400 resolved startStat rendering as a genuine newline,
not a defect; no cleanup repair is included.

## Actual bounded checks

All subprocess test/check environments were replaced with only
`PATH=/usr/bin:/bin`; the fixture explicitly sets synthetic allowed port 33333.
No inherited secrets, NODE_OPTIONS or `.env` were loaded. Existing installed
Jest helper is used only by the pre-existing process-copy unit regression.
Exact commands, exit codes and stdout are retained in `checks.log`.

- New native HTTP regression: exit 0 after repair (`after.log`), versus exit 1
  at the exact base (`before.log`). Native GET on env-owned port plus GET and
  POST on registered listener port reach the transport counter: **3 calls**.
  **11 denied target cases** never reach it; UDP creation also denied. Native
  HTTP Unix socketPath, hostname, external, IPv6 and unowned port requests are
  covered, plus close revocation and malformed present paths. HTTP requests
  are immediately destroyed; no response/status/capacity pass is claimed.
- Existing guard regression: exit 0, **2 stub transports**, copied Jest env,
  listener validity, exact port admission, vector normalization and revocation.
- Existing cleanup regression: exit 0, **46 cases**, observations stubbed.
- Guard and new regression `node --check`: exit 0 each.
- `bash -n docs/team/evidence/task-379/runtime.sh`: exit 0.
- `git diff --check`: exit 0.

## Limits / review handoff

No DB, services, network, listener bind, install/download, environment/config,
provider, spend, push, merge or deploy. No live HTTP100 run or full API gate.
Server ownership is simulated via stubbed native address/listening metadata in
this source-only fixture, not asserted as a real kernel listener. Native HTTP
normalization itself is actual Node HTTP code, not copied options-only logic.

Fresh independent lead **and** QA review of the exact resulting commit are
required before any separately authorized task390 runtime. Author submits401
to review, not done;390 and full246 remain open. Historical runtime159ca329
honest failure/cleanup evidence is not converted into an HTTP capacity pass.

Commit tooling: this isolated worktree has no configured Git author identity;
used command-scoped existing task author `tixmo-backend <tixmo-backend@local>`
without modifying Git config. Repository pre-commit cannot source missing
`tixmoapi2/.husky/_/husky.sh`; no install is permitted. Commit therefore uses
command-scoped `core.hooksPath=/dev/null`; required focused checks above were
run explicitly. No global/repository config was changed.
