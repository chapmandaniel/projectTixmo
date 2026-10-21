# Task432 bounded source-only candidate — INCOMPLETE

Base `fcab880ea7caf50493439a21032b7a93effc438f`, isolated branch
`tixmo/task-432-two-phase-market`, worktree `worktrees/task-432`.
No real execution grant; source/stub review only. Existing424 market/API
FAIL remains unchanged, QA430 independent. This is not full-market PASS.

## Inspected / existing-solution preflight

Read assigned role/repository/team workflow, board424/427/428 including actual
`BB428-20261021-AUDIT-METADATA-ONLY`, docs successor
`d853dad3800b26e523c4d3f2dac24d25990c443d`, actual root market/verifyApi,
427 runtime/run-gate/scoped guard,379 private runtime path; inspected retained
362/424 composition descriptions. Existing npm+Node are sufficient; no new
library, service, installation, dependency or lock mutation.

## Delivered

- Extract exact12 ordered stages into shared `scripts/market-stages.mjs`;
  existing `verify-market-local.mjs` otherwise unchanged. Every npm command,
  unfiltered audit, API nested invocation, dashboard production override and
  fail-fast policy retained. Existing root runner is NOT converted to a split
  runtime and still requires its existing execution boundary.
- `scripts/market-composition.mjs`: non-CLI DI-only composition core. Exact2
  audits precede10 local stages. Closes audit adapter before local admission,
  checks source identity before/after each stage, accumulates commands/time/
  raw outputs/output hashes/versions and calls persistence on failure too.
  Tracked source/package/lock hashes plus HEAD and clean-tree requirement in
  exported snapshot helper. Missing files fail closed.
- No real executor/admission/persistence implementation supplied. Core contract
  acknowledgement is an adapter interface, NOT proof of enforcement. It never
  emits PASS, even with all stubs returning zero. No environment credentials
  or inherited environment accepted by the core.

## Actual offline checks

PASS `node docs/team/evidence/task-432/offline-stub.mjs`: compares all12 exact
original stage objects at basefcab880e (including override), proves teardown
ordering, every12 fail-fast position, source-change invalidation, missing
boundary contract denial, cleanup failure. All executors are in-memory stubs;
no service/listener/network/DB/application import. Git show is read-only.
PASS `node --check` each of market-composition.mjs, market-stages.mjs and
verify-market-local.mjs; PASS `git diff --check`.
An initial file-generation command used unavailable `python`; corrected to
existing python3 and reran actual checks above. No install performed.

## Precise remaining gaps / required continuation

This bounded candidate is a reviewable partial implementation, NOT a finished
compositional runner, runtime approval or authority-bearing wrapper.

1. Real credential/service-free audit admission must enforce only
   registry.npmjs.org HTTPS443 plus existing-resolver DNS, no arbitrary DNS,
   proxies, alternate registries or redirected destination. Fresh private HOME
   and npm config/environment provenance must exclude credentials/providers/
   DB URLs. Existing npm still runs exact unfiltered audits, no retry/bypass.
   Node hooks alone do NOT establish OS/native/subprocess isolation; an
   enforcement-capable reviewed execution boundary remains missing.
2. Real local admission must use fresh scrubbed owned DB/Redis/HTTP/private
   disk artifact contract and mandatory pre-import427 protection with no audit
   authority. Compose427 runtime/run-gate rather than merely setting marker
   variables. Current shared commands intentionally retain `npm run verify:api`:
   nested build/migrate/schema/Jest raw receipt transport must be added without
   replacing/filtering that command or weakening assertions. Compile/Jest/ALS
   native bridge, real listener ownership and cleanup remain unverified.
3. Persist the joined manifest and raw receipts immutably with verified versions
   and dependencies/generated-client provenance. Current persistence is only
   a required injected callback, not an immutable on-disk store. Add source/
   lock mutation fixtures against real snapshot helper and adapter rejection
   tests. Missing proof must remain INCOMPLETE, never become full PASS.
4. Independent lead AND QA review exact final composed SHA including427 and both
   adapters, then PM names bounded audit owner after environment verification.
   Both audits must actually PASS before separate fresh sole-runtime grant for
   all10 local stages. Partial manual commands cannot qualify verify:market.

