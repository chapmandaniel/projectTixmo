# Task 421: independent QA of exact cleanup and composed checkout

Verdict: APPROVE scoped task419 cleanup and composed task414 frontend/source
acceptance on exact `8aae387bcd4290edd259fd75aa11baaa1f62ca63`.
Parent independently asserted `4dde80623f21272f011fed3ff05c9ebb86bfb071`.
Reviewer tixmo-qa; new isolated branch `tixmo/task-421-independent-qa`, worktree
`/home/daniel/projects/projectTixmo/worktrees/task-421`. Evidence-only successor;
no source, baseline, checker, assertions or tests edited by reviewer.
PM owns closure of419/414; this report does not close them.

## Independent baseline proof

Read task421/419/414/417/418/420 notes, repository and role/workflow instructions,
full unchanged design guard, package scripts and Vite/Vitest configuration.
Guardrail `tdash/docs/dashboard-design-system.md:34` permits baseline updates
"only when intentionally accepting or clearing the tracked baseline". Task419
expressly scopes clearing obsolete debt, not adding exemptions or regenerating.

Actual Python assertions passed: exactly2 removed records,0 additions,926->924;
only arbitrary-color-utility records for src/features/WaitingRoomView.jsx,
`bg-[#0a0a0a]` old line6 and `bg-[#1a1a1a]` old line10. Both absent in current
source. All other fields (generatedAt/rules included), violation objects/order
unchanged. Literal deletion of exactly the two original serialized record blocks
produces byte-identical candidate baseline: every other byte preserved.
`git diff --name-only PARENT TARGET` exactly baseline and task419 author report;
therefore checker/rules/source/tests/assertions/dependency manifests unchanged.
Git baseline diff exactly16 removed lines,0 additions. Key reproducible proof
(run from worktree using Python3):

```python
import subprocess,json,pathlib
base='4dde80623f21272f011fed3ff05c9ebb86bfb071'
p='tdash/design-system-guard-baseline.json'
a=subprocess.check_output(['git','show',base+':'+p]); b=pathlib.Path(p).read_bytes()
x=json.loads(a); y=json.loads(b)
removed=[v for v in x['violations'] if v not in y['violations']]
added=[v for v in y['violations'] if v not in x['violations']]
assert len(removed)==2 and not added
assert {v['match'] for v in removed}=={'bg-[#0a0a0a]','bg-[#1a1a1a]'}
assert all(v['file']=='src/features/WaitingRoomView.jsx' and v['ruleId']=='arbitrary-color-utility' for v in removed)
assert {k:v for k,v in x.items() if k!='violations'}=={k:v for k,v in y.items() if k!='violations'}
assert y['violations']==[v for v in x['violations'] if v not in removed]
clean=a.decode()
for v in removed:
    block='    '+json.dumps(v,indent=2).replace('\n','\n    ')+',\n'
    assert block in clean
    clean=clean.replace(block,'',1)
assert clean.encode()==b
assert all(v['match'] not in pathlib.Path('tdash/src/features/WaitingRoomView.jsx').read_text() for v in removed)
```

## Fresh execution on exact candidate

Independently Python byte-compared both tdash/package.json and package-lock.json
with task315 AND task251. task315 node_modules resolves task251; selected actual
installed versions matched lock entries: React18.3.1, Axios1.20.0, Vitest4.1.11,
Vite6.4.3, @testing-library/react16.3.2, jsdom27.4.0. Existing deps only, no install.
Created owned local symlink with:
`ln -s /home/daniel/projects/projectTixmo/worktrees/task-251/tdash/node_modules tdash/node_modules`.
All npm commands used `env -i PATH="$PATH" HOME=/home/daniel` prefix:

- `npm --prefix tdash run design:guard`: PASS924 tracked violations, no regressions.
- `npm --prefix tdash test -- --run src/test/api-session-races.test.js src/test/AppCheckoutBusy.test.jsx src/test/AppSession.test.jsx src/test/AppCheckoutReturn.test.jsx src/test/CheckoutPage.test.jsx src/test/session.test.js`:
  PASS6 files54tests,4.67s. Suite counts respectively11/3/2/4/32/2.
- `npm --prefix tdash run build > /tmp/tixmo-421-build.log 2>&1`:
  successful Vite build,2137 modules,12.59s; no warning/error lines in log.
- `git diff --check`: exit0. Final staged/final checks and clean tree recorded
  with commit handoff. Owned dependency link removed via `unlink tdash/node_modules`.

Combined verification shell completed exit0; no verification failure. Individual
commands printed explicit guard/test/build success, not inferred from final tail.
One exploratory rg included nonexistent features/CheckoutPage.jsx alongside actual
pages/CheckoutPage.jsx and exited2; actual pages file was subsequently read.
This was an inspection path error, not a test failure.

## Composed checkout source and coverage

Inspected actual App, api interceptor, WaitingRoomView, CheckoutPage and integration
assertions. Busy event requires503 AND exact WAITING_ROOM_ACTIVE marker; delay
requires safe integer1..60, otherwise5. Stale-session rejection precedes busy
classification; refresh/session behavior retained. Unmarked503 and marker on500
remain generic visible errors. Axios adapter matrix verifies numeric7/string7/
negative/zero/61/unmarked/non503 cases, one dispatch/no replay, token retention;
separate stale marked503 case verifies no busy event after session replacement.

App mounts overlay outside route switch and retains checkout under inert wrapper;
no busy-driven navigation or auth/session mutation. WaitingRoomView countdown only
enables manual dismissal, never invokes writes. Wording makes no queue place,
fairness or reservation promise. Actual AppCheckoutBusy uses actual App and actual
CheckoutPage (not stub), actual Axios instance/interceptors with adapter, mocked
fetch/Stripe/auth. Both /orders and /payments/create-intent rejection paths assert
selected cart controls/signed-in state retained, token retained, countdown disabled,
no writes at countdown or dismissal, no Stripe confirmation, explicit manual submit
causes exactly one next write; held-order intent retry does not duplicate order.
Actual checkout unmarked503 produces generic visible feedback without busy dialog.
Existing CheckoutPage session/return suites also pass. Existing cartOrderId restore
may prepare an intent on initial restoration and pending order status polls are
GETs; the reviewed busy overlay/countdown introduces no automatic write replay.

## Limits

Original4dde guard FAIL from two resolved obsolete entries remains valid history;
this fresh candidate PASS does not rewrite it. No full frontend, API, real Redis,
real provider, browser/device, performance or capacity gate run; mock transport
and jsdom checks do not prove those. No DB/services/network/install/configuration,
scheduler/spend/push/merge/deploy. Shared main preexisting untracked files preserved.
