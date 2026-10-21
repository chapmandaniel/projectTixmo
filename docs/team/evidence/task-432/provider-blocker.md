# Task432: concrete427 provider extraction blocked, source-only checkpoint

Inspected exact base `f9c42c5ddf3b4825c40c6a3d7b8c20f8004c6abd` and actual
lead464 `fc7ea3fe3552f5accb6bc3630d58036d96f1d946` / QA465
`287445b3e094e9b2c1785acb27f00124fccf6a81` reports. New isolated branch
`tixmo/task-432-provider-checkpoint`. No runtime implementation changed.

## Source-backed blocker, not an authorization request

- `scripts/market-local-phase.mjs:10` rejects absent acquisition before source
  capture/provisioning. Lines17 and24-32 show acquisition precedes the returned
  runtime verifiers: any real provider must itself perform genuine admission
  and dependency/generated-client provenance checks BEFORE provisioning. Adding
  callable verifiers after acquisition cannot satisfy that prerequisite.
- `docs/team/evidence/task-427/runtime.sh:3-10` implements a grant marker and
  environment scrub, not native network admission or provenance verification.
  Lines19-23 capture source, and115-123 exclusively publish it; neither checks
  installed dependencies/generated client or establishes native isolation.
- The same shell provisions at125-137, then verifies PG/Redis executable/PID
  ownership and exact loopback listeners at130-160. Existing45-108 owns bounded
  cleanup/traps; these should be retained, not replaced with marker assertions.
  Ownership cannot be asserted for services before they exist; pre-provision
  admission and post-provision service identity are distinct requirements.
- Lines178 and185 install a Node guard and run one full API gate. The shell has
  no ready/session/close handoff for all ten local stages. Running it as the
  bridge's acquire callback would run nested API commands prematurely and
  clean services on shell exit. It is not a safe acquisition implementation.
- `docs/team/evidence/task-427/run-gate.mjs:11-28` already preserves the nested
  CLI/raw receipt adapter. Reuse it for the API stage; it is not a provider.
- `docs/team/evidence/task-379/runtime-path.cjs:6-28` supplies actual private
  owned disk validation. This is reusable but not admission or provenance.

This is missing implementation/evidence, not merely missing permission. No
claim is made that native enforcement is impossible. Read-only executable
discovery found `/usr/bin/unshare`, `/usr/bin/nsenter`, `/usr/bin/setpriv` and
`/usr/bin/timeout`; `bwrap` was not found on PATH. No namespaces were entered,
capabilities tested, or enforcement inferred from executable availability.
No new orchestration dependency is justified by this inspection.

## Smallest viable next implementation slice

Preserve the legacy shell default and extract its existing owned cleanup and
service identity operations into an inert, explicitly sourced helper first,
with command-injection fixtures for PID reuse/foreign executable/listener and
partial-start cleanup failures. Then expose a shell-held ready/close session
that retains ownership/traps while the existing exact-ten executor runs.
Do not connect that session to `acquire` until pre-provision native admission
and installed/generated/runtime provenance have a reviewed implementation
and evidence source. Default absent proof must remain denial, not a boolean,
grant marker, successful callback invocation or Node preload claim. A helper
extraction alone would not establish admission or make task432 runtime-ready.
This bounded turn deliberately commits the precise blocker rather than an
unverified shell protocol or another adapter scaffold.

## Actual offline checks

All exit0 on this unchanged source base:

- `node docs/team/evidence/task-432/offline-local-phase.mjs`: missing provider,
  boolean denial, native/provenance/source rejection with cleanup, revoked
  authority zero children, exact12/all10 failfast and once-only cleanup PASS.
- `node docs/team/evidence/task-432/offline-local-session.mjs`: exact10,
  overrides/rawNUL/all10failfast, admission/source/order/closed/preprovision
  ordering and all10 in-flight command mutation regressions PASS.
- `node docs/team/evidence/task-432/offline-stub.mjs`: exact12/default parity,
  all12failfast, canonical receipt forgery/source transition denials PASS.
- `bash -n docs/team/evidence/task-427/runtime.sh`; `git diff --check`: PASS.

All application spawn callbacks in these suites are inert. The parity probe
reads Git source; no application, Jest, services, DB/Redis/HTTP, network,
audits, install, generation, config, scheduler, cloud, spend, push, merge or
deployment ran. All prior probes and exact12/default/nested4/unfiltered audits
are unchanged. Task448 helpers untouched. Task432 stays REVIEW/INCOMPLETE;
real427 provider/native admission/registry-DNS/provenance remain open.
Original424 FAIL retained; no fullmarketPASS or runtime grant. Fresh independent
review may assess this documentation checkpoint, not approve absent machinery.