No network/audits/build/Jest/DB/Redis/runtime/services/install/generation,
provider/spend/config/CI/scheduler/production/push/merge/deploy performed.
No default-branch changes. No full-market, parity, capacity, browser/provider
acceptance, task424 closure or launch approval claimed.

## QA433 original-author repair (source/offline only)

QA found executor-result spread could forge canonical receipt fields and audit
teardown mutation could allow one stale local stage. Replaced result spreading
with explicit status/signal/error/raw-output fields; pass a separate cloned stage
into adapter to preserve canonical command metadata. Clone captured identity.
Revalidate immediately after teardown and immediately before run after admission.
PASS extended offline-stub regressions: forged identity/commands/env/timestamps
and adapter-mutated stage args rejected as canonical receipts on all12 stages;
source mutation during either audit teardown or local admission yields exactly
zero local runs, two retained audit receipts and INCOMPLETE. Original parity,
all12 fail-fast, cleanup and invalidation stubs still PASS. Syntax and diff check
PASS. No adapters/runtime/registry/services added or run. All remaining gaps
above unchanged. Requires independent exact-successor re-review, not selfapproval.

## Persistence successor (source/offline only)

New isolated branch `tixmo/task-432-persistence`, worktree
`worktrees/task-432-persistence`, exact base
`0cdb124530272f2c7408acb0374eb4a576a8fdf4`; previous worktree and main untouched.
The earlier missing-persistence statements describe the previous checkpoint:
this successor supplies a concrete `createEvidenceStore` callback plus reader
in `scripts/market-evidence-store.mjs`. No core/stage/default-runner changes.

Existing maintained Node24.21.0/npm11.19.0 suffice: fs/crypto/Git, no dependency
or custom service. Board lookup `kanban show 443` returned no such task; no
reviewed enforceable registry/DNS boundary identified or exercised here.
Inspected existing427 run-gate nested command/stdout/stderr/Jest transport.

Store requires an existing private owned non-symlink directory outside the
candidate and a safe run ID. Exclusive mkdir reserves each run, exclusive file
writes prevent overwrite, raw UTF-8 stdout/stderr bytes are fsynced and joined
with canonical receipts/hash metadata in manifest.json. The full manifest seal
is fsynced privately then hard-linked atomically to manifest.sha256 (no clobber),
followed by directory fsync. Readers accept only sealed/hash-consistent bundles;
pre-publication failed writes deliberately leave unsealed reservations for
inspection, never reuse/overwrite them. Post-publication outcomes are specified
in the lead436 repair section below; publication is the commit point. Read-only files/run directory discourage accidental edits.
This is append-only/content-verified **application scope**, NOT filesystem
immutability against owning UID/root, authentication, WORM storage, or OS
network isolation. Owner can rewrite both data and seals; hashes alone cannot
prove authenticity. Preserve/separately trust returned manifestHash for custody.

Actual checks (offline only):

- `node docs/team/evidence/task-432/offline-disk.mjs` PASS: creates owned temporary
  Git repository with six fixture package/lock files and source; real uncommitted
  source/lock changes denied, restore matches snapshot, committed lock drift
  changes identity. Real source mutation on teardown/admission gives zero local
  commands and two retained INCOMPLETE audit-stub receipts.
- Same fixture PASS: disk-backed12-stage stub and fail-fast2-stage raw bundles,
  seal/hash verification, repeat write EEXIST, raw tamper rejection, failed hash
  write leaves unsealed bundle denied by reader, traversal run-ID rejection.
- Original `offline-stub.mjs` PASS: all12 exact-command/env parity, every failfast
  position, canonical receipt/argument protection and transition stale denial.
- `node --check scripts/market-evidence-store.mjs` and
  `node --check docs/team/evidence/task-432/offline-disk.mjs` PASS;
  `git diff --check` PASS. npm version read only, no npm execution stage.

