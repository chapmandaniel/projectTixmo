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
