# Task398 independent review preparation

Isolated branch `tixmo/task-398-independent-review`, baseline
`8b265cfafda374e676fc74ef96810d0b0171a68c`. Read exact lead394
`0cf55967f2af0ba0f541fe3373e71762560b628d` and QA395
`51c4d32bcfff5764aa2bd575d9c52be7976a9114` reports and retained reproductions.
No acceptance verdict is possible until PM supplies exact397 source SHA.

Existing installed Node VM/fs/child_process built-ins suffice; no dependency,
service or custom platform needed. Planned independent adversarial stub matrix:

- Positive complete current-run receipts, absent PID, exact empty ss result.
- Each receipt missing or invalid JSON, null/array/scalar; every required field
  removed, wrong-typed or malformed; valid-looking but inconsistent stat PID,
  PPID and start-time identity, executable mismatch; invalid integer bounds.
- Each duplicated process/run identity field conflicts across records.
- IPv6 family with IPv4 address, wildcard, IPv6, localhost and invalid ports.
- Internally consistent old invocation substituted, current marker missing or
  malformed, mismatched invocation or owned directory; current context cannot
  be inferred solely from supplied receipt pairs.
- Present/recycled PID always rejects; unavailable/nonzero ss and occupied port
  reject; observer can only invoke exact read-only ss query, never signal PID.
- Independently trace runner-created invocation through exported producer
  context into both receipts and observer's separately supplied current context.
- Native exact-loopback guard unchanged or independently rerun bounded stub
  checks; all HTTP100 expect-containing source lines unchanged versus baseline.
- Shell/JS syntax, installed TypeScript transpilation, git diff whitespace.

Limits: all filesystem/proc/ss interactions inside observer are stubs; no actual
server/listener, runtime grant, DB, services, networking, installs/downloads,
configuration, provider, spend, push, merge or deploy. Producer/runner source
inspection is not an actual runtime PASS. Original backend owns repairs; fresh
independent QA remains separate and PM owns implementation closure.
