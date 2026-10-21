# Independent QA445: CLI receipt source checkpoint

Verdict: **APPROVE scoped SOURCE/OFFLINE CLI callback wiring only**, exact `92225b707a114b49c6c9f2cef361e7c8977c539b` against `b45649abb438ec791f0c37a57bb42cdcfd928abb`. No new blocking defect found in this four-file delta. This is not overall task432 acceptance or a runtime grant.

New isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-445`, branch `tixmo/task-445-independent-qa`. Only this evidence directory is reviewer-owned. Read role/repository/team workflow, task445/444 and current432 notes, plus actual lead444 immutable report `afecc89be05f32fa2366d2ad88ae661792f38d8c`; did not reuse lead probes. Existing built-in Node assertions/spawn/Git suffice; no dependencies/install or custom service needed.

## Actual commands and results

- `node docs/team/evidence/task-445/probes.mjs`: exit0, **22 independent cases PASS, 0 failures**, run twice; second output retained in results.txt. Actual adapter, verifyApi and transport/collector execute with stubbed children. No application child commands execute.
- `node --check scripts/verify-api-cli.mjs`: exit0.
- `node --check scripts/verify-api.mjs`: exit0.
- `git diff --check`: exit0.

Probe groups: byte-identical parent/current verifyApi function body and default original env reference/no callback option; success plus all four failure positions (canonical command/argument order, counts4/1/2/3/4); raw NUL/newline/Unicode stdout and NUL/CRLF stderr exact roundtrip; provider marker scrub/synthetic Stripe fallback/unchanged parent; synchronous child throw becomes one status-1 receipt; source drift before verifier and after each command causes exactly0/1/2/3/4 child attempts; seven preflight denials produce no verifier callback; unsafe identity file permission and symlink denied; real executable subprocess invalid runtime path exits1 with Invalid runtime location and empty stdout.

Fixture boundary: the task379 runtime-path validator is substituted only in this probe's module cache with a temporary-directory-only validator, restored in finally. Tests use owned /tmp fixtures with injected snapshot/guard consistency values. This is an explicit fixture-only substitution, NOT evidence of passing real admission. Final real-executable negative test uses the original validator in a separate process. No runtime directories or services created. Author offline-cli suite was inspected, not run because it creates task379 runtime-path fixtures. Five older suites not rerun: this delta does not change composition/store implementations. No historical pass represented as current.

## Assessment and limitations

Executable dynamically imports runVerifyApiCli and passes real verifyApi. Default function body unchanged. Opt-in path/cwd/preload-symbol/offline-flag/challenge/artifact/private-identity checks precede verifier; source snapshot before execution and after each persisted receipt fails closed mechanically. Persistence errors propagate. Root twelve stages/audits/core/store unchanged by exact four-file diff. Probe source-drift test uses injected snapshots, not actual tracked-file mutation; actual real snapshot enforcement was inspected, not newly runtime-qualified.

Scope symbol/env/private owner JSON identity consistency is **not attestation**: it proves neither authentic preload, fresh process/service ownership, effective credential scrub nor isolation. These probes do not bind dependencies, generated clients, or runtime versions and do not prove protection against transient mutate/revert or same-UID adversaries. Raw strings preserved as exercised; arbitrary invalid UTF-8 process bytes are outside this string-based verifier contract.

**All ten lifecycle/core admission, real427 shell wiring, enforced registryHTTPS443/necessary existing-resolver DNS, and verified dependency/generated-client provenance remain OPEN. Parent432 NOT closable, no fullmarketPASS, no actual audit/runtime qualification. Original424 failure retained.** Scoped lead444 approval does not change this.

No product/author edits, services/runtime/DB/Redis/HTTP/network/install/generation/config/spend/push/merge/deploy. Only local tooling subprocesses and synthetic fixtures. Evidence-only commit uses invocation-only Git identity and hooksPath override for inherited missing Husky helper; no persistent config or lint-staged result claimed.
