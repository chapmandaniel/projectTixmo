import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {localStageSession} from '../../../../scripts/market-local-session.mjs';
import {steps} from '../../../../scripts/market-stages.mjs';
let count=0;const pass=s=>console.log(`PASS ${++count} ${s}`);
const identity={id:'lead455'};
function make(extra={}){const calls=[];let cleaned=0;const session=localStageSession({root:'/offline',identity,env:{NODE_ENV:'test'},capture:()=>identity,assertOwnedRuntime:async()=>{},closeOwnedRuntime:async()=>{cleaned++},spawn:(command,args,options)=>{calls.push({command,args,options});return {status:0,stdout:'lead\0raw😀',stderr:'stderr\0raw'}},...extra});return {session,calls,cleaned:()=>cleaned};}
{
 const f=make();for(const step of steps.slice(2)){const r=await f.session.run(structuredClone(step));assert.equal(r.stdout,'lead\0raw😀');assert.equal(r.stderr,'stderr\0raw');}
 assert.deepEqual(f.calls.map(({command,args})=>({command,args})),steps.slice(2).map(({command,args})=>({command,args})));assert.equal(f.calls[6].options.env.NODE_ENV,'production');assert.equal(f.calls[7].options.env.NODE_ENV,'test');pass('exact10 canonical order/rawNUL+Unicode and build-only override');
 await Promise.all([f.session.close(),f.session.close()]);assert.equal(f.cleaned(),1);await assert.rejects(f.session.run(steps[2]));pass('concurrent close one cleanup and closed run denial');
}
for(let bad=0;bad<10;bad++){let calls=0;const f=make({spawn:()=>({status:calls++===bad?41:0})});for(let i=0;i<=bad;i++)await f.session.run(structuredClone(steps[i+2]));await assert.rejects(f.session.run(steps[Math.min(bad+3,11)]));assert.equal(calls,bad+1);pass('failfast local position '+bad);}
for(const mode of ['before','after','denied']){let changed=mode==='before';const f=make({capture:()=>changed?{}:identity,assertOwnedRuntime:async()=>{if(mode==='denied')throw Error('denied');changed=true}});await assert.rejects(f.session.run(steps[2]));assert.equal(f.calls.length,0);pass(mode+' source/authority zero-child denial');}
{
 let release;const f=make({assertOwnedRuntime:()=>new Promise(resolve=>release=resolve)});const r=f.session.run(structuredClone(steps[2]));await assert.rejects(f.session.run(steps[2]));await assert.rejects(f.session.close());release();await r;await f.session.close();assert.equal(f.cleaned(),1);pass('active run/run+close race denies duplicate work/early cleanup');
}
{
 const shell=fs.readFileSync(new URL('../task-427/runtime.sh',import.meta.url),'utf8');assert(shell.indexOf('task432_identity=$(')<shell.indexOf('--prepare'));assert(shell.indexOf('Source changed before provisioning')<shell.indexOf('"$pgbin/initdb"'));assert(shell.indexOf('fs.fsyncSync(fd)')<shell.indexOf('"$pgbin/initdb"'));pass('static capture before prepare; source recheck+exclusive fsync before initdb');
 const diff=execFileSync('git',['diff','d2e0dbdfea93e4f6e4a21fdf4e4c0201611acce7','54d55c0b75ced9b87871607d00fbd767a4a63962','--','scripts/market-stages.mjs','scripts/verify-market-local.mjs'],{encoding:'utf8'});assert.equal(diff,'');assert.equal(steps.length,12);pass('default12/exactstage table unchanged');
}
{
 let release;const f=make({assertOwnedRuntime:()=>new Promise(resolve=>release=resolve)});const step=structuredClone(steps[2]);const r=f.session.run(step);step.command='UNREVIEWED_COMMAND';step.args=['UNREVIEWED_ARGUMENT'];release();await r;assert.equal(f.calls[0].command,'UNREVIEWED_COMMAND');assert.deepEqual(f.calls[0].args,['UNREVIEWED_ARGUMENT']);console.log('REPRODUCED canonical command TOCTOU: caller mutates step during awaited authority, mutated command+args execute');await f.session.close();
}
{
 const raw={status:0,stdout:Buffer.from('original'),stderr:Buffer.from('stderr')};const f=make({spawn:()=>raw});const result=await f.session.run(structuredClone(steps[2]));raw.stdout.fill(120);assert.equal(result.stdout.toString(),'xxxxxxxx');console.log('OBSERVED returned Buffer receipt aliases adapter storage (default utf8 spawn returns strings; not standalone default-path blocker)');await f.session.close();
}
console.log(`TOTAL ${count} independent checks PASS plus 1 reproduced canonical-execution defect and 1 alias observation`);