An initial fixture assertion used async rejection for synchronous validation;
corrected to assert.throws, rerun PASS. All filesystem mutation confined to owned
new source files and temporary fixtures; cleanup only those generated fixtures.
Inherited Husky pre-commit references missing `_/husky.sh` helper (actual path
`tixmoapi2/.husky/_/husky.sh`); inspected hook, commit uses invocation-only
`core.hooksPath=/dev/null`, no config write/install/lint-staged claim.

Remaining blockers unchanged except this bounded persistence implementation:
real reviewed registry443/existingDNS admission + scrubbed config/env provenance,
fresh427 local owned DB/Redis/HTTP/artifact adapter, nested API raw receipt join,
actual verified npm/dependency/generated-client provenance. Adapter-supplied
versions remain caller claims; test npm version is explicitly a stub. The store
can retain current core receipts, not attest missing nested receipts or turn
stubs into qualification. Independent lead+QA exact successor review required;
no audit/runtime grant, full-market PASS, task432 closure or selfapproval.
QA434 is sole runtime owner separately; its services/dependencies untouched.

## Nested API transport successor — still INCOMPLETE

New isolated `tixmo/task-432-runtime-transport`, base9704866f. Existing Node
fs/crypto and reviewed379 private disk-path validator reused; no package added.
`verifyApi` now accepts an explicit optional DI `record` callback; its default
CLI and exact four nested commands/safety/scrubbing/fail-fast remain unchanged.
Raw stdout/stderr, command/cwd/start/status/signal/error are recorded before the
existing error check, including thrown spawn failures. No environment switch,
preload bypass, runtime grant marker or replacement outer npm command added.

`api-receipt-transport.mjs` supplies a concrete exclusive/fsynced private disk
writer and collector. Writer enforces four canonical commands/cwds in order;
collector verifies source identity, canonical command/cwd/index, raw hashes,
owned regular files and failure prefixes; rejects missing success receipts,
extra commands and execution after failure. Source identity is caller captured,
not an attestation; same-UID rewrite remains possible. Core can optionally call
`collectNestedApi` at exact stage5, joining its returned nested receipts into the
canonical stage receipt and the existing sealed manifest. This callback is a
trusted collector interface; use the concrete validating collector, never trust
an executor's arbitrary receipt metadata. Core remains non-qualifying.

Actual offline checks PASS:
`node docs/team/evidence/task-432/offline-nested.mjs` drives existing verifyApi
with only stubbed subprocesses, actual private disk raw NUL receipts, all four
nested failfast positions, stale identity denial, duplicate-write rejection,
raw tamper denial, core12-stage stub join and sealed-store reread. Original
`offline-stub.mjs` and `offline-disk.mjs` PASS. Syntax checks on changed modules
and diff check PASS. First nested fixture cleanup hit read-only sealed directory;
fixed owned-fixture chmod before cleanup and removed that exact generated fixture,
then reran PASS. No other runtime directory/service touched.

NOT DELIVERED: actual427 all-ten-stage local session lifecycle/preimport admission,
CLI wiring to retain exact `npm run verify:api` while installing callback and
transport into its nested process, actual verified dependency/generated-client/
runtime version provenance, or enforceable registry443/existingDNS boundary.
Standalone427 starts/stops its own services around verifyApi; invoking it as a
stage replacement would change the exact command and cannot prove all10-stage
ownership. Do not treat DI transport as a functioning runtime adapter. No audit,
network, DB, Redis, HTTP, application tests/build/install/generation/config/CI/
scheduler/cloud/spend/push/merge/deploy execution. Final exactSHA independent
lead+QA still required before separate admission; no PASS or432 closure.


## Lead436 publication commit-point repair

Read independent finding/repro a08b740157226f45b32e6492d5731dda96065dfa.
The prior blanket failed-writer/unsealed guarantee was incorrect after hardlink
publication. Seal link is now the explicit application commit point. Pre-link
errors still reject and leave unreadable/unsealed reservations. After link,
cleanup/permission/directory-fsync errors return `committed: true` plus explicit
operation/code/message `warnings`; they never reject a readable committed bundle.
`durabilityConfirmed` is true only when both post-publication directory fsyncs
succeeded. A committed bundle with false durability or warnings is not durable
completion evidence; callers must inspect and retain the returned outcome.
No rollback/reuse or owning-UID immutability guarantee is introduced. Unexpected
process death after publication can still leave a readable committed bundle; a
reader validates content, not fsync history or authenticity. Store outcomes are
not market qualification, and the composition core still never emits PASS.

