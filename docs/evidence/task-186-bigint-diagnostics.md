# Task 186: lossless fixture-local BigInt diagnostics

Base `4e3664d719c301159b40a58a2fc684c4d84ab905`; branch
`tixmo/task-186-bigint-diagnostics`, isolated worktree `task-186`.
No task184 changes carried. Read137/138/143 history; historic old-processing
baseline intentionally includes conflicting recovery observations/oracle, not a
fix-ready green recovery test. Those native durable assertions remain byte-identical.

One diagnostic line changed at payment-old-processing.baseline.test.ts:43:
local JSON.stringify replacer converts only bigint to decimal string, matching
payment-expired-successor test's existing local diagnostic pattern. No Number
conversion, global prototype, source, config/schema/locks/manifests changed.

Fresh baseline: `timeout 10s node` with node:assert/node:vm evaluated the actual
extracted original console diagnostic JSON.stringify expression against mocked
before/after rows carrying 9007199254740993n and9223372036854775807n. It threw
TypeError mentioning BigInt; assert.throws passed, process exit0. This is expected
serialization-failure reproduction, NOT a failing SQL/Jest test run.

Fresh repaired same-expression probe: exit0, both ancient=false/true controls
passed exact decimal values beyond Number.MAX_SAFE_INTEGER, signed PG BIGINT
maximum, nested array generations0n/9007199254740995n; dates retained ISO strings,
numeric inventory/counts and booleans unchanged; original native bigint objects
unchanged and BigInt.prototype.toJSON remains undefined. No dependencies needed.
`git diff --check` exit0. Reproducible combined command (baseline+candidate):

```sh
timeout 10s node <<'JS'
const fs=require('fs'),vm=require('vm'),assert=require('assert'),cp=require('child_process');
const p='tixmoapi2/tests/integration/payment-old-processing.baseline.test.ts';
const extract=s=>{const l=s.split('\n').find(x=>x.includes("console.log('TASK137_DURABLE'"));return l.slice(l.indexOf('JSON.stringify'),l.lastIndexOf(')'));};
const baseline=extract(cp.execFileSync('git',['show','4e3664d719c301159b40a58a2fc684c4d84ab905:'+p],{encoding:'utf8'}));
const candidate=extract(fs.readFileSync(p,'utf8'));
for(const ancient of [false,true]) {
 const beforeEvent={attemptGeneration:9007199254740993n,processingStartedAt:new Date('2000-01-01T00:00:00.000Z')};
 const row={attemptGeneration:9223372036854775807n,nested:{generations:[0n,9007199254740995n]}};
 const input={ancient,beforeEvent,target:{status:'PENDING'},otherBefore:{},beforeInventory:{quantityHeld:4},row,a:{status:'PAID'},b:{},inventory:{quantityHeld:2},email:{mock:{calls:[[]]}}};
 assert.throws(()=>vm.runInNewContext(baseline,input),/BigInt/);
 const parsed=JSON.parse(vm.runInNewContext(candidate,input));
 assert.strictEqual(parsed.before.event.attemptGeneration,'9007199254740993');
 assert.strictEqual(parsed.after.event.attemptGeneration,'9223372036854775807');
 assert.deepStrictEqual(parsed.after.event.nested.generations,['0','9007199254740995']);
 assert.strictEqual(parsed.before.event.processingStartedAt,'2000-01-01T00:00:00.000Z');
 assert.strictEqual(parsed.ancient,ancient); assert.strictEqual(parsed.emails,1);
 assert.strictEqual(parsed.before.inventory.quantityHeld,4);
 assert.strictEqual(beforeEvent.attemptGeneration,9007199254740993n);
 assert.strictEqual(row.attemptGeneration,9223372036854775807n);
 assert.strictEqual(typeof row.attemptGeneration,'bigint');
}
assert.strictEqual(BigInt.prototype.toJSON,undefined);
console.log('PASS original BigInt failure and lossless candidate serialization, both controls');
JS
```

No DB/Jest/API/full-market gate, migrations, services, dependency install, or
runtime grant. Serialization regression only; no SQL assertions or recovery
behavior claimed green. Independent exact-SHA lead and QA required before PM
closure. Unmerged and undeployed.


## Task191 independent QA: APPROVE scoped diagnostic repair

Reviewer tixmo-qa; exact `d3a684cf55836ef70842d3b5d33b8d06da5b9a1b`, base
`4e3664d719c301159b40a58a2fc684c4d84ab905`. New isolated branch
`tixmo/review-191`, worktree `worktrees/review-191`. Independent lead190 evidence
`daf829d83da0696828d9dc480f4c1f9b7291ebba` read; checks below independently run.
Shared main untracked AGENTS/docs-team left untouched. Target diff exactly two
paths: this author report and one diagnostic line in old-processing fixture.

Local replacer changes only BigInt diagnostic output into lossless decimal strings,
without Number conversion, prototype/global mutation or product changes. Complete
fixture bytes excluding only its single TASK137_DURABLE console line independently
compared equal to base, retaining setup/cleanup, both ancient schedules, all durable
assertions and native state comparisons. No SQL oracle edited or weakened; ancient
historical conflicting baseline/recovery assertions are still present. Serialization
success does not imply those assertions now pass on enabled recovery.

### Commands and actual output

From review root, extracted the exact documented shell block above to
`/tmp/tixmo-191-probe.sh` and ran `bash /tmp/tixmo-191-probe.sh`. Its actual command
is the complete `timeout 10s node` here-document above, using baseline git-show and
candidate actual-expression extraction, no serializer reimplementation. **Exit0**;
raw `docs/team/evidence/task-191-expression.log`:

```text
PASS original BigInt failure and lossless candidate serialization, both controls
```

Original expression throws on BigInt for each ancient=false/true; candidate preserves
exact9007199254740993/9223372036854775807 and nested0/9007199254740995, date ISO,
boolean ancient, numerical counts/inventory and native input BigInts. Baseline red
means expected serialization exception, not a failed Jest or database run.

Supplemental `/tmp/tixmo-191-strict.sh` is the same extracted command with only
assert.throws predicate changed to `error=>error.name==='TypeError' && /BigInt/.test(error.message)`
and extra assertions `assert.deepStrictEqual(row.nested.generations,[0n,9007199254740995n]); assert.strictEqual(parsed.after.inventory.quantityHeld,2)`.
Run `bash /tmp/tixmo-191-strict.sh`, **exit0**, raw
`docs/team/evidence/task-191-strict.log`:

```text
PASS strict TypeError and native nested preservation ancient=false
PASS strict TypeError and native nested preservation ancient=true
PASS original BigInt failure and lossless candidate serialization, both controls
```

Both scripts use the same bounded10s node command. VM exception name is checked
rather than host instanceof because VM has separate intrinsic constructors.
BigInt.prototype.toJSON remains undefined; no global patch introduced.

Byte comparison command was Python: read base with
`subprocess.check_output(['git','show','4e3664d:'+p])`, candidate `Path(p).read_bytes()`,
remove only lines containing `console.log('TASK137_DURABLE'` using
`splitlines(keepends=True)`, require exactly one such line in each, assert remaining
bytes equal. Actual output `PASS every non-diagnostic fixture byte identical`.
`git diff --check`, `git diff --exit-code d3a684c -- tixmoapi2` exit0;
`git diff --name-only 4e3664d d3a684c` reports only two expected paths.

No modules/install/DB/services/Jest/build/SQL/full-market execution or recovery green
claimed. Evidence-only review adds report/logs; candidate fixture untouched.191
review complete,186 remains for PM closure;175/177 nonpassing/release NO-GO.
