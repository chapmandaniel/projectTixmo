import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {localStageSession} from '../../../../scripts/market-local-session.mjs';
import {steps} from '../../../../scripts/market-stages.mjs';
const expected=structuredClone(steps); const identity={fixture:'457'};
let checks=0;const pass=s=>console.log(`PASS ${++checks} ${s}`);
function setup(extra={}){const calls=[];let clean=0;const session=localStageSession({root:'/offline',identity,env:{NODE_ENV:'test'},capture:()=>identity,assertOwnedRuntime:async()=>{},closeOwnedRuntime:async()=>{clean++},spawn:(command,args,options)=>{calls.push({command,args,options});return {status:0,stdout:'raw\0😀',stderr:'err\0'}},...extra});return {session,calls,clean:()=>clean};}
{
 let release;const f=setup({assertOwnedRuntime:()=>new Promise(resolve=>release=resolve)});
 for(let i=2;i<12;i++){
  const caller=structuredClone(expected[i]);const running=f.session.run(caller);
  caller.command='changed-command';caller.args.splice(0,caller.args.length,'changed-arg');caller.environment={NODE_ENV:'changed',EXTRA:'changed'};
  steps[i].command='changed-import';steps[i].args.push('changed-import-arg');steps[i].environment={NODE_ENV:'changed-import'};
  release();const receipt=await running;const call=f.calls.at(-1);
  assert.equal(call.command,expected[i].command);assert.deepEqual(call.args,expected[i].args);assert.equal(call.options.env.NODE_ENV,expected[i].environment?.NODE_ENV??'test');assert.equal(call.options.env.EXTRA,undefined);assert.equal(receipt.stdout,'raw\0😀');assert.equal(receipt.stderr,'err\0');
  Object.keys(steps[i]).forEach(k=>delete steps[i][k]);Object.assign(steps[i],structuredClone(expected[i]));
  pass('caller command/args/environment and imported-step mutations pinned stage '+i);
 }
 await Promise.all([f.session.close(),f.session.close()]);assert.equal(f.clean(),1);await assert.rejects(f.session.run(expected[2]));pass('cleanup once and postclose denial');
}
for(let bad=0;bad<10;bad++){let n=0;const f=setup({spawn:()=>({status:n++===bad?17:0})});for(let i=0;i<=bad;i++)await f.session.run(expected[i+2]);await assert.rejects(f.session.run(expected[Math.min(bad+3,11)]));assert.equal(n,bad+1);pass('failfast position '+bad);}
for(const when of ['before','after','authority']){let changed=when==='before';const f=setup({capture:()=>changed?{}:identity,assertOwnedRuntime:async()=>{if(when==='authority')throw Error('denied');changed=true}});await assert.rejects(f.session.run(expected[2]));assert.equal(f.calls.length,0);pass('zerochild denial '+when);}
{
 let release;const f=setup({assertOwnedRuntime:()=>new Promise(resolve=>release=resolve)});const running=f.session.run(expected[2]);await assert.rejects(f.session.run(expected[2]));await assert.rejects(f.session.close());release();await running;await f.session.close();assert.equal(f.clean(),1);pass('active close/run race denied');
}
assert.equal(execFileSync('git',['diff','54d55c0b75ced9b87871607d00fbd767a4a63962','d6ad958ce3bda5659ad7c347a014dd78146b9640','--','scripts/market-stages.mjs','scripts/verify-market-local.mjs'],{encoding:'utf8'}),'');assert.equal(steps.length,12);pass('default12 unchanged');
console.log('TOTAL '+checks+' independent checks PASS');