Actual `offline-publication.mjs` PASS: injected link EIO rejects with no accepted
seal; injected post-link unlink, chmod and fsync EIO all return committed outcomes
with exact warnings and explicit durability, reader-valid hashes, and duplicate
reservation denial. Original offline-nested/offline-disk/offline-stub all PASS,
store/regression syntax and diff checks PASS. No runtime/network/services.
Independent lead436 fresh exact-successor review and QA438 still required.

## Caller persistence-outcome continuation (source/offline only)

From exact `f45349e422beb381ccfac419271c859df2a13e48`, composition retains the
persistence callback's full result as returned-manifest `persistence`, including
committed/warnings/durabilityConfirmed, plus an explicit `evidenceCompletion`.
Committed publication is distinguished from confirmed directory-fsync durability.
Missing/uncommitted outcomes or unconfirmed durability set caller qualification
INCOMPLETE. Warnings remain visible even when durability is confirmed; callers
must inspect them. No result emits market PASS. Failed stages/cleanup still reject
and expose the manifest/outcome on `error.evidence`. Callback rejection reports
CALLBACK_FAILED_PUBLICATION_UNKNOWN, not an unsupported unpublished guarantee;
when it supersedes an execution failure that error is retained as executionFailure.

This is a caller envelope, NOT a recursive rewrite of the already-sealed input.
A reader's sealed manifest alone does not attest post-publication warnings or
fsync history. Receiving/retaining this envelope is not crash-safe outcome storage,
authenticity, filesystem immutability, or reviewed runtime qualification.

Actual offline checks: `node docs/team/evidence/task-432/offline-caller.mjs`
passes full12 stub runs with real owned-disk prepublication link EIO and
postpublication unlink/chmod/both-directory-fsync faults, precise warnings and
durability visibility, rejected stage/cleanup outcome visibility, absent/uncommitted
callback results, unchanged sealed bytes. Existing offline-publication,
offline-stub, offline-disk and offline-nested suites pass; changed JS syntax and
`git diff --check` pass. No network/audit/runtime/application tests, DB/Redis/HTTP,
install/generation/config/CI/scheduler/cloud/spend/push/merge/deploy executed.

Task432 remains REVIEW/INCOMPLETE pending actual427 all10-stage lifecycle,
CLI callback wiring, enforced registry/DNS boundary, verified provenance and fresh
independent final lead+QA review. This caller change supplies no real adapters.

## Bounded CLI adapter successor (2026-10-21)

Exact base `b45649abb438ec791f0c37a57bb42cdcfd928abb`, new isolated branch
`tixmo/task-432-lifecycle`, worktree `worktrees/task-432-lifecycle`.
Despite branch name, this checkpoint implements CLI callback wiring ONLY, not
an all-ten-stage owned lifecycle. Existing npm/Node, verifyApi and reviewed379
private disk/432 receipt helpers suffice; no dependency or orchestration added.

`scripts/verify-api.mjs` executable entry now calls `runVerifyApiCli`. With no
`TASK432_API_RECEIPTS`, existing verification receives the same environment,
commands, safety checks, provider scrubbing, output suppression and fail-fast
behavior. Opt-in names an existing379 private0700 disk run directory containing
an owner-only regular nonsymlink `api-identity.json`: the exact JSON snapshot
from `snapshot(sourceRoot)`. Opt-in fails before verifyApi unless cwd is the
canonical script source root,427 native scope preload is present, artifact dir
matches, fresh-format run challenge exists, and npm offline/no-auto-yes options
are set. Source is checked against the full clean tracked snapshot before any
verification and after each persisted nested receipt; drift stops the sequence.
The actual CLI supplies the callback to the existing canonical raw transport.
There is no command replacement, filtering, audit bypass, install, or default
market runner change. Parent environment is not a source of authorization.

