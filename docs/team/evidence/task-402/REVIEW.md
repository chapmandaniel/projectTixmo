# Task 402 independent lead review — APPROVE

Reviewed exact `971275ba7c87b7d6d3d8831d6334922dcf618a05`, against base
`5a64d9739f148d966534ba802ddd162fc17e053d`, on isolated branch
`tixmo/review-402-native-http`, worktree `worktrees/review-402`.
Reviewer: tixmo-lead; not implementation author. No blocking findings.

## Technical findings

The only executable guard change admits `options.path === null` in addition
to absent path. Native Node HTTP Agent genuinely supplies null for TCP;
the new fixture exercises actual native GET/POST normalization, not manually
copied options. The existing exact IPv4 host and owned-port predicates remain
in the same rejection expression. Any other present path is still denied,
including empty, false, zero, Unix pathname and object/array values.
Normalized socket argument vectors retain the same checks.

Registration still requires a listening native HTTP Server and the captured
native address accessor, exact IPv4 127.0.0.1, integer port 1..65535, and no
duplicate port. Close-event and explicit revocation remain effective. Native
address/listening state is simulated only inside test fixtures; no kernel
listener ownership is established by this review.

Diff inspection confirms runtime, receipt schemas, cleanup observer and
integration assertions are unchanged. The 46-case cleanup regression passes;
this does not certify actual runtime cleanup or HTTP capacity.

## Independently executed commands and actual results

From this worktree, all Node/bash checks used `env -i PATH=/usr/bin:/bin`
followed by `/home/daniel/.nvm/versions/node/v24.21.0/bin/node` or `/bin/bash`.
No inherited NODE_OPTIONS, database target or .env was loaded.

- `node docs/team/evidence/task-401/native-http-regression.cjs`: exit 0;
  actual normalized host 127.0.0.1, port 33333, path null; 3 allowed stub
  transports, 11 denied targets, UDP denial and close revocation.
- `node docs/team/evidence/task-393/guard-regression.cjs`: exit 0;
  copied Jest env isolation, registration/revocation, vectors and denials;
  exactly 2 stub transports. Uses existing installed jest-util only.
- `node docs/team/evidence/task-393/cleanup-regression.cjs`: exit 0;
  46 receipt cases, stubbed observations only.
- `node docs/team/evidence/task-402/adversarial.cjs`: exit 0;
  22 denied cases covering invalid registration addresses/families/ports,
  duplicate registration, present malformed paths in normalized vectors,
  hostname/IPv6/external/unowned null-path targets, explicit revocation;
  exactly 1 allowed null-path vector stub transport.
- `node --check docs/team/evidence/task-379/network-guard.cjs`: exit 0.
- `node --check docs/team/evidence/task-401/native-http-regression.cjs`: exit 0.
- `bash -n docs/team/evidence/task-379/runtime.sh`: exit 0.
- `git diff --check 5a64d9739f148d966534ba802ddd162fc17e053d HEAD`: exit 0
  before this report-only commit.

## Limits and handoff

APPROVE is source/stub-only approval of the exact reviewed SHA, not of a
future revision or runtime. Author's before/after/check logs were inspected;
historical before failure was not independently rerun. No DB, network, DNS,
listener binding, service, install, config, provider, spend, push, merge or
deploy. No source rewrite or test weakening. Existing files preserved.

PM must obtain separately mandatory exact-SHA QA before closing task 401 or
authorizing a new task 390 runtime. Task 390/full 246 remain open; this review
does not convert prior failed capacity evidence into a pass.
