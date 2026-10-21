import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {localStageSession} from '../../../../scripts/market-local-session.mjs';
import {steps} from '../../../../scripts/market-stages.mjs';
let count=0;
const pass=name=>{count++; console.log(`PASS ${count} ${name}`)};
const baseline=structuredClone(steps), identity={source:'offline'};
function fixture(extra={}) {const calls=[];const env={NODE_ENV:'test',MARKER:'original'};const session=localStageSession({root:'/offline',identity,env,capture:()=>identity,assertOwnedRuntime:async()=>{},closeOwnedRuntime:async()=>{},spawn:(command,args,options)=>{calls.push({command,args,options});return {status:0,stdout:'\0raw Ω',stderr:'err\0終'}},...extra});return {session,calls,env};}
for(let target=2;target<12;target++) {
 let release,hold=false;
 const {session,calls,env}=fixture({assertOwnedRuntime:()=>hold?new Promise(r=>release=r):Promise.resolve()});
 for(let i=2;i<target;i++) await session.run(structuredClone(baseline[i]));
 hold=true;const caller=structuredClone(baseline[target]);const pending=session.run(caller);
 caller.command='unreviewed';caller.args.splice(0,caller.args.length,'bad');caller.environment={NODE_ENV:'bad',INJECTED:'bad'};
 steps[target].command='import-mutated';steps[target].args.push('bad');steps[target].environment={NODE_ENV:'bad',INJECTED:'bad'};env.MARKER='mutated';
 release(); const result=await pending;const actual=calls.at(-1);
 assert.equal(actual.command,baseline[target].command);assert.deepEqual(actual.args,baseline[target].args);
 assert.deepEqual(actual.options.env,{NODE_ENV:'test',MARKER:'original',...baseline[target].environment});
 assert.equal(result.stdout,'\0raw Ω');assert.equal(result.stderr,'err\0終');
 assert.equal(actual.options.shell,false);assert.equal(actual.options.encoding,'utf8');
 Object.keys(steps[target]).forEach(k=>delete steps[target][k]);Object.assign(steps[target],structuredClone(baseline[target]));
 await session.close();pass(`stage ${target+1} caller/import/args/env await mutation pinned, raw receipts`);
}
for(let fail=0;fail<10;fail++) {let n=0;const {session}=fixture({spawn:()=>({status:n++===fail?9:0})});for(let i=0;i<=fail;i++) await session.run(baseline[i+2]);await assert.rejects(session.run(baseline[Math.min(fail+3,11)]));assert.equal(n,fail+1);await session.close();pass(`failfast position ${fail+1}`)}
for(const kind of ['pre-source','post-source','authority']) {let drift=false;const {session,calls}=fixture({capture:()=>kind==='pre-source'||drift?{}:identity,assertOwnedRuntime:async()=>{if(kind==='authority')throw Error('denied');if(kind==='post-source')drift=true}});await assert.rejects(session.run(baseline[2]));assert.equal(calls.length,0);await session.close();pass(`${kind} zero child`)}
{let release,n=0;const {session,calls}=fixture({assertOwnedRuntime:()=>new Promise(r=>release=r),closeOwnedRuntime:async()=>{n++}});const pending=session.run(baseline[2]);await assert.rejects(session.run(baseline[2]));await assert.rejects(session.close());release();await pending;await Promise.all([session.close(),session.close()]);assert.equal(n,1);assert.equal(calls.length,1);await assert.rejects(session.run(baseline[3]));pass('active concurrent run/close rejected; cleanup once; postclose denied')}
for(const result of [{status:0,error:Error('overflow')},{status:0,signal:'SIGTERM'},null]) {const {session,calls}=fixture({spawn:()=>{if(result===null)throw Error('spawn');return result}});const receipt=await session.run(baseline[2]);assert.ok(receipt.error||receipt.signal);await assert.rejects(session.run(baseline[3]));await session.close();pass('error/signal/throw fail closed')}
for(const file of ['scripts/verify-market-local.mjs','scripts/market-stages.mjs','scripts/verify-api.mjs','docs/team/evidence/task-427/run-gate.mjs']) {assert.equal(execFileSync('git',['diff','d2e0dbdf','HEAD','--',file],{encoding:'utf8'}),'')};assert.equal(steps.length,12);pass('root12/default/nested4/run-gate exact source unchanged');
const shell=fs.readFileSync('docs/team/evidence/task-427/runtime.sh','utf8');
assert.ok(shell.indexOf('task432_identity=$(')<shell.indexOf('--prepare'));
assert.ok(shell.indexOf('fs.fsyncSync(fd)')<shell.indexOf('"$pgbin/initdb"'));pass('static capture before preparation and publish before initdb');
const start=shell.indexOf("  import fs from \"node:fs\";",shell.indexOf('TASK432_SOURCE_IDENTITY="$task432_identity"'));
const end=shell.indexOf("\n'",start);let snippet=shell.slice(start,end).replace('import { snapshot } from "./scripts/market-composition.mjs";','const snapshot = () => ({source:"offline"});');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tixmo456-'));
const result=spawnSync(process.execPath,['--input-type=module','-e',snippet],{cwd:temp,encoding:'utf8',env:{TASK432_SOURCE_IDENTITY:JSON.stringify(identity),TASK432_API_RECEIPTS:temp}});
assert.equal(result.status,1);assert.match(result.stderr,/ENOENT/);assert.match(result.stderr,/undefined\/api-identity.json/);
assert.ok(shell.indexOf('export TASK379_ARTIFACT_DIR=')>shell.indexOf('"$pgbin/initdb"'));
console.log('REPRODUCED BLOCKER: fresh scrubbed shell publication fails ENOENT undefined/api-identity.json before provisioning. Fixture replaces ONLY snapshot import, runs actual publication code, no services.');
fs.rmdirSync(temp);
console.log(`TOTAL ${count} PASS plus 1 reproduced blocker`);
