# Task294 R2 actual App -> real API wallet slice

Product stays `4ec8594850eb547dafc145a14bb1b85cdeaa235c`, prior checkpoint
`a48f0eeb064bc519f84d192aebae1083efc91abd` evidence unchanged. New test/harness only.

Reproduce from task294 worktree, with matching task235 cache symlinks for API
and tdash node_modules:

```
bash docs/team/evidence/task-294-r2/runtime.sh
```

New script is reviewed279R2 owned-runtime guard adapted to new disk
`workspace/runtime/task294-r2`, env-i, PG18/Redis/real mounted app. REDIS_DB=1
explicitly matches URL /1 and actual Redis client options database is asserted1.
Jest spawns a Node browser harness while real API stays alive. Actual App served
by own Vite (configFile:false, envFile:false) with sole proxy target exact owned
127.0.0.1 API origin. A preselected owned frontend port is configured via
Object.assign(test config,{clientUrl:exactOrigin}) before app/clientOrigin
import; no production source or CORS implementation changes.

CDP/createCDP/deadline/cleanup helpers copied from reviewed2806275325 support;
qualified launcher is task288/scripts/runtime/task-288-chromium. Profile is
0700 disk runtime. No API responses fulfilled/intercepted with synthetic data:
all allowed requests are continued to actual API. Other origins and unlisted
API mutations blocked. Audit records method/path/status, never JWT/passwords.
Synthetic fixture credentials are passed only child env; no inherited provider
or unknown target environment. Existing logger mock and inert Stripe constructor
and notificationService remain documented boundaries; no auth/password/session,
Prisma, Redis/rate-limit, QR generator or route/controller mocks.

## Executed browser scope

Actual BuyerAuthPanel A password login -> real wallet order -> real PNG QR;
SQL sessionVersion change -> actual Refresh401 + refresh401 -> identity/private
content cleared; A UI re-login -> same wallet recovered; revokeA again -> B UI
login -> empty B wallet -> real reload and no A order/QR. API assertions also
check B direct ticket/QR/order denial, wrong-password401 and expired-JWT401.
Finance invariant is unchanged seeded PAID order and ticket/attempt/refund counts,
plus all stub Stripe methods uncalled, NOT zero database writes (login lastLogin,
QR cache and explicit sessionVersion fixture updates are expected writes).

## Retained initial faults

initial-browser/failure.json: first attempt actual auth/login500 because the
new Vite origin was not in API trusted CORS config; no ownership bypass.
Cleanup verified. Bounded config-origin repair had TS2540 on readonly exported
config.clientUrl; typecheck-acceptance.log records no tests/browser executed.
Object.assign is test configuration before app imports, not an auth mock.
Final evidence remains separate from both failures.

## Limits

Seeded PAID/SUCCEEDED + SOLD fixture, NOT purchase/webhook/provider confirmation.
No checkout return-link/recovery route browser scenario, inbox/receipt delivery,
lost credential recovery, elapsed expiry waiting, process restart, real payment,
provider, staging or device acceptance. Browser session expiry is real middleware
rejection after explicit SQL revocation, not elapsed JWT time; API-only signed
expired JWT check is separately asserted. Full W05/production launch NO-GO.
Independent QA and technical review of exact new harness SHA required.

The subsequent identifier-overlap-browser run actually reached A login/QR,
revocation/private clear, A recovery, B login and B reload, but the final no-A
DOM assertion falsely matched the common fixture key inside B's email. Its
failure.json shows B's empty wallet and all real HTTP200/401. New fixture order
number has a distinct ORDER- prefix so no-A checks cannot match B's email;
assertion remains intact. Prior failure/screenshot/audit and cleanup retained.

Final author result: scoped actual App -> real backend browser slice PASS;
Jest1/1 PASS16.9s, four screenshots and complete HTTP audit in browser/.
cleanup.txt independently checks all four attempts' exact PG/Redis/API/browser
PIDs, all recorded TCP listeners, postmaster/socket/profile absence. Browser helper
awaits exact child exit and Vite close; parent Jest awaits browser-harness Node
exit0. Temporary dependency symlinks removed. Original checkpoint evidence
unchanged. Command-local missing Husky shim bypass as documented in prior
checkpoint; syntax/diff checks and fresh run used, no persistent config change.

Personally opened prior-run A QR and final B reload screenshots: text/QR and empty B wallet legible; no scanning/a11y/device certification. Log whitespace normalized only for Git diff check.