Actual PASS `node docs/team/evidence/task-432/offline-cli.mjs`: real verifyApi
with stubbed children through the adapter, all four failure positions, raw NUL
receipt roundtrip/collector, seven preflight denials before verifier invocation,
default callback-free parity, first-command source drift stops before migration,
and a real subprocess invocation of the CLI rejects missing427 preload before
verification or child execution. PASS all five prior offline suites
(`offline-stub`, `offline-disk`, `offline-nested`, `offline-publication`,
`offline-caller`), three changed JS syntax checks and `git diff --check`.
These are tooling fixtures, not application tests or runtime qualification.

OPEN:427 shell still runs its own API gate, does NOT create this identity file,
select this adapter, execute all10 local stages, or implement compose.openLocal.
A reviewed lifecycle owner must wire those pieces and create/check the identity
within its own fresh scrubbed pre-import boundary; no shell/grant/config changed.
Scope symbol, environment markers and owner-writable JSON are consistency
checks, NOT authentic runtime ownership or security attestation. The adapter
relies on the actual preloaded427/379 guards and independently verified owned
services; it cannot establish freshness or scrub credentials on its own.
Existing verifyApi target validation remains mandatory. Enforced registry443+
necessaryDNS admission is still absent; policy alone is NOT a network grant.
Dependency/generated-client/runtime-version provenance is still unverified.
No runtime/network/audit/DB/Redis/HTTP/application tests/install/generation/
shared-lock mutation/config/CI/scheduler/provider/spend/push/merge/deploy run.
This successor requires independent exactSHA lead+QA review; earlier partial
approvals do not cover it. Task432 INCOMPLETE, original424 failure retained,
no full market PASS and no closure/runtime authorization.


## Successor: concrete427 shell-to-CLI transport wiring (SOURCE/OFFLINE only)

Base92225b707a114b49c6c9f2cef361e7c8977c539b, isolated task-432-preimport.
427 runtime.sh now exclusively writes/fsyncs the clean tracked-source snapshot to
api-identity.json and opts into TASK432_API_RECEIPTS before verifier children.
427 run-gate actually calls the reviewed CLI adapter around the existing verifyApi
callback; raw stdout/stderr are piped into its canonical receipts while legacy
numbered logs, command journal, full-suite Jest JSON flags, and blocked-call check
remain. Capture is bounded to64MiB per stream; overflow is a child failure, never
PASS. This buffers rather than streams output; no unlimited-output claim.
The default root12 stages/audits and verifyApi implementation are untouched.

Actual `node docs/team/evidence/task-432/offline-shell.mjs`:10 cases PASS:
full four-command/rawNUL receipt-to-log parity, each four failure positions,
spawn throw, source drift stopping migration/incomplete collector rejection,
blocked-call failure, missing guard denial, and real shell missing-grant exit2
before any runtime creation. Fixture validator temporarily substituted solely
for private /tmp fixtures and restored; this is NOT real admission. Initial test
incorrectly expected drift's partial successful receipt to collect; actual
collector rejected it, expectation corrected and rerun PASS.
`node --check` runner and fixture, `bash -n` shell, `git diff --check`:PASS.
Older five suites are rerun separately if explicitly recorded on the board;
historical passes are not current evidence.

No genuine runtime admission is established by snapshot/env/symbol/privateJSON.
Service ownership checks remain existing427 shell behavior, not newly tested.
All10-stage lifecycle and compose.openLocal integration, genuine preimport/native
admission, enforced registryHTTPS443/existingDNS, dependency/generated-client
provenance and runtime versions remain OPEN. Snapshot occurs after service setup
but before verifier children; it does not gate service provisioning. Admission
requires independently reviewed lifecycle integration and a separate explicit
audit/runtime grant; this checkpoint grants neither. No overall432 closure,
fullmarketPASS or replacement of424 original failure. Fresh independent lead
and QA must review this exact successor;444/445 approve its parent slice only.
No network/audit/services/runtime/DB/Redis/HTTP/applicationtest/install/generation/
config/CI/scheduler/cloud/spend/push/merge/deploy executed.
