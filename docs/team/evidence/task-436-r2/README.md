# Lead436 fresh review - APPROVE scoped store-contract repair

Exact successor **f45349e422beb381ccfac419271c859df2a13e48** compared with
parent **50bf4bb42646f51e61435bd647de5018db9e5e37**, new isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-436-r2`, branch
`tixmo/task-436-rereview`. Only the earlier436 publication-failure finding is
re-reviewed. This does NOT review or approve nested transport50bf4bb4 or432.

## Repair accepted

Seal hardlink is now an explicit application publication commit point. Before
publication, write/fsync/link errors reject and leave no accepted sealed bundle.
After publication, unlink/chmod/run-fsync/parent-fsync failures are collected as
operation/code/message warnings and return committed:true. DurabilityConfirmed
is true only if both post-publication directory fsync calls succeeded. No false
promise remains that every callback-failed or interrupted writer is unsealed.
Reader checks content, not fsync history or authenticity. Process death after
publication remains distinct from the caller receiving a successful outcome.

Actual existing Node24.21.0 offline checks, all exit0:

- Author offline-publication: prelink EIO rejected/unsealed; postlink unlink,
  chmod and fsync faults return committed with correct warnings/durability;
  read verification and duplicate rejection retained.
- Retained independent offline-review: prepublication directory fsync EIO denies
  sealed read; run-only and parent-only postpublication fsync failures each set
  durabilityConfirmed=false with exact distinct warning; combined unlink+chmod
  failures preserve both warnings; readable INCOMPLETE qualification unchanged,
  every reserved run remains non-reusable.
- Original offline-disk: PASS real Git source/lock drift and transition mutation,
  complete12/failure2 stub bundles, raw/hash/seal/tamper/unsealed protections.
- Original offline-stub: PASS exact12/overrides, all12 failfast cases, canonical
  receipt/argument defenses and teardown/admission stale-source denial.
- Store syntax and diff checks PASS. Repair diff leaves market-stages,
  verify-market-local and market-composition unchanged from its parent.

## Integration gap remains, not approved

`compose` still awaits `persist(...)` in finally without retaining its returned
outcome. It therefore does NOT surface or join committed warnings and durability
status into its returned manifest. The store API repair is sound in isolation;
composition success must NOT be taken as durable evidence completion. A concrete
caller must inspect/retain returned outcome, distinguish publication from durable
completion, and fail or mark qualification incomplete as appropriate. This is an
explicit remaining integration requirement before overall432 acceptance, not
approval of the current composition caller. No actual caller qualification was
executed, and source core does not emit PASS.

Owner/root can rewrite content/seals; no filesystem immutability/authenticity
claim approved. Registry/DNS enforcement, local427 lifecycle/CLI wiring, final
nested transport review and actual dependency/generated-client/runtime provenance
remain incomplete. QA438 exact-successor review separate. Full-market NO-GO.
No runtime/network/services/DB/install/config/spend/push/merge/deploy performed.
