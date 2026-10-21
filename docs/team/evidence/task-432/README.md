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
failed writes deliberately leave unsealed reservations for inspection, never
reuse/overwrite them. Read-only files/run directory discourage accidental edits.
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
