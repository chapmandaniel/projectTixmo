# Task393 source-only HTTP listener guard repair

Base: `b0d749d6962f75d6daee2836a4605e505daf4556`.
Branch: `tixmo/task-393-http-guard`; isolated `worktrees/task-393`.
Incorporates QA392 report at `d9d5c8636a26fa21d3474241221b231df115f347`
and failed runtime390 evidence `a085aa70eae8ae44f59d853e23b055c29dee32f8`.

## Root-cause proof before repair

Used installed task354 `jest-util.installCommonGlobals` to construct Jest's
actual copied process object in a VM global. Native env ports remained
`31001,41001` after Jest env appended `51001`. The original preloaded guard
rejected the exact `127.0.0.1:51001` target. Connector was replaced with a counter
before guard import: **no socket/listener/network call or service was created**.
This proves the previously hypothetical env visibility boundary; it reproduces
that cause rather than claiming an independently observed real HTTP success.
Initial diagnostic fixture lacked VM Symbol global and threw before inspection;
using VM globalThis fixed the fixture. No product workaround was needed.

## Bounded repair and ownership

Native built-in `net` owns a non-writable symbol registration function whose
closure crosses Jest's copied-process boundary. It accepts only a listening
HTTP Server, verifies native Server.address() is exact IPv4 `127.0.0.1` and
valid bound port, then admits only that port. Close automatically revokes it;
finally also revokes explicitly. No wildcard localhost, Unix, UDP, external,
IPv6, or unowned-port admission added. Existing PG/Redis and runtime path/PID
ownership guards and every HTTP/inventory/uniqueness/cancellation assertion
remain unchanged. Uses installed Node built-ins, not a new library/service.

Before registration, test persists Jest PID/PPID/executable/Linux proc stat
(start identity) and exact HTTP address in separate JSON receipts. cleanup.json
also retains identity, HTTP port and serverListening. Runner cleanup invokes
process-cleanup.cjs after Jest exits: records /proc absence and `ss` exact-port
rows to process-cleanup.json; missing/malformed receipt, retained PID, failed ss,
or occupied HTTP port fails cleanup. It never kills an unverified PID. Failure
before listener creation cannot yield complete cleanup evidence and fails closed.

## Actual focused checks, 2026-10-21

- `node docs/team/evidence/task-393/guard-regression.cjs`: exit0; retained
  regression.log. Installed Jest process-copy reproduction, explicit exact port
  registration, normalized connect-vector admission, automatic close revocation,
  idempotent explicit revoke, fake/non-listening server rejection, wildcard
  listener rejection, Unix/UDP/external/IPv6/unowned target rejection. Only two
  successful transports reach a counter stub, never the kernel connector.
- `bash -n docs/team/evidence/task-379/runtime.sh`: exit0.
- `node --check` network-guard.cjs and process-cleanup.cjs: exit0.
- Installed TypeScript transpileModule on changed integration test: zero syntax
  diagnostics (not a full typecheck or DB test).
- `git diff --check`: exit0.

## Limits and handoff

No services, DB, network, install/download/generation, config/provider/cloud,
production, spend, push, merge or deploy. No HTTP100 rerun or full API suite.
Cleanup observer is source-reviewed/syntax-checked only; actual new runtime
receipts must be independently checked after fresh sole-owner permission.
Lead AND QA must independently review the exact new source SHA before390 rerun.
390 and full246 remain OPEN; historical runtime failure is not a passing gate.
