# Independent QA438 — baseline transport/publication

Reviewed immutable `f45349e422beb381ccfac419271c859df2a13e48`, cumulative diff against `9704866fd5ce034d2ce31072269c9dbd826af4db`, isolated branch `tixmo/task-438-qa` / worktree `task-438`. Evidence only; no product edits.

## Verdict

APPROVE **partial source-only transport and publication semantics**, not overall task432. Baseline caller discards persistence outcome, warnings and durability: independently reproduced; request changes remains for that known caller gap, currently owned by the original author. No approval of future successor without fresh review.

## Actual checks (all exit 0)

- `node docs/team/evidence/task-432/offline-stub.mjs`: exact12/override parity, all12 failfast positions, boundaries, cleanup, canonical identity and transition-source drift.
- `node docs/team/evidence/task-432/offline-disk.mjs`: real temporary Git source/lock mutations, seals, joined disk receipts and tampering.
- `node docs/team/evidence/task-432/offline-nested.mjs`: four nested commands, each failfast position, raw NUL transport, no-clobber, identity, tamper, disk stage5 join.
- `node docs/team/evidence/task-432/offline-publication.mjs`: before/after commit-point fault injection, postpublication warnings and durability.
- `node docs/team/evidence/task-438/adversarial.mjs`: independent 16 mutation/failure probes covering index, command, args, cwd, identity, raw hash, status, timestamp presence, missing prefix, command after failure, extra receipt, symlink/public receipt and thrown/signal/error child failures; unsafe target before spawn/callback, provider scrub and unchanged parent env; stage5-only nested join; isolated target and parent postpublication fsync faults each report committed/readable with exactly one warning and durability=false; prepublication fsync failure leaves unreadable unsealed reservation. Also deliberately confirms baseline caller discards persistence outcome.
- `node --check` on all four changed scripts; `git diff --check`.
- Empty cumulative diff for `scripts/market-stages.mjs` and `scripts/verify-market-local.mjs`; default CLI entry unchanged except optional DI record path. Existing exact four API commands preserved.

## Limits

Private disk paths are checked via existing379 validator. These are application-level canonical/content checks, not same-UID/root tamper-proof authenticity, OS isolation or crash-durability proof. Stub adapters are trusted; composition can accept forged nested data from an arbitrary callback, so approval covers the concrete collector and its use, not untrusted adapter enforcement. No actual CLI callback transport wiring,427 all10 lifecycle adapter, registry/DNS enforcement, dependency/generated-client provenance or runtime qualifications approved. No network/audit/runtime/DB/services/install/config/spend/push/merge/deploy; no fullmarket PASS or432 closure. Synthetic env strings only, no credentials read.

Initial mistaken source filename read corrected to `api-receipt-transport.mjs`; final check command's attempt to read absent `.husky/pre-commit` failed after checks had passed. No test failure was hidden.
