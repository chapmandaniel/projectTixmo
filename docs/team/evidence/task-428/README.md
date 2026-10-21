# Task428: source-only market execution boundary assessment

Author: tixmo-lead; 2026-10-21. Exact inspected product source/base:
`8aae387bcd4290edd259fd75aa11baaa1f62ca63`.
Branch `tixmo/task-428-market-boundary`, isolated `worktrees/task-428`.
Documentation only; independent exact-SHA review required. No self-approval.

## Evidence and finding

Inspected root package.json, scripts/verify-market-local.mjs, verify-api.mjs,
dependency-audit-evidence.mjs, current readiness docs and CI workflow;
task379 runtime.sh, runtime-path.cjs and network-guard.cjs; task362 retained
network-guard.cjs and run-gate.mjs in worktrees/task362; and immutable task424
`21e2c8fec6f6fd7913c1c14e274b79fda964fc46` README, runtime.sh,
run-gate.mjs, network-guard.cjs, market.log and audit-blocked-network.jsonl.
These were file/Git reads only, not executions of retained scripts.

Actual script has 12 fail-fast stages, now transcribed in readiness docs.
The previous eight-stage list omitted both audits, tooling/development checks
and lint, and incorrectly counted nested API build as a separate root stage.
verify:api runs build, migrate, destructive schema bootstrap and unfiltered Jest.
Task424 raw market log records npm audit endpoint error and exit1;
blocked receipt records HTTPS registry.npmjs.org from PID3394266.
Exactly 0 PASS / 1 FAIL / 11 NOT REACHED. No advisory verdict was obtained.

Task362/424 Node preloads reject nonloopback net/TLS/http/fetch traffic and
record attempts. They are accidental Node-traffic protection, not OS/native
or subprocess network isolation. Task379 guard instead permits exact owned
IPv4-loopback DB/Redis ports plus actual registered HTTP listeners, rejects
Unix/non-owned TCP and UDP. Its runtime also requires a fresh run identity
and an owned 0700 disk artifact directory with checked ancestors/realpath.
These contracts must stay intact. Task427 independently addresses full API
composition with the HTTP runtime; task428 neither implements nor approves it.

## Minimal recommended boundary (proposal, NOT supported implementation)

Keep existing maintained npm tooling; no new library/platform is needed.
The current root runner cannot select phases or per-stage environments; running
remaining commands manually would be supplementary evidence only, not a new
successful `npm run verify:market` invocation.

Recommended bounded follow-up: author and independently review a compositional
runner that retains all 12 original ordered commands and fail-fast semantics,
with no skip switches or weakened exit/assertion/security policy:

1. Advisory phase: run the exact two unfiltered npm audit commands first in a
   separate credential-free, service-free environment approved for necessary
   npm registry HTTPS and DNS. Use the same exact candidate package/lockfiles,
   existing matching npm/dependencies, record versions/time, raw output, exits,
   and package/lock hashes. No install, audit fix, lock mutation, providers or
   DB targets. Do not pass runtime credentials, URLs or guard exemptions here.
   Fail/registry error stops qualification; do not substitute stale cached data
   or the helper's narrower `--omit=dev` policy. Advisory metadata may disclose
   dependency information to the registry, so this outbound purpose must be
   expressly within the network authorization.
2. Local phase: only after both audit commands succeed, enter a fresh scrubbed
   environment with mandatory pre-import owned-loopback guard and verified
   disposable DB/Redis/HTTP/artifact contracts. Execute all remaining 10 root
   stages unchanged; retain every nested API operation and existing test skips
   explicitly in counts. Do not carry advisory-phase network privileges into
   app/tests, or remove NODE_OPTIONS from a running DB qualification process.
3. One manifest joins both phase receipts to the same exact source, immutable
   package/lock hashes and runtime versions. Any source/lock change invalidates
   qualification. Both phases and independent review are necessary; partial
   success never becomes full-market PASS. A reviewed split implementation
   would need its own acceptance evidence before claiming equivalence.

## Operational authority and safe sequencing

Current tasks424/428 prohibit external network; no grant is inferred from a
registry requirement or existing CI configuration. PM must secure Daniel's
explicit authorization for this new outbound audit purpose (or an expressly
approved equivalent execution environment), including permitted registry/DNS
scope, dependency-metadata disclosure, no installs/spend and evidence handling.
That authorization must not authorize broad test/runtime egress. PM separately
assigns a source-only tooling implementation/review; then grants one named
release owner a bounded sole disposable DB/Redis/HTTP runtime after checking
active claims, existing ports/services and the reviewed427 composition.
No DB owner is granted by this report. Existing CI is an option to assess,
not proof: it currently has a single environment and PostgreSQL14/Redis7,
not task245 PostgreSQL17/Redis8.2.10 parity or the task379 owned-runtime contract.
Do not trigger it or modify workflow/config as an implicit workaround.

## Checks and limits

Read-only source/receipt inspection plus `git diff --check`; no network,
services, DB, runtime gates, installs, config/scheduler changes, provider calls,
spend, push, merge or deploy. Existing npm audit was evaluated before proposing
any custom orchestration; existing root command cannot meet the two required
boundaries as written. No audit PASS, product fix, runtime fix, parity, capacity,
provider/browser acceptance or launch approval is claimed. Readiness document
historical June green evidence is explicitly historical, not current health.
