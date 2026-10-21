# Lead444 independent opt-in API CLI adapter review

Exact reviewed **92225b707a114b49c6c9f2cef361e7c8977c539b** versus **b45649abb438ec791f0c37a57bb42cdcfd928abb**. New isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-444`, branch `tixmo/task-444-independent-lead`. Read role/repository/team instructions earlier in this session, current444/432 board and new432 README/limitations; claimed444 only. Ownership: this evidence directory only, no author/product edits.

**APPROVE scoped SOURCE/OFFLINE CLI callback wiring only. No new blocking finding in this four-file delta.** Independent QA445 remains separate. This is NOT task432 acceptance or runtime authorization.

## Actual independent checks

`node docs/team/evidence/task-444/probes.mjs` exit0: **22** independent offline cases (raw output retained). Uses actual adapter, verifyApi and raw transport/collector with children stubbed; owned-path validator is explicitly replaced within this probe process with a temporary-fixture-only validator and restored finally. Fixtures are under an owned temporary directory, not tixmo-pm/runtime. This is mechanical adapter/receipt testing, NOT evidence that the real runtime admission checks passed.

- Verifier function body is byte-identical to immutable parent; callback-free adapter passes exactly the original environment object and no record option.
- Successful four-command invocation, failures at each of four positions, and synchronous child-spawn throw all preserve fail-fast counts. Actual collector reads corresponding canonical private raw receipts, including NUL output, and rejects no valid tested sequence. Four commands/args/cwds are enforced by existing canonical transport.
- Synthetic provider markers scrubbed from child env, synthetic Stripe fallback retained, parent env unchanged.
- Identity drift before verifier and after each of four recorded commands rejects, with exactly0/1/2/3/4 children respectively; no later migration/schema/test continues after detected drift.
- Wrong cwd, missing scope symbol, auto-yes enabled, offline disabled, malformed challenge and artifact-directory mismatch all reject before verifier.
- World/group-readable identity file and symlink identity reject before verifier.
- Real executable subprocess `node scripts/verify-api.mjs` with an invalid synthetic opt-in directory exits1 with Invalid runtime location. No child verifier/application process runs; no DB/Redis credentials or valid runtime paths supplied.

`node --check scripts/verify-api-cli.mjs`, `node --check scripts/verify-api.mjs`, and `git diff --check` all exit0. Initial inspection attempted nonexistent market-api-receipts filename; actual api-receipt-transport located/read, no target failure. No failing independent probe run.

Author offline-cli was inspected but not executed: it creates fixtures inside the runtime/task-379 hierarchy. This review intentionally creates no runtime directories and does not need that suite to substantiate its independent offline cases. No inherited historical green result is represented as a new run. Five older suites were not repeated because this delta does not change their composition/store implementations.

## Contract assessment and limits

Actual executable entrypoint now dynamically imports runVerifyApiCli and passes the real verifyApi callback. No opt-in means original verifier path/options; root twelve ordered stages/audits/default runner are unchanged. Opt-in checks source-root cwd, real private379 path, preload symbol, matching artifact dir, challenge format, offline npm flags and owner-only regular identity file before calling verifyApi. Actual snapshot is rooted in this script's repository and checks clean tracked/untracked state plus all tracked file hashes. Snapshot is compared before first child and after each recorded receipt. Receipt persistence precedes post-command drift check, so failure artifacts may describe a now-invalid candidate; CLI rejects and no qualification/PASS should be inferred from isolated receipt presence. Filesystem receipt publication failure still rejects rather than fabricating a durable receipt. Default provider scrub/target validation and four-command fail-fast remain unchanged.

These are consistency checks, not security attestation: a scope symbol does not authenticate preload implementation; challenge syntax does not establish freshness or bind a process; owner-writable identityJSON does not prove service ownership/credential scrubbing. Dependencies/generated-client/runtime versions are not bound by tracked source hashes. No prevention of transient change-and-revert or adversarial concurrent UID writes is claimed. Native pre-import guards and independently verified runtime remain external requirements, as new README explicitly states. The adapter imports tooling only, not product app code, before preflight; application/child execution starts only through verifyApi after these checks and existing target validation.

All ten local-stage lifecycle, compose.openLocal/core admission,427 shell identity/adapter wiring, enforced registry HTTPS443 plus necessary existing-resolver DNS, verified dependency/generated provenance, actual runtime and fresh independent QA remain OPEN. No overall432 closure/fullmarketPASS, no inferred authorization. Original424 failure remains authoritative. The branch name lifecycle does not change this narrow deliverable.

No services/runtime/DB/Redis/HTTP/network/install/product edits/config/spend/push/merge/deploy. Only synthetic offline child stubs, a failclosed tooling subprocess, and removed owned temporary fixtures. No runtime grant consumed. Evidence commit uses invocation-only identity/hooksPath override for previously documented inherited Husky helper issue; no persistent configuration change.
